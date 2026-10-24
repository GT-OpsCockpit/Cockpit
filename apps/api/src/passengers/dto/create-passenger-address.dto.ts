import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePassengerAddressDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  address: string;

  /** Apartment number, gate code, "ring twice" — whatever geocoding can't know. */
  @IsOptional()
  @IsString()
  info?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsBoolean()
  isAirport?: boolean;
}
