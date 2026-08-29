import { describe, expect, it } from 'vitest'
import { bookingListQuery, defaultBookingFilters } from './booking-filters'

// The narrowing itself is the API's (see trips.e2e-spec.ts, "the board
// filters"). What is worth pinning here is that the bar's blank fields do not
// travel — an empty `search=` would be a filter the dispatcher never asked for.
describe('bookingListQuery', () => {
  it('asks for the live board and the selected period, and nothing else, when the bar is untouched', () => {
    expect(bookingListQuery(defaultBookingFilters())).toEqual({ period: 'upcoming', board: true })
  })

  it('sends each filled field, trimming the two free-text ones', () => {
    expect(
      bookingListQuery({
        ...defaultBookingFilters(),
        period: 'past',
        search: '  Marc Dubois  ',
        passenger: ' Alice ',
        clientRef: 'CI1',
        driverRef: 'D1',
        vehicleType: 'Business',
        service: 'ASD',
      }),
    ).toEqual({
      period: 'past',
      board: true,
      search: 'Marc Dubois',
      passenger: 'Alice',
      clientRef: 'CI1',
      driverRef: 'D1',
      vehicleType: 'Business',
      service: 'ASD',
    })
  })

  it('drops a free-text field that holds nothing but whitespace', () => {
    expect(bookingListQuery({ ...defaultBookingFilters(), search: '   ', passenger: '  ' })).toEqual({
      period: 'upcoming',
      board: true,
    })
  })
})
