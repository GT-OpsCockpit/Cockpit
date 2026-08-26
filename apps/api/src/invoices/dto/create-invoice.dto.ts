import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateInvoiceDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tripRefs: string[];

  @IsOptional()
  @IsString()
  clientRef?: string;

  @IsOptional()
  @IsString()
  eventRef?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
