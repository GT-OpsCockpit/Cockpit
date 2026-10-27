import type { TripEntity } from '@cockpit/shared/api'
import { driverLabel, formatPhoneDisplay, partnerLabel } from '@cockpit/shared'
import type { PlanningResource } from './planning-status'
import { shortMake } from './vehicle-label'
import type { TimelineRow } from './planning-timeline'
import { isTripInWindow, type TimelineWindow } from './planning-timeline-math'

/**
 * The Farm out board of the visual planning: every trip handed to a partner —
 * a partner's own driver, or a partner company with nobody named yet. The Local
 * board keeps our own drivers and vehicles; a trip lives on one board or the
 * other.
 */

/** Sub-contracted AND already given to a partner driver or company. */
export function isOnFarmOutBoard(trip: TripEntity): boolean {
  return trip.subContractor && (!!trip.partner || !!trip.directPartner)
}

/**
 * The row a farmed-out trip sits on. In the drivers planning a partner's driver
 * has one row for all their trips; in the vehicles planning their vehicle does
 * (when one is on the trip). A partner company has none of its own to share, so
 * each of its trips gets a row (two overlapping jobs would otherwise sit on top
 * of each other).
 */
export function farmOutRowKey(trip: TripEntity, resource: PlanningResource = 'drivers'): string {
  if (trip.partner) {
    return resource === 'vehicles' && trip.fleetVehicle
      ? `vehicle:${trip.fleetVehicle.regNbr}`
      : `partner:${trip.partner.ref}`
  }
  if (trip.directPartner) return `trip:${trip.ref}`
  return ''
}

/**
 * One row per partner driver (or per partner vehicle in the vehicles planning),
 * and one per trip given to a partner company — labelled with the company name
 * and the vehicle type that was ordered, nothing more. Only trips falling in the
 * visible window make a row.
 */
export function farmOutRows(trips: TripEntity[], window: TimelineWindow, resource: PlanningResource = 'drivers'): TimelineRow[] {
  const visible = trips.filter((t) => isOnFarmOutBoard(t) && isTripInWindow(t, window))
  const partners = new Map<string, TimelineRow>()
  const companies: TimelineRow[] = []

  for (const trip of visible) {
    const key = farmOutRowKey(trip, resource)
    if (trip.partner) {
      if (partners.has(key)) continue
      const vehicle = resource === 'vehicles' ? trip.fleetVehicle : null
      if (vehicle) {
        // The driver the vehicle was given with — the partner this trip is farmed out to.
        const driver = driverLabel(trip.partner)
        partners.set(key, {
          key,
          label: [vehicle.regNbr, vehicle.category.name].filter(Boolean).join(' · '),
          subLabel: `${[shortMake(vehicle.make), vehicle.model].filter(Boolean).join(' ')} — ${driver}`,
        })
      } else {
        partners.set(key, {
          key,
          label: partnerLabel(trip.partner),
          subLabel: formatPhoneDisplay(trip.partner.phone) || undefined,
        })
      }
    } else if (trip.directPartner) {
      companies.push({
        key,
        label: trip.directPartner.companyName || trip.directPartner.contactName,
        subLabel: trip.vehicleType?.name ?? undefined,
      })
    }
  }

  const byLabel = (a: TimelineRow, b: TimelineRow) => a.label.localeCompare(b.label) || a.key.localeCompare(b.key)
  return [...partners.values()].sort(byLabel).concat(companies.sort(byLabel))
}
