import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePassengerRouteDto {
  @IsString()
  @MinLength(1)
  pickupLocation: string;

  @IsOptional()
  @IsString()
  dropoffLocation?: string;

  /** Resolved to an internal id server-side — same ref convention as every other DTO in the app. */
  @IsOptional()
  @IsString()
  vehicleTypeRef?: string;

  @IsNumber()
  priceEur: number;
}
