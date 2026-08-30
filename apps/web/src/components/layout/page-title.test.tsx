import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { PageTitle } from './page-title'
import { NAV_ITEMS } from './nav-items'

afterEach(cleanup)

function at(pathname: string) {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <PageTitle />
    </MemoryRouter>,
  )
}

describe('PageTitle', () => {
  // The heading used to be typed out at each page on top of the nav entry that
  // already named the section, so renaming "Clients" to "Customers" left nine
  // pages saying the old name. Deriving it is what the component's icon lookup
  // was already doing, and what its comment already claimed.
  it('names the section exactly as its nav entry does', () => {
    at('/clients')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Customers')
  })

  it('reads the label from NAV_ITEMS rather than a copy of it', () => {
    const drivers = NAV_ITEMS.find((item) => item.to === '/drivers')!
    at('/drivers')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(drivers.label)
  })

  it('resolves the section from a nested route, not just its index', () => {
    at('/settings/company')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Settings')
  })
})
