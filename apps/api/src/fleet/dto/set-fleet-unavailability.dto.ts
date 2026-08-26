import { IsDateString, IsIn, IsOptional } from 'class-validator';

const KINDS = ['REPAIR', 'SERVICE', 'BODYWORK'] as const;

export class SetFleetUnavailabilityDto {
  @IsOptional()
  @IsIn([...KINDS, null])
  type?: (typeof KINDS)[number] | null;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
