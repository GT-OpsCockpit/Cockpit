import { PartialType } from '@nestjs/mapped-types';
import { CreateClientDto } from './create-client.dto';

// Same fields as creation, all optional: PUT only applies the keys present in
// the body, matching the legacy's partial-update `updateClient()`.
export class UpdateClientDto extends PartialType(CreateClientDto) {}
