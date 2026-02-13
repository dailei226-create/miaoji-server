import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  // ========== 用户端 ==========

  /** 获取或创建用户的当前 OPEN ticket */
  async getOrCreateTicket(userId: string) {
    if (!userId) throw new BadRequestException('user_required');

    // 查找现有 OPEN ticket
    let ticket = await this.prisma.supportTicket.findFirst({
      where: { userId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });

    // 没有则创建
    if (!ticket) {
      ticket = await this.prisma.supportTicket.create({
        data: { userId, status: 'OPEN' },
      });
    }

    return this.mapTicket(ticket);
  }

  /** 获取用户当前 ticket（不创建） */
  async getUserTicket(userId: string) {
    if (!userId) throw new BadRequestException('user_required');

    const ticket = await this.prisma.supportTicket.findFirst({
      where: { userId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });

    return ticket ? this.mapTicket(ticket) : null;
  }

  /** 获取 ticket 消息列表（升序） */
  async getMessages(ticketId: string, userId?: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) throw new NotFoundException('ticket_not_found');

    // 用户只能查看自己的 ticket
    if (userId && ticket.userId !== userId) {
      throw new NotFoundException('ticket_not_found');
    }

    const messages = await this.prisma.supportMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((m) => this.mapMessage(m));
  }

  /** 用户发送消息 */
  async sendUserMessage(ticketId: string, userId: string, content: string) {
    if (!userId) throw new BadRequestException('user_required');
    if (!content?.trim()) throw new BadRequestException('content_required');

    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) throw new NotFoundException('ticket_not_found');
    if (ticket.userId !== userId) throw new NotFoundException('ticket_not_found');
    if (ticket.status !== 'OPEN') throw new BadRequestException('ticket_closed');

    const now = new Date();

    const message = await this.prisma.supportMessage.create({
      data: {
        ticketId,
        senderType: 'USER',
        senderId: userId,
        content: content.trim(),
      },
    });

    // 更新 ticket 最后消息时间
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { lastMessageAt: now },
    });

    return this.mapMessage(message);
  }

  // ========== 管理端 ==========

  /** 获取 ticket 列表（管理员） */
  async listTickets(params: { status?: string; page?: number; pageSize?: number }) {
    const { status, page = 1, pageSize = 20 } = params;

    const where: any = {};
    if (status === 'OPEN' || status === 'CLOSED') {
      where.status = status;
    }

    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        ...this.mapTicket(t),
        lastMessage: t.messages[0] ? this.mapMessage(t.messages[0]) : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** 管理员发送消息 */
  async sendAdminMessage(ticketId: string, adminId: string | null, content: string) {
    if (!content?.trim()) throw new BadRequestException('content_required');

    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) throw new NotFoundException('ticket_not_found');

    const now = new Date();

    const message = await this.prisma.supportMessage.create({
      data: {
        ticketId,
        senderType: 'ADMIN',
        senderId: adminId || null,
        content: content.trim(),
      },
    });

    // 更新 ticket 最后消息时间
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { lastMessageAt: now },
    });

    return this.mapMessage(message);
  }

  /** 更新 ticket 状态 */
  async updateTicketStatus(ticketId: string, status: 'OPEN' | 'CLOSED') {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) throw new NotFoundException('ticket_not_found');

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status },
    });

    return this.mapTicket(updated);
  }

  // ========== 映射 ==========

  private mapTicket(t: any) {
    return {
      id: t.id,
      userId: t.userId,
      status: t.status,
      lastMessageAt: t.lastMessageAt ? t.lastMessageAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  private mapMessage(m: any) {
    return {
      id: m.id,
      ticketId: m.ticketId,
      senderType: m.senderType,
      senderId: m.senderId || null,
      content: m.content,
      readAt: m.readAt ? m.readAt.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
