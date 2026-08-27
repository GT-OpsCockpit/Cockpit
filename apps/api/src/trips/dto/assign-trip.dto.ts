import { IsOptional, IsString } from 'class-validator';

/**
 * Lightweight counterpart to UpdateTripDto for the Planning Gantt's drag&drop:
 * patches only driverRef and/or fleetRegNbr, unlike the full booking form PUT.
 * An empty string clears the field (same convention as CreateTripDto/UpdateTripDto).
 */
export class AssignTripDto {
  @IsOptional()
  @IsString()
  driverRef?: string;

  @IsOptional()
  @IsString()
  fleetRegNbr?: string;
}
