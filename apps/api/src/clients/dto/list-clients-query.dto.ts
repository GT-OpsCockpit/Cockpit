import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ClientType } from '../../../generated/prisma/enums';

export class ListClientsQueryDto {
  /** Matches against ref, company/contact name, email and acronym (case-insensitive substring). */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ClientType)
  type?: ClientType;

  /**
   * The complement of `type` — the Invoicing Customer tab wants every account
   * that is not an Event, since Events have their own selector next to it.
   * Server-side for the same reason as the filters below: dropping the
   * unwanted rows from an already-paginated page would silently shorten the
   * list rather than shrink the query.
   */
  @IsOptional()
  @IsEnum(ClientType)
  excludeType?: ClientType;

  /**
   * The three filters below narrow an Events listing down to the accounts a
   * driver or fleet vehicle based at that location may actually be linked to
   * — the legacy's "Link to an Event" popup (openEventLinkModal,
   * common.js:3034). They are Prisma filters rather than a client-side pass
   * over the current page because this endpoint is paginated: filtering the
   * page would hide a mismatched event without shrinking the result set.
   * EventLinkService enforces the same rules on write.
   */
  @IsOptional()
  @IsString()
  eventCountry?: string;

  @IsOptional()
  @IsString()
  eventArea?: string;

  /** Drops Events whose end date has already passed. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  eventNotEnded?: boolean;

  // Query params arrive as strings — @Type(() => Boolean) would map "false"
  // to `true` (Boolean('false') is truthy), so this needs an explicit check.
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
