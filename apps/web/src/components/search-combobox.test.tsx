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
})
