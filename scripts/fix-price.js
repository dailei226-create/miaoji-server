// 修复价格数据脚本：将 price < 100 的值 * 100（视为元转分）
// 用法：在本地环境运行 node scripts/fix-price.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Start fixing prices...');
  
  // 查找所有 price < 100 的商品（假设这些是之前的“元”单位数据）
  const works = await prisma.work.findMany({
    where: {
      price: {
        lt: 100
      }
    }
  });

  console.log(`Found ${works.length} works with price < 100.`);

  for (const work of works) {
    const newPrice = work.price * 100;
    console.log(`Updating work ${work.id}: ${work.price} -> ${newPrice}`);
    await prisma.work.update({
      where: { id: work.id },
      data: { price: newPrice }
    });
  }

  // 同时也可能需要修复 effectivePrice / discountPrice 等，这里只作为示例修复基础 price
  // 如果有 discountPrice 也需要处理：
  const worksWithDiscount = await prisma.work.findMany({
    where: {
      discountPrice: {
        lt: 100,
        not: null
      }
    }
  });
  console.log(`Found ${worksWithDiscount.length} works with discountPrice < 100.`);
  for (const work of worksWithDiscount) {
    if (work.discountPrice !== null) {
      const newDiscount = work.discountPrice * 100;
      console.log(`Updating work discount ${work.id}: ${work.discountPrice} -> ${newDiscount}`);
      await prisma.work.update({
        where: { id: work.id },
        data: { discountPrice: newDiscount }
      });
    }
  }

  console.log('Fix complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
