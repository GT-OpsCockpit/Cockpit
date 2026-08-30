import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ClientEntityClientType } from '@cockpit/shared/api'

// The Country column renders <CountryLabel>, which reads the country catalogue
// off /meta to spell the code out. Stub just that hook (the rest of the module
// is kept) so the table stays renderable without a QueryClientProvider.
vi.mock('@cockpit/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cockpit/shared/api')>()),
  useMetaControllerGetMeta: () => ({ data: { countries: [{ code: 'FR', name: 'France' }] } }),
}))

const { ClientsTable } = await import('./clients-table')
const { baseClient } = await import('./test-fixtures')

afterEach(cleanup)

const noop = { onEdit: vi.fn(), onToggleActive: vi.fn(), onNewBooking: vi.fn() }

describe('ClientsTable', () => {
  it('shows a placeholder row when there are no accounts', () => {
    render(<ClientsTable clients={[]} onEdit={vi.fn()} onToggleActive={vi.fn()} onNewBooking={vi.fn()} />)
    expect(screen.getByText('No accounts to display')).toBeInTheDocument()
  })

  it('shows a filtered-empty state with a working reset action when filters are active', () => {
    const onResetFilters = vi.fn()
    render(
      <ClientsTable
        clients={[]}
        onEdit={vi.fn()}
        onToggleActive={vi.fn()}
        onNewBooking={vi.fn()}
        hasActiveFilters
        onResetFilters={onResetFilters}
      />,
    )

    expect(screen.queryByText('No accounts to display')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(onResetFilters).toHaveBeenCalledOnce()
  })

  it('renders the acronym next to the name only when set', () => {
    const withAcronym = baseClient({ ref: 'CC1', name: 'Atlas Capital', acronym: 'ATL' })
    const { rerender } = render(<ClientsTable clients={[withAcronym]} onEdit={vi.fn()} onToggleActive={vi.fn()} onNewBooking={vi.fn()} />)
    expect(screen.getByText('(ATL)')).toBeInTheDocument()

    const withoutAcronym = baseClient({ ref: 'CI1', name: 'Marc Dubois', acronym: null })
    rerender(<ClientsTable clients={[withoutAcronym]} onEdit={vi.fn()} onToggleActive={vi.fn()} onNewBooking={vi.fn()} />)
    expect(screen.queryByText('(ATL)')).not.toBeInTheDocument()
  })

  it('dims an inactive account and offers Reactivate instead of Deactivate', () => {
    const inactive = baseClient({ ref: 'CI1', active: false })
    render(<ClientsTable clients={[inactive]} onEdit={vi.fn()} onToggleActive={vi.fn()} onNewBooking={vi.fn()} />)

    expect(screen.getByRole('row', { name: /CI1/ })).toHaveClass('opacity-50')
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
  })

  it('does not dim an active account and offers Deactivate instead of Reactivate', () => {
    const active = baseClient({ ref: 'CI1', active: true })
    render(<ClientsTable clients={[active]} onEdit={vi.fn()} onToggleActive={vi.fn()} onNewBooking={vi.fn()} />)

    expect(screen.getByRole('row', { name: /CI1/ })).not.toHaveClass('opacity-50')
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  })

  it('calls onEdit with the clicked client', () => {
    const onEdit = vi.fn()
    const client = baseClient({ ref: 'CI1' })
    render(<ClientsTable clients={[client]} onEdit={onEdit} onToggleActive={vi.fn()} onNewBooking={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledWith(client)
  })

  it('calls onToggleActive with the clicked client', () => {
    const onToggleActive = vi.fn()
    const client = baseClient({ ref: 'CI1', active: true })
    render(<ClientsTable clients={[client]} onEdit={vi.fn()} onToggleActive={onToggleActive} onNewBooking={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    expect(onToggleActive).toHaveBeenCalledWith(client)
  })

  // Named cells rather than a count of em dashes in the row: the count broke
  // the moment a column was added, and never said which cell had gone blank.
  it('falls back to an em dash for a missing email, POC phone or billing', () => {
    const client = baseClient({ ref: 'CI1', email: null, pocPhone: null, billing: null })
    render(<ClientsTable clients={[client]} onEdit={vi.fn()} onToggleActive={vi.fn()} onNewBooking={vi.fn()} />)

    // Ref | Country | Name | Type | Email | POC | POC phone | Billing | Action
    const cells = within(screen.getByRole('row', { name: /CI1/ })).getAllByRole('cell')
    expect(cells[4]).toHaveTextContent('—')
    expect(cells[6]).toHaveTextContent('—')
    expect(cells[7]).toHaveTextContent('—')
  })
})

// The legacy's account list carried Country and POC as columns of their own
// (common.js:3358-3375). v2 dropped both, so telling a French account from a
// Monegasque one, or reaching the person to call, meant opening each record.
describe('ClientsTable — Country, POC and Event dates', () => {
  const row = () => screen.getAllByRole('row')[1]
  // Ref | Country | Name | Type | Email | POC | POC phone | Billing | Action
  const cell = (index: number) => within(row()).getAllByRole('cell')[index]

  it('spells the country out, the same way the Fleet list does', () => {
    render(<ClientsTable clients={[baseClient({ countryCode: 'FR' })]} {...noop} />)
    expect(cell(1)).toHaveTextContent('France (FR)')
  })

  it('says "—" in the Country cell itself for an account with no country', () => {
    render(<ClientsTable clients={[baseClient({ countryCode: null })]} {...noop} />)
    expect(cell(1)).toHaveTextContent('—')
  })

  it('names the POC next to the number to call them on', () => {
    render(<ClientsTable clients={[baseClient({ pocName: 'Claire Bonnet', pocPhone: '+33611223344' })]} {...noop} />)
    expect(cell(5)).toHaveTextContent('Claire Bonnet')
  })

  it('says "—" in the POC cell itself when no contact is named', () => {
    render(<ClientsTable clients={[baseClient({ pocName: null })]} {...noop} />)
    expect(cell(5)).toHaveTextContent('—')
  })

  // The dates belong in the name's own cell, in grey, as in the legacy — an
  // Events account is booked against its dates, and a stale one is the usual
  // reason a driver can't be assigned.
  it("shows an Events account's dates under its name", () => {
    render(
      <ClientsTable
        clients={[
          baseClient({
            clientType: ClientEntityClientType.EVENT,
            name: 'Régate du Sud',
            eventStartDate: '2026-08-25T00:00:00.000Z',
            eventEndDate: '2026-08-30T00:00:00.000Z',
          }),
        ]}
        {...noop}
      />,
    )
    expect(within(row()).getByText('25/08/2026 → 30/08/2026')).toBeInTheDocument()
  })

  it('shows no date line for an account that is not an Event', () => {
    render(<ClientsTable clients={[baseClient({ clientType: ClientEntityClientType.INDIVIDUAL })]} {...noop} />)
    expect(within(row()).queryByText(/→/)).not.toBeInTheDocument()
  })
})
