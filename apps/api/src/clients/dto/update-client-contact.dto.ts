import { PartialType } from '@nestjs/swagger';
import { CreateClientContactDto } from './create-client-contact.dto';

export class UpdateClientContactDto extends PartialType(
  CreateClientContactDto,
) {}
