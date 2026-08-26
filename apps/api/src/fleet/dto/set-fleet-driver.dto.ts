import { IsOptional, IsString } from 'class-validator';

export class SetFleetDriverDto {
  @IsOptional()
  @IsString()
  driverRef?: string | null;
}
