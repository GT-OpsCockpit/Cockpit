import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import tzlookup from 'tz-lookup';
import { PrismaService } from '../prisma/prisma.service';
import { EnvironmentVariables } from '../config/env.validation';
import { AIRPORT_FBO_DIRECTORY } from '../common/constants/airport-fbo';
import { normalizeSearch } from '../common/utils/normalize-search';
import {
  simplifyAddress,
  isAirportResult,
  extractIata,
  NominatimResult,
} from './nominatim.util';
import { FlightCheckDto } from './dto/flight-check.dto';
import {
  GeocodeTzEntity,
  GeocodeSearchResponseEntity,
  FboLookupEntity,
  FlightCheckResponseEntity,
  PocSearchResponseEntity,
  FxRateEntity,
} from './dto/geo-response.entity';

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const FX_API_URL = 'https://open.er-api.com/v6/latest/EUR';
const FLIGHT_NUMBER_PATTERN = /^([A-Z]{2,3})\s?(\d{1,4}[A-Z]?)$/;
const FLIGHT_TOLERANCE_MS = 90 * 60 * 1000;

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  private get userAgent(): string {
    return this.config.get('NOMINATIM_USER_AGENT', { infer: true });
  }

  private async nominatimSearch(
    q: string,
    limit: number,
  ): Promise<NominatimResult[]> {
    const url = `${NOMINATIM_SEARCH_URL}?format=json&addressdetails=1&extratags=1&limit=${limit}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'User-Agent': this.userAgent } });
    if (!res.ok) throw new Error(`nominatim_http_${res.status}`);
    return res.json() as Promise<NominatimResult[]>;
  }

  async geocodeTz(q: string): Promise<GeocodeTzEntity> {
    if (!q.trim())
      throw new BadRequestException('Missing q parameter (address).');
    let results: NominatimResult[];
    try {
      results = await this.nominatimSearch(q.trim(), 1);
    } catch (err) {
      this.logger.warn(`[geocode-tz] failed: ${(err as Error).message}`);
      throw new BadGatewayException(
        "Geocoding unavailable at the moment, using the selected country's timezone instead.",
      );
    }
    const r0 = results[0];
    if (!r0) {
      throw new NotFoundException(
        "Address not found, using the selected country's timezone instead.",
      );
    }
    const lat = parseFloat(r0.lat);
    const lon = parseFloat(r0.lon);
    return {
      tz: tzlookup(lat, lon),
      lat,
      lon,
      displayName: simplifyAddress(r0),
      countryCode: r0.address?.country_code?.toUpperCase() ?? null,
      isAirport: isAirportResult(r0),
      iata: extractIata(r0),
    };
  }

  async geocodeSearch(
    q: string,
    limit: number,
  ): Promise<GeocodeSearchResponseEntity> {
    if (q.trim().length < 2) return { results: [] };
    try {
      const results = await this.nominatimSearch(
        q.trim(),
        Math.min(limit || 5, 8),
      );
      const mapped = results
        .map((r) => {
          let tz: string | null;
          try {
            tz = tzlookup(parseFloat(r.lat), parseFloat(r.lon));
          } catch {
            tz = null;
          }
          return {
            displayName: simplifyAddress(r),
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
            tz,
            countryCode: r.address?.country_code?.toUpperCase() ?? null,
            isAirport: isAirportResult(r),
            iata: extractIata(r),
          };
        })
        .filter((r) => r.tz);
      return { results: mapped };
    } catch (err) {
      this.logger.warn(`[geocode-search] failed: ${(err as Error).message}`);
      throw new BadGatewayException(
        'Address search unavailable at the moment.',
      );
    }
  }

  fboLookup(q: string): FboLookupEntity {
    const norm = q.toLowerCase();
    const entry = AIRPORT_FBO_DIRECTORY.find((e) =>
      e.match.some((m) => norm.includes(m)),
    );
    return {
      found: !!entry,
      name: entry?.name ?? null,
      fbo: entry?.fbo ?? null,
    };
  }

  async flightCheck(dto: FlightCheckDto): Promise<FlightCheckResponseEntity> {
    const match = dto.flightNumber
      .trim()
      .toUpperCase()
      .match(FLIGHT_NUMBER_PATTERN);
    if (!match)
      throw new BadRequestException(
        'Invalid flight number format (e.g. AF1234)',
      );
    const [, carrier, number] = match;

    const appId = this.config.get('FLIGHTSTATS_APP_ID', { infer: true });
    const appKey = this.config.get('FLIGHTSTATS_APP_KEY', { infer: true });
    if (!appId || !appKey) {
      return {
        ok: true,
        configured: false,
        match: null,
        message:
          'Missing FlightStats credentials. Fill in FLIGHTSTATS_APP_ID and FLIGHTSTATS_APP_KEY in .env to enable real flight verification.',
      };
    }

    try {
      const [y, mo, d] = dto.pickupDate.split('-');
      const url = `https://api.flightstats.com/flex/flightstatus/rest/v2/json/flight/${carrier}/${number}/dep/${y}/${mo}/${d}?appId=${encodeURIComponent(appId)}&appKey=${encodeURIComponent(appKey)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`flightstats_http_${res.status}`);
      const data = (await res.json()) as {
        flightStatuses?: {
          departureDate?: { dateLocal?: string };
          arrivalDate?: { dateLocal?: string };
        }[];
      };
      const flightStatuses = data.flightStatuses ?? [];
      if (flightStatuses.length === 0) {
        return {
          ok: true,
          configured: true,
          match: false,
          message: 'No flight found for this reference on this date.',
        };
      }
      const flight = flightStatuses[0];
      const schedDep = flight.departureDate?.dateLocal;
      const schedArr = flight.arrivalDate?.dateLocal;
      const pickupInstant = new Date(
        `${dto.pickupDate}T${dto.pickupTime}:00`,
      ).getTime();
      const withinTolerance = (iso: string | undefined) =>
        !!iso &&
        Math.abs(new Date(iso).getTime() - pickupInstant) <=
          FLIGHT_TOLERANCE_MS;
      return {
        ok: true,
        configured: true,
        match: withinTolerance(schedDep) || withinTolerance(schedArr),
        scheduledDeparture: schedDep ?? null,
        scheduledArrival: schedArr ?? null,
      };
    } catch (err) {
      this.logger.warn(`[flight-check] failed: ${(err as Error).message}`);
      throw new BadGatewayException(
        'FlightStats verification unavailable at the moment.',
      );
    }
  }

  // TODO: this loads the entire client and trip tables into memory on every
  // call (no WHERE, no take) and filters/dedupes in JS below. It's an
  // autocomplete endpoint hit on every keystroke, so this should push the
  // normalizeSearch filtering into SQL (or at least cap with `take`) instead
  // of scanning unboundedly as the tables grow.
  async pocSearch(q: string, limit: number): Promise<PocSearchResponseEntity> {
    const query = normalizeSearch(q).trim();
    const seen = new Set<string>();
    const results: { name: string; phone: string | null }[] = [];

    const add = (name: string | null, phone: string | null) => {
      if (!name) return;
      const key = `${normalizeSearch(name)}|${phone ?? ''}`;
      if (seen.has(key)) return;
      if (query && !normalizeSearch(name).includes(query)) return;
      seen.add(key);
      results.push({ name, phone });
    };

    const [clients, trips] = await Promise.all([
      this.prisma.client.findMany({
        select: { pocName: true, pocPhone: true },
      }),
      this.prisma.trip.findMany({ select: { pocName: true, pocPhone: true } }),
    ]);
    for (const c of clients) add(c.pocName, c.pocPhone);
    for (const t of trips) add(t.pocName, t.pocPhone);

    return { results: results.slice(0, Math.min(limit || 8, 15)) };
  }

  async fxRate(currencyRaw: string): Promise<FxRateEntity> {
    const currency = currencyRaw.trim().toUpperCase();
    if (!currency) throw new BadRequestException('Missing currency parameter.');
    const today = new Date().toISOString().slice(0, 10);
    if (currency === 'EUR') return { currency, eurPerUnit: 1, date: today };

    const cached = await this.prisma.fxRateCache.findUnique({
      where: { currency },
    });
    if (cached && cached.fetchedAt.toISOString().slice(0, 10) === today) {
      return { currency, eurPerUnit: cached.eurPerUnit, date: today };
    }

    let rates: Record<string, number>;
    try {
      const res = await fetch(FX_API_URL);
      if (!res.ok) throw new Error(`fx_http_${res.status}`);
      const data = (await res.json()) as {
        result?: string;
        rates?: Record<string, number>;
      };
      if (data.result !== 'success' || !data.rates)
        throw new Error('fx_bad_response');
      rates = data.rates;
    } catch (err) {
      this.logger.warn(`[fx-rate] failed: ${(err as Error).message}`);
      throw new BadGatewayException(
        'Exchange rate service unavailable at the moment.',
      );
    }

    const unitsPerEur = rates[currency];
    if (!unitsPerEur)
      throw new NotFoundException(`Exchange rate unavailable for ${currency}.`);
    const eurPerUnit = 1 / unitsPerEur;
    const fetchedAt = new Date();
    await this.prisma.fxRateCache.upsert({
      where: { currency },
      create: { currency, eurPerUnit, fetchedAt },
      update: { eurPerUnit, fetchedAt },
    });
    return { currency, eurPerUnit, date: today };
  }
}
