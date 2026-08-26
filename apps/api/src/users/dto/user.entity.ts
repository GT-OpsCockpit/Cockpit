import { Role } from '../../../generated/prisma/enums';

/** User record with the password hash stripped out — never returned to clients. */
export class PublicUserEntity {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone: string | null;
  active: boolean;
  deactivatedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}
