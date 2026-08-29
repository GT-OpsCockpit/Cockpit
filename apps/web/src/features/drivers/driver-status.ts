import { DriverUnavailabilityEntityType } from '@cockpit/shared/api'
import type { DriverEntity, DriverUnavailabilityEntity } from '@cockpit/shared/api'
import { partnerLabel } from '@cockpit/shared'
import type { BookingPrefill } from '@/features/bookings/booking-create-dialog'

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB')
}

export function unavailabilityLabel(unavailability: DriverUnavailabilityEntity | null): string | null {
  if (!unavailability) return null
  switch (unavailability.type) {
    case DriverUnavailabilityEntityType.OFF:
      return `Off ${formatDate(unavailability.date!)}`
    case DriverUnavailabilityEntityType.HOLIDAYS:
      return `Holidays until ${formatDate(unavailability.endDate!)}`
    case DriverUnavailabilityEntityType.SICK:
      return `Sick until ${formatDate(unavailability.endDate!)}`
  }
}
