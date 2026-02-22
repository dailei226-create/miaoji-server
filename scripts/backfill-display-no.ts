import { PrismaClient } from '@prisma/client'
import {
  createUniqueOrderDisplayNo,
  createUniqueRefundDisplayNo,
  createUniqueUserDisplayNo,
} from '../src/utils/display-no'

const prisma = new PrismaClient()
const PAGE_SIZE = 300

async function backfillOrders() {
  let total = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await prisma.order.findMany({
      where: { displayNo: null },
      select: { id: true },
      take: PAGE_SIZE,
      orderBy: { createdAt: 'asc' },
    })
    if (!rows.length) break
    for (const row of rows) {
      let done = false
      for (let i = 0; i < 5 && !done; i++) {
        try {
          const displayNo = await createUniqueOrderDisplayNo(prisma, 10)
          await prisma.order.update({ where: { id: row.id }, data: { displayNo } })
          done = true
          total++
        } catch (e: any) {
          if (String(e?.code || '').toUpperCase() !== 'P2002' && i === 4) throw e
        }
      }
    }
    console.log(`[backfill] Order done=${total}`)
  }
}

async function backfillRefunds() {
  let total = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await prisma.orderRefund.findMany({
      where: { displayNo: null },
      select: { id: true },
      take: PAGE_SIZE,
      orderBy: { createdAt: 'asc' },
    })
    if (!rows.length) break
    for (const row of rows) {
      let done = false
      for (let i = 0; i < 5 && !done; i++) {
        try {
          const displayNo = await createUniqueRefundDisplayNo(prisma, 10)
          await prisma.orderRefund.update({ where: { id: row.id }, data: { displayNo } })
          done = true
          total++
        } catch (e: any) {
          if (String(e?.code || '').toUpperCase() !== 'P2002' && i === 4) throw e
        }
      }
    }
    console.log(`[backfill] OrderRefund done=${total}`)
  }
}

async function backfillUsers() {
  let total = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await prisma.user.findMany({
      where: { displayNo: null },
      select: { id: true },
      take: PAGE_SIZE,
      orderBy: { createdAt: 'asc' },
    })
    if (!rows.length) break
    for (const row of rows) {
      let done = false
      for (let i = 0; i < 5 && !done; i++) {
        try {
          const displayNo = await createUniqueUserDisplayNo(prisma, 10)
          await prisma.user.update({ where: { id: row.id }, data: { displayNo } })
          done = true
          total++
        } catch (e: any) {
          if (String(e?.code || '').toUpperCase() !== 'P2002' && i === 4) throw e
        }
      }
    }
    console.log(`[backfill] User done=${total}`)
  }
}

async function main() {
  console.log('[backfill] start displayNo backfill')
  await backfillOrders()
  await backfillRefunds()
  await backfillUsers()
  console.log('[backfill] finished')
}

main()
  .catch((e) => {
    console.error('[backfill] failed', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
