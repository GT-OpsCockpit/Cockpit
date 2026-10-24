import { IsOptional, IsString } from 'class-validator';

export class ListPriceListsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  /** Only price lists attached to this client. */
  @IsOptional()
  @IsString()
  clientRef?: string;
}
