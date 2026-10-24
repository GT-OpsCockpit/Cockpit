import { IsBoolean, IsOptional, IsString, ValidateIf } from 'class-validator';
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

  // @IsOptional() alone only skips validation for undefined/null — an update
  // sends '' on purpose to clear the field (drivers.service.ts's update()
  // writes NULL for it), and @IsPhone() would otherwise reject that empty
  // string as "not a valid phone number", making the field impossible to
  // clear from the edit form. @ValidateIf mirrors the web form's own zod rule
  // (optionalPhone/optionalEmail, contact-fields.ts): empty is fine, filled
  // has to be valid.
  @ValidateIf((o: CreateDriverDto) => !!o.phone?.trim())
  @IsPhone()
  phone?: string;

  @IsOptional()
  @IsString()
  company?: string;

  // Attaches this driver to a real Partner's roster (Drivers & Partners
  // page), alongside the legacy free-text `company` above — see
  // Driver.partnerId's comment in schema.prisma.
  @IsOptional()
  @IsString()
  partnerRef?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @ValidateIf((o: CreateDriverDto) => !!o.email?.trim())
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
