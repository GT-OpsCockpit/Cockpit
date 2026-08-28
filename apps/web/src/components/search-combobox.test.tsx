import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SearchCombobox, type ComboboxOption } from './search-combobox'

afterEach(cleanup)

const OPTIONS: ComboboxOption[] = [
  { value: 'fr', label: 'France (FR)' },
  { value: 'gb', label: 'United Kingdom (GB)' },
]

// Regression coverage for the accessibility fix (Bookings handoff session 10):
// Country/Customer/Driver/Partner used to render with no accessible name at
// all (their trigger button never received the id a <FormLabel>'s htmlFor
// pointed at). This renders the same <label for> + id pairing production
// code produces via <FormLabel>/<FormControl>, so a regression here would
// mean getByLabel can no longer find the trigger.
function LabelledCombobox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label htmlFor="country-field">Country</label>
      <SearchCombobox
        id="country-field"
        value={value}
        onChange={onChange}
        options={OPTIONS}
        placeholder="Country…"
        searchPlaceholder="Search country…"
      />
    </div>
  )
}

describe('SearchCombobox', () => {
  it('is reachable via its associated label, and shows the placeholder when nothing is selected', () => {
    render(<LabelledCombobox value="" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Country')).toHaveTextContent('Country…')
  })

  it('shows the selected option label instead of the placeholder once a value is set', () => {
    render(<LabelledCombobox value="fr" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Country')).toHaveTextContent('France (FR)')
  })

  it('opens, filters, and reports the chosen option through onChange', () => {
    const onChange = vi.fn()
    render(<LabelledCombobox value="" onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('Country'))
    fireEvent.change(screen.getByPlaceholderText('Search country…'), { target: { value: 'United' } })

    const option = screen.getByRole('option', { name: 'United Kingdom (GB)' })
    fireEvent.click(option)

    expect(onChange).toHaveBeenCalledWith('gb')
  })

  // Regression coverage for the bug reported on /events and /invoicing: the
  // remote-search pickers used to append every option ever seen to the live
  // results (the old useOptionMemory), so typing a query left the previous
  // 20 rows sitting in the list — the dropdown looked like it had ignored
  // the search entirely. Only the labels are remembered now, and only to
  // keep the trigger readable.
  it('shows only the options it is given, in remote-search mode', () => {
    const { rerender } = render(
      <SearchCombobox value="" onChange={vi.fn()} options={OPTIONS} onSearchChange={vi.fn()} searchValue="" />,
    )
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getAllByRole('option')).toHaveLength(2)

    rerender(
      <SearchCombobox
        value=""
        onChange={vi.fn()}
        options={[{ value: 'gb', label: 'United Kingdom (GB)' }]}
        onSearchChange={vi.fn()}
        searchValue="United"
      />,
    )
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['United Kingdom (GB)'])
  })

  it('keeps showing the selected label after that option drops out of the results', async () => {
    const { rerender } = render(
      <SearchCombobox value="fr" onChange={vi.fn()} options={OPTIONS} onSearchChange={vi.fn()} searchValue="" />,
    )
    // The label memory fills from an effect, so let it flush before the option disappears.
    await screen.findByRole('combobox')

    rerender(
      <SearchCombobox
        value="fr"
        onChange={vi.fn()}
        options={[{ value: 'gb', label: 'United Kingdom (GB)' }]}
        onSearchChange={vi.fn()}
        searchValue="United"
      />,
    )
    expect(screen.getByRole('combobox')).toHaveTextContent('France (FR)')
  })

  it('falls back to selectedLabel for a value no search has returned yet', () => {
    render(
      <SearchCombobox
        value="fr"
        onChange={vi.fn()}
        options={[]}
        selectedLabel="France (FR)"
        onSearchChange={vi.fn()}
        searchValue=""
      />,
    )
    expect(screen.getByRole('combobox')).toHaveTextContent('France (FR)')
  })

  it('announces an in-flight search instead of claiming there are no results', () => {
    render(
      <SearchCombobox
        value=""
        onChange={vi.fn()}
        options={[]}
        loading
        onSearchChange={vi.fn()}
        searchValue="Fra"
        emptyText="No results."
      />,
    )
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByText('Searching…')).toBeInTheDocument()
    expect(screen.queryByText('No results.')).not.toBeInTheDocument()
  })
})
