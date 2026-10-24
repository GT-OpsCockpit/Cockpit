import { PartialType } from '@nestjs/swagger';
import { CreatePriceListEntryDto } from './create-price-list-entry.dto';

export class UpdatePriceListEntryDto extends PartialType(
  CreatePriceListEntryDto,
) {}
