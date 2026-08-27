import { TripEntityBilling, TripEntityService } from '@cockpit/shared/api'
import type { ClientBaseEntity, DriverBaseEntity, TripEntity, TripStepEntity, TripStepEntityStep } from '@cockpit/shared/api'

/** Shared builders for Bookings tests — both pure-logic (trip-status.test.ts) and component (*.test.tsx) specs. */

export function baseClient(overrides: Partial<ClientBaseEntity> = {}): ClientBaseEntity {
  return {
    id: 'client-1',
    ref: 'CI1',
    clientType: 'COMPANY',
    contactFirstName: null,
    contactLastName: null,
    company: 'Acme Corp',
    acronym: 'ACM',
    refPoOther: null,
    address: null,
    postalCode: null,
    city: null,
    countryCode: 'FR',
    vatNumber: null,
    email: null,
    billing: TripEntityBilling.ACCOUNT,
    pocName: null,
    pocPhone: null,
    pocEmail: null,
    eventCountry: null,
    eventArea: null,
    eventStartDate: null,
    eventEndDate: null,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function baseDriver(overrides: Partial<DriverBaseEntity> = {}): DriverBaseEntity {
  return {
    id: 'driver-1',
    ref: 'D-FR-NI-XXX-001',
    countryCode: 'FR',
    firstName: 'Julien',
    lastName: 'Petit',
    phone: '+33698765432',
    company: null,
    email: null,
    area: 'Local',
    eventsOnly: false,
    eventCountry: null,
    eventArea: null,
    eventClientId: null,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function step(step: TripStepEntityStep, occurredAt = '2026-01-01T00:00:00.000Z'): TripStepEntity {
  return { id: `step-${step}`, tripId: 'trip-1', step, occurredAt }
}

export function baseTrip(overrides: Partial<TripEntity> = {}): TripEntity {
  return {
    priceEur: null,
    partnerRateEur: null,
    client: baseClient(),
    driver: null,
    partner: null,
    vehicleType: null,
    fleetVehicle: null,
    steps: [],
    id: 'trip-1',
    ref: 'R-CI1-26-1',
    countryCode: 'FR',
    area: 'Nice',
    timezone: 'Europe/Paris',
    pickupAt: '2026-09-01T10:00:00.000Z',
    pickupLocation: 'Nice Airport',
    dropoffLocation: 'Hotel Negresco',
    service: TripEntityService.TSF,
    hours: null,
    instructions: null,
    clientId: 'client-1',
    passengerName: 'Jane Doe',
    pocName: null,
    pocPhone: null,
    pocEmail: null,
    tracking: true,
    paxCount: 1,
    vehicleTypeId: null,
    fleetVehicleId: null,
    driverId: null,
    billing: TripEntityBilling.ACCOUNT,
    flightNumber: null,
    bufferTime: null,
    fboAddress: null,
    tailNbr: null,
    nameboardUrl: null,
    pickupIata: null,
    dropoffIata: null,
    subContractor: false,
    partnerId: null,
    dispatched: false,
    invoiced: false,
    assignmentCancelled: false,
    assignmentCancelledAt: null,
    cancellationFee: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
