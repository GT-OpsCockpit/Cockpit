import { IsOptional, IsString } from 'class-validator';

export class AreaSuggestionsQueryDto {
  /**
   * The country already chosen in the paired Country field — a plain code
   * ("FR", "MC") or a US regional one ("US-NY"). Optional: with no country
   * chosen there is nothing to suggest and "Local" is not allowed either,
   * so the frontend can call this unconditionally.
   */
  @IsOptional()
  @IsString()
  countryCode?: string;
}
