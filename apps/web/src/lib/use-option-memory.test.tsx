import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useOptionMemory } from './use-option-memory'
import type { ComboboxOption } from '@/components/search-combobox'

afterEach(cleanup)

function Probe({ results, seed }: { results: ComboboxOption[]; seed?: ComboboxOption | null }) {
  const options = useOptionMemory(results, seed)
  return <div data-testid="options">{options.map((o) => `${o.value}:${o.label}`).join(',')}</div>
}

describe('useOptionMemory', () => {
  it('passes through live results untouched when nothing has dropped out', async () => {
    render(<Probe results={[{ value: 'a', label: 'A' }]} />)
    expect(await screen.findByTestId('options')).toHaveTextContent('a:A')
  })

  it('keeps a previously seen option visible once it drops out of the live results', async () => {
    const { rerender } = render(<Probe results={[{ value: 'a', label: 'A' }]} />)
    await screen.findByTestId('options')

    rerender(<Probe results={[{ value: 'b', label: 'B' }]} />)
    const el = await screen.findByTestId('options')
    expect(el.textContent).toContain('b:B')
    expect(el.textContent).toContain('a:A')
  })

  it('includes the seed even before any live results have arrived', async () => {
    render(<Probe results={[]} seed={{ value: 'x', label: 'Seed X' }} />)
    expect(await screen.findByTestId('options')).toHaveTextContent('x:Seed X')
  })

  it('lets a live result override a stale label for the same value', async () => {
    const { rerender } = render(<Probe results={[{ value: 'a', label: 'Old Name' }]} />)
    await screen.findByTestId('options')

    rerender(<Probe results={[{ value: 'a', label: 'New Name' }]} />)
    const el = await screen.findByTestId('options')
    expect(el.textContent).toBe('a:New Name')
  })
})
