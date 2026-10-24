import { PartialType } from '@nestjs/swagger';
import { CreatePassengerAddressDto } from './create-passenger-address.dto';

export class UpdatePassengerAddressDto extends PartialType(
  CreatePassengerAddressDto,
) {}
