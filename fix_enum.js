const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`Order\` MODIFY COLUMN \`status\` ENUM('created', 'paid', 'paid_mock', 'shipped', 'received', 'completed', 'canceled', 'refund_requested', 'refund_approved', 'refund_rejected', 'refunded') NOT NULL DEFAULT 'created'
    `);
    console.log('枚举已更新');
  } catch(e) {
    console.error('更新失败:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
