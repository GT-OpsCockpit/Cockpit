import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { normalizeEmail } from '@cockpit/shared';

export class LoginDto {
  // The legacy compared login emails case-insensitively
  // (email.trim().toLowerCase() vs ADMIN_EMAIL, server.js:131). User.email is
  // stored normalized (UsersService), so the lookup key has to be too —
  // otherwise "Admin@x.com" fails to find the account it obviously means.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
