import {
  Banknote,
  Calendar,
  CalendarClock,
  Car,
  PartyPopper,
  ReceiptText,
  Settings,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

/**
 * The app's sections, in header order. Single source for the nav links and for
 * each page's <PageTitle> — label and icon both — so a section can't end up
 * named or drawn two different ways.
 *
 * "Customers" and "Drivers & Partners" are the legacy's own names for these
 * two (clients.html, drivers.html): an account here is rarely an end client,
 * and the second list holds sub-contracting companies as much as chauffeurs.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/bookings', label: 'Bookings', icon: Calendar },
  { to: '/clients', label: 'Customers', icon: Users },
  { to: '/drivers', label: 'Drivers & Partners', icon: Car },
  { to: '/vehicles', label: 'Vehicles', icon: Truck },
  { to: '/planning', label: 'Planning', icon: CalendarClock },
  { to: '/events', label: 'Events', icon: PartyPopper },
  { to: '/invoicing', label: 'Invoicing', icon: ReceiptText },
  { to: '/finance', label: 'Finance', icon: Banknote },
  { to: '/settings', label: 'Settings', icon: Settings },
]
