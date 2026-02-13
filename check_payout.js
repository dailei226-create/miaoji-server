const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw`SELECT id, userId, holderName, status, verifiedAt FROM CreatorPayout ORDER BY createdAt DESC LIMIT 3`;
  console.log('CreatorPayout 数据（前3条）：');
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
