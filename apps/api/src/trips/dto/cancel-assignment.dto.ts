import { IsEnum, IsOptional } from 'class-validator';
import { CancellationFee } from '../../../generated/prisma/enums';

export class CancelAssignmentDto {
  @IsOptional()
  @IsEnum(CancellationFee)
  cancellationFee?: CancellationFee;
}
