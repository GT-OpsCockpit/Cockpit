import { ClientEntityBilling, ClientEntityClientType } from '@cockpit/shared/api'
import type { ClientEntity } from '@cockpit/shared/api'

/** Shared builder for Clients tests (client-status.test.ts and any future component specs). */
export function baseClient(overrides: Partial<ClientEntity> = {}): ClientEntity {
  return {
    id: 'client-1',
    ref: 'CI1',
    name: 'Marc Dubois',
    clientType: ClientEntityClientType.INDIVIDUAL,
    contactFirstName: 'Marc',
    contactLastName: 'Dubois',
    company: null,
    acronym: null,
    refPoOther: null,
    address: null,
    postalCode: null,
    city: null,
    countryCode: 'FR',
    vatNumber: null,
    email: 'marc.dubois@example.com',
    billing: ClientEntityBilling.ACCOUNT,
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
