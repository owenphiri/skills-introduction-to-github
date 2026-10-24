/**
 * Demo data: one farm on ENTERPRISE (everything visible), a broiler batch and
 * a layer flock with 30 days of realistic records, inventory, a supplier,
 * sales & expenses. Run: `npm run seed`.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
};

async function main() {
  const password = await argon2.hash('Password123!');

  const farm = await prisma.farm.create({
    data: {
      name: 'Kasama Demo Farm',
      latitude: -10.2129,
      longitude: 31.1808,
      address: 'Kasama, Northern Province, Zambia',
      subscription: { create: { plan: 'ENTERPRISE', status: 'ACTIVE' } },
    },
  });

  for (const [email, fullName, role] of [
    ['owner@demo.farm', 'Demo Owner', 'OWNER'],
    ['manager@demo.farm', 'Demo Manager', 'MANAGER'],
    ['worker@demo.farm', 'Demo Worker', 'WORKER'],
  ] as const) {
    await prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash: password,
        memberships: { create: { farmId: farm.id, role } },
      },
    });
  }

  const houseA = await prisma.house.create({
    data: { farmId: farm.id, name: 'House A', capacity: 3000 },
  });
  const houseB = await prisma.house.create({
    data: { farmId: farm.id, name: 'House B', capacity: 2500 },
  });

  const broilers = await prisma.flock.create({
    data: {
      farmId: farm.id,
      houseId: houseA.id,
      name: 'Broiler Batch 2026-06 (Ross 308)',
      type: 'BROILER',
      breed: 'Ross 308',
      birdsPlaced: 2500,
      placedAt: day(30),
      costPerChick: 1.1,
    },
  });
  const layers = await prisma.flock.create({
    data: {
      farmId: farm.id,
      houseId: houseB.id,
      name: 'Layer Flock 2026-A (Lohmann Brown)',
      type: 'LAYER',
      breed: 'Lohmann Brown',
      birdsPlaced: 2000,
      placedAt: day(200),
      costPerChick: 1.6,
    },
  });

  // 30 days of records; day 22 has a deliberate mortality spike so the
  // dashboard shows a CRITICAL alert out of the box.
  for (let i = 29; i >= 0; i--) {
    const age = 30 - i;
    await prisma.dailyRecord.create({
      data: {
        flockId: broilers.id,
        date: day(i),
        mortality: i === 8 ? 28 : Math.random() < 0.5 ? 1 : 2,
        feedKg: Math.round(30 + age * 7.5),
        waterL: Math.round((30 + age * 7.5) * 1.9),
        avgWeightG: Math.round(42 + age * 62 + Math.random() * 30),
      },
    });
    await prisma.dailyRecord.create({
      data: {
        flockId: layers.id,
        date: day(i),
        mortality: Math.random() < 0.3 ? 1 : 0,
        feedKg: 230,
        waterL: 440,
        eggsCollected: Math.round(2000 * (0.86 + Math.random() * 0.06)),
        eggsBroken: Math.round(Math.random() * 15),
      },
    });
  }

  await prisma.vaccination.createMany({
    data: [
      { flockId: broilers.id, vaccine: 'Newcastle (LaSota)', dueDate: day(-2), method: 'water' },
      { flockId: layers.id, vaccine: 'Infectious Bronchitis booster', dueDate: day(-10), method: 'spray' },
    ],
  });

  const supplier = await prisma.supplier.create({
    data: {
      farmId: farm.id,
      name: 'NorthFeeds Ltd',
      phone: '+260 970 000000',
      latitude: -10.1996,
      longitude: 31.1852,
    },
  });

  await prisma.inventoryItem.createMany({
    data: [
      { farmId: farm.id, name: 'Broiler starter', category: 'FEED', unit: 'bag(50kg)', quantity: 42, reorderLevel: 20, unitCost: 32 },
      { farmId: farm.id, name: 'Layer mash', category: 'FEED', unit: 'bag(50kg)', quantity: 12, reorderLevel: 15, unitCost: 28 },
      { farmId: farm.id, name: 'Newcastle vaccine', category: 'VACCINE', unit: 'dose(1000)', quantity: 5, reorderLevel: 2, unitCost: 14 },
      { farmId: farm.id, name: 'Egg trays', category: 'PACKAGING', unit: 'unit', quantity: 800, reorderLevel: 300, unitCost: 0.3 },
    ],
  });

  for (let m = 5; m >= 0; m--) {
    const d = new Date();
    d.setMonth(d.getMonth() - m, 15);
    await prisma.sale.create({
      data: {
        farmId: farm.id,
        flockId: layers.id,
        product: 'eggs(tray)',
        quantity: 1500 + m * 60,
        unitPrice: 3.1,
        date: d,
      },
    });
    await prisma.expense.create({
      data: { farmId: farm.id, category: 'feed', amount: 2800 + m * 120, date: d },
    });
    await prisma.expense.create({
      data: { farmId: farm.id, category: 'labour', amount: 900, date: d },
    });
  }

  console.log(`Seeded farm ${farm.id} with supplier ${supplier.name}.`);
  console.log('Logins: owner@demo.farm / manager@demo.farm / worker@demo.farm — Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
