import { IsEmail, Matches } from 'class-validator';

export class VerifyDto {
  @IsEmail()
  email: string;

  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit string' })
  code: string;
}
