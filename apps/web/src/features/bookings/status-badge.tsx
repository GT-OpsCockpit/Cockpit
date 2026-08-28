import { Send } from 'lucide-react'
import type { TripEntity } from '@cockpit/shared/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { STEP_ICONS } from './trip-step-icons'
import {
  NO_STATUS_LABEL,
  currentStatus,
  isStatusAdvanceable,
  isStatusHighlighted,
  statusLabel,
  type TripStatus,
} from './trip-status'

// Pill-outline (tinted background + border and text in the status colour), on
// theme tokens rather than raw Tailwind palette classes.
const HIGHLIGHTED_COLORS: Record<string, string> = {
  TRANSMITTED: 'border-success/40 bg-success/10 text-success',
  RECEIVED: 'border-primary/40 bg-primary/10 text-primary',
  ACCEPTED: 'border-border bg-muted text-muted-foreground',
  DROPPED: 'border-success/40 bg-success/10 text-success',
  CANCELLED: 'border-destructive/40 bg-destructive/10 text-destructive',
}

const PLAIN_COLORS: Record<string, string> = {
  ENROUTE: 'text-warning',
  ARRIVED: 'text-foreground',
  ONBOARD: 'text-foreground',
}

function StatusIcon({ status }: { status: NonNullable<TripStatus> }) {
  const Icon = STEP_ICONS[status]
  return <Icon aria-hidden="true" />
}

/** Mirrors the legacy's statusBadgeAndRowClass() badge half — pill-outline badge for highlighted steps, plain colored text otherwise. */
export function StatusBadge({ trip, onAdvance }: { trip: TripEntity; onAdvance?: (trip: TripEntity) => void }) {
  const status = currentStatus(trip)
  if (!status) {
    return (
      <Badge className="border-destructive/40 bg-destructive/10 text-destructive">
        <Send aria-hidden="true" />
        {NO_STATUS_LABEL}
      </Badge>
    )
  }

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
            <StatusIcon status={status} />
            {label}
          </button>
        </Badge>
      )
    }
    return (
      <Badge className={cn(HIGHLIGHTED_COLORS[status])}>
        <StatusIcon status={status} />
        {label}
      </Badge>
    )
  }

  const plainClass = cn('inline-flex items-center gap-1 text-xs font-semibold [&>svg]:size-3', PLAIN_COLORS[status])
  if (clickable) {
    return (
      <button type="button" className={cn(plainClass, 'cursor-pointer')} {...clickProps}>
        <StatusIcon status={status} />
        {label}
      </button>
    )
  }
  return (
    <span className={plainClass}>
      <StatusIcon status={status} />
      {label}
    </span>
  )
}
