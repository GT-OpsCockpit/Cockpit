import { describe, expect, it } from 'vitest'
import { entryCurrencies, eurFromForeign, foreignFromEur } from './price-currency'

describe('price currency', () => {
  it('converts a typed amount to euros at the rate of the day, to the cent', () => {
    expect(eurFromForeign(100, 1.0642)).toBe(106.42)
    expect(eurFromForeign(33.33, 0.9)).toBe(30)
  })

  it('reads a euro price back in the foreign currency', () => {
    expect(foreignFromEur(106.42, 1.0642)).toBe(100)
  })

  it('offers the euro, and the foreign currency of a service abroad', () => {
    expect(entryCurrencies('CHF')).toEqual(['EUR', 'CHF'])
    expect(entryCurrencies('EUR')).toEqual(['EUR'])
    expect(entryCurrencies(undefined)).toEqual(['EUR'])
  })
})
