import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFleetVehicleDto {
  /** Vehicle-type NAME (not id/ref) — matches an existing VehicleType.name. */
  @IsString()
  category: string;

  @IsString()
  regNbr: string;

  @IsString()
  make: string;

  @IsString()
  model: string;

  @IsInt()
  yearOfBuild: number;

  @IsBoolean()
  fourWD: boolean;

  @IsInt()
  @Min(0)
  @Max(50)
  nbPax: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6)
  acronym?: string;

  @IsOptional()
  @IsBoolean()
  isLocal?: boolean;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  partnerCompany?: string;

  /** Driver ref (e.g. "D-FR-INT-001") to reserve this vehicle for — external vehicles only. */
  @IsOptional()
  @IsString()
  driverRef?: string;

  @IsOptional()
  @IsBoolean()
  eventsOnly?: boolean;

  @IsOptional()
  @IsString()
  eventCountry?: string;

  @IsOptional()
  @IsString()
  eventArea?: string;

  @IsOptional()
  @IsString()
  eventRef?: string;
}
