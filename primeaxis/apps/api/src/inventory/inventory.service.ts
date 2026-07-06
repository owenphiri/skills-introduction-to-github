import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePODto,
  MovementDto,
  UpsertItemDto,
  UpsertSupplierDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  // ── Items & movements ─────────────────────────────────────────────────────

  listItems(farmId: string, category?: string) {
    return this.prisma.inventoryItem.findMany({
      where: { farmId, ...(category ? { category: category as any } : {}) },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  createItem(farmId: string, dto: UpsertItemDto) {
    return this.prisma.inventoryItem.create({ data: { farmId, ...dto } });
  }

  updateItem(farmId: string, itemId: string, dto: UpsertItemDto) {
    return this.prisma.inventoryItem.update({
      where: { id: itemId, farmId },
      data: dto,
    });
  }

  /**
   * Ledger write + cached balance update in one transaction.
   * USAGE with a flockId is what powers per-batch feed/med costing.
   */
  async move(farmId: string, itemId: string, dto: MovementDto) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, farmId },
    });
    if (!item) throw new NotFoundException('Item not found');

    const signed =
      dto.type === 'USAGE' || (dto.type === 'TRANSFER' && dto.quantity > 0)
        ? -Math.abs(dto.quantity)
        : Math.abs(dto.quantity);

    if (item.quantity + signed < 0) {
      throw new BadRequestException(
        `Only ${item.quantity} ${item.unit} in stock`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.inventoryItem.update({
        where: { id: itemId },
        data: { quantity: { increment: signed } },
      }),
      this.prisma.stockMovement.create({
        data: {
          itemId,
          type: dto.type,
          quantity: signed,
          flockId: dto.flockId,
          note: dto.note,
        },
      }),
    ]);

    if (updated.quantity <= updated.reorderLevel) {
      await this.alerts.raise(
        farmId,
        'LOW_STOCK',
        updated.quantity <= 0 ? 'CRITICAL' : 'WARNING',
        `${updated.name}: ${updated.quantity} ${updated.unit} left (reorder at ${updated.reorderLevel})`,
        updated.id,
      );
    }
    return updated;
  }

  itemHistory(farmId: string, itemId: string) {
    return this.prisma.stockMovement.findMany({
      where: { itemId, item: { farmId } },
      orderBy: { at: 'desc' },
      take: 200,
      include: { flock: { select: { id: true, name: true } } },
    });
  }

  // ── Suppliers ─────────────────────────────────────────────────────────────

  listSuppliers(farmId: string) {
    return this.prisma.supplier.findMany({ where: { farmId } });
  }

  createSupplier(farmId: string, dto: UpsertSupplierDto) {
    return this.prisma.supplier.create({ data: { farmId, ...dto } });
  }

  // ── Purchase orders ───────────────────────────────────────────────────────

  listPOs(farmId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { farmId },
      include: {
        supplier: { select: { id: true, name: true } },
        lines: { include: { item: { select: { name: true, unit: true } } } },
      },
      orderBy: { orderedAt: 'desc' },
    });
  }

  createPO(farmId: string, dto: CreatePODto) {
    return this.prisma.purchaseOrder.create({
      data: {
        farmId,
        supplierId: dto.supplierId,
        status: 'ORDERED',
        orderedAt: new Date(),
        lines: { create: dto.lines },
      },
      include: { lines: true },
    });
  }

  /** Receiving a PO posts a PURCHASE movement per line and restocks. */
  async receivePO(farmId: string, poId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: poId, farmId, status: 'ORDERED' },
      include: { lines: true },
    });
    if (!po) throw new NotFoundException('Open purchase order not found');

    await this.prisma.$transaction([
      ...po.lines.flatMap((line) => [
        this.prisma.inventoryItem.update({
          where: { id: line.itemId },
          data: { quantity: { increment: line.quantity }, unitCost: line.unitCost },
        }),
        this.prisma.stockMovement.create({
          data: {
            itemId: line.itemId,
            type: 'PURCHASE',
            quantity: line.quantity,
            note: `PO ${po.id}`,
          },
        }),
      ]),
      this.prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      }),
    ]);
    return this.prisma.purchaseOrder.findUnique({
      where: { id: po.id },
      include: { lines: true },
    });
  }
}
