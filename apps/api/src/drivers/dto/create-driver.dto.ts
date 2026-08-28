import { IsBoolean, IsOptional, IsString } from 'class-validator';
import {
  IsCountryCode,
  IsEmailFormat,
  IsPhone,
} from '../../common/validators/contact.validators';

export class CreateDriverDto {
  @IsOptional()
  @IsCountryCode()
  countryCode?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsPhone()
  phone?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsEmailFormat()
  email?: string;

  @IsOptional()
  @IsBoolean()
  eventsOnly?: boolean;

  @IsOptional()
  @IsCountryCode()
  eventCountry?: string;

  @IsOptional()
  @IsString()
  eventArea?: string;

  /** Ref of the linked event Client account (e.g. "CE1"). */
  @IsOptional()
  @IsString()
  eventRef?: string;
}
