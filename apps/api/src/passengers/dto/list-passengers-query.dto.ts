import { IsOptional, IsString } from 'class-validator';

export class ListPassengersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  /** Only passengers belonging to this client — omit for everyone (including independents). */
  @IsOptional()
  @IsString()
  clientRef?: string;
}
