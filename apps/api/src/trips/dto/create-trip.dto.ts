import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Service, Billing } from '../../../generated/prisma/enums';

export class CreateTripDto {
  @IsString()
  countryCode: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsDateString()
  pickupAt: string;

  @IsString()
  pickupLocation: string;

  @IsOptional()
  @IsString()
  dropoffLocation?: string;

  @IsEnum(Service)
  service: Service;

  @IsOptional()
  @IsInt()
  hours?: number;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsString()
  clientRef: string;

  @IsString()
  @MinLength(1)
  passengerName: string;

  @IsOptional()
  @IsString()
  pocName?: string;

  @IsOptional()
  @IsString()
  pocPhone?: string;

  @IsOptional()
  @IsString()
  pocEmail?: string;

  @IsOptional()
  @IsBoolean()
  tracking?: boolean;

  @IsOptional()
  @IsInt()
  paxCount?: number;

  /** VehicleType NAME (not id/ref). */
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  fleetRegNbr?: string;

  @IsOptional()
  @IsNumber()
  priceEur?: number;

  @IsOptional()
  @IsNumber()
  partnerRateEur?: number;

  @IsOptional()
  @IsString()
  driverRef?: string;

  @IsOptional()
  @IsEnum(Billing)
  billing?: Billing;

  @IsOptional()
  @IsString()
  flightNumber?: string;

  @IsOptional()
  @IsInt()
  bufferTime?: number;

  @IsOptional()
  @IsString()
  fboAddress?: string;

  @IsOptional()
  @IsString()
  tailNbr?: string;

  @IsOptional()
  @IsString()
  pickupIata?: string;

  @IsOptional()
  @IsString()
  dropoffIata?: string;

  @IsOptional()
  @IsBoolean()
  subContractor?: boolean;

  @IsOptional()
  @IsString()
  partnerRef?: string;

  /** Manual ref override — 409 if it already exists. */
  @IsOptional()
  @IsString()
  ref?: string;
}
