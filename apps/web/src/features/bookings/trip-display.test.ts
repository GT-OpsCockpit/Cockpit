import { describe, expect, it } from 'vitest'
import { cancellationFeeLabel, fleetVehicleLabel, itineraryLabel, pocTooltipLabel, shortPlaceLabel } from './trip-display'
import { baseTrip } from './test-fixtures'
import { TripEntityCancellationFee, TripEntityService } from '@cockpit/shared/api'

// A full street address doesn't fit the Itinerary column next to Reg Nbr,
// Sub-C and Driver — and cutting it at the first comma keeps the wrong end.
// Ported from shortPlaceLabel (common.js:2032).
describe('shortPlaceLabel', () => {
  it('leads with the city and keeps the rest behind it', () => {
    expect(shortPlaceLabel('Hotel Negresco, Nice, France', null, 'Europe/Paris')).toBe('Nice, Hotel Negresco')
  })

  it('names the Paris arrondissement a postal code gives away', () => {
    expect(shortPlaceLabel('12 rue de Tolbiac, 75013 Paris', null, 'Europe/Paris')).toBe('Paris 13, 12 rue de Tolbiac')
  })

  it("leads with the trip's own city when the address names it, and strips it from the rest", () => {
    expect(shortPlaceLabel('Gare de Lyon, Paris', null, 'Europe/Paris')).toBe('Paris, Gare de Lyon')
  })

  // "place, city, country" is the shape the address search returns, so the
  // city is the second-to-last segment rather than the last.
  it('takes the city segment of a comma-separated address', () => {
    expect(shortPlaceLabel('Hotel Martinez, Cannes, France', null, 'Europe/Paris')).toBe('Cannes, Hotel Martinez')
  })

  it('keeps a one-segment address, behind the city when there is one', () => {
    expect(shortPlaceLabel('Somewhere unlisted', null, 'Europe/Paris')).toBe('Paris, Somewhere unlisted')
    expect(shortPlaceLabel('Somewhere unlisted', null, null)).toBe('Somewhere unlisted')
  })

  it('keeps an airport code behind its city', () => {
    expect(shortPlaceLabel('Charles de Gaulle Airport', 'CDG', 'Europe/Paris')).toBe('Paris, CDG')
    expect(shortPlaceLabel('Somewhere', 'JFK', null)).toBe('JFK')
  })

  it('falls back to an em dash rather than an empty cell', () => {
    expect(shortPlaceLabel('', null, 'Europe/Paris')).toBe('—')
    expect(shortPlaceLabel(null, null, null)).toBe('—')
  })

  it('reads a timezone city with an underscore as the name it stands for', () => {
    expect(shortPlaceLabel('JFK Terminal 4, New York', null, 'America/New_York')).toBe('New York, JFK Terminal 4')
  })
})

describe('itineraryLabel', () => {
  it('shortens both ends', () => {
    const trip = baseTrip({
      pickupLocation: 'Hotel Negresco, Nice, France',
      dropoffLocation: 'Aéroport, Cannes, France',
      timezone: 'Europe/Paris',
    })
    expect(itineraryLabel(trip)).toBe('Nice, Hotel Negresco → Cannes, Aéroport')
  })

  it('says how long an at-disposal booking runs instead of a drop-off', () => {
    const trip = baseTrip({ service: TripEntityService.ASD, hours: 4, pickupLocation: 'Nice, France' })
    expect(itineraryLabel(trip)).toEqual(expect.stringContaining('→ ASD (4h)'))
  })
})

// The Bookings table printed the Prisma enum member straight out ("Fee: FIFTY")
// where the legacy — and v2's own cancel dialog — say "Fee: 50%"
// (common.js:3114 / booking-cancel-dialog.tsx's FEE_OPTIONS).
describe('cancellationFeeLabel', () => {
  it.each([
    [TripEntityCancellationFee.FREE, 'Free'],
    [TripEntityCancellationFee.FIFTY, '50%'],
    [TripEntityCancellationFee.SEVENTYFIVE, '75%'],
    [TripEntityCancellationFee.HUNDRED, '100%'],
  ])('reads %s as %s', (fee, expected) => {
    expect(cancellationFeeLabel(fee)).toBe(expected)
  })

  it('has nothing to say about a booking that was never cancelled', () => {
    expect(cancellationFeeLabel(null)).toBeNull()
  })
})

// The Reg Nbr column showed the vehicle's acronym and a dash when it had none,
// which reads exactly like "no vehicle assigned" — seen live on AA-001-BC,
// assigned and yet shown as "—". The legacy did the same and lived with it
// (common.js:2604-2611); here the plate is the honest fallback.
describe('fleetVehicleLabel', () => {
  it('prefers the acronym, which is what the column is sized for', () => {
    expect(fleetVehicleLabel(baseTrip({ fleetVehicle: { regNbr: 'AA-001-BC', acronym: 'MERC1' } as never }))).toBe(
      'MERC1',
    )
  })

  it('falls back to the plate rather than claim there is no vehicle', () => {
    expect(fleetVehicleLabel(baseTrip({ fleetVehicle: { regNbr: 'AA-001-BC', acronym: null } as never }))).toBe(
      'AA-001-BC',
    )
  })

  it('still says "—" when no vehicle is assigned at all', () => {
    expect(fleetVehicleLabel(baseTrip({ fleetVehicle: null }))).toBe('—')
  })
})

// The person to call when a pickup goes wrong is often not the passenger — a
// PA, an event coordinator. The legacy surfaced them on hover over the
// passenger line, and only when they differ (common.js:3108): on a list where
// most bookings have the passenger as their own contact, showing it every time
// is noise nobody reads.
describe('pocTooltipLabel', () => {
  it('names the POC and the number to reach them on', () => {
    expect(
      pocTooltipLabel(baseTrip({ passengerName: 'Jane Doe', pocName: 'Claire Bonnet', pocPhone: '+33611223344' })),
    ).toBe('POC: Claire Bonnet · +33 6 11 22 33 44')
  })

  it('names the POC alone when no number is on file', () => {
    expect(pocTooltipLabel(baseTrip({ passengerName: 'Jane Doe', pocName: 'Claire Bonnet', pocPhone: null }))).toBe(
      'POC: Claire Bonnet',
    )
  })

  it('says nothing when the POC is the passenger', () => {
    expect(pocTooltipLabel(baseTrip({ passengerName: 'Jane Doe', pocName: 'Jane Doe' }))).toBeNull()
  })

  it('says nothing when no POC is named', () => {
    expect(pocTooltipLabel(baseTrip({ passengerName: 'Jane Doe', pocName: null }))).toBeNull()
  })
})
