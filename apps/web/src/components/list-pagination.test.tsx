import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ListPagination } from './list-pagination'

afterEach(cleanup)

describe('ListPagination', () => {
  it('renders nothing when there are no results', () => {
    const { container } = render(<ListPagination page={1} limit={20} total={0} onPageChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the range and disables Previous on the first page', () => {
    render(<ListPagination page={1} limit={20} total={45} onPageChange={vi.fn()} />)
    expect(screen.getByText('1–20 of 45')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('shows a partial last-page range and disables Next on the last page', () => {
    render(<ListPagination page={3} limit={20} total={45} onPageChange={vi.fn()} />)
    expect(screen.getByText('41–45 of 45')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
  })

  it('calls onPageChange with page ± 1 when Next/Previous are clicked', () => {
    const onPageChange = vi.fn()
    render(<ListPagination page={2} limit={20} total={45} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPageChange).toHaveBeenCalledWith(3)

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('is a single, fully-enabled page when everything fits under the limit', () => {
    render(<ListPagination page={1} limit={20} total={5} onPageChange={vi.fn()} />)
    expect(screen.getByText('1–5 of 5')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })
})
