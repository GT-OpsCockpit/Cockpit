import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

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

  /**
   * Drops drivers marked unavailable today (day off / holidays / sick) and
   * Events-scoped drivers outside their event's date range — the legacy's
   * isEffectivelyActive, which gated every assignment picker (common.js:3010).
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  availableOnly?: boolean;

  /**
   * The booking a driver is being picked FOR — enables the eligibility rule
   * (Events driver vs in-house vs partner, see driverEligibilityFilter).
   * Sent as the trip's own fields rather than a ref so the New booking bar
   * can filter against a draft that doesn't exist yet, exactly as the legacy
   * did with draftTripForEligibility() (common.js:4012).
   *
   * `tripClientRef` is what decides Events-vs-daily; the other four decide
   * locality (isLocalTrip). Eligibility is skipped entirely when no
   * tripClientRef is given.
   */
  @IsOptional()
  @IsString()
  tripClientRef?: string;

  @IsOptional()
  @IsString()
  tripArea?: string;

  @IsOptional()
  @IsString()
  tripCountryCode?: string;

  @IsOptional()
  @IsString()
  tripPickupLocation?: string;

  @IsOptional()
  @IsString()
  tripDropoffLocation?: string;

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
