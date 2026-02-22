/* Temporary verification script:
 * - Create a Banner row via Prisma (should auto-generate id by @default(cuid()))
 * - Delete it afterwards (no residue)
 *
 * Usage (server): node /tmp/_tmp_test_banner_create_delete.js
 */
// NOTE: this script may be executed from /tmp on server.
// Use absolute require to ensure it resolves correctly.
const { PrismaClient } = require('/www/miaoji/server/node_modules/@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    const b = await prisma.banner.create({
      data: {
        title: null,
        imageUrl: 'https://moji.yanxiangtaoci.cn/uploads/banners/test.png',
        linkUrl: null,
        position: 'HOME',
        sortOrder: 0,
        sort: 0,
        enabled: false,
        targetType: 'NONE',
        targetId: null,
      },
    })
    console.log('created_id=' + b.id)
    await prisma.banner.delete({ where: { id: b.id } })
    console.log('deleted_ok=1')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

