import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/enums';
import {
  PERMISSION_NAMES,
  type Permission,
} from '../../common/permissions/permissions';

/**
 * `devCode` is only ever present when AUTH_DEV_OTP is on outside production
 * (see AuthService.login) — normal login responses are an empty object,
 * relying on email delivery instead.
 */
export class LoginResultEntity {
  devCode?: string;
}

/**
 * GET /auth/me — the session's user, as attached by SessionAuthGuard, plus
 * their resolved permission list (see common/permissions/permissions.ts).
 * The frontend never re-derives "does this role have this permission"
 * itself — it just checks whether a name is in this array (see
 * apps/web/src/features/auth/use-permission.ts and
 * docs/agents/permissions.md). `permissions` isn't just a courtesy: it's the
 * single channel the frontend gets permission data through at all.
 */
export class AuthMeEntity {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;

  @ApiProperty({ enum: PERMISSION_NAMES, isArray: true })
  permissions: Permission[];
}
