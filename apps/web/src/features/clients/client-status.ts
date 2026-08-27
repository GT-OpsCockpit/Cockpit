import type { ClientEntity } from '@cockpit/shared/api'

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
