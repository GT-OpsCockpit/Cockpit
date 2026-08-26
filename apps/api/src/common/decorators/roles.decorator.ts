import { SetMetadata } from '@nestjs/common';
import { Role } from '../../../generated/prisma/enums';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles (checked by RolesGuard, on top of SessionAuthGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
