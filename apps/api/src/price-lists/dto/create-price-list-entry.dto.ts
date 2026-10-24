import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

// A route here is defined either by exact address (pickupLocation) or by
// postal code(s) — pickupPostalCodes, matching ANY of the listed codes at
// this same rate — never required to be both; the service only asks that
// at least one pickup descriptor is present. `bidirectional` makes the same
// rate also apply pickup<->dropoff reversed.
export class CreatePriceListEntryDto {
  @IsOptional()
  @IsString()
  pickupLocation?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pickupPostalCodes?: string[];

  @IsOptional()
  @IsString()
  pickupCountryCode?: string;

  @IsOptional()
  @IsString()
  dropoffLocation?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dropoffPostalCodes?: string[];

  @IsOptional()
  @IsString()
  dropoffCountryCode?: string;

  @IsOptional()
  @IsBoolean()
  bidirectional?: boolean;

  /** Resolved to an internal id server-side. */
  @IsOptional()
  @IsString()
  vehicleTypeRef?: string;

  @IsNumber()
  priceEur: number;
}
