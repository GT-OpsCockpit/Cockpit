import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { NAV_ITEMS } from './nav-items'

/**
 * A page's <h1>, carrying the same lucide icon as its nav link. The icon is
 * resolved from the current route rather than passed in, so a section's nav
 * entry and its heading can never drift apart.
 */
export function PageTitle({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const Icon = NAV_ITEMS.find((item) => pathname.startsWith(item.to))?.icon

  return (
    <h1 className="flex items-center gap-2 text-2xl font-semibold">
      {Icon && <Icon className="text-muted-foreground size-6" aria-hidden="true" />}
      {children}
    </h1>
  )
}
