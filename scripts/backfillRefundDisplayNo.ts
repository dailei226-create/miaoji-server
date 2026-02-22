import { PrismaClient } from '@prisma/client'
import { createUniqueRefundDisplayNo } from '../src/utils/display-no'

const prisma = new PrismaClient()
const BATCH_SIZE = 200

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function countMissing() {
  return prisma.orderRefund.count({
    where: {
      OR: [{ displayNo: null }, { displayNo: '' }],
    },
  })
}

async function run() {
  const totalMissing = await countMissing()
  console.log(`[backfill] start missing=${totalMissing}`)
  if (totalMissing === 0) return

  let processed = 0
  while (true) {
    const rows = await prisma.orderRefund.findMany({
      where: {
        OR: [{ displayNo: null }, { displayNo: '' }],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    })
    if (!rows.length) break

    for (const row of rows) {
      const displayNo = await createUniqueRefundDisplayNo(prisma, 12)
      await prisma.orderRefund.update({
        where: { id: row.id },
        data: { displayNo },
      })
      processed++
      if (processed % 20 === 0 || processed === totalMissing) {
        console.log(`[backfill] processed=${processed}/${totalMissing}`)
      }
    }

    await sleep(50)
  }

  const remain = await countMissing()
  console.log(`[backfill] done processed=${processed} remain=${remain}`)
}

run()
  .catch((e) => {
    console.error('[backfill] failed', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
