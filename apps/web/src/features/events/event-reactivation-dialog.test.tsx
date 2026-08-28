import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ClientEntity } from '@cockpit/shared/api'

const useCandidates = vi.fn()
const mutateAsync = vi.fn()
vi.mock('@cockpit/shared/api', () => ({
  useClientsControllerListReactivationCandidates: (...args: unknown[]) => useCandidates(...(args as [])) as unknown,
  useClientsControllerReactivate: () => ({ mutateAsync, isPending: false }),
  getClientsControllerListQueryKey: () => ['clients'],
  getDriversControllerListQueryKey: () => ['drivers'],
  getFleetVehiclesControllerListQueryKey: () => ['fleet'],
}))
vi.mock('@/lib/query-client', () => ({ queryClient: { invalidateQueries: vi.fn() } }))

const { EventReactivationDialog } = await import('./event-reactivation-dialog')

afterEach(() => {
  cleanup()
  useCandidates.mockReset()
  mutateAsync.mockReset()
})

// Only the four fields the dialog reads — importing the full fixture would
// drag in enums this file deliberately mocks away.
const EVENT = {
  ref: 'CE2',
  name: 'Grand Prix 2027',
  eventCountry: 'MC',
  eventArea: 'Monaco',
} as ClientEntity

function mockCandidates(drivers: string[], fleetVehicles: string[] = []) {
  useCandidates.mockReturnValue({
    data: {
      drivers: drivers.map((ref) => ({
        ref,
        label: `Driver ${ref}`,
        previousEventRef: 'CE1',
        previousEventName: 'Grand Prix 2026',
      })),
      fleetVehicles: fleetVehicles.map((ref) => ({
        ref,
        label: `${ref} (Business)`,
        previousEventRef: 'CE1',
        previousEventName: 'Grand Prix 2026',
      })),
    },
  })
}

describe('EventReactivationDialog', () => {
  // "Silently does nothing if there's no match" (common.js:3912) — an empty
  // prompt after every single Events account creation would be noise.
  it('stays out of the way when there is nothing to offer', () => {
    mockCandidates([])
    render(<EventReactivationDialog event={EVENT} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('offers every candidate pre-checked, naming the Event it comes from', () => {
    mockCandidates(['D1'], ['V1'])
    render(<EventReactivationDialog event={EVENT} onClose={vi.fn()} />)

    expect(screen.getAllByText(/previously: Grand Prix 2026/)).toHaveLength(2)
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    for (const box of screen.getAllByRole('checkbox')) {
      expect(box).toHaveAttribute('data-state', 'checked')
    }
  })

  it('sends only what is still ticked', async () => {
    mockCandidates(['D1', 'D2'])
    mutateAsync.mockResolvedValue({ ok: true, drivers: 1, fleetVehicles: 0 })
    render(<EventReactivationDialog event={EVENT} onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('checkbox')[1])
    fireEvent.click(screen.getByRole('button', { name: 'Reactivate selected' }))

    await vi.waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        ref: 'CE2',
        data: { driverRefs: ['D1'], fleetVehicleRefs: [] },
      }),
    )
  })

  it('Skip closes without relinking anything', () => {
    mockCandidates(['D1'])
    const onClose = vi.fn()
    render(<EventReactivationDialog event={EVENT} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onClose).toHaveBeenCalled()
    expect(mutateAsync).not.toHaveBeenCalled()
  })
})
