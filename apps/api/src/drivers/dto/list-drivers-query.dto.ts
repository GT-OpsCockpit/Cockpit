import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListDriversQueryDto {
  /** Matches against ref, firstName/lastName/company/email/phone (case-insensitive substring). */
  @IsOptional()
  @IsString()
  search?: string;

  // Query params arrive as strings — @Type(() => Boolean) would map "false"
  // to `true` (Boolean('false') is truthy), so this needs an explicit check.
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
