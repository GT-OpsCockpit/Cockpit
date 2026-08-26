import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateDriverDto {
  @IsOptional()
  @IsString()
  countryCode?: string;

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
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsBoolean()
  eventsOnly?: boolean;

  @IsOptional()
  @IsString()
  eventCountry?: string;

  @IsOptional()
  @IsString()
  eventArea?: string;

  /** Ref of the linked event Client account (e.g. "CE1"). */
  @IsOptional()
  @IsString()
  eventRef?: string;
}
