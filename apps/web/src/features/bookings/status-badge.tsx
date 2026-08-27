import type { TripEntity } from '@cockpit/shared/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { currentStatus, isStatusAdvanceable, isStatusHighlighted, statusLabel } from './trip-status'

const HIGHLIGHTED_COLORS: Record<string, string> = {
  TRANSMITTED: 'bg-emerald-100 text-emerald-800',
  RECEIVED: 'bg-indigo-100 text-indigo-800',
  ACCEPTED: 'bg-gray-200 text-gray-700',
  DROPPED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-700',
}

const PLAIN_COLORS: Record<string, string> = {
  ENROUTE: 'text-orange-700',
  ARRIVED: 'text-foreground',
  ONBOARD: 'text-foreground',
}

/** Mirrors the legacy's statusBadgeAndRowClass() badge half — solid pill for highlighted steps, plain colored text otherwise. */
export function StatusBadge({ trip, onAdvance }: { trip: TripEntity; onAdvance?: (trip: TripEntity) => void }) {
  const status = currentStatus(trip)
  if (!status) return <Badge className="bg-red-100 text-red-700">📤 Send ?</Badge>

  const label = statusLabel(status)
  const clickable = onAdvance && isStatusAdvanceable(trip)
  const clickProps = clickable
    ? { title: 'Click to validate the next step', onClick: () => onAdvance(trip) }
    : undefined

  if (isStatusHighlighted(status)) {
    if (clickable) {
      return (
        <Badge asChild className={cn(HIGHLIGHTED_COLORS[status], 'cursor-pointer')}>
          <button type="button" {...clickProps}>
            {label}
          </button>
        </Badge>
      )
    }
    return <Badge className={cn(HIGHLIGHTED_COLORS[status])}>{label}</Badge>
  }

  if (clickable) {
    return (
      <button
        type="button"
        className={cn('cursor-pointer text-xs font-semibold', PLAIN_COLORS[status])}
        {...clickProps}
      >
        {label}
      </button>
    )
  }
  return <span className={cn('text-xs font-semibold', PLAIN_COLORS[status])}>{label}</span>
}
