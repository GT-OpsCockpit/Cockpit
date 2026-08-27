import type { FleetVehicleEntity, VehicleTypeEntity } from '@cockpit/shared/api'

export function baseVehicleType(overrides: Partial<VehicleTypeEntity> = {}): VehicleTypeEntity {
  return {
    id: 'type-1',
    ref: 'V1',
    name: 'Business',
    maxPax: 3,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/** Shared builder for Fleet tests (vehicle-status.test.ts and any future component specs). */
export function baseVehicle(overrides: Partial<FleetVehicleEntity> = {}): FleetVehicleEntity {
  return {
    id: 'vehicle-1',
    ref: 'F1',
    categoryId: 'type-1',
    category: baseVehicleType(),
    regNbr: 'AB-123-CD',
    make: 'Mercedes-Benz',
    model: 'E-Class',
    yearOfBuild: 2025,
    fourWD: false,
    nbPax: 3,
    color: 'Metallic Black',
    acronym: 'S123',
    isLocal: true,
    countryCode: null,
    area: null,
    partnerCompany: null,
    driverId: null,
    driver: null,
    eventsOnly: false,
    eventCountry: null,
    eventArea: null,
    eventClientId: null,
    eventClient: null,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    unavailability: null,
    ...overrides,
  }
}
