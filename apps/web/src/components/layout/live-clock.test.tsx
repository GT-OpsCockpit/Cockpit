import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { LiveClock } from './live-clock'

// Asserted TZ-agnostically (no TZ is pinned for the suite, see vite.config.ts):
// the contract is the shape and the ticking, not one machine's abbreviation.
const CLOCK_TEXT = /^\d{2}:\d{2}:\d{2} \S+$/

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-28T14:32:07'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('LiveClock', () => {
  it('renders the current time with a zone label', () => {
    render(<LiveClock />)
    expect(screen.getByText(CLOCK_TEXT)).toBeInTheDocument()
    expect(screen.getByText(/^14:32:07 /)).toBeInTheDocument()
  })

  it('ticks forward every second', () => {
    render(<LiveClock />)
    act(() => void vi.advanceTimersByTime(1000))
    expect(screen.getByText(/^14:32:08 /)).toBeInTheDocument()

    act(() => void vi.advanceTimersByTime(2000))
    expect(screen.getByText(/^14:32:10 /)).toBeInTheDocument()
  })

  it('clears its interval on unmount, so no timer outlives the component', () => {
    const { unmount } = render(<LiveClock />)
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
