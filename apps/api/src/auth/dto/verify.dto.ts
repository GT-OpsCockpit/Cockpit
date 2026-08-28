import { Transform } from 'class-transformer';
import { IsEmail, Matches } from 'class-validator';
import { normalizeEmail } from '@cockpit/shared';

export class VerifyDto {
  /** Normalized like LoginDto's — the two have to resolve to the same account. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  email: string;

  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit string' })
  code: string;
}
