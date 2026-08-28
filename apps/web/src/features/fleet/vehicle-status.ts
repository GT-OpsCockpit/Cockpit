import { FleetUnavailabilityEntityType } from '@cockpit/shared/api'
import type { FleetUnavailabilityEntity, FleetVehicleEntity } from '@cockpit/shared/api'
import type { BookingPrefill } from '@/features/bookings/booking-create-dialog'

export interface VehicleFilters {
  search: string
  showInactive: boolean
}

export function defaultVehicleFilters(): VehicleFilters {
  return { search: '', showInactive: false }
}

/** Seeds a "New booking" modal opened from this vehicle's row — see booking-create-dialog.tsx. */
export function vehicleBookingPrefill(vehicle: FleetVehicleEntity): BookingPrefill {
  return {
    vehicleType: vehicle.category.name,
    fleetRegNbr: vehicle.regNbr,
    regNbrLabel: `${vehicle.regNbr} — ${vehicle.category.name}`,
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB')
}

const UNAVAILABILITY_LABELS: Record<FleetUnavailabilityEntityType, string> = {
  [FleetUnavailabilityEntityType.REPAIR]: 'Repair shop',
  [FleetUnavailabilityEntityType.SERVICE]: 'Manufacturer service',
  [FleetUnavailabilityEntityType.BODYWORK]: 'Bodywork',
}

export function unavailabilityLabel(unavailability: FleetUnavailabilityEntity | null): string | null {
  if (!unavailability) return null
  const label = UNAVAILABILITY_LABELS[unavailability.type]
  return `${label} — ${formatDate(unavailability.startDate)} → ${formatDate(unavailability.endDate)}`
}

/**
 * Nb Pax limit by Category (and by Model for Van/E-Van, whose capacity
 * depends on the Mercedes vehicle used). Ported verbatim from the legacy's
 * defaultFleetPax (vehicles.html:369-378) — the field is purely informative,
 * never a free input: recomputed client-side on every Category/Model change.
 */
export function defaultFleetPax(category: string, model: string): number {
  if (category === 'SUV') return 3
  if (category === 'Van') return 7
  if (category === 'E-Van') return model === 'VLE' ? 5 : 7
  if (category === 'Sprinter') return 15
  if (category === 'Coach 35') return 35
  if (category === 'Coach 50') return 50
  if (category === 'Lugg.') return 0
  return 3 // Business, E-Business, First, Luxe, Excep.
}
