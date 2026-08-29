import { IsString, MinLength } from 'class-validator';

/**
 * A new password for an account, set by an administrator.
 *
 * v2 gives each account its own password, which the legacy's access records
 * had no notion of — and deactivation here is one-way. Without this, an
 * account whose password is lost has no way back in and no way to be retired
 * cleanly. Same minimum as CreateUserDto: one rule, one place it can drift.
 */
export class SetPasswordDto {
  @IsString()
  @MinLength(8)
  password: string;
}
