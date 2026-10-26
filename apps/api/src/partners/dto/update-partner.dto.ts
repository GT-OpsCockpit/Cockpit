import { PartialType } from '@nestjs/swagger';
import { CreatePartnerDto } from './create-partner.dto';

// Every field stays as strict as CreatePartnerDto's when it IS sent (the email
// can never be blanked — a partner Cockpit can't reach is the one thing this
// feature exists to prevent; the landline can, with a blank string);
// PartialType only makes each field optional to send at all, same as
// UpdateVehicleTypeDto.
export class UpdatePartnerDto extends PartialType(CreatePartnerDto) {}
