import { Role } from '../../../generated/prisma/enums';

/**
 * `devCode` is only ever present when AUTH_DEV_OTP is on outside production
 * (see AuthService.login) — normal login responses are an empty object,
 * relying on email delivery instead.
 */
export class LoginResultEntity {
  devCode?: string;
}

/** GET /auth/me — the session's user, as attached by SessionAuthGuard. */
export class AuthMeEntity {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}
