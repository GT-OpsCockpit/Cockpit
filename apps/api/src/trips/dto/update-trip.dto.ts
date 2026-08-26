import { IsBoolean, IsOptional } from 'class-validator';
import { OmitType } from '@nestjs/mapped-types';
import { CreateTripDto } from './create-trip.dto';

// Legacy's PUT never touches pocEmail (no equivalent field in the edit popup)
// and never accepts a manual ref (the ref only changes automatically, when
// the linked client account changes) — both omitted here to match.
export class UpdateTripDto extends OmitType(CreateTripDto, [
  'pocEmail',
  'ref',
] as const) {
  /** "Confirm and send" checkbox — best-effort WhatsApp to the POC after saving. */
  @IsOptional()
  @IsBoolean()
  notifyDriver?: boolean;
}
