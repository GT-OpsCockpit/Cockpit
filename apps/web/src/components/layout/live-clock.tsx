import { useEffect, useState } from 'react'
import { DateTime } from 'luxon'
import { Clock } from 'lucide-react'

/**
 * Ticks on its own `setInterval` so a re-render every second never touches
 * the rest of the topbar (and vice versa — nav/menu state changes don't
 * restart this timer).
 *
 * Shown from 2xl up only: the topbar's middle block is pinned to the page
 * content's width (80rem) and centred, which leaves the margins to the
 * wordmark and this clock — below ~1530px there is no margin left to put it
 * in without pushing that block off-centre.
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

  return (
    <div className="text-muted-foreground hidden items-center gap-1.5 text-xs whitespace-nowrap tabular-nums 2xl:flex">
      <Clock className="size-3.5" />
      <span>
        {now.toFormat('HH:mm:ss')} {now.setLocale('en-GB').offsetNameShort}
      </span>
    </div>
  )
}
