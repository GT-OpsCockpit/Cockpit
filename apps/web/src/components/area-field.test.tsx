import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const useAreaSuggestions = vi.fn()
vi.mock('@cockpit/shared/api', () => ({
  useMetaControllerGetAreaSuggestions: (...args: unknown[]) => useAreaSuggestions(...args) as unknown,
}))

const { AreaField } = await import('./area-field')

afterEach(() => {
  cleanup()
  useAreaSuggestions.mockReset()
})

function mockSuggestions(cities: string[], localAllowed: boolean) {
  useAreaSuggestions.mockReturnValue({ data: { countryCode: 'X', cities, localAllowed } })
}

describe('AreaField', () => {
  it('offers the country’s cities as suggestions', () => {
    mockSuggestions(['Nice', 'Cannes', 'Paris'], true)
    render(<AreaField countryCode="FR" value="" onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Local', 'Nice', 'Cannes', 'Paris'])
  })

  // "Local" means "based on site" and only exists as a French concept in the
  // legacy (initAreaCombo, common.js:832) — everywhere else an actual city is
  // required. It stays listed but greyed out, so the concept is still visible.
  it('only lets "Local" be picked in France', () => {
    const onChange = vi.fn()
    mockSuggestions(['Milan'], false)
    render(<AreaField countryCode="IT" value="" onChange={onChange} />)

    fireEvent.click(screen.getByRole('combobox'))
    const local = screen.getByRole('option', { name: 'Local' })
    expect(local).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(local)
    expect(onChange).not.toHaveBeenCalled()

    cleanup()
    mockSuggestions(['Nice'], true)
    render(<AreaField countryCode="FR" value="" onChange={onChange} />)
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'Local' }))
    expect(onChange).toHaveBeenCalledWith('Local')
  })

  // The suggestions are a cap, not a closed list: the legacy field accepted
  // any typed city and constraining it would be a regression.
  it('still accepts a city that is not in the catalogue', () => {
    const onChange = vi.fn()
    mockSuggestions(['Nice', 'Cannes'], true)
    render(<AreaField countryCode="FR" value="" onChange={onChange} />)

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.change(screen.getByPlaceholderText('Search or type an area…'), { target: { value: 'Ramatuelle' } })
    fireEvent.click(screen.getByText('Use “Ramatuelle”'))

    expect(onChange).toHaveBeenCalledWith('Ramatuelle')
  })

  it('asks for a country before anything else, and queries nothing until it has one', () => {
    mockSuggestions([], false)
    render(<AreaField countryCode="" value="" onChange={vi.fn()} />)

    expect(screen.getByRole('combobox')).toHaveTextContent('Choose a country first…')
    expect(useAreaSuggestions).toHaveBeenCalledWith({ countryCode: '' }, { query: { enabled: false } })
  })
})
