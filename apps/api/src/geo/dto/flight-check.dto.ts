import { IsDateString, IsString } from 'class-validator';

export class FlightCheckDto {
  @IsString()
  flightNumber: string;

  @IsDateString()
  pickupDate: string;

  @IsString()
  pickupTime: string;
}
