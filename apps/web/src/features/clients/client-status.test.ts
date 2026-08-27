import { describe, expect, it } from 'vitest'
import { ClientEntityClientType } from '@cockpit/shared/api'
import { clientTypeLabel, defaultClientFilters } from './client-status'

describe('clientTypeLabel', () => {
  it.each([
    [ClientEntityClientType.INDIVIDUAL, 'Individual'],
    [ClientEntityClientType.COMPANY, 'Company'],
    [ClientEntityClientType.EVENT, 'Events'],
  ] as const)('labels %s as %s', (type, label) => {
    expect(clientTypeLabel(type)).toBe(label)
  })
})

describe('defaultClientFilters', () => {
  it('starts with no search, no type restriction, and inactive accounts hidden', () => {
    expect(defaultClientFilters()).toEqual({ search: '', type: '', showInactive: false })
  })
})
