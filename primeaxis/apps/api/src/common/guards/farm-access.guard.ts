import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resolves the `:farmId` route param against FarmMember. Rejects outsiders,
 * attaches `req.farmRole` for RolesGuard. Platform admins pass with role ADMIN.
 */
@Injectable()
export class FarmAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const farmId: string | undefined = req.params.farmId;
    if (!farmId) return true; // route is not farm-scoped

    if (req.user?.isPlatformAdmin) {
      req.farmRole = 'ADMIN';
      return true;
    }

    const member = await this.prisma.farmMember.findUnique({
      where: { farmId_userId: { farmId, userId: req.user.id } },
    });
    if (!member) throw new ForbiddenException('Not a member of this farm');

    req.farmRole = member.role;
    return true;
  }
}
