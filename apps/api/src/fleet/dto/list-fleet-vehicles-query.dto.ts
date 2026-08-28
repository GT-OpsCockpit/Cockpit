import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListFleetVehiclesQueryDto {
  /** Matches against ref, regNbr, make/model/acronym (case-insensitive substring). */
  @IsOptional()
  @IsString()
  search?: string;

  // Query params arrive as strings — @Type(() => Boolean) would map "false"
  // to `true` (Boolean('false') is truthy), so this needs an explicit check.
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;

  /**
   * Drops vehicles marked unavailable today (repair / service / bodywork)
   * and Events-scoped vehicles outside their event's date range — the
   * legacy's isEffectivelyActive, which gated the Reg Nbr picker
   * (populateFleetRegOptions, common.js:935).
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  availableOnly?: boolean;

  /**
   * Trip vehicle-type name the vehicle has to be able to service — resolved
   * through VEHICLE_COMPATIBILITY (e.g. a "Lugg." booking also accepts a
   * "Van"). Same rule the trip create/update already enforces on write; here
   * it stops an incompatible vehicle from being offered in the first place.
   */
  @IsOptional()
  @IsString()
  compatibleWith?: string;

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
