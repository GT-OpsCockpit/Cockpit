import type { CompanyInfoEntity, PublicUserEntity } from '@cockpit/shared/api'

export function baseCompanyInfo(overrides: Partial<CompanyInfoEntity> = {}): CompanyInfoEntity {
  return {
    id: 1,
    name: 'Cockpit Transport',
    legalName: 'Cockpit Transport SARL',
    street1: '1 Rue de la Paix',
    zipCode: '75002',
    city: 'Paris',
    countryCode: 'FR',
    vatNbr: 'FR12345678901',
    email: 'contact@cockpit.test',
    website: 'https://cockpit.test',
    ownerSurname: 'Dubois',
    ownerName: 'Marc',
    mobile: '0611111111',
    ownerEmail: 'marc.dubois@cockpit.test',
    saved: true,
    ...overrides,
  }
}

export function baseUser(overrides: Partial<PublicUserEntity> = {}): PublicUserEntity {
  return {
    id: 'user-1',
    email: 'jane.doe@cockpit.test',
    role: 'DISPATCHER',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '0611111111',
    active: true,
    deactivatedAt: null,
    lastLoginAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
