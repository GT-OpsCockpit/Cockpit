import { DriverUnavailabilityEntityType } from '@cockpit/shared/api'
import type { DriverEntity, DriverUnavailabilityEntity } from '@cockpit/shared/api'
import { partnerLabel } from '@cockpit/shared'
import type { BookingPrefill } from '@/features/bookings/booking-create-dialog'
import { formatDate } from '@/lib/utils'

export interface DriverFilters {
  search: string
  showInactive: boolean
}

export function defaultDriverFilters(): DriverFilters {
  return { search: '', showInactive: false }
}

/** Splits the current page into the two always-visible legacy tables — internal chauffeurs vs. partner companies/chauffeurs. */
export function isPartner(driver: DriverEntity): boolean {
  return !!driver.company
}

/**
 * Seeds a "New booking" modal opened from this driver's row — see
 * booking-create-dialog.tsx. A partner is a sub-contractor company, not a
 * driver, so it maps to the form's Partner field (+ Sub-contracted toggle)
 * rather than the Driver field. Explicitly clears the other branch too —
 * otherwise a stale value from an earlier draft (e.g. "New booking" clicked
 * on a chauffeur, then on a partner) would leave both a Driver and a Partner
 * set at once, the exact conflicting state BookingCreateDialog's canDispatch
 * guard exists to prevent.
 */
export function driverBookingPrefill(driver: DriverEntity): BookingPrefill {
  return isPartner(driver)
    ? { subContractor: true, partnerRef: driver.ref, partnerLabel: partnerLabel(driver), driverRef: '' }
    : { driverRef: driver.ref, driverLabel: `${driver.name} (${driver.ref})`, subContractor: false, partnerRef: '' }
}

// The legacy's own wording (UNAVAILABILITY_LABELS, common.js:3001-3004), which
// the Vehicles table already used for its own three kinds.
const UNAVAILABILITY_LABELS: Record<DriverUnavailabilityEntityType, string> = {
  [DriverUnavailabilityEntityType.OFF]: 'Day off',
  [DriverUnavailabilityEntityType.HOLIDAYS]: 'Holidays',
  [DriverUnavailabilityEntityType.SICK]: 'Sickness leave',
}

/**
 * A driver's unavailability as the list shows it: "Day off — 01/06/2026" for a
 * single day, "Holidays — 01/06/2026 → 10/06/2026" for a window — the shape of
 * the legacy's unavailabilityLine (common.js:3498-3506).
 *
 * A window used to be labelled by its end alone ("Holidays until 10/06/2026"),
 * which left the *start* readable nowhere in the list.
 */
export function unavailabilityLabel(unavailability: DriverUnavailabilityEntity | null): string | null {
  if (!unavailability) return null
  const label = UNAVAILABILITY_LABELS[unavailability.type]
  return unavailability.type === DriverUnavailabilityEntityType.OFF
    ? `${label} — ${formatDate(unavailability.date!)}`
    : `${label} — ${formatDate(unavailability.startDate!)} → ${formatDate(unavailability.endDate!)}`
}
