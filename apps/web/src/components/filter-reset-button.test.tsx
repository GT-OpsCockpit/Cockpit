import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FilterResetButton } from './filter-reset-button'

afterEach(cleanup)

describe('FilterResetButton', () => {
  it('is disabled when there are no active filters', () => {
    render(<FilterResetButton onReset={vi.fn()} hasActiveFilters={false} />)
    expect(screen.getByRole('button', { name: 'Reset filters' })).toBeDisabled()
  })

  it('is enabled and calls onReset when filters are active', () => {
    const onReset = vi.fn()
    render(<FilterResetButton onReset={onReset} hasActiveFilters />)

    const button = screen.getByRole('button', { name: 'Reset filters' })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(onReset).toHaveBeenCalledOnce()
  })
})
