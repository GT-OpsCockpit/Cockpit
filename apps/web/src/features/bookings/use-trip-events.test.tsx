import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/lib/query-client'
import { useTripEvents } from './use-trip-events'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  close = vi.fn()

  constructor() {
    FakeEventSource.instances.push(this)
  }
}

describe('useTripEvents', () => {
  let invalidate: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
    invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    invalidate.mockRestore()
  })

  it('invalidates every filtered trip list on a trip-changed event', () => {
    renderHook(() => useTripEvents())
    const source = FakeEventSource.instances[0]

    source.onmessage?.({ data: JSON.stringify({ type: 'trip-changed', ref: 'R-CI1-26-1' }) })

    // The prefix key, with no params — a filtered list must refetch too.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['/api/trips'] })
  })

  it('refetches on reconnect, since events missed while offline never replay', () => {
    renderHook(() => useTripEvents())
    const source = FakeEventSource.instances[0]

    source.onopen?.()
    expect(invalidate).not.toHaveBeenCalled()

    source.onopen?.()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['/api/trips'] })
  })

  it('ignores heartbeats', () => {
    renderHook(() => useTripEvents())
    const source = FakeEventSource.instances[0]

    source.onmessage?.({ data: JSON.stringify({ type: 'heartbeat' }) })

    expect(invalidate).not.toHaveBeenCalled()
  })
})
