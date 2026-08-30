import { useLocation } from 'react-router'
import { NAV_ITEMS } from './nav-items'

/**
 * A page's <h1>: the section's name and the same lucide icon as its nav link,
 * both resolved from the current route rather than passed in. Typing the
 * heading out per page put the section's name in two places, and renaming a
 * nav entry then left every page saying the old one.
 */
export function PageTitle() {
  const { pathname } = useLocation()
  const item = NAV_ITEMS.find((navItem) => pathname.startsWith(navItem.to))
  const Icon = item?.icon

  return (
    <h1 className="flex items-center gap-2 text-2xl font-semibold">
      {Icon && <Icon className="text-muted-foreground size-6" aria-hidden="true" />}
      {item?.label}
    </h1>
  )
}
