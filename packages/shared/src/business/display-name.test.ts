import { describe, expect, it } from 'vitest'
import { clientDisplayName, driverDisplayName, driverLabel, partnerLabel } from './display-name.js'

describe('clientDisplayName', () => {
  it('prefers the company name when present', () => {
    expect(
      clientDisplayName({
        ref: 'CC1',
        company: '  Acme Corp  ',
        contactFirstName: 'Jane',
        contactLastName: 'Doe',
      }),
    ).toBe('Acme Corp')
  })

  it('falls back to the contact full name when there is no company', () => {
    expect(
      clientDisplayName({ ref: 'CI1', company: null, contactFirstName: 'Jane', contactLastName: 'Doe' }),
    ).toBe('Jane Doe')
  })

  it('falls back to "Account {ref}" when neither is set', () => {
    expect(
      clientDisplayName({ ref: 'CI2', company: null, contactFirstName: null, contactLastName: null }),
    ).toBe('Account CI2')
  })
})

describe('driverDisplayName', () => {
  it('is first + last, joined and end-trimmed', () => {
    expect(driverDisplayName({ firstName: 'Jean', lastName: 'Dupont' })).toBe('Jean Dupont')
    // Only the ends are trimmed, as in the legacy (server.js:604) — a stray
    // space inside a stored field is kept rather than collapsed.
    expect(driverDisplayName({ firstName: ' Jean ', lastName: 'Dupont' })).toBe('Jean  Dupont')
  })

  it('drops the missing half rather than padding it', () => {
    expect(driverDisplayName({ firstName: 'Jean', lastName: null })).toBe('Jean')
    expect(driverDisplayName({ firstName: null, lastName: 'Dupont' })).toBe('Dupont')
  })

  // The legacy's server.js:604 has no fallback here — unlike the client name
  // just above, which does. Company is a field of its own everywhere it is
  // shown, so the name never carries it.
  it('is empty for a partner company with nobody named on file — no fallback', () => {
    expect(driverDisplayName({ firstName: null, lastName: null })).toBe('')
  })
})

describe('driverLabel', () => {
  it('is the name when there is one', () => {
    expect(driverLabel({ ref: 'D1', firstName: 'Jean', lastName: 'Dupont', company: 'Acme' })).toBe('Jean Dupont')
  })

  it('falls back to the company, then the ref, so a cell is never blank', () => {
    expect(driverLabel({ ref: 'D2', firstName: null, lastName: null, company: ' Acme ' })).toBe('Acme')
    expect(driverLabel({ ref: 'D3', firstName: null, lastName: null, company: null })).toBe('D3')
  })
})

describe('partnerLabel', () => {
  it('joins the chauffeur and the company when both are known', () => {
    expect(partnerLabel({ ref: 'D1', firstName: 'Jean', lastName: 'Dupont', company: 'Acme' })).toBe('Jean Dupont — Acme')
  })

  it('drops the missing half rather than leaving a dangling separator', () => {
    expect(partnerLabel({ ref: 'D2', firstName: null, lastName: null, company: 'Acme' })).toBe('Acme')
    expect(partnerLabel({ ref: 'D3', firstName: 'Jean', lastName: 'Dupont', company: null })).toBe('Jean Dupont')
    expect(partnerLabel({ ref: 'D4', firstName: null, lastName: null, company: null })).toBe('D4')
  })
})
