import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { GeoService } from './geo.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';

function makeConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    NOMINATIM_USER_AGENT: 'Test/1.0',
    FLIGHTSTATS_APP_ID: undefined,
    FLIGHTSTATS_APP_KEY: undefined,
    ...overrides,
  };
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService<EnvironmentVariables, true>;
}

function mockFetch(impl: (...args: unknown[]) => unknown): jest.Mock {
  const mock = jest.fn(impl);
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

describe('GeoService', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('geocodeTz', () => {
    it('rejects a blank query', async () => {
      const service = new GeoService({} as PrismaService, makeConfig());
      await expect(service.geocodeTz('  ')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('returns 404 when Nominatim finds nothing', async () => {
      mockFetch(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
      );
      const service = new GeoService({} as PrismaService, makeConfig());
      await expect(service.geocodeTz('nowhere')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns 502 when the Nominatim call fails', async () => {
      mockFetch(() => Promise.resolve({ ok: false, status: 500 }));
      const service = new GeoService({} as PrismaService, makeConfig());
      await expect(service.geocodeTz('paris')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('resolves tz/lat/lon/displayName/isAirport from the first result', async () => {
      mockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                lat: '43.6584',
                lon: '7.2159',
                display_name: "Nice Côte d'Azur Airport",
                address: {
                  aeroway: "Nice Côte d'Azur Airport",
                  city: 'Nice',
                  country: 'France',
                  country_code: 'fr',
                },
                class: 'aeroway',
                extratags: { iata: 'NCE' },
              },
            ]),
        }),
      );
      const service = new GeoService({} as PrismaService, makeConfig());
      const result = await service.geocodeTz('nice airport');
      expect(result.tz).toBe('Europe/Paris');
      expect(result.countryCode).toBe('FR');
      expect(result.isAirport).toBe(true);
      expect(result.iata).toBe('NCE');
    });
  });

  describe('fboLookup', () => {
    it('matches an airport by name or code', () => {
      const service = new GeoService({} as PrismaService, makeConfig());
      expect(service.fboLookup('Nice Airport').name).toBe(
        "Nice Côte d'Azur (NCE)",
      );
      expect(service.fboLookup('NCE').name).toBe("Nice Côte d'Azur (NCE)");
      expect(
        service.fboLookup('Aéroport de Paris-Le Bourget, 93350 Le Bourget')
          .name,
      ).toBe('Paris - Le Bourget (LBG)');
      expect(service.fboLookup('Genève Aéroport').name).toBe('Genève (GVA)');
    });

    it('does not match a keyword buried inside a longer word', () => {
      const service = new GeoService({} as PrismaService, makeConfig());
      // "France" ends in "nce": a raw substring match handed every French
      // address the Nice FBO, so a CDG pickup pre-filled a Nice address.
      expect(
        service.fboLookup(
          'Aéroport de Paris-Charles-de-Gaulle, Tremblay-en-France, France',
        ),
      ).toEqual({ found: false, name: null, fbo: null });
    });

    it('reports not-found for an airport outside the directory', () => {
      const service = new GeoService({} as PrismaService, makeConfig());
      expect(service.fboLookup('Nowhere')).toEqual({
        found: false,
        name: null,
        fbo: null,
      });
    });
  });

  describe('flightCheck', () => {
    it('rejects an invalid flight number format', async () => {
      const service = new GeoService({} as PrismaService, makeConfig());
      await expect(
        service.flightCheck({
          flightNumber: '1234',
          pickupDate: '2026-01-01',
          pickupTime: '10:00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('degrades gracefully when FlightStats credentials are missing', async () => {
      const service = new GeoService({} as PrismaService, makeConfig());
      const result = await service.flightCheck({
        flightNumber: 'AF1234',
        pickupDate: '2026-01-01',
        pickupTime: '10:00',
      });
      expect(result).toEqual(
        expect.objectContaining({ ok: true, configured: false, match: null }),
      );
    });
  });

  describe('fxRate', () => {
    it('returns 1 for EUR without touching the DB or network', async () => {
      const service = new GeoService({} as PrismaService, makeConfig());
      const result = await service.fxRate('eur');
      expect(result.eurPerUnit).toBe(1);
    });

    it('serves from a same-day cache without calling fetch', async () => {
      const fetchSpy = mockFetch(() => Promise.resolve({}));
      const prisma = {
        fxRateCache: {
          findUnique: jest.fn().mockResolvedValue({
            currency: 'USD',
            eurPerUnit: 0.9,
            fetchedAt: new Date(),
          }),
        },
      } as unknown as PrismaService;
      const service = new GeoService(prisma, makeConfig());
      const result = await service.fxRate('usd');
      expect(result.eurPerUnit).toBe(0.9);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fetches and caches when there is no fresh cache entry', async () => {
      mockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ result: 'success', rates: { USD: 1.1 } }),
        }),
      );
      const upsert = jest.fn().mockResolvedValue({});
      const prisma = {
        fxRateCache: { findUnique: jest.fn().mockResolvedValue(null), upsert },
      } as unknown as PrismaService;
      const service = new GeoService(prisma, makeConfig());
      const result = await service.fxRate('usd');
      expect(result.eurPerUnit).toBeCloseTo(1 / 1.1);
      expect(upsert).toHaveBeenCalledTimes(1);
    });

    it('404s for a currency the provider does not know', async () => {
      mockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ result: 'success', rates: {} }),
        }),
      );
      const prisma = {
        fxRateCache: { findUnique: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService;
      const service = new GeoService(prisma, makeConfig());
      await expect(service.fxRate('zzz')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('pocSearch', () => {
    it('dedups by name+phone and filters case/accent-insensitively', async () => {
      const prisma = {
        client: {
          findMany: jest.fn().mockResolvedValue([
            { pocName: 'José García', pocPhone: '111' },
            { pocName: 'Jose Garcia', pocPhone: '111' }, // dup of above (same normalized name+phone)
          ]),
        },
        trip: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ pocName: 'Alice', pocPhone: '222' }]),
        },
      } as unknown as PrismaService;
      const service = new GeoService(prisma, makeConfig());
      const { results } = await service.pocSearch('jose', 10);
      expect(results).toEqual([{ name: 'José García', phone: '111' }]);
    });
  });
});
