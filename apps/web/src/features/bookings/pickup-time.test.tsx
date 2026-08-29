import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PickupTime } from './pickup-time'
import { baseTrip } from './test-fixtures'

afterEach(cleanup)

describe('PickupTime', () => {
  // The dispatcher sits in Paris and the bookings do not: without the second
  // line, a New York pickup reads "07:00" on a list next to Riviera bookings
  // and there is nothing to compare it against (common.js:1903-1910).
  it('states the pickup in its own timezone and again in Paris', () => {
    render(
      <PickupTime
        trip={baseTrip({ timezone: 'America/New_York', pickupAt: '2026-09-01T11:00:00.000Z' })}
      />,
    )

    expect(screen.getByText(/01\/09 07:00 LT/)).toBeInTheDocument()
    expect(screen.getByText('13:00 Paris')).toBeInTheDocument()
  })

  it('still shows both lines for a booking already in Paris', () => {
    render(<PickupTime trip={baseTrip({ timezone: 'Europe/Paris', pickupAt: '2026-09-01T11:00:00.000Z' })} />)

    expect(screen.getByText(/01\/09 13:00 LT/)).toBeInTheDocument()
    expect(screen.getByText('13:00 Paris')).toBeInTheDocument()
  })
})
