function two(n: number) {
  return String(n).padStart(2, '0')
}

function nowInBJ() {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  return new Date(utc + 8 * 3600000)
}

function randomDigits(len: number) {
  let out = ''
  for (let i = 0; i < len; i++) {
    out += Math.floor(Math.random() * 10)
  }
  return out
}

function orderLikePrefix() {
  const d = nowInBJ()
  return `${two(d.getFullYear() % 100)}${two(d.getMonth() + 1)}${two(d.getDate())}${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`
}

function userPrefix() {
  const d = nowInBJ()
  return `${two(d.getFullYear() % 100)}${two(d.getMonth() + 1)}${two(d.getDate())}`
}

export async function createUniqueOrderDisplayNo(prisma: any, retry = 5): Promise<string> {
  for (let i = 0; i < retry; i++) {
    const value = `${orderLikePrefix()}${randomDigits(6)}`
    const existed = await prisma.order.findUnique({ where: { displayNo: value }, select: { id: true } })
    if (!existed) return value
  }
  throw new Error('createUniqueOrderDisplayNo failed after retries')
}

export async function createUniqueRefundDisplayNo(prisma: any, retry = 5): Promise<string> {
  for (let i = 0; i < retry; i++) {
    const value = `${orderLikePrefix()}${randomDigits(6)}`
    const existed = await prisma.orderRefund.findUnique({ where: { displayNo: value }, select: { id: true } })
    if (!existed) return value
  }
  throw new Error('createUniqueRefundDisplayNo failed after retries')
}

export async function createUniqueUserDisplayNo(prisma: any, retry = 5): Promise<string> {
  for (let i = 0; i < retry; i++) {
    const value = `${userPrefix()}${randomDigits(6)}`
    const existed = await prisma.user.findUnique({ where: { displayNo: value }, select: { id: true } })
    if (!existed) return value
  }
  throw new Error('createUniqueUserDisplayNo failed after retries')
}
