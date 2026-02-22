/*
 * Read-only diagnostics for admin-web issues:
 * - CreatorReview: inspect pending CreatorProfile.applyData and images urls
 * - WorkReview: inspect reviewing works fields (coverUrl/desc/etc)
 *
 * Run on server:
 *   node /tmp/diag_adminweb_creator_work_issues.js
 */
const { PrismaClient } = require('/www/miaoji/server/node_modules/@prisma/client')

function safeJsonParse(x) {
  if (!x) return null
  if (typeof x === 'object') return x
  if (typeof x !== 'string') return null
  try {
    return JSON.parse(x)
  } catch (e) {
    return null
  }
}

function pickImages(applyData) {
  if (!applyData) return []
  const v = applyData.images
  if (Array.isArray(v)) return v.filter(Boolean).map(String)
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return []
    if (s.startsWith('[')) {
      const parsed = safeJsonParse(s)
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String)
    }
    return [s]
  }
  return []
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const pendingCreators = await prisma.creatorProfile.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    console.log('=== [A1] CreatorProfile pending images sample (top 20) ===')
    const classified = { tmp: 0, uploads: 0, http: 0, empty: 0, other: 0 }
    let printed = 0
    for (const cp of pendingCreators) {
      const applyData = safeJsonParse(cp.applyData)
      const images = pickImages(applyData)
      const first = images[0] ? String(images[0]) : ''
      if (!first) classified.empty++
      else if (first.startsWith('http://tmp/') || first.startsWith('https://tmp/') || first.includes('wxfile://')) classified.tmp++
      else if (first.startsWith('/uploads/') || first.includes('/uploads/')) classified.uploads++
      else if (first.startsWith('http://') || first.startsWith('https://')) classified.http++
      else classified.other++

      if (printed < 5) {
        printed++
        console.log(JSON.stringify({
          userId: cp.userId,
          status: cp.status,
          appliedAt: cp.appliedAt,
          createdAt: cp.createdAt,
          applyDataKeys: applyData ? Object.keys(applyData).slice(0, 30) : [],
          imagesSample: images.slice(0, 5),
        }, null, 2))
      }
    }
    console.log('[A1] pending_count=' + pendingCreators.length + ' classified=' + JSON.stringify(classified))

    const statusCounts = await prisma.$queryRaw`
      SELECT status, COUNT(*) AS cnt
      FROM Work
      GROUP BY status
      ORDER BY cnt DESC
      LIMIT 20
    `
    console.log('\n=== [A2] Work status counts (top 20) ===')
    const normalized = Array.isArray(statusCounts)
      ? statusCounts.map((r) => ({
          status: r && r.status != null ? String(r.status) : '',
          cnt: r && r.cnt != null ? String(r.cnt) : '0',
        }))
      : statusCounts
    console.log(JSON.stringify(normalized, null, 2))

    const reviewingWorks = await prisma.work.findMany({
      where: { status: 'reviewing' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    console.log('\n=== [A2] Work reviewing details (top 5) ===')
    console.log('reviewing_count=' + reviewingWorks.length)
    for (const w of reviewingWorks) {
      console.log(JSON.stringify({
        id: w.id,
        title: w.title,
        coverUrl: w.coverUrl,
        desc: w.desc,
        creatorId: w.creatorId,
        price: w.price,
        createdAt: w.createdAt,
        status: w.status,
      }, null, 2))
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

