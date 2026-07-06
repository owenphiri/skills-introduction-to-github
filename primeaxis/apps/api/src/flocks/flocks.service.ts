import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLANS } from '../payments/plans';
import {
  CreateFlockDto,
  CreateVaccinationDto,
  UpdateFlockDto,
  UpsertHouseDto,
} from './dto/flock.dto';

@Injectable()
export class FlocksService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Houses ────────────────────────────────────────────────────────────────

  listHouses(farmId: string) {
    return this.prisma.house.findMany({
      where: { farmId },
      include: {
        flocks: { where: { status: 'ACTIVE' }, select: { id: true, name: true } },
      },
    });
  }

  async createHouse(farmId: string, dto: UpsertHouseDto) {
    await this.assertWithinLimit(farmId, 'houses');
    return this.prisma.house.create({ data: { farmId, ...dto } });
  }

  updateHouse(farmId: string, houseId: string, dto: UpsertHouseDto) {
    return this.prisma.house.update({
      where: { id: houseId, farmId },
      data: dto,
    });
  }

  // ── Flocks ────────────────────────────────────────────────────────────────

  listFlocks(farmId: string, status?: string) {
    return this.prisma.flock.findMany({
      where: { farmId, ...(status ? { status: status as any } : {}) },
      include: { house: { select: { id: true, name: true } } },
      orderBy: { placedAt: 'desc' },
    });
  }

  async createFlock(farmId: string, dto: CreateFlockDto) {
    const house = await this.prisma.house.findFirst({
      where: { id: dto.houseId, farmId },
    });
    if (!house) throw new NotFoundException('House not found on this farm');

    const activeBirds = await this.prisma.flock.aggregate({
      where: { farmId, status: 'ACTIVE' },
      _sum: { birdsPlaced: true },
    });
    const plan = await this.planOf(farmId);
    const limit = PLANS[plan].limits.birds;
    if ((activeBirds._sum.birdsPlaced ?? 0) + dto.birdsPlaced > limit) {
      throw new ForbiddenException(
        `The ${plan} plan supports up to ${limit.toLocaleString()} active birds. Upgrade to add this flock.`,
      );
    }
    if (dto.birdsPlaced > house.capacity) {
      throw new BadRequestException(
        `House "${house.name}" capacity is ${house.capacity} birds`,
      );
    }

    return this.prisma.flock.create({ data: { farmId, ...dto } });
  }

  async getFlock(farmId: string, flockId: string) {
    const flock = await this.prisma.flock.findFirst({
      where: { id: flockId, farmId },
      include: {
        house: true,
        vaccinations: { orderBy: { dueDate: 'asc' } },
      },
    });
    if (!flock) throw new NotFoundException('Flock not found');
    return flock;
  }

  updateFlock(farmId: string, flockId: string, dto: UpdateFlockDto) {
    return this.prisma.flock.update({
      where: { id: flockId, farmId },
      data: dto,
    });
  }

  // ── Vaccinations ──────────────────────────────────────────────────────────

  addVaccination(farmId: string, flockId: string, dto: CreateVaccinationDto) {
    return this.prisma.vaccination.create({
      data: { ...dto, flock: { connect: { id: flockId, farmId } } },
    });
  }

  markVaccinationGiven(farmId: string, vaccinationId: string) {
    return this.prisma.vaccination.update({
      where: { id: vaccinationId, flock: { farmId } },
      data: { givenAt: new Date() },
    });
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async assertWithinLimit(farmId: string, kind: 'houses') {
    const plan = await this.planOf(farmId);
    const count = await this.prisma.house.count({ where: { farmId } });
    if (count >= PLANS[plan].limits[kind]) {
      throw new ForbiddenException(
        `The ${plan} plan allows ${PLANS[plan].limits[kind]} ${kind}. Upgrade for more.`,
      );
    }
  }

  private async planOf(farmId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { farmId } });
    return sub?.status === 'ACTIVE' || sub?.status === 'TRIALING'
      ? sub.plan
      : ('FREE' as const);
  }
}
