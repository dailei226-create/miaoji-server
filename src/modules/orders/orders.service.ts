import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { OrderStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreatorsService } from '../creators/creators.service'
import { CreateOrderDto } from './dto'
import { randomBytes } from 'crypto'

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private creators: CreatorsService,
  ) {}

  /**
   * [BUGFIX] 计算有效价格：同时考虑作品自身折扣和活动折扣
   */
  private getEffectivePrice(
    work: {
      price?: number | null
      discountPrice?: number | null
      discountStartAt?: Date | string | null
      discountEndAt?: Date | string | null
    },
    activityDiscount?: number | null
  ) {
    const price = typeof work?.price === 'number' ? work.price : 0
    const now = new Date()

    // 1. 作品自身折扣
    let workDiscountPrice: number | null = null
    const discountPrice =
      typeof work?.discountPrice === 'number' ? work.discountPrice : null
    const startAt = work?.discountStartAt ? new Date(work.discountStartAt) : null
    const endAt = work?.discountEndAt ? new Date(work.discountEndAt) : null
    if (discountPrice != null && startAt && endAt && now >= startAt && now <= endAt) {
      workDiscountPrice = discountPrice
    }

    // 2. 活动折扣（如果参加了当前生效活动）
    let activityPrice: number | null = null
    if (activityDiscount != null && activityDiscount >= 1 && activityDiscount <= 100) {
      activityPrice = Math.round((price * activityDiscount) / 100)
    }

    // 取更低者（更利于买家）
    const candidates = [price]
    if (workDiscountPrice != null) candidates.push(workDiscountPrice)
    if (activityPrice != null) candidates.push(activityPrice)
    return Math.min(...candidates)
  }

  /**
   * 查询作品的活动折扣（如果参加了当前生效活动）
   */
  private async getActivityDiscount(workId: string): Promise<number | null> {
    try {
      const now = new Date()
      // 查找所有当前生效活动
      const activities = await this.prisma.activity.findMany({
        where: {
          enabled: true,
          AND: [
            { OR: [{ startAt: null }, { startAt: { lte: now } }] },
            { OR: [{ endAt: null }, { endAt: { gte: now } }] },
          ],
        },
      })
      if (activities.length === 0) return null

      const activityIds = activities.map((a) => a.id)
      // 查找这个作品在任一生效活动的参加记录（只查未退出的）
      const join = await this.prisma.activityJoin.findFirst({
        where: {
          activityId: { in: activityIds },
          workId,
          leftAt: null,
        },
      })
      if (join) {
        return join.discount
      }
    } catch (e) {
      console.error('[getActivityDiscount] error:', e)
    }
    return null
  }

  /**
   * 从 opLogs 聚合最新一条 after_sale_seller_decision
   */
  private getAfterSaleSellerDecision(opLogs: { action: string; createdAt: Date; payloadJson?: any }[]): any {
    if (!opLogs || !Array.isArray(opLogs)) return null
    const logs = opLogs.filter((l) => l.action === 'after_sale_seller_decision')
    if (logs.length === 0) return null
    const latest = logs.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
    const p = latest.payloadJson as any
    if (!p) return null
    return {
      decision: p.decision || null,
      reason: p.reason ?? null,
      returnAddress: p.returnAddress ?? null,
      decidedAt: p.decidedAt ?? null,
      opCreatedAt: latest.createdAt ? new Date(latest.createdAt).toISOString() : null,
    }
  }

  private sanitizeItems(items: any[]) {
    return (items || []).map((item) => {
      let cover = item.coverSnap || ''
      if (
        cover &&
        (cover.includes('http://tmp/') ||
          cover.includes('/_tmp/') ||
          cover.includes('/tmp/') ||
          cover.includes('127.0.0.1:61120') ||
          cover.startsWith('wxfile://'))
      ) {
        cover = null
      }
      return { ...item, coverSnap: cover }
    })
  }

  // 创建订单：生成订单 + 生成订单项
  async create(userId: string, dto: CreateOrderDto) {
    const workId = dto.workId
    const qty = (dto as any).qty ?? (dto as any).quantity ?? (dto as any).count ?? 1
    const addressId = dto.addressId
    const snapshotFromDto = (dto as any).addressSnapshot

    if (!workId || qty < 1) {
      throw new BadRequestException('参数错误')
    }
    if (!addressId) {
      throw new BadRequestException('请先添加收货地址')
    }

    // [BUGFIX] 在事务之前查询活动折扣
    const activityDiscount = await this.getActivityDiscount(workId)

    // 先查作品获取 sellerId，然后检查卖家状态
    const workForSeller = await this.prisma.work.findUnique({ where: { id: workId } })
    if (!workForSeller) throw new NotFoundException('作品不存在')
    const sellerId = workForSeller.creatorId && String(workForSeller.creatorId) ? String(workForSeller.creatorId) : userId

    // [卖家管理] 检查卖家状态
    if (sellerId !== userId) {
      const sellerCheck = await this.creators.checkSellerCanOperate(sellerId)
      if (!sellerCheck.ok) {
        throw new BadRequestException(sellerCheck.message || '卖家不可接单')
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 查作品
      const work = await tx.work.findUnique({
        where: { id: workId },
      })
      if (!work) throw new NotFoundException('作品不存在')
      const stock = typeof work.stock === 'number' ? work.stock : 0
      if (qty > stock) throw new BadRequestException('out_of_stock')

      // 生成唯一订单号
      const orderNo = `MO${Date.now()}${randomBytes(4).toString('hex')}`
      // [BUGFIX] 使用活动折扣计算有效价格
      const unitPrice = this.getEffectivePrice(work, activityDiscount)
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new BadRequestException('invalid_price')
      }
      const amount = Math.max(0, unitPrice) * qty

      // 订单地址快照：优先使用前端传入的完整快照（name/phone/province/city/detail），否则仅存 id
      const addressSnapshot =
        snapshotFromDto && typeof snapshotFromDto === 'object' && (snapshotFromDto.name || snapshotFromDto.phone)
          ? { id: addressId, ...snapshotFromDto }
          : addressId
            ? { id: addressId }
            : {}

      // 创建订单 + 订单项
      const order = await tx.order.create({
        data: {
          orderNo,
          buyerId: userId,
          sellerId,
          status: 'created',
          amount,
          addressSnapshot,
          items: {
            create: [
              {
                workId: work.id,
                titleSnap: work.title || work.id,
                priceSnap: Math.max(0, unitPrice),
                qty,
                coverSnap: work.coverUrl || null,
              },
            ],
          },
        },
        include: { items: true },
      })

      return {
        ...order,
        out_trade_no: order.orderNo,
      }
    })
  }

  // 模拟支付：如果订单已 paid 直接返回；否则改为 paid
  async mockPay(userId: string, orderId: string) {
    if (!orderId) throw new BadRequestException('参数错误')

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    if (!order) throw new NotFoundException('订单不存在')
    if (order.buyerId !== userId) throw new ForbiddenException('无权限')

    if (order.status === 'paid') return order
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: 'paid' },
        include: { items: true },
      })
      for (const item of updated.items || []) {
        const qty = item.qty || 0
        const res = await tx.work.updateMany({
          where: { id: item.workId, stock: { gte: qty } },
          data: { stock: { decrement: qty } },
        })
        if (!res || res.count === 0) {
          throw new BadRequestException('out_of_stock')
        }
      }
      return {
        ...updated,
        items: this.sanitizeItems(updated.items),
        canPay: updated.status === 'created',
        payable: updated.status === 'created',
        totalAmount: updated.amount,
      }
    })
  }

  // 取消订单：仅 created 可取消
  async cancel(userId: string, orderId: string) {
    if (!orderId) throw new BadRequestException('参数错误')
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    })
    if (!order) throw new NotFoundException('订单不存在')
    if (order.buyerId !== userId) throw new ForbiddenException('无权限')
    if (order.status !== 'created') {
      throw new BadRequestException('status_not_allowed')
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'canceled' },
    })
  }

  // 买家订单列表
  async listBuyer(userId: string) {
    // [DEBUG] 临时日志 - 验证后删除
    console.log('[listBuyer] userId =', userId)
    const items = await this.prisma.order.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    })
    console.log('[listBuyer] found', items.length, 'orders')

    // 统计每笔订单的“退款申请次数”（买家端 request-refund 提交次数）
    const orderIds = items.map((x) => x.id)
    const applyCountMap: Record<string, number> = {}
    if (orderIds.length > 0) {
      const groups = await this.prisma.orderOpLog.groupBy({
        by: ['orderId'],
        where: { orderId: { in: orderIds }, action: 'refund_request_buyer' },
        _count: { _all: true },
      })
      for (const g of groups) {
        applyCountMap[g.orderId] = g._count._all
      }
    }

    return {
      items: items.map((order) => ({
        ...order,
        items: this.sanitizeItems(order.items),
        canPay: order.status === 'created',
        payable: order.status === 'created',
        totalAmount: order.amount,
        refundApplyCount: applyCountMap[order.id] || 0,
      })),
    }
  }

  // 用户订单列表（买家或卖家）
  async listByUser(userId: string) {
    const items = await this.prisma.order.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    })
    return {
      items: items.map((order) => ({
        ...order,
        items: this.sanitizeItems(order.items),
        canPay: order.status === 'created',
        payable: order.status === 'created',
        totalAmount: order.amount,
      })),
    }
  }

  // 卖家订单列表：按 sellerId 过滤，支持 ?status=created|paid|canceled
  async listSeller(userId: string, status?: string) {
    const allowed = new Set<OrderStatus>([OrderStatus.created, OrderStatus.paid, OrderStatus.canceled])
    const st = status ? String(status) : ''
    const stEnum = allowed.has(st as OrderStatus) ? (st as OrderStatus) : undefined
    const where: { sellerId: string; status?: OrderStatus } = { sellerId: userId }
    if (stEnum) where.status = stEnum

    const items = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true, refund: true, opLogs: { orderBy: { createdAt: 'desc' } } },
    })
    return {
      items: items.map((order) => {
        const afterSaleSellerDecision = this.getAfterSaleSellerDecision(order.opLogs)
        return {
          ...order,
          items: this.sanitizeItems(order.items),
          canPay: order.status === 'created',
          payable: order.status === 'created',
          totalAmount: order.amount,
          afterSaleSellerDecision,
        }
      }),
    }
  }

  // 订单详情：买家或卖家可看
  async detail(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, refund: true, opLogs: { orderBy: { createdAt: 'desc' } } },
    })
    if (!order) throw new NotFoundException('订单不存在')
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('无权限')
    }
    const canPay = order.status === 'created'
    const afterSaleSellerDecision = this.getAfterSaleSellerDecision(order.opLogs)
    return {
      ...order,
      items: this.sanitizeItems(order.items),
      canPay,
      payable: canPay,
      totalAmount: order.amount,
      afterSaleSellerDecision,
    }
  }

  // 占位：已发货（不新增表，备注写入 addressSnapshot）
  async markShipped(
    userId: string,
    orderId: string,
    expressCompany?: string,
    expressNo?: string
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('订单不存在')
    // 只允许卖家操作
    if (order.sellerId !== userId) {
      throw new ForbiddenException('无权限操作此订单')
    }
    // [卖家管理] 检查卖家状态
    const sellerCheck = await this.creators.checkSellerCanOperate(userId)
    if (!sellerCheck.ok) {
      throw new BadRequestException(sellerCheck.message || '卖家不可发货')
    }
    // 只有 paid 状态可发货
    if (order.status !== OrderStatus.paid) {
      throw new BadRequestException('订单状态不允许发货')
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.shipped,
        expressCompany: expressCompany || null,
        expressNo: expressNo || null,
        shippedAt: new Date(),
      },
    })
  }

  // 占位：售后中（不新增表，备注写入 addressSnapshot）
  async markAfterSale(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('订单不存在')
    const snapshot = (order.addressSnapshot as any) || {}
    return this.prisma.order.update({
      where: { id: orderId },
      data: { addressSnapshot: { ...snapshot, mvpNote: 'after_sale' } },
    })
  }

  // ========== 管理员操作 ==========

  // 管理员订单列表（支持筛选）
  async adminList(query?: { status?: string; q?: string; page?: number; pageSize?: number }) {
    const { status, q, page = 1, pageSize = 20 } = query || {}
    
    const where: any = {}
    if (status && status !== 'all') {
      where.status = status
    }
    if (q) {
      where.OR = [
        { orderNo: { contains: q } },
        { buyerId: { contains: q } },
      ]
    }

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: true, refund: true, opLogs: { orderBy: { createdAt: 'desc' } } },
      }),
      this.prisma.order.count({ where }),
    ])

    const items = rows.map((order) => ({
      ...order,
      afterSaleSellerDecision: this.getAfterSaleSellerDecision(order.opLogs),
    }))

    return { items, total, page, pageSize }
  }

  // 管理员订单详情
  async adminDetail(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        items: true, 
        refund: true, 
        opLogs: { orderBy: { createdAt: 'desc' } },
        buyer: { select: { id: true, nickname: true, openId: true } },
        seller: { select: { id: true, nickname: true, openId: true } },
      },
    })
    if (!order) throw new NotFoundException('订单不存在')
    return {
      ...order,
      afterSaleSellerDecision: this.getAfterSaleSellerDecision(order.opLogs),
    }
  }

  // 写操作日志
  private async writeOpLog(orderId: string, action: string, payload?: any, adminId?: string) {
    await this.prisma.orderOpLog.create({
      data: {
        orderId,
        action,
        payloadJson: payload || null,
        adminId: adminId || null,
      },
    })
  }

  // 管理员关闭订单（仅 created -> canceled）
  async adminCancel(orderId: string, note?: string, adminId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('订单不存在')
    if (order.status !== 'created') {
      throw new BadRequestException('仅待付款订单可关闭')
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'canceled' },
    })
    await this.writeOpLog(orderId, 'cancel', { note }, adminId)
    return updated
  }

  // 管理员发货（仅 paid -> shipped）
  async adminShip(orderId: string, data: { expressCompany?: string; expressNo?: string; note?: string }, adminId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('订单不存在')
    if (order.status !== 'paid') {
      throw new BadRequestException('仅已付款订单可发货')
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { 
        status: 'shipped',
        expressCompany: data.expressCompany || null,
        expressNo: data.expressNo || null,
        shippedAt: new Date(),
      },
    })
    await this.writeOpLog(orderId, 'ship', data, adminId)
    return updated
  }

  // 管理员完成订单（统一口径下仅允许 received -> completed）
  async adminComplete(orderId: string, note?: string, adminId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('订单不存在')
    // 交易完成以“买家确认收货”为准；管理员仅允许在 received 状态下补单。
    if (order.status !== 'received') {
      throw new BadRequestException('仅已收货订单可完成')
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { 
        status: 'completed',
        completedAt: new Date(),
      },
    })
    await this.writeOpLog(orderId, 'complete', { note }, adminId)
    return updated
  }

  // 发起退款申请（paid/shipped -> refund_requested）
  async adminRefundRequest(orderId: string, data: { reason?: string; note?: string }, adminId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { refund: true } })
    if (!order) throw new NotFoundException('订单不存在')
    if (!['paid', 'shipped'].includes(order.status)) {
      throw new BadRequestException('仅已付款或已发货订单可申请退款')
    }
    if (order.refund) {
      throw new BadRequestException('已存在退款申请')
    }

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'refund_requested' },
      }),
      this.prisma.orderRefund.create({
        data: {
          orderId,
          status: 'requested',
          reason: data.reason || null,
          requestNote: data.note || null,
        },
      }),
    ])
    await this.writeOpLog(orderId, 'refund_request', data, adminId)
    return this.adminDetail(orderId)
  }

  // 同意退款（refund_requested -> refund_approved）
  async adminRefundApprove(orderId: string, note?: string, adminId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { refund: true } })
    if (!order) throw new NotFoundException('订单不存在')
    if (order.status !== 'refund_requested') {
      throw new BadRequestException('仅退款申请中的订单可同意')
    }

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'refund_approved' },
      }),
      this.prisma.orderRefund.update({
        where: { orderId },
        data: { 
          status: 'approved',
          decisionNote: note || null,
          decidedAt: new Date(),
        },
      }),
    ])
    await this.writeOpLog(orderId, 'refund_approve', { note }, adminId)
    return this.adminDetail(orderId)
  }

  // 拒绝退款（refund_requested -> refund_rejected）
  async adminRefundReject(orderId: string, data: { reason: string; note?: string }, adminId?: string) {
    if (!data.reason) {
      throw new BadRequestException('拒绝理由必填')
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { refund: true } })
    if (!order) throw new NotFoundException('订单不存在')
    if (order.status !== 'refund_requested') {
      throw new BadRequestException('仅退款申请中的订单可拒绝')
    }

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'refund_rejected' },
      }),
      this.prisma.orderRefund.update({
        where: { orderId },
        data: { 
          status: 'rejected',
          decisionNote: `${data.reason}${data.note ? '\n' + data.note : ''}`,
          decidedAt: new Date(),
        },
      }),
    ])
    await this.writeOpLog(orderId, 'refund_reject', data, adminId)
    return this.adminDetail(orderId)
  }

  // 执行退款（本期禁用）
  async adminRefundExecute(orderId: string) {
    throw new ForbiddenException('退款未开启（部署后接微信退款）')
  }

  // 更新运营备注
  async adminUpdateNote(orderId: string, note: string, adminId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('订单不存在')

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { adminNote: note },
    })
    await this.writeOpLog(orderId, 'note', { note }, adminId)
    return updated
  }

  // ========== 买家端接口 ==========

  // 确认收货（买家）
  async confirmReceipt(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('订单不存在')
    if (order.buyerId !== userId) throw new BadRequestException('无权操作此订单')
    // 幂等：重复点击/重复请求不应重复写 receivedAt/completedAt
    if (order.status === 'received' || order.status === 'completed') {
      return { ok: true, status: order.status }
    }
    if (order.status !== 'shipped') {
      throw new BadRequestException('订单状态不允许确认收货')
    }

    const now = new Date()
    const updated = await this.prisma.$transaction(async (tx) => {
      // Step 1: 仅 shipped -> received（并发下用 updateMany 保证只写一次）
      const step1 = await tx.order.updateMany({
        where: { id: orderId, status: 'shipped' },
        data: { status: 'received', receivedAt: now },
      })
      if (step1.count === 0) {
        // 可能并发已处理；再次读取确认幂等返回
        const latest = await tx.order.findUnique({ where: { id: orderId } })
        if (!latest) throw new NotFoundException('订单不存在')
        if (latest && (latest.status === 'received' || latest.status === 'completed')) {
          return latest
        }
        throw new BadRequestException('订单状态不允许确认收货')
      }

      // Step 2: 自动升级为 completed（交易完成），仅 received -> completed
      await tx.order.updateMany({
        where: { id: orderId, status: 'received' },
        data: { status: 'completed', completedAt: now },
      })
      const latest = await tx.order.findUnique({ where: { id: orderId } })
      if (!latest) throw new NotFoundException('订单不存在')
      return latest
    })
    await this.writeOpLog(orderId, 'confirm_receipt', {}, userId)
    return { ok: true, status: updated.status }
  }

  // 申请退款/退货退款（买家）
  async requestRefund(
    userId: string,
    orderId: string,
    reason?: string,
    type?: 'refund' | 'return_refund',
    action?: 'modify',
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('订单不存在')
    if (order.buyerId !== userId) throw new BadRequestException('无权操作此订单')

    const opAction = (action || '') as string
    // action 白名单：仅允许空/undefined 或 modify
    if (opAction && opAction !== 'modify') {
      throw new BadRequestException('invalid_action')
    }

    // 检查状态
    // 检查是否已有退款申请
    const existingRefund = await this.prisma.orderRefund.findUnique({ where: { orderId } })

    // 防重复提交：已在申请中时，action 为空必须拒绝（提示走 modify）
    if (order.status === 'refund_requested' && !opAction) {
      throw new BadRequestException('已提交申请，如需修改请使用 modify')
    }

    // 确定 refundType：优先信任参数，否则沿用既有申请的 requestNote
    const refundType = (type || (existingRefund?.requestNote as any) || 'refund') as 'refund' | 'return_refund'

    // 校验 refundType 与订单发货事实是否一致（不依赖当前 order.status）
    if (refundType === 'return_refund') {
      if (!order.shippedAt) throw new BadRequestException('未发货订单不可申请退货退款')
    } else {
      if (order.shippedAt) throw new BadRequestException('已发货订单仅可申请退货退款')
    }

    // 修改申请：仅 refund_requested + requested 可修改（不计入申请次数）
    if (opAction === 'modify') {
      if (!existingRefund) throw new BadRequestException('退款申请不存在')
      if (order.status !== 'refund_requested' || existingRefund.status !== 'requested') {
        throw new BadRequestException('当前状态不可修改退款申请')
      }
      await this.prisma.orderRefund.update({
        where: { orderId },
        data: {
          reason: reason || null,
          requestNote: refundType,
        },
      })
      await this.writeOpLog(orderId, 'refund_modify_buyer', { reason, type: refundType }, userId)
      return { ok: true, status: 'refund_requested' }
    }

    // action 为空：发起/再次申请的状态校验
    const allowedApplyStatuses = new Set(['paid', 'paid_mock', 'shipped'])
    if (order.status !== 'refund_rejected' && !allowedApplyStatuses.has(String(order.status))) {
      throw new BadRequestException('订单状态不允许申请退款')
    }

    // 再次申请次数限制：最多 2 次（含首次）
    const applyCount = await this.prisma.orderOpLog.count({
      where: { orderId, action: 'refund_request_buyer' },
    })
    if (applyCount >= 2 && order.status === 'refund_rejected') {
      throw new BadRequestException('退款申请次数已达上限')
    }
    if (applyCount >= 2 && existingRefund && existingRefund.status === 'rejected') {
      throw new BadRequestException('退款申请次数已达上限')
    }

    // 创建或更新退款申请
    if (existingRefund) {
      await this.prisma.orderRefund.update({
        where: { orderId },
        data: {
          status: 'requested',
          reason: reason || null,
          requestNote: refundType,
          decidedAt: null,
          decisionNote: null,
        },
      })
    } else {
      await this.prisma.orderRefund.create({
        data: {
          orderId,
          status: 'requested',
          reason: reason || null,
          requestNote: refundType,
        },
      })
    }

    // 更新订单状态
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'refund_requested' },
    })

    await this.writeOpLog(orderId, 'refund_request_buyer', { reason, type: refundType }, userId)
    return { ok: true, status: 'refund_requested' }
  }

  // 取消退款申请（买家）
  // - 仅允许订单 status=refund_requested 时取消
  // - 取消后订单状态回退：未发货 -> paid（paid_mock 归一到 paid）；已发货 -> shipped
  // - 不改表：删除 OrderRefund，写 OpLog refund_cancel_buyer
  async cancelRefund(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('订单不存在')
    if (order.buyerId !== userId) throw new BadRequestException('无权操作此订单')
    if (order.status !== 'refund_requested') {
      throw new BadRequestException('仅退款申请中的订单可取消申请')
    }

    const existingRefund = await this.prisma.orderRefund.findUnique({ where: { orderId } })
    if (!existingRefund) {
      // 状态异常但尽量自愈：直接回退订单状态并记录日志
      const restoreStatus = order.shippedAt ? 'shipped' : 'paid'
      await this.prisma.$transaction([
        this.prisma.order.update({ where: { id: orderId }, data: { status: restoreStatus } }),
        this.prisma.orderOpLog.create({ data: { orderId, action: 'refund_cancel_buyer', adminId: userId } }),
      ])
      return { ok: true, status: restoreStatus }
    }
    if (existingRefund.status !== 'requested') {
      throw new BadRequestException('当前状态不可取消退款申请')
    }

    const restoreStatus = order.shippedAt ? 'shipped' : 'paid'
    await this.prisma.$transaction([
      this.prisma.orderRefund.delete({ where: { orderId } }),
      this.prisma.order.update({ where: { id: orderId }, data: { status: restoreStatus } }),
      this.prisma.orderOpLog.create({ data: { orderId, action: 'refund_cancel_buyer', adminId: userId } }),
    ])
    return { ok: true, status: restoreStatus }
  }

  /**
   * 发布者处理售后意见：只写 opLog，不改 Order/OrderRefund 状态
   * 仅 seller 可操作，且 order.status=refund_requested、refund.status=requested
   */
  async afterSaleSellerDecision(
    userId: string,
    orderId: string,
    body: { decision?: string; reason?: string; returnAddress?: { name?: string; phone?: string; fullText?: string } },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { refund: true },
    })
    if (!order) throw new NotFoundException('订单不存在')
    if (order.sellerId !== userId) {
      throw new ForbiddenException('无权限操作此订单')
    }
    if (order.status !== 'refund_requested') {
      throw new BadRequestException('仅退款申请中的订单可提交处理意见')
    }
    if (!order.refund || order.refund.status !== 'requested') {
      throw new BadRequestException('当前状态不可提交处理意见')
    }

    const decision = body.decision as string
    const allowed = ['agree_return', 'agree_refund', 'reject']
    if (!decision || !allowed.includes(decision)) {
      throw new BadRequestException('无效的 decision')
    }
    if (decision === 'reject' && !String(body.reason || '').trim()) {
      throw new BadRequestException('拒绝时请填写原因')
    }

    const payload = {
      decision,
      reason: body.reason?.trim() || null,
      returnAddress: body.returnAddress || null,
      decidedAt: new Date().toISOString(),
    }

    await this.prisma.orderOpLog.create({
      data: {
        orderId,
        action: 'after_sale_seller_decision',
        payloadJson: payload as any,
        adminId: null,
      },
    })
    return { ok: true }
  }
}
