import { useEffect, useState } from 'react'
import { DateTime } from 'luxon'
import { Clock } from 'lucide-react'

/**
 * Ticks on its own `setInterval` so a re-render every second never touches
 * the rest of the topbar (and vice versa — nav/menu state changes don't
 * restart this timer).
 *
 * Always shows Paris time first — the ops team runs on it regardless of
 * where an individual viewer happens to be — and, only when the browser's
 * own time zone differs from Paris (someone travelling, or a subcontractor
 * abroad), a second line with their local time underneath.
 *
 * The zone abbreviation is pinned to en-GB rather than the browser locale:
 * `offsetNameShort` is locale-derived, and a French browser renders Paris as
 * "UTC+2" (German as "MESZ") where en-GB gives the "CEST" everyone here reads
 * — and the rest of this UI is in English anyway.
 */
export function LiveClock() {
  const [now, setNow] = useState(() => DateTime.local())

  useEffect(() => {
    const id = setInterval(() => setNow(DateTime.local()), 1000)
    return () => clearInterval(id)
  }, [])

  const paris = now.setZone('Europe/Paris').setLocale('en-GB')
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const isParisZone = localZone === 'Europe/Paris'
  const local = now.setLocale('en-GB')
  // "Europe/Berlin" -> "Berlin" — good enough for a small hint label; falls
  // back to the raw IANA name for zones without a "/" (e.g. "UTC").
  const localCity = localZone.split('/').at(-1)?.replace(/_/g, ' ') ?? localZone

  return (
    <div className="text-muted-foreground -ml-[15px] flex flex-col items-start gap-0.5 text-xs whitespace-nowrap tabular-nums">
      {isParisZone ? (
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
          {paris.toFormat('HH:mm')} {paris.offsetNameShort} · Paris
        </span>
      ) : (
        <>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {local.toFormat('HH:mm')} {local.offsetNameShort} · {localCity}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {paris.toFormat('HH:mm')} {paris.offsetNameShort} · Paris
          </span>
        </>
      )}
    </div>
  )
}
