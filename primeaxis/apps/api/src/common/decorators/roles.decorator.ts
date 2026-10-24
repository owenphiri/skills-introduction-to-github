import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Minimum farm roles allowed on a route, e.g. @Roles('OWNER', 'MANAGER').
 * Evaluated by RolesGuard against the FarmMember role that FarmAccessGuard
 * attached to the request.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
