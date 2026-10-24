import { IsArray, IsString } from 'class-validator';

/** Replaces the full set of clients this price list applies to (not a diff/patch). */
export class SetPriceListClientsDto {
  @IsArray()
  @IsString({ each: true })
  clientRefs: string[];
}
