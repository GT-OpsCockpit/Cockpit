import { useEffect } from 'react'
import { getBaseUrl } from '@cockpit/shared/api'
import { getTripsControllerListQueryKey } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'

interface TripChangedEvent {
  type: 'trip-changed'
  ref: string
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
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as TripChangedEvent
        if (payload.type === 'trip-changed') {
          void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
        }
      } catch {
        // Ignore malformed/heartbeat events.
      }
    }
    return () => source.close()
  }, [])
}
