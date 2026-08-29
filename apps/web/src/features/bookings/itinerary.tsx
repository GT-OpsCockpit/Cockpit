import { Plane } from 'lucide-react'
import type { TripEntity } from '@cockpit/shared/api'
import { itineraryLabel } from './trip-display'

/**
 * The Itinerary column: both ends shortened to fit, and the flight number
 * underneath when there is one.
 *
 * The flight is what the driver is actually waiting on at an airport pickup,
 * which is why the legacy printed it on its own line here (itineraryCell,
 * common.js:2618-2626) rather than leaving it inside the booking form.
 */
export function Itinerary({ trip }: { trip: TripEntity }) {
  return (
    <>
      {itineraryLabel(trip)}
      {trip.flightNumber && (
        <div className="text-muted-foreground flex items-center gap-1 text-[9.5px]">
          <Plane className="size-2.5" aria-hidden="true" />
          {trip.flightNumber}
        </div>
      )}
    </>
  )
}
