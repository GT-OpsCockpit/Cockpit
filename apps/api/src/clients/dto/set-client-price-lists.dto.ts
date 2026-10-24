import { IsArray, IsString } from 'class-validator';

/** Replaces the full set of price lists applicable to this client (not a diff/patch). */
export class SetClientPriceListsDto {
  @IsArray()
  @IsString({ each: true })
  priceListRefs: string[];
}
