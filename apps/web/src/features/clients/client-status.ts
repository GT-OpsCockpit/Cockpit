import type { ClientEntity } from '@cockpit/shared/api'
import type { BookingPrefill } from '@/features/bookings/booking-create-dialog'

export const CLIENT_TYPE_LABELS: Record<ClientEntity['clientType'], string> = {
  INDIVIDUAL: 'Individual',
  COMPANY: 'Company',
  EVENT: 'Events',
}

export function clientTypeLabel(type: ClientEntity['clientType']): string {
  return CLIENT_TYPE_LABELS[type]
}

export interface ClientFilters {
  search: string
  type: '' | ClientEntity['clientType']
  showInactive: boolean
}

export function defaultClientFilters(): ClientFilters {
  return { search: '', type: '', showInactive: false }
}

/** Seeds a "New booking" modal opened from this client's row — see booking-create-dialog.tsx. */
export function clientBookingPrefill(client: ClientEntity): BookingPrefill {
  return { clientRef: client.ref, clientLabel: `${client.name} (${client.ref})` }
}
