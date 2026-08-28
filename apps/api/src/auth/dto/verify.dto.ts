import { Matches } from 'class-validator';
import { IsEmailFormat } from '../../common/validators/contact.validators';

export class VerifyDto {
  /** Normalized like LoginDto's — the two have to resolve to the same account. */
  @IsEmailFormat()
  email: string;

  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit string' })
  code: string;
}
