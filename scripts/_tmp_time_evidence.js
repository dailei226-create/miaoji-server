/**
 * Evidence script (read-only):
 * - Step 1: query DB raw createdAt for pending CreatorProfile and reviewing Work
 * - Step 2: call admin APIs and print response createdAt raw strings
 *
 * Usage:
 *   1) Start backend: npm run dev  (PORT defaults to 3100)
 *   2) Run: node scripts/_tmp_time_evidence.js
 */
const axios = require('axios')
const { PrismaClient } = require('@prisma/client')

function pickList(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.list)) return payload.list
  if (Array.isArray(payload.creators)) return payload.creators
  if (Array.isArray(payload.works)) return payload.works
  if (Array.isArray(payload.data)) return payload.data
  return []
}

async function main() {
  const prisma = new PrismaClient()
  const port = Number(process.env.PORT || 3100)
  const baseURL = process.env.EVIDENCE_BASE_URL || `http://127.0.0.1:${port}`

  try {
    // Step 1: DB raw values (MySQL DATETIME has no timezone; show as stored)
    const tz = await prisma.$queryRawUnsafe(
      'SELECT @@global.time_zone AS global_tz, @@session.time_zone AS session_tz, NOW(3) AS now_dt, UTC_TIMESTAMP(3) AS now_utc',
    )
    console.log('--- Step1: DB timezone snapshot ---')
    console.log('DB_TZ=', JSON.stringify(tz, null, 2))

    const creatorDbRows = await prisma.$queryRawUnsafe(
      "SELECT userId, status, createdAt, CAST(createdAt AS CHAR) AS createdAt_raw, appliedAt, CAST(appliedAt AS CHAR) AS appliedAt_raw FROM CreatorProfile WHERE status = 'pending' ORDER BY createdAt DESC LIMIT 1",
    )
    const workDbRows = await prisma.$queryRawUnsafe(
      "SELECT id, status, createdAt, CAST(createdAt AS CHAR) AS createdAt_raw FROM Work WHERE status = 'reviewing' ORDER BY createdAt DESC LIMIT 1",
    )
    const creatorDb = (creatorDbRows && creatorDbRows[0]) || null
    const workDb = (workDbRows && workDbRows[0]) || null

    console.log('--- Step1: DB raw createdAt ---')
    console.log('CreatorProfile.createdAt raw row =', JSON.stringify(creatorDb, null, 2))
    console.log('Work.createdAt raw row          =', JSON.stringify(workDb, null, 2))

    // Also show Prisma Date -> ISO (to detect driver timezone interpretation)
    const creatorPrisma = await prisma.creatorProfile.findFirst({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, status: true, createdAt: true, appliedAt: true },
    })
    const workPrisma = await prisma.work.findFirst({
      where: { status: 'reviewing' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, createdAt: true },
    })

    console.log('--- Step1: Prisma Date objects (for comparison) ---')
    console.log('Prisma CreatorProfile =', {
      userId: creatorPrisma && creatorPrisma.userId,
      status: creatorPrisma && creatorPrisma.status,
      createdAt: creatorPrisma && creatorPrisma.createdAt,
      createdAt_iso: creatorPrisma && creatorPrisma.createdAt && creatorPrisma.createdAt.toISOString(),
      appliedAt: creatorPrisma && creatorPrisma.appliedAt,
      appliedAt_iso: creatorPrisma && creatorPrisma.appliedAt && creatorPrisma.appliedAt.toISOString(),
    })
    console.log('Prisma Work =', {
      id: workPrisma && workPrisma.id,
      status: workPrisma && workPrisma.status,
      createdAt: workPrisma && workPrisma.createdAt,
      createdAt_iso: workPrisma && workPrisma.createdAt && workPrisma.createdAt.toISOString(),
    })

    // Step 2: API response raw strings
    // Use mock-login (dev-only) to get an admin JWT, then call /admin/* endpoints.
    console.log('--- Step2: API response createdAt ---')
    const loginRes = await axios.post(
      `${baseURL}/auth/mock-login`,
      { openId: 'evidence-admin-openid', nickname: 'evidence-admin', role: 'admin' },
      { timeout: 15000 },
    )
    const token = loginRes?.data?.token
    if (!token) throw new Error('mock-login did not return token')

    const headers = { Authorization: `Bearer ${token}` }

    const creatorsRes = await axios.get(`${baseURL}/admin/creators`, {
      params: { status: 'pending' },
      headers,
      timeout: 15000,
    })
    const creatorsPayload = creatorsRes && creatorsRes.data !== undefined ? creatorsRes.data : creatorsRes
    const creators = pickList(creatorsPayload)
    const creatorApi =
      (creatorDb && creators.find((x) => String(x.userId || x.id || '') === String(creatorDb.userId))) ||
      creators[0] ||
      null

    const worksRes = await axios.get(`${baseURL}/admin/works`, {
      params: { status: 'reviewing' },
      headers,
      timeout: 15000,
    })
    const worksPayload = worksRes && worksRes.data !== undefined ? worksRes.data : worksRes
    const works = pickList(worksPayload)
    const workApi =
      (workDb && works.find((x) => String(x.id || x.workId || '') === String(workDb.id))) ||
      works[0] ||
      null

    console.log('admin creators Response.createdAt =', creatorApi && (creatorApi.createdAt || creatorApi.created || null))
    console.log('admin works Response.createdAt    =', workApi && (workApi.createdAt || workApi.created || null))

    console.log('--- Step2: picked API rows (for reference) ---')
    console.log('picked creator row keys=', creatorApi ? Object.keys(creatorApi) : null)
    console.log('picked work row keys   =', workApi ? Object.keys(workApi) : null)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('[evidence script error]', e?.message || e)
  process.exitCode = 1
})

