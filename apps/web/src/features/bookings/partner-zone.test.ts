import { describe, expect, it } from 'vitest'
import { partnerCarFits, partnerServesBooking, type BookingEnd } from './partner-zone'

const zurich = { countryCode: 'CH', area: 'Zurich' }
const bls = { countryCode: 'CH', area: 'Bern' }
const nice = { countryCode: 'FR', area: 'Nice' }

const zurichAirport: BookingEnd = { countryCode: 'CH', text: 'Zurich Flughafen' }
const zurichCity: BookingEnd = { countryCode: 'CH', text: 'Bahnhofstrasse 1, Zürich' }
const niceEnd: BookingEnd = { countryCode: 'FR', text: 'Nice Côte d’Azur Airport' }

describe('partnerServesBooking', () => {
  it('offers a Zurich partner, not one from another Swiss city, for a Zurich airport → Zurich city transfer', () => {
    const ends = [zurichAirport, zurichCity]
    expect(partnerServesBooking(zurich, ends)).toBe(true)
    expect(partnerServesBooking(bls, ends)).toBe(false)
  })

  it('offers the partners of both ends for a Zurich → Nice transfer', () => {
    const ends = [zurichAirport, niceEnd]
    expect(partnerServesBooking(zurich, ends)).toBe(true)
    expect(partnerServesBooking(nice, ends)).toBe(true)
    expect(partnerServesBooking(bls, ends)).toBe(false)
  })

  it('does not offer a partner of the same city name in another country', () => {
    expect(partnerServesBooking({ countryCode: 'FR', area: 'Zurich' }, [zurichAirport])).toBe(false)
  })

  it('ignores accents and case in the zone', () => {
    expect(partnerServesBooking({ countryCode: 'CH', area: 'ZÜRICH' }, [zurichAirport])).toBe(true)
  })

  it('matches on the country alone when the partner has no zone, or a "Local" one', () => {
    expect(partnerServesBooking({ countryCode: 'FR', area: null }, [niceEnd])).toBe(true)
    expect(partnerServesBooking({ countryCode: 'FR', area: 'Local' }, [niceEnd])).toBe(true)
  })

  it('counts Monaco as France: a French local partner serves a Monaco → Nice transfer', () => {
    const frenchLocal = { countryCode: 'FR', area: 'Local' }
    const ends: BookingEnd[] = [{ countryCode: 'MC', text: 'Monaco' }, { countryCode: 'MC', text: 'Nice' }]
    expect(partnerServesBooking(frenchLocal, ends)).toBe(true)
    expect(partnerServesBooking(zurich, ends)).toBe(false)
  })

  it('does not offer a partner with no country on file', () => {
    expect(partnerServesBooking({ countryCode: null, area: 'Zurich' }, [zurichAirport])).toBe(false)
  })

  it('offers every partner while no end of the booking is located yet', () => {
    expect(partnerServesBooking(bls, [{ countryCode: '' }, {}])).toBe(true)
  })
})

describe('partnerCarFits', () => {
  const eBusiness = { fleetReserved: { categoryId: 'e-business' } }

  it('rules out a partner whose single car is of another category than the one asked for', () => {
    expect(partnerCarFits(eBusiness, 'van')).toBe(false)
    expect(partnerCarFits(eBusiness, 'e-business')).toBe(true)
  })

  it('keeps a driver with no reserved car, and any partner while no category is chosen', () => {
    expect(partnerCarFits({ fleetReserved: null }, 'van')).toBe(true)
    expect(partnerCarFits(eBusiness, undefined)).toBe(true)
  })
})
