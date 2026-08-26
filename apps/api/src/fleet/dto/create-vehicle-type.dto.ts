import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateVehicleTypeDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  @Min(1)
  maxPax: number;
}
