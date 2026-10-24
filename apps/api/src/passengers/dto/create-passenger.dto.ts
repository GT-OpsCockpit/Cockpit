import { IsArray, IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePassengerRouteDto } from './create-passenger-route.dto';

export class CreatePassengerDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Optional — a passenger may belong to one client (an employee always
   * booked through their company's account) or to none (independent,
   * bookable under any client). Resolved to clientId server-side.
   */
  @IsOptional()
  @IsString()
  clientRef?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePassengerRouteDto)
  routes?: CreatePassengerRouteDto[];
}
