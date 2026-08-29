import type { InactivityReason } from '@cockpit/shared'
import { Badge } from '@/components/ui/badge'

/**
 * Why a Drivers/Vehicles row is greyed out. The legacy showed one badge and
 * distinguished the three reasons, because they mean different things to the
 * dispatcher: "Deactivated" is a decision someone made, the other two lapse on
 * their own (inactivityBadge, common.js:3486-3493).
 *
 * `unavailabilityLabel` is passed in rather than derived: a driver is off/on
 * holiday/sick, a vehicle is in the repair shop/in service/in bodywork, and
 * each feature already spells its own out.
 */
export function InactivityBadge({
  reason,
  unavailabilityLabel,
}: {
  reason: InactivityReason | null
  unavailabilityLabel?: string | null
}) {
  if (!reason) return null

  const label =
    reason === 'DEACTIVATED'
      ? 'Deactivated'
      : reason === 'OUTSIDE_EVENT'
        ? 'Outside event dates'
        : unavailabilityLabel

  if (!label) return null

  return (
    <Badge variant="outline" className="text-muted-foreground ml-1 text-[10px] font-normal">
      {label}
    </Badge>
  )
}
