import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export class TxnDto {
  category?: string; // expenses
  product?: string;  // sales
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  date: Date;
  flockId?: string;
  note?: string;
  buyer?: string;
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  addExpense(farmId: string, dto: TxnDto) {
    return this.prisma.expense.create({
      data: {
        farmId,
        flockId: dto.flockId,
        category: dto.category ?? 'other',
        amount: new Prisma.Decimal(dto.amount ?? 0),
        date: dto.date,
        note: dto.note,
      },
    });
  }

  addSale(farmId: string, dto: TxnDto) {
    return this.prisma.sale.create({
      data: {
        farmId,
        flockId: dto.flockId,
        product: dto.product ?? 'live-bird',
        quantity: dto.quantity ?? 1,
        unitPrice: new Prisma.Decimal(dto.unitPrice ?? 0),
        date: dto.date,
        buyer: dto.buyer,
      },
    });
  }

  /**
   * Monthly revenue vs cost for the dashboard chart, plus per-batch
   * profitability: sales − chick cost − attributed feed/meds − expenses.
   */
  async summary(farmId: string, months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const [sales, expenses, flocks] = await Promise.all([
      this.prisma.sale.findMany({ where: { farmId, date: { gte: since } } }),
      this.prisma.expense.findMany({ where: { farmId, date: { gte: since } } }),
      this.prisma.flock.findMany({
        where: { farmId },
        include: {
          stockMovements: {
            where: { type: 'USAGE' },
            include: { item: { select: { unitCost: true } } },
          },
        },
      }),
    ]);

    const monthly = new Map<string, { revenue: number; costs: number }>();
    const key = (d: Date) => d.toISOString().slice(0, 7);
    for (const s of sales) {
      const m = monthly.get(key(s.date)) ?? { revenue: 0, costs: 0 };
      m.revenue += Number(s.unitPrice) * s.quantity;
      monthly.set(key(s.date), m);
    }
    for (const e of expenses) {
      const m = monthly.get(key(e.date)) ?? { revenue: 0, costs: 0 };
      m.costs += Number(e.amount);
      monthly.set(key(e.date), m);
    }

    const perBatch = flocks.map((f) => {
      const revenue = sales
        .filter((s) => s.flockId === f.id)
        .reduce((a, s) => a + Number(s.unitPrice) * s.quantity, 0);
      const feedMedCost = f.stockMovements.reduce(
        (a, m) => a + Math.abs(m.quantity) * Number(m.item.unitCost),
        0,
      );
      const directExpenses = expenses
        .filter((e) => e.flockId === f.id)
        .reduce((a, e) => a + Number(e.amount), 0);
      const chickCost = Number(f.costPerChick) * f.birdsPlaced;
      return {
        flockId: f.id,
        name: f.name,
        status: f.status,
        revenue,
        costs: chickCost + feedMedCost + directExpenses,
        profit: revenue - chickCost - feedMedCost - directExpenses,
      };
    });

    return {
      monthly: [...monthly.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, ...v, profit: v.revenue - v.costs })),
      perBatch,
    };
  }
}
