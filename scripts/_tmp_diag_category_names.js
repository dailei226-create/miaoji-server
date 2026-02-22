// Temporary, read-only diagnostic script.
// Usage (server): node /tmp/_tmp_diag_category_names.js
const { PrismaClient } = require('/www/miaoji/server/node_modules/@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    const cats = await prisma.category.findMany({ orderBy: { updatedAt: 'desc' } })
    const pick = (kw) =>
      (cats || [])
        .filter((c) => c && String(c.name || '').includes(kw))
        .map((c) => ({ id: String(c.id), name: String(c.name), parentId: c.parentId ? String(c.parentId) : null }))

    console.log('total_categories=' + (cats ? cats.length : 0))
    console.log('match(地毯)=', JSON.stringify(pick('地毯'), null, 2))
    console.log('match(平均)=', JSON.stringify(pick('平均'), null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

