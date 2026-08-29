import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Itinerary } from './itinerary'
import { baseTrip } from './test-fixtures'

afterEach(cleanup)

// The flight is what the driver is actually waiting on at an airport pickup,
// which is why the legacy printed it under the itinerary rather than leaving
// it inside the booking form (itineraryCell, common.js:2618-2626).
describe('Itinerary', () => {
  it('shows the flight number under the route', () => {
    render(<Itinerary trip={baseTrip({ flightNumber: 'AF1234' })} />)
    expect(screen.getByText('AF1234')).toBeInTheDocument()
  })

  it('shows nothing extra for a booking with no flight', () => {
    render(<Itinerary trip={baseTrip({ flightNumber: null })} />)
    expect(screen.queryByText(/AF\d+/)).not.toBeInTheDocument()
  })
})
