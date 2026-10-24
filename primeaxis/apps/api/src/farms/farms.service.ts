import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLANS } from '../payments/plans';
import { InviteMemberDto, UpsertFarmDto } from './dto/farm.dto';

@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.farm.findMany({
      where: { members: { some: { userId } } },
      include: { subscription: { select: { plan: true, status: true } } },
    });
  }

  async create(userId: string, dto: UpsertFarmDto) {
    // Multi-farm is a Professional+ feature: count farms the user OWNS.
    const owned = await this.prisma.farmMember.count({
      where: { userId, role: 'OWNER' },
    });
    const bestPlan = await this.bestPlanFor(userId);
    if (owned >= PLANS[bestPlan].limits.farms) {
      throw new ForbiddenException(
        `Your ${bestPlan} plan allows ${PLANS[bestPlan].limits.farms} farm(s). Upgrade for multi-farm.`,
      );
    }
    return this.prisma.farm.create({
      data: {
        ...dto,
        members: { create: { userId, role: 'OWNER' } },
        subscription: { create: { plan: 'FREE', status: 'ACTIVE' } },
      },
    });
  }

  async get(farmId: string) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      include: {
        subscription: true,
        members: {
          include: { user: { select: { id: true, email: true, fullName: true } } },
        },
        _count: { select: { houses: true, flocks: true } },
      },
    });
    if (!farm) throw new NotFoundException('Farm not found');
    return farm;
  }

  update(farmId: string, dto: UpsertFarmDto) {
    return this.prisma.farm.update({ where: { id: farmId }, data: dto });
  }

  async invite(farmId: string, dto: InviteMemberDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    // Production: send an invite email instead of requiring a pre-existing
    // account. Kept synchronous here to stay focused on the domain model.
    if (!user) throw new NotFoundException('No account with that email yet');
    return this.prisma.farmMember.upsert({
      where: { farmId_userId: { farmId, userId: user.id } },
      create: { farmId, userId: user.id, role: dto.role },
      update: { role: dto.role },
    });
  }

  removeMember(farmId: string, memberId: string) {
    return this.prisma.farmMember.delete({
      where: { id: memberId, farmId, NOT: { role: 'OWNER' } },
    });
  }

  private async bestPlanFor(userId: string) {
    const subs = await this.prisma.subscription.findMany({
      where: {
        farm: { members: { some: { userId, role: 'OWNER' } } },
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      select: { plan: true },
    });
    const order = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const;
    return subs.reduce<(typeof order)[number]>(
      (best, s) => (order.indexOf(s.plan) > order.indexOf(best) ? s.plan : best),
      'FREE',
    );
  }
}
