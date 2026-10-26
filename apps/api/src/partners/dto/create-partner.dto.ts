import { IsBoolean, IsOptional, IsString, ValidateIf } from 'class-validator';
import { IsCountryCode, IsEmailFormat, IsPhone } from '../../common/validators/contact.validators';

/**
 * A sub-contracted partner — a company with its own roster of drivers and
 * vehicles, or a lone individual. See docs/feature-requests/partner-companies.md
 * for the validated shape (the "New partner" popup mockup this DTO backs).
 */
export class CreatePartnerDto {
  @IsOptional()
  @IsBoolean()
  individual?: boolean;

  // Required unless individual — a company partner has to be named to show
  // up as anything other than a lone contact on the Drivers & Partners page.
  @ValidateIf((o: CreatePartnerDto) => !o.individual)
  @IsString()
  companyName?: string;

  /** "Manager / dispatch name" for a company, "Contact name" for an individual. */
  @IsString()
  contactName: string;

  // Landline — optional. A blank string is accepted too (the edit form sends
  // it to clear the number). The email below is the one contact a partner must
  // have: automatic notification on assign/unassign/cancel goes there.
  @IsOptional()
  @ValidateIf((o: CreatePartnerDto) => o.phone !== '')
  @IsPhone()
  phone?: string;

  // Second contact number, alongside phone — optional.
  @IsOptional()
  @IsPhone()
  mobile?: string;

  @IsEmailFormat()
  email: string;

  @IsOptional()
  @IsCountryCode()
  countryCode?: string;

  @IsOptional()
  @IsString()
  area?: string;

  // Split name, used to seed the auto-created driver record for an
  // Individual partner (see PartnersService.createIndividualRoster) — the
  // form still sends the combined `contactName` above for display.
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  // Present only when creating an Individual partner with their own
  // vehicle — the "New partner" popup reveals these once the Individual
  // checkbox is on (see partner-form-fields.tsx). Creates a Driver +
  // FleetVehicle attached to this Partner in the same request, instead of
  // the separate "New driver" + "Link a vehicle" two-step flow.
  @ValidateIf((o: CreatePartnerDto) => !!o.individual)
  @IsString()
  vehicleCategory?: string;

  @ValidateIf((o: CreatePartnerDto) => !!o.individual)
  @IsString()
  vehicleRegNbr?: string;

  @ValidateIf((o: CreatePartnerDto) => !!o.individual)
  @IsString()
  vehicleMake?: string;

  @ValidateIf((o: CreatePartnerDto) => !!o.individual)
  @IsString()
  vehicleModel?: string;

  @IsOptional()
  @IsString()
  vehicleColor?: string;

  // Optional either way — an individual sub-contractor's own car may or may
  // not be 4WD, and there's no sensible default to assume for them (unlike
  // the Fleet "New vehicle" popup's own fourWD, which defaults false).
  @IsOptional()
  @IsBoolean()
  vehicleFourWD?: boolean;
}
