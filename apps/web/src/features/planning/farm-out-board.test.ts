import { describe, expect, it } from 'vitest'
import { baseTrip } from '../bookings/test-fixtures'
import { farmOutRowKey, farmOutRows, isOnFarmOutBoard } from './farm-out-board'
import { computeTimelineWindow } from './planning-timeline-math'

const window = computeTimelineWindow('2026-09-01', 1)
const onDay = { pickupAt: '2026-09-01T10:00:00.000Z' }

const partnerDriver = { ref: 'D-9', firstName: 'Luc', lastName: 'Meyer', company: 'BLS', phone: null } as never
const company = { ref: 'P-1', companyName: 'Limousines Zurich', contactName: 'Ana' } as never

describe('isOnFarmOutBoard', () => {
  it('holds a sub-contracted trip given to a partner driver or to a partner company', () => {
    expect(isOnFarmOutBoard(baseTrip({ subContractor: true, partner: partnerDriver }))).toBe(true)
    expect(isOnFarmOutBoard(baseTrip({ subContractor: true, directPartner: company }))).toBe(true)
  })

  it('leaves a sub-contracted trip nobody has been picked for to the Local board, and our own trips too', () => {
    expect(isOnFarmOutBoard(baseTrip({ subContractor: true }))).toBe(false)
    expect(isOnFarmOutBoard(baseTrip({ subContractor: false }))).toBe(false)
  })
})

describe('farmOutRowKey', () => {
  it('shares one row between the trips of a partner driver, and gives each partner-company trip its own', () => {
    const a = baseTrip({ ref: 'R-1', subContractor: true, partner: partnerDriver })
    const b = baseTrip({ ref: 'R-2', subContractor: true, partner: partnerDriver })
    expect(farmOutRowKey(a)).toBe(farmOutRowKey(b))

    const c = baseTrip({ ref: 'R-3', subContractor: true, directPartner: company })
    const d = baseTrip({ ref: 'R-4', subContractor: true, directPartner: company })
    expect(farmOutRowKey(c)).not.toBe(farmOutRowKey(d))
  })
})

describe('farmOutRows', () => {
  it('labels a partner-company row with the company and the vehicle type ordered', () => {
    const trip = baseTrip({
      ...onDay,
      subContractor: true,
      directPartner: company,
      vehicleType: { name: 'Van' } as never,
    })

    expect(farmOutRows([trip], window)).toEqual([
      { key: farmOutRowKey(trip), label: 'Limousines Zurich', subLabel: 'Van' },
    ])
  })

  it('makes a single row for a partner driver with several trips', () => {
    const trips = [
      baseTrip({ ...onDay, ref: 'R-1', subContractor: true, partner: partnerDriver }),
      baseTrip({ ...onDay, ref: 'R-2', subContractor: true, partner: partnerDriver }),
    ]

    expect(farmOutRows(trips, window)).toHaveLength(1)
  })

  it('leaves out trips that are not farmed out or fall outside the visible days', () => {
    const trips = [
      baseTrip({ ...onDay, ref: 'R-1', subContractor: false }),
      baseTrip({ pickupAt: '2026-10-15T10:00:00.000Z', ref: 'R-2', subContractor: true, partner: partnerDriver }),
    ]

    expect(farmOutRows(trips, window)).toEqual([])
  })
})

describe('farmOutRows in the vehicles planning', () => {
  const vehicle = {
    regNbr: 'AB-123-CD',
    make: 'Mercedes-Benz',
    model: 'V-Class',
    category: { name: 'Van' },
  } as never

  it('puts a partner driver trip on its vehicle, named M-B and with the driver', () => {
    const trip = baseTrip({ ...onDay, subContractor: true, partner: partnerDriver, fleetVehicle: vehicle })

    expect(farmOutRowKey(trip, 'vehicles')).toBe('vehicle:AB-123-CD')
    expect(farmOutRows([trip], window, 'vehicles')).toEqual([
      { key: 'vehicle:AB-123-CD', label: 'AB-123-CD · Van', subLabel: 'M-B V-Class — Luc Meyer' },
    ])
  })

  it('shows only the company and the vehicle type ordered for a partner company', () => {
    const trip = baseTrip({
      ...onDay,
      subContractor: true,
      directPartner: company,
      vehicleType: { name: 'Van' } as never,
      fleetVehicle: vehicle,
    })

    expect(farmOutRows([trip], window, 'vehicles')).toEqual([
      { key: farmOutRowKey(trip, 'vehicles'), label: 'Limousines Zurich', subLabel: 'Van' },
    ])
  })
})
