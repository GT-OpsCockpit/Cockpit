import type { TripEntity } from '@cockpit/shared/api'
import { displayPickup } from './trip-display'

/**
 * A booking's pickup, stated twice: in its own local time, and underneath, the
 * same moment in Paris.
 *
 * The desk is in Paris and the bookings are not — the second line is how a
 * dispatcher reads a list spanning several timezones against their own clock,
 * which is why the legacy rendered both on every row that shows a pickup
 * (displayPickup, common.js:1903-1910). "LT" marks the first line as local so
 * the two are never confused.
 */
export function PickupTime({ trip }: { trip: TripEntity }) {
  const { local, paris } = displayPickup(trip)
  return (
    <>
      {local} LT
      <div className="text-muted-foreground text-[11px]">{paris} Paris</div>
    </>
  )
}
