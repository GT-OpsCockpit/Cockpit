import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ClientType, Billing } from '../../../generated/prisma/enums';
import {
  IsCountryCode,
  IsEmailFormat,
  IsPhone,
} from '../../common/validators/contact.validators';

export class CreateClientDto {
  @IsEnum(ClientType)
  clientType: ClientType;

  @IsOptional()
  @IsString()
  contactFirstName?: string;

  @IsOptional()
  @IsString()
  contactLastName?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  acronym?: string;

  @IsOptional()
  @IsString()
  refPoOther?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsCountryCode()
  countryCode?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsOptional()
  @IsEmailFormat()
  email?: string;

  @IsOptional()
  @IsEnum(Billing)
  billing?: Billing;

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
  @IsCountryCode()
  eventCountry?: string;

  @IsOptional()
  @IsString()
  eventArea?: string;

  @IsOptional()
  @IsDateString()
  eventStartDate?: string;

  @IsOptional()
  @IsDateString()
  eventEndDate?: string;
}
