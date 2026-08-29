import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { keepPreviousData } from '@tanstack/react-query'
import { ApiError } from '@cockpit/shared/api'

const invalidateQueries = vi.fn()
const success = vi.fn()
const error = vi.fn()
const mutateAsync = vi.fn(async (_variables: { ref: string; data: { active: boolean } }) => ({}))

vi.mock('@/lib/query-client', () => ({ queryClient: { invalidateQueries: (...a: unknown[]) => invalidateQueries(...a) } }))
vi.mock('sonner', () => ({ toast: { success: (m: string) => success(m), error: (m: string) => error(m) } }))

const { useRoster } = await import('./use-roster')

interface Row {
  ref: string
  active: boolean
}

interface Filters {
  search: string
  showInactive: boolean
  type: string
}

const defaults = (): Filters => ({ search: '', showInactive: false, type: '' })

const ROWS: Row[] = [
  { ref: 'C1', active: true },
  { ref: 'C2', active: false },
]

interface ListCall {
  params: { search?: string; includeInactive?: boolean; page?: number; limit?: number; type?: string }
  options: { query: { placeholderData: typeof keepPreviousData } }
}

let listCalls: ListCall[] = []

const lastParams = () => listCalls[listCalls.length - 1].params

beforeEach(() => {
  listCalls = []
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  invalidateQueries.mockReset()
  success.mockReset()
  error.mockReset()
  mutateAsync.mockReset()
  mutateAsync.mockImplementation(async () => ({}))
})

function Harness({
  rows = ROWS,
  total = 2,
  loading = false,
  extraParams,
}: {
  rows?: Row[]
  total?: number
  loading?: boolean
  extraParams?: (filters: Filters) => { type?: string }
}) {
  const roster = useRoster<Filters, Row, { type?: string }>({
    defaults,
    useList: (params, options) => {
      listCalls.push({ params, options })
      return { data: { data: rows, total }, isLoading: loading }
    },
    useSetActive: () => ({ mutateAsync }),
    listQueryKey: ['/api/accounts'],
    extraParams,
    label: 'Account',
    errorLabel: 'account',
  })

  return (
    <div>
      <input
        aria-label="Search"
        value={roster.filters.search}
        onChange={(e) => roster.setFilters({ ...roster.filters, search: e.target.value })}
      />
      <button onClick={() => roster.setPage(3)}>Go to page 3</button>
      <button onClick={() => roster.setFilters({ ...roster.filters, showInactive: true })}>Show deactivated</button>
      <button onClick={() => roster.setFilters({ ...roster.filters, type: 'COMPANY' })}>Companies only</button>
      <button onClick={roster.resetFilters}>Reset</button>
      <button onClick={() => roster.toggleActive(roster.rows[0])}>Toggle first</button>
      <p>page {roster.page}</p>
      <p>{roster.hasActiveFilters ? 'filtered' : 'unfiltered'}</p>
      <p>
        {roster.rows.length} of {roster.total}
        {roster.loading ? ' (loading)' : ''}
      </p>
    </div>
  )
}

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('useRoster', () => {
  it('asks for the first page, and lets the list stand while the next one loads', () => {
    render(<Harness />)
    expect(lastParams()).toEqual({ search: undefined, includeInactive: undefined, page: 1, limit: 20 })
    expect(listCalls[0].options.query.placeholderData).toBe(keepPreviousData)
    expect(screen.getByText('2 of 2')).toBeInTheDocument()
  })

  // A page number only means anything against the filters that produced it:
  // this is the rule each of the three roster pages used to carry itself.
  it('sends the user back to page 1 whenever the filters change', () => {
    render(<Harness />)
    click('Go to page 3')
    expect(screen.getByText('page 3')).toBeInTheDocument()

    click('Show deactivated')
    expect(screen.getByText('page 1')).toBeInTheDocument()
    expect(lastParams().page).toBe(1)
    expect(lastParams().includeInactive).toBe(true)
  })

  it('waits for the typing to stop before asking again', () => {
    vi.useFakeTimers()
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'ali' } })

    expect(lastParams().search).toBeUndefined()
    act(() => void vi.advanceTimersByTime(299))
    expect(lastParams().search).toBeUndefined()
    act(() => void vi.advanceTimersByTime(1))
    expect(lastParams().search).toBe('ali')
  })

  it('sends the filters this record adds on top of the shared ones', () => {
    render(<Harness extraParams={(filters) => ({ type: filters.type || undefined })} />)
    expect(lastParams().type).toBeUndefined()

    click('Companies only')
    expect(lastParams().type).toBe('COMPANY')
  })

  it('knows when the filters have been touched, and puts them back', () => {
    render(<Harness />)
    expect(screen.getByText('unfiltered')).toBeInTheDocument()

    click('Show deactivated')
    expect(screen.getByText('filtered')).toBeInTheDocument()

    click('Go to page 3')
    click('Reset')
    expect(screen.getByText('unfiltered')).toBeInTheDocument()
    expect(screen.getByText('page 1')).toBeInTheDocument()
  })

  describe('the activate/deactivate switch', () => {
    it('announces the record by name and refreshes the list', async () => {
      render(<Harness />)
      click('Toggle first')

      await waitFor(() => expect(success).toHaveBeenCalledWith('Account C1 deactivated.'))
      expect(mutateAsync).toHaveBeenCalledWith({ ref: 'C1', data: { active: false } })
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/accounts'] })
    })

    it('says "reactivated" when the record was off', async () => {
      render(<Harness rows={[{ ref: 'C2', active: false }]} total={1} />)
      click('Toggle first')

      await waitFor(() => expect(success).toHaveBeenCalledWith('Account C2 reactivated.'))
      expect(mutateAsync).toHaveBeenCalledWith({ ref: 'C2', data: { active: true } })
    })

    // The permission gate lives on the server (…:reactivate). What the page
    // gets back is a message, and it is the one the user has to read.
    it("surfaces the API's own message when the switch is refused", async () => {
      mutateAsync.mockImplementation(async () => {
        throw new ApiError(403, { error: 'Reactivating a driver requires the Admin role.' })
      })
      render(<Harness />)
      click('Toggle first')

      await waitFor(() => expect(error).toHaveBeenCalledWith('Reactivating a driver requires the Admin role.'))
      expect(success).not.toHaveBeenCalled()
      expect(invalidateQueries).not.toHaveBeenCalled()
    })

    it("falls back to the record's own wording when the failure carries no API message", async () => {
      mutateAsync.mockImplementation(async () => {
        throw new Error('Network down')
      })
      render(<Harness />)
      click('Toggle first')

      await waitFor(() => expect(error).toHaveBeenCalledWith('Error updating account status.'))
    })
  })

  it('reports the first load, so the table can show skeleton rows', () => {
    render(<Harness rows={[]} total={0} loading />)
    expect(screen.getByText('0 of 0 (loading)')).toBeInTheDocument()
  })
})
