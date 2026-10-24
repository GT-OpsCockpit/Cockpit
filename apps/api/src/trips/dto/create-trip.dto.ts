import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Service, Billing } from '../../../generated/prisma/enums';
import {
  IsCountryCode,
  IsEmailFormat,
  IsPhone,
} from '../../common/validators/contact.validators';

export class CreateTripDto {
  @IsCountryCode()
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
  @IsPhone()
  pocPhone?: string;

  @IsOptional()
  @IsEmailFormat()
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
  @Min(0, { message: 'Buffer time cannot be negative.' })
  bufferTime?: number;

  @IsOptional()
  @IsString()
  fboAddress?: string;

  @IsOptional()
  @IsString()
  tailNbr?: string;

  /** Name to write on the pickup sign — the attached file is uploaded separately. */
  @IsOptional()
  @IsString()
  nameboard?: string;

  @IsOptional()
  @IsString()
  trainNumber?: string;

  @IsOptional()
  @IsString()
  trainObservation?: string;

  @IsOptional()
  @IsString()
  pickupIata?: string;

  @IsOptional()
  @IsString()
  dropoffIata?: string;

  /**
   * IANA zone the client read the typed date/time in to build `pickupAt`
   * (geocoded from the pickup address). Optional: falls back to the country's
   * default timezone, which is all the legacy ever had.
   */
  @IsOptional()
  @IsString()
  pickupTimezone?: string;

  @IsOptional()
  @IsBoolean()
  subContractor?: boolean;

  @IsOptional()
  @IsString()
  partnerRef?: string;

  /**
   * A Partner company to farm the job out to with no specific driver of
   * theirs picked yet — the "partenaire sans driver" case. Mutually
   * exclusive with `partnerRef` above (TripsService rejects both being set):
   * one names a driver on that company's roster, this names the company
   * itself with nobody named on file.
   */
  @IsOptional()
  @IsString()
  directPartnerRef?: string;

  /** Manual ref override — 409 if it already exists. */
  @IsOptional()
  @IsString()
  ref?: string;
}
