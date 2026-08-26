import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '../../../generated/prisma/client';

export class GeocodeTzEntity {
  tz: string;
  lat: number;
  lon: number;
  displayName: string;
  countryCode: string | null;
  isAirport: boolean;
  iata: string | null;
}

export class GeocodeSearchHitEntity {
  displayName: string;
  lat: number;
  lon: number;
  tz: string | null;
  countryCode: string | null;
  isAirport: boolean;
  iata: string | null;
}

export class GeocodeSearchResponseEntity {
  results: GeocodeSearchHitEntity[];
}

export class FboLookupEntity {
  found: boolean;
  name: string | null;
  fbo: string | null;
}

/**
 * Shape varies with `configured`/`match` (no FlightStats credentials vs. no
 * match vs. a real match) — modeled as one class with the union of every
 * field any branch can send, rather than a discriminated union the Swagger
 * plugin can't turn into a real schema anyway.
 */
export class FlightCheckResponseEntity {
  ok: boolean;
  configured: boolean;
  match: boolean | null;
  message?: string;
  scheduledDeparture?: string | null;
  scheduledArrival?: string | null;
}

export class PocSearchHitEntity {
  name: string;
  phone: string | null;
}

export class PocSearchResponseEntity {
  results: PocSearchHitEntity[];
}

export class FxRateEntity {
  currency: string;

  // A plain JS number for the EUR short-circuit, but a Prisma Decimal
  // (serialized to a JSON string by its toJSON()) when read back from the
  // FxRateCache — both are genuinely possible over the wire, hence the
  // explicit oneOf (the TS type keeps the real Decimal type; only the
  // documented schema is simplified to number | string).
  @ApiProperty({ oneOf: [{ type: 'number' }, { type: 'string' }] })
  eurPerUnit: number | Prisma.Decimal;

  date: string;
}
