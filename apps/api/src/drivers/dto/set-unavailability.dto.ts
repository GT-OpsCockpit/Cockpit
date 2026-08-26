import { IsDateString, IsIn, IsOptional } from 'class-validator';

const KINDS = ['OFF', 'HOLIDAYS', 'SICK'] as const;

export class SetDriverUnavailabilityDto {
  @IsOptional()
  @IsIn([...KINDS, null])
  type?: (typeof KINDS)[number] | null;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
