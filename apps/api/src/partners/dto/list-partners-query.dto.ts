import { Transform } from 'class-transformer';
import { IsOptional, IsBoolean, IsString } from 'class-validator';

export class ListPartnersQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;

  /** Drivers & Partners page "Vehicle category" filter — matches a partner whose own roster includes a vehicle of this Category name. */
  @IsOptional()
  @IsString()
  category?: string;
}
