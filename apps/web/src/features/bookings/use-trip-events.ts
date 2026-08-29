import { useEffect } from 'react'
import { getBaseUrl } from '@cockpit/shared/api'
import { getTripsControllerListQueryKey } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'

interface TripChangedEvent {
  type: 'trip-changed'
  ref: string
}

/** No params → the key is the `['/api/trips']` prefix, so every filtered
 * variant of the list is invalidated, not just the unfiltered one. */
function invalidateTrips() {
  void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
}

/**
 * Subscribes to the API's SSE trip-change stream (replaces the legacy's 5s
 * dispatcher polling). The stream is purely an invalidation signal — the
 * REST contract for reading trips is unchanged, this just tells TanStack
 * Query when to refetch (see apps/api/src/realtime/realtime.service.ts).
 */
export function useTripEvents() {
  useEffect(() => {
    const source = new EventSource(`${getBaseUrl()}/api/events/stream`, {
      withCredentials: true,
    })

    // EventSource reconnects on its own, but the server's Subject has no
    // replay buffer and the stream carries no Last-Event-ID: whatever was
    // emitted while we were disconnected is gone for good. Without this the
    // board would sit silently stale until the *next* change — the failure
    // that reads as "the live view stopped working". Refetching on every
    // reconnect (not the first connect, which the query already covers)
    // closes the gap.
    let reconnect = false
    source.onopen = () => {
      if (reconnect) invalidateTrips()
      reconnect = true
    }

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as TripChangedEvent
        if (payload.type === 'trip-changed') {
          invalidateTrips()
        }
      } catch {
        // Ignore malformed/heartbeat events.
      }
    }
    return () => source.close()
  }, [])
}
