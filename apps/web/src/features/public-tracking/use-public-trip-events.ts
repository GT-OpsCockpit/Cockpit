import { useEffect, useRef } from 'react'
import { getBaseUrl } from '@cockpit/shared/api'

interface TripChangedEvent {
  type: 'trip-changed'
  ref: string
}

/**
 * Public counterpart to bookings/use-trip-events.ts, for the unauthenticated
 * /driver/:ref and /track/:ref pages: same SSE stream (now @Public(), see
 * apps/api/src/realtime/realtime.controller.ts), but scoped to a single ref
 * client-side and refetching the one query these pages hold instead of
 * invalidating the dispatcher's trip list.
 */
export function usePublicTripEvents(ref: string, onChanged: () => void) {
  const onChangedRef = useRef(onChanged)
  useEffect(() => {
    onChangedRef.current = onChanged
  })

  useEffect(() => {
    if (!ref) return
    const source = new EventSource(`${getBaseUrl()}/api/events/stream`)

    // Same catch-up as the dispatcher hook: nothing replays events missed
    // while the connection was down, and a driver watching their own ride
    // has no second screen to notice the page went stale on.
    let reconnect = false
    source.onopen = () => {
      if (reconnect) onChangedRef.current()
      reconnect = true
    }

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as TripChangedEvent
        if (payload.type === 'trip-changed' && payload.ref === ref) onChangedRef.current()
      } catch {
        // Ignore malformed/heartbeat events.
      }
    }
    return () => source.close()
  }, [ref])
}
