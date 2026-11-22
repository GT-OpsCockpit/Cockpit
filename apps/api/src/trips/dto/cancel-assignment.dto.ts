import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CancellationFee } from '../../../generated/prisma/enums';

export class CancelAssignmentDto {
  @IsOptional()
  @IsEnum(CancellationFee)
  cancellationFee?: CancellationFee;

  /** The signed-in user's own password — required to cancel a completed trip. */
  @IsOptional()
  @IsString()
  adminPassword?: string;
}
