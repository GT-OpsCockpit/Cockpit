import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { TripEntity } from '@cockpit/shared/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { clientAccountLabel, itineraryLabel, tripDriverName } from '../bookings/trip-display'
import {
  blockGeometry,
  compareUnassignedTrips,
  computeTimelineWindow,
  isTripInWindow,
  isTripOnVisibleDay,
  nowLinePercent,
} from './planning-timeline-math'

export interface TimelineRowIcon {
  icon: LucideIcon
  title: string
  /** Driver rows show the icon inline on the label's first line; vehicle rows show it on its own third line (common.js:2189-2225). */
  placement: 'inline' | 'thirdLine'
  dimmed: boolean
  onClick: () => void
}

export interface TimelineRow {
  key: string
  label: string
  subLabel?: string
  icon?: TimelineRowIcon
  /** Set while the row's unavailability covers the visible day — also marks the row inactive-styled. */
  statusLabel?: string | null
}

export interface PlanningTimelineProps {
  trips: TripEntity[]
  rows: TimelineRow[]
  dateStr: string
  days: 1 | 2 | 3
  getRowKey: (trip: TripEntity) => string
  colorFor: (trip: TripEntity) => string
  isEditable: (trip: TripEntity) => boolean
  onAssign: (trip: TripEntity, rowKey: string) => void
  onUnassign: (trip: TripEntity) => void
  canDrop?: (trip: TripEntity, row: TimelineRow) => boolean
  incompatibleMessage?: (trip: TripEntity, row: TimelineRow) => string
  onOpenTrip: (trip: TripEntity) => void
  /** Color legend (e.g. one dot per vehicle Category) — purely decorative, lets the block colors below be decoded at a glance. */
  legend?: { label: string; color: string }[]
}

const LABEL_COL = '12rem'

/**
 * React port of the legacy's renderTimeline() (common.js:2097-2344): one row
 * per driver/vehicle, native HTML5 drag&drop — pile→row assigns, block→pile
 * unassigns. No row-to-row direct drag (the legacy doesn't support it
 * either: only the pile cards and the unassign-back-to-pile gesture are
 * wired for drag).
 */
export function PlanningTimeline({
  trips,
  rows,
  dateStr,
  days,
  getRowKey,
  colorFor,
  isEditable,
  onAssign,
  onUnassign,
  canDrop,
  incompatibleMessage,
  onOpenTrip,
  legend,
}: PlanningTimelineProps) {
  const [dragOverRowKey, setDragOverRowKey] = useState<string | null>(null)
  const [pileDragOver, setPileDragOver] = useState(false)

  const window_ = computeTimelineWindow(dateStr, days)
  const nowPct = nowLinePercent(window_)

  const unassigned = trips
    .filter((t) => !getRowKey(t) && isTripOnVisibleDay(t, window_))
    .sort(compareUnassignedTrips)
  const assignedTrips = trips.filter((t) => getRowKey(t) && isTripInWindow(t, window_))

  const hourLabels = window_.dateList.flatMap((_, dayIndex) =>
    Array.from({ length: 24 }, (_, h) => {
      if (h % window_.hourStep !== 0) return null
      const leftPct = dayIndex * window_.dayWidthPct + (h / 24) * window_.dayWidthPct
      return { key: `${dayIndex}-${h}`, leftPct, label: String(h).padStart(2, '0') }
    }).filter((x): x is { key: string; leftPct: number; label: string } => x !== null),
  )

  const gridlines = window_.dateList.flatMap((_, dayIndex) =>
    Array.from({ length: 24 }, (_, h) => ({
      leftPct: dayIndex * window_.dayWidthPct + (h / 24) * window_.dayWidthPct,
      dayStart: h === 0 && dayIndex > 0,
    })),
  )

  function attemptAssign(trip: TripEntity, row: TimelineRow) {
    if (!isEditable(trip)) {
      toast.warning('Editing a booking whose pickup is already in the past requires the Admin role.')
      return
    }
    if (canDrop && !canDrop(trip, row)) {
      toast.error(incompatibleMessage ? incompatibleMessage(trip, row) : 'This assignment is not compatible.')
      return
    }
    onAssign(trip, row.key)
  }

  function attemptUnassign(trip: TripEntity) {
    if (!isEditable(trip)) {
      toast.warning('Editing a booking whose pickup is already in the past requires the Admin role.')
      return
    }
    onUnassign(trip)
  }

  const headerRows = window_.daysCount > 1 ? 2 : 1

  return (
    <div className="grid gap-4">
      {/* No `overflow-hidden` here (unlike <TableCard>): the grid below scrolls
          horizontally with a `sticky left-0` name column, and clipping on an
          ancestor turns that ancestor into the sticky containing block, which
          staggers the column out of alignment. */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        {legend && legend.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b px-4 py-2.5">
            {legend.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2.5 rounded-full" style={{ background: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          {/* Every cell states its row AND column explicitly. The "Now" overlay
              below is definitely placed across column 2 of every data row, which
              reserves those cells: auto-placed label/lane pairs then had nowhere
              to go but column 1, one per row, and the whole chart came out
              staggered. Explicit placement also lets the overlay legitimately sit
              on top of the lanes instead of competing with them for a cell. */}
          <div
            className="grid min-w-[900px]"
            style={{ gridTemplateColumns: `${LABEL_COL} 1fr` }}
          >
            {/* --- Header: optional day labels, then hour ticks --- */}
            {window_.daysCount > 1 && (
              <>
                <div className="col-start-1 row-start-1 sticky left-0 z-20 border-b bg-card" />
                <div className="col-start-2 row-start-1 relative h-6 border-b bg-muted/40">
                  {window_.dateList.map((d, i) => (
                    <div
                      key={d}
                      className="absolute top-0 flex h-full items-center justify-center text-[11px] font-semibold text-foreground/70"
                      style={{ left: `${i * window_.dayWidthPct}%`, width: `${window_.dayWidthPct}%` }}
                    >
                      {d}
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="col-start-1 sticky left-0 z-20 border-b bg-card" style={{ gridRow: headerRows }} />
            <div className="col-start-2 relative h-6 border-b bg-muted/40" style={{ gridRow: headerRows }}>
              {hourLabels.map((tick) => (
                <div
                  key={tick.key}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground tabular-nums"
                  style={{ left: `${tick.leftPct}%` }}
                >
                  {tick.label}
                </div>
              ))}
              <div className="absolute top-1/2 right-0 -translate-y-1/2 text-[10px] font-medium text-muted-foreground tabular-nums">
                24
              </div>
            </div>

            {/* --- One row per driver/vehicle --- */}
            {rows.length === 0 ? (
              <div
                className="col-span-2 col-start-1 p-8 text-center text-sm text-muted-foreground"
                style={{ gridRow: headerRows + 1 }}
              >
                No rows to display.
              </div>
            ) : (
              rows.map((row, rowIndex) => {
                const rowTrips = assignedTrips.filter((t) => getRowKey(t) === row.key)
                const isDragOver = dragOverRowKey === row.key
                const isLast = rowIndex === rows.length - 1
                return (
                  <div key={row.key} className="group contents">
                    <div
                      className={cn(
                        'col-start-1 sticky left-0 z-10 flex flex-col justify-center gap-0.5 border-r bg-card px-3 py-2 text-xs transition-colors group-hover:bg-muted/40',
                        !isLast && 'border-b',
                        row.statusLabel && 'bg-destructive/[0.03]',
                      )}
                      style={{ gridRow: headerRows + 1 + rowIndex }}
                    >
                      <div className="flex items-center gap-1 font-medium text-foreground">
                        {row.icon?.placement === 'inline' && <RowIcon icon={row.icon} />}
                        <span className="truncate">{row.label}</span>
                      </div>
                      {row.subLabel && <div className="truncate text-[11px] text-muted-foreground">{row.subLabel}</div>}
                      {row.icon?.placement === 'thirdLine' && (
                        <div className="flex items-center gap-1">
                          <RowIcon icon={row.icon} />
                          {row.statusLabel && (
                            <span className="truncate text-[10.5px] font-medium text-destructive">{row.statusLabel}</span>
                          )}
                        </div>
                      )}
                      {row.icon?.placement !== 'thirdLine' && row.statusLabel && (
                        <div className="truncate text-[10.5px] font-medium text-destructive">{row.statusLabel}</div>
                      )}
                    </div>
                    <div
                      data-row-key={row.key}
                      className={cn(
                        'col-start-2 relative h-16 transition-colors group-hover:bg-muted/20',
                        !isLast && 'border-b',
                        isDragOver && 'bg-primary/10 outline outline-2 -outline-offset-2 outline-primary/40',
                      )}
                      style={{ gridRow: headerRows + 1 + rowIndex }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOverRowKey(row.key)
                      }}
                      onDragLeave={() => setDragOverRowKey((k) => (k === row.key ? null : k))}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDragOverRowKey(null)
                        const ref = e.dataTransfer.getData('text/plain')
                        const trip = unassigned.find((t) => t.ref === ref)
                        if (!trip) return
                        attemptAssign(trip, row)
                      }}
                    >
                      {gridlines.map((line, i) => (
                        <div
                          key={i}
                          className={cn('absolute top-0 bottom-0 w-px', line.dayStart ? 'bg-border' : 'bg-border/50')}
                          style={{ left: `${line.leftPct}%` }}
                        />
                      ))}
                      {rowTrips.map((trip) => {
                        const geometry = blockGeometry(trip, window_)
                        if (!geometry) return null
                        const account = clientAccountLabel(trip)
                        return (
                          <div
                            key={trip.ref}
                            draggable
                            data-ref={trip.ref}
                            title={`${trip.ref} — ${account.primary} — ${itineraryLabel(trip)}`}
                            className="absolute top-1.5 bottom-1.5 cursor-pointer overflow-hidden rounded-md px-1.5 py-0.5 text-[10px] leading-tight font-medium text-white shadow-sm ring-1 ring-black/10 transition-all hover:shadow-md hover:brightness-105 active:cursor-grabbing"
                            style={{ left: `${geometry.leftPct}%`, width: `${geometry.widthPct}%`, background: colorFor(trip) }}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', trip.ref)
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            onClick={() => onOpenTrip(trip)}
                          >
                            <div className="truncate">{itineraryLabel(trip)}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}

            {/* --- "Now" indicator, spanning every data row (not the header) --- */}
            {nowPct !== null && rows.length > 0 && (
              <div
                className="pointer-events-none relative col-start-2"
                style={{ gridRow: `${headerRows + 1} / span ${rows.length}` }}
              >
                <div className="absolute top-0 bottom-0 w-px bg-destructive/70" style={{ left: `${nowPct}%` }}>
                  <div className="absolute -top-1 -left-[3px] size-[7px] rounded-full bg-destructive" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          Unassigned trips
          {unassigned.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
              {unassigned.length}
            </span>
          )}
        </div>
        <div
          data-drop-zone="unassigned-pile"
          className={cn(
            'flex min-h-16 flex-wrap gap-2 rounded-xl border border-dashed p-3 transition-colors',
            pileDragOver ? 'border-primary bg-primary/5' : 'border-border/70',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setPileDragOver(true)
          }}
          onDragLeave={() => setPileDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setPileDragOver(false)
            const ref = e.dataTransfer.getData('text/plain')
            const trip = assignedTrips.find((t) => t.ref === ref)
            if (!trip) return
            attemptUnassign(trip)
          }}
        >
          {unassigned.length === 0 ? (
            <div className="flex w-full items-center justify-center py-2 text-sm text-muted-foreground">
              No unassigned trips for this {days > 1 ? 'period' : 'day'}.
            </div>
          ) : (
            unassigned.map((trip) => {
              const account = clientAccountLabel(trip)
              return (
                <div
                  key={trip.ref}
                  draggable
                  data-ref={trip.ref}
                  className="w-44 cursor-grab rounded-lg border bg-card p-2 text-[11px] shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
                  style={{ borderLeftWidth: 3, borderLeftColor: colorFor(trip) }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', trip.ref)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onClick={() => onOpenTrip(trip)}
                >
                  <div className="truncate font-medium text-foreground">{trip.passengerName || trip.ref}</div>
                  <div className="truncate text-muted-foreground">{itineraryLabel(trip)}</div>
                  <div className="truncate text-muted-foreground">
                    {account.primary} · {trip.vehicleType?.name ?? '—'} · {tripDriverName(trip) ?? '—'}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function RowIcon({ icon }: { icon: TimelineRowIcon }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      title={icon.title}
      className={cn('-ml-1', icon.dimmed && 'opacity-35 hover:opacity-100')}
      onClick={(e) => {
        e.stopPropagation()
        icon.onClick()
      }}
    >
      <icon.icon />
    </Button>
  )
}
