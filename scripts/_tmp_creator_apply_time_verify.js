/**
 * Verify the "creator apply time +8h" fix for NEW records.
 *
 * Evidence produced (keep concise):
 * - DB raw createdAt (CAST as CHAR)
 * - API /admin/creators response createdAt (ISO Z)
 * - Convert API createdAt to Beijing time for comparison
 *
 * Prereqs:
 * - backend running on PORT (default 3100)
 *
 * Run:
 *   node scripts/_tmp_creator_apply_time_verify.js
 */
const axios = require('axios')
const { PrismaClient } = require('@prisma/client')

function toBeijingString(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
    })
  } catch {
    return null
  }
}

function pickList(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.list)) return payload.list
  if (Array.isArray(payload.creators)) return payload.creators
  if (Array.isArray(payload.data)) return payload.data
  return []
}

async function main() {
  const prisma = new PrismaClient()
  const port = Number(process.env.PORT || 3100)
  const baseURL = process.env.EVIDENCE_BASE_URL || `http://127.0.0.1:${port}`

  const beijingNow = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  })
  console.log('Beijing submit time (client reference) =', beijingNow)

  try {
    // 1) Login as normal user (buyer) then call POST /creators/apply
    const buyerOpenId = `evidence-buyer-${Date.now()}`
    const buyerLogin = await axios.post(
      `${baseURL}/auth/mock-login`,
      { openId: buyerOpenId, nickname: 'evidence-buyer', role: 'buyer' },
      { timeout: 15000 },
    )
    const buyerToken = buyerLogin?.data?.token
    const buyerUserId = buyerLogin?.data?.user?.id
    if (!buyerToken || !buyerUserId) throw new Error('mock-login(buyer) failed')

    await axios.post(
      `${baseURL}/creators/apply`,
      { intro: 'time-fix-evidence', images: [], isOriginal: true, phone: '13800000000', realName: '测试' },
      { headers: { Authorization: `Bearer ${buyerToken}` }, timeout: 15000 },
    )

    // 2) DB raw createdAt (newest for that user)
    const dbRows = await prisma.$queryRawUnsafe(
      'SELECT userId, status, createdAt, CAST(createdAt AS CHAR) AS createdAt_raw, appliedAt, CAST(appliedAt AS CHAR) AS appliedAt_raw FROM CreatorProfile WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
      buyerUserId,
    )
    const db = (dbRows && dbRows[0]) || null
    console.log('DB CreatorProfile.createdAt_raw =', db && db.createdAt_raw)

    // 3) Admin API response createdAt
    const adminLogin = await axios.post(
      `${baseURL}/auth/mock-login`,
      { openId: 'evidence-admin-openid', nickname: 'evidence-admin', role: 'admin' },
      { timeout: 15000 },
    )
    const adminToken = adminLogin?.data?.token
    if (!adminToken) throw new Error('mock-login(admin) failed')

    const creatorsRes = await axios.get(`${baseURL}/admin/creators`, {
      params: { status: 'pending' },
      headers: { Authorization: `Bearer ${adminToken}` },
      timeout: 15000,
    })
    const payload = creatorsRes && creatorsRes.data !== undefined ? creatorsRes.data : creatorsRes
    const items = pickList(payload)
    const row = items.find((x) => String(x.userId || x.id || '') === String(buyerUserId)) || null
    const apiCreatedAt = row && (row.createdAt || row.created || null)
    console.log('API admin creators Response.createdAt =', apiCreatedAt)
    console.log('API createdAt -> Beijing =', toBeijingString(apiCreatedAt))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('[verify script error]', e?.message || e)
  process.exitCode = 1
})

