import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePriceListDto } from './create-price-list.dto';

// Entries are edited one at a time through their own sub-resource endpoints,
// same reasoning as UpdatePassengerDto omitting `routes`.
export class UpdatePriceListDto extends PartialType(
  OmitType(CreatePriceListDto, ['entries'] as const),
) {}
