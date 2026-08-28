import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

/** Bounded to keep one request from rewriting an unbounded slice of the roster. */
const MAX_PER_CALL = 200;

export class ReactivateDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PER_CALL)
  @IsString({ each: true })
  driverRefs?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PER_CALL)
  @IsString({ each: true })
  fleetVehicleRefs?: string[];
}
