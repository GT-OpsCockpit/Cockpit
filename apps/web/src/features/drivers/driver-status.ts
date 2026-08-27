import { DriverUnavailabilityEntityType } from '@cockpit/shared/api'
import type { DriverEntity, DriverUnavailabilityEntity } from '@cockpit/shared/api'

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
