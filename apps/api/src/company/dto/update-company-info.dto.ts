import { IsNotEmpty, IsString } from 'class-validator';
import {
  IsCountryCode,
  IsEmailFormat,
  IsPhone,
} from '../../common/validators/contact.validators';

// All 13 fields are required together, matching the legacy's all-or-nothing
// COMPANY_INFO_FIELDS validation.
export class UpdateCompanyInfoDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  legalName: string;

  @IsString()
  @IsNotEmpty()
  street1: string;

  @IsString()
  @IsNotEmpty()
  zipCode: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsCountryCode()
  countryCode: string;

  @IsString()
  @IsNotEmpty()
  vatNbr: string;

  @IsEmailFormat()
  email: string;

  @IsString()
  @IsNotEmpty()
  website: string;

  @IsString()
  @IsNotEmpty()
  ownerSurname: string;

  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @IsPhone()
  mobile: string;

  @IsEmailFormat()
  ownerEmail: string;
}
