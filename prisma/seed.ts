import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function randOrderNo() {
  return 'MJ' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

// 初始集市类目（与前端原 defaultConfig.market.categories 一致，仅做初始数据）
const INIT_CATEGORIES = [
  { id: 'c_home', name: '家居', weight: 90, parentId: null as string | null, children: [
    { id: 'c_textile', name: '地瓷', weight: 90 }, { id: 'c_tray', name: '捏塑', weight: 80 },
    { id: 'c_storage', name: '收纳', weight: 70 }, { id: 'c_candle', name: '香氛', weight: 60 },
  ]},
  { id: 'c_vessel', name: '器物', weight: 80, parentId: null as string | null, children: [
    { id: 'c_cup', name: '杯盏', weight: 90 }, { id: 'c_incense', name: '香器', weight: 80 },
    { id: 'c_plate', name: '盘', weight: 70 }, { id: 'c_tea', name: '茶具', weight: 60 },
    { id: 'c_bowl', name: '碗', weight: 50 }, { id: 'c_vase', name: '花器', weight: 40 }, { id: 'c_jar', name: '罐', weight: 30 },
  ]},
  { id: 'c_jewelry', name: '饰品', weight: 70, parentId: null as string | null, children: [
    { id: 'c_bracelet', name: '手链', weight: 90 }, { id: 'c_earring', name: '耳饰', weight: 80 },
    { id: 'c_necklace', name: '项链', weight: 70 }, { id: 'c_ring', name: '戒指', weight: 60 },
  ]},
];

async function main() {
  const shouldRun = process.env.RUN_SEED === 'true';
  if (!shouldRun) {
    console.log('Seed skipped (set RUN_SEED=true to enable).');
    return;
  }

  const catCount = await prisma.category.count().catch(() => 0);
  if (catCount === 0) {
    for (const root of INIT_CATEGORIES) {
      await prisma.category.create({ data: { id: root.id, name: root.name, weight: root.weight, parentId: root.parentId } });
      for (const ch of root.children) {
        await prisma.category.create({ data: { id: ch.id, name: ch.name, weight: ch.weight, parentId: root.id } });
      }
    }
    console.log('Market categories seeded.');
  }

  const buyer = await prisma.user.create({ data: { openId: 'buyer_openid_seed_001' } });
  const seller = await prisma.user.create({ data: { openId: 'seller_openid_seed_001' } });
  const work = await prisma.work.create({ data: {} });

  await prisma.order.create({
    data: {
      orderNo: randOrderNo(),
      buyerId: buyer.id,
      sellerId: seller.id,
      status: 'created',
      amount: 0,
      addressSnapshot: {},
      items: {
        create: [
          {
            workId: work.id,
            titleSnap: 'snap',
            priceSnap: 0,
            qty: 1,
            coverSnap: null,
          },
        ],
      },
    },
  });

  await prisma.favorite.create({
    data: { userId: buyer.id, workId: work.id },
  });

  await prisma.follow.create({
    data: { userId: buyer.id, creatorId: seller.id },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Seed complete');
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
