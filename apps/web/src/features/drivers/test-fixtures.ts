import type { DriverEntity } from '@cockpit/shared/api'

/** Shared builder for Drivers tests (driver-status.test.ts and any future component specs). */
export function baseDriver(overrides: Partial<DriverEntity> = {}): DriverEntity {
  return {
    id: 'driver-1',
    ref: 'D-FR-INT-001',
    name: 'John Smith',
    countryCode: 'FR',
    firstName: 'John',
    lastName: 'Smith',
    phone: '0611111111',
    company: null,
    email: null,
    area: 'Local',
    eventsOnly: false,
    eventCountry: null,
    eventArea: null,
    eventClientId: null,
    eventClient: null,
    unavailability: null,
    fleetReserved: null,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
