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
 * The app's sections, in header order. Single source for both the nav links and
 * each page's <PageTitle> icon, so a section can't end up with two glyphs.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/bookings', label: 'Bookings', icon: Calendar },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/drivers', label: 'Drivers', icon: Car },
  { to: '/vehicles', label: 'Vehicles', icon: Truck },
  { to: '/planning', label: 'Planning', icon: CalendarClock },
  { to: '/events', label: 'Events', icon: PartyPopper },
  { to: '/invoicing', label: 'Invoicing', icon: ReceiptText },
  { to: '/finance', label: 'Finance', icon: Banknote },
  { to: '/settings', label: 'Settings', icon: Settings },
]
