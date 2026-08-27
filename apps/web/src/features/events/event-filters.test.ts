import { describe, expect, it } from 'vitest'
import { baseClient, baseTrip } from '../bookings/test-fixtures'
import { applyEventFilters, defaultEventFilters } from './event-filters'

const monaco = baseClient({ ref: 'CE1', company: 'Grand Prix', refPoOther: 'PO-2026-001', clientType: 'EVENT' })
const cannes = baseClient({ ref: 'CE2', company: 'Cannes Gala', refPoOther: 'PO-2026-777', clientType: 'EVENT' })

describe('applyEventFilters', () => {
  it('passes everything through with the default (empty) filters', () => {
    const trips = [baseTrip({ client: monaco }), baseTrip({ client: cannes })]
    expect(applyEventFilters(trips, defaultEventFilters())).toHaveLength(2)
  })

  it('narrows by the exact client ref', () => {
    const trips = [baseTrip({ ref: 'R1', client: monaco }), baseTrip({ ref: 'R2', client: cannes })]
    const result = applyEventFilters(trips, { ...defaultEventFilters(), clientRef: 'CE1' })
    expect(result.map((t) => t.ref)).toEqual(['R1'])
  })

  it('narrows by country code', () => {
    const trips = [baseTrip({ ref: 'R1', countryCode: 'FR' }), baseTrip({ ref: 'R2', countryCode: 'MC' })]
    const result = applyEventFilters(trips, { ...defaultEventFilters(), countryCode: 'MC' })
    expect(result.map((t) => t.ref)).toEqual(['R2'])
  })

  it('narrows by vehicle type name', () => {
    const trips = [
      baseTrip({ ref: 'R1', vehicleType: { id: 'v1', ref: 'V1', name: 'Business', maxPax: 3, active: true, createdAt: '' } }),
      baseTrip({ ref: 'R2', vehicleType: { id: 'v2', ref: 'V2', name: 'Van', maxPax: 8, active: true, createdAt: '' } }),
    ]
    const result = applyEventFilters(trips, { ...defaultEventFilters(), vehicleType: 'Van' })
    expect(result.map((t) => t.ref)).toEqual(['R2'])
  })

  it('narrows by a pickupAt date range (Paris-local date)', () => {
    const trips = [
      baseTrip({ ref: 'R1', pickupAt: '2026-05-20T09:00:00.000Z' }),
      baseTrip({ ref: 'R2', pickupAt: '2026-05-24T09:00:00.000Z' }),
      baseTrip({ ref: 'R3', pickupAt: '2026-05-28T09:00:00.000Z' }),
    ]
    const result = applyEventFilters(trips, { ...defaultEventFilters(), dateStart: '2026-05-21', dateEnd: '2026-05-25' })
    expect(result.map((t) => t.ref)).toEqual(['R2'])
  })

  it('matches Event name against the linked client\'s company field, case-insensitively', () => {
    const trips = [baseTrip({ ref: 'R1', client: monaco }), baseTrip({ ref: 'R2', client: cannes })]
    const result = applyEventFilters(trips, { ...defaultEventFilters(), eventName: 'grand prix' })
    expect(result.map((t) => t.ref)).toEqual(['R1'])
  })

  it('matches Ref/PO/Other against the linked client\'s refPoOther field', () => {
    const trips = [baseTrip({ ref: 'R1', client: monaco }), baseTrip({ ref: 'R2', client: cannes })]
    const result = applyEventFilters(trips, { ...defaultEventFilters(), refPoOther: '777' })
    expect(result.map((t) => t.ref)).toEqual(['R2'])
  })
})
