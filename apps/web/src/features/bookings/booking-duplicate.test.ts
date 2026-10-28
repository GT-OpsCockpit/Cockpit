import { describe, expect, it } from 'vitest'
import { canReturn, copyValues } from './booking-duplicate'
import { tripFormDefaults, type TripFormValues } from './trip-form-schema'

const original: TripFormValues = {
  ...tripFormDefaults(),
  countryCode: 'MC',
  area: 'Monaco',
  pickupDate: '2026-11-02',
  pickupTime: '09:00',
  vehicleType: 'Sedan',
  clientRef: 'C1',
  passengerName: 'Ada',
  pickupLocation: 'Monaco',
  dropoffLocation: 'Nice Airport',
  pickupIata: '',
  dropoffIata: 'NCE',
  dropoffIsAirport: true,
  dropoffCountryCode: 'FR',
  flightNumber: 'AF123',
  priceEur: 150,
  driverRef: 'D1',
  subContractor: true,
  partnerRef: 'P1',
  partnerRateEur: 100,
  pickupTimezone: 'Europe/Monaco',
}
const options = { pickupDate: '2026-11-05', pickupTime: '18:30', vehicleType: 'Van', count: 2 }

describe('copyValues', () => {
  it('repeats the booking at the new date, time and vehicle, unassigned', () => {
    const copy = copyValues(original, { kind: 'duplicate', ...options })
    expect(copy).toMatchObject({
      pickupDate: '2026-11-05',
      pickupTime: '18:30',
      vehicleType: 'Van',
      pickupLocation: 'Monaco',
      dropoffLocation: 'Nice Airport',
      passengerName: 'Ada',
      priceEur: 150,
      pickupTimezone: 'Europe/Monaco',
      driverRef: '',
      subContractor: false,
      partnerRef: '',
    })
  })

  it('runs a return the other way, each end keeping its own airport code and country', () => {
    const copy = copyValues(original, { kind: 'return', ...options })
    expect(copy).toMatchObject({
      pickupLocation: 'Nice Airport',
      dropoffLocation: 'Monaco',
      pickupIata: 'NCE',
      dropoffIata: '',
      pickupIsAirport: true,
      countryCode: 'FR',
      dropoffCountryCode: 'MC',
      area: '',
      flightNumber: '',
      pickupTimezone: '',
      pickupDate: '2026-11-05',
      priceEur: 150,
    })
  })

  it('keeps the area when a return stays in one country', () => {
    const local = { ...original, dropoffCountryCode: 'MC' }
    expect(copyValues(local, { kind: 'return', ...options }).area).toBe('Monaco')
  })
})

describe('canReturn', () => {
  it('needs a drop-off, and is not for an ASD', () => {
    expect(canReturn({ service: 'TSF', dropoffLocation: 'Nice' })).toBe(true)
    expect(canReturn({ service: 'TSF', dropoffLocation: '' })).toBe(false)
    expect(canReturn({ service: 'ASD', dropoffLocation: 'Nice' })).toBe(false)
  })
})
