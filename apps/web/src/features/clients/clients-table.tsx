import { CalendarPlus, Pencil, RotateCcw, Users, X } from 'lucide-react'
import { ClientEntityClientType, type ClientEntity } from '@cockpit/shared/api'
import { formatPhoneDisplay } from '@cockpit/shared'
import { cn, formatDate } from '@/lib/utils'
import { CountryLabel } from '@/components/country-label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/table-card'
import { TableSkeletonRows } from '@/components/table-skeleton-rows'
import { EmptyState } from '@/components/empty-state'
import { clientTypeLabel } from './client-status'

interface ClientsTableProps {
  clients: ClientEntity[]
  /** First (uncached) load of the clients query — shows skeleton rows instead of the empty-state line. */
  loading?: boolean
  onEdit: (client: ClientEntity) => void
  onToggleActive: (client: ClientEntity) => void
  onNewBooking: (client: ClientEntity) => void
  hasActiveFilters?: boolean
  onResetFilters?: () => void
}

export function ClientsTable({
  clients,
  loading = false,
  onEdit,
  onToggleActive,
  onNewBooking,
  hasActiveFilters,
  onResetFilters,
}: ClientsTableProps) {
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ref</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>POC</TableHead>
            <TableHead>POC phone</TableHead>
            <TableHead>Billing</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableSkeletonRows columns={9} />
          ) : clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="p-0 whitespace-normal">
                <EmptyState
                  icon={Users}
                  title="No accounts to display"
                  description="Accounts created will appear here."
                  hasActiveFilters={hasActiveFilters}
                  onResetFilters={onResetFilters}
                />
              </TableCell>
            </TableRow>
          ) : (
            clients.map((client) => (
              <TableRow key={client.ref} className={cn(!client.active && 'opacity-50')}>
                <TableCell className="text-xs font-medium">{client.ref}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  <CountryLabel code={client.countryCode} />
                </TableCell>
                <TableCell className="text-xs">
                  {client.name}
                  {client.acronym && <span className="text-muted-foreground text-[10px]"> ({client.acronym})</span>}
                  {/* An Events account is booked against its dates, and a
                      finished one is the usual reason a driver can no longer be
                      assigned — the legacy put them right under the name for
                      that reason (common.js:3358-3360). */}
                  {client.clientType === ClientEntityClientType.EVENT && (client.eventStartDate || client.eventEndDate) && (
                    <div className="text-muted-foreground text-[10px]">
                      {client.eventStartDate ? formatDate(client.eventStartDate) : '?'} →{' '}
                      {client.eventEndDate ? formatDate(client.eventEndDate) : '?'}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs">{clientTypeLabel(client.clientType)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{client.email ?? '—'}</TableCell>
                <TableCell className="text-xs">{client.pocName ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatPhoneDisplay(client.pocPhone) || '—'}</TableCell>
                <TableCell className="text-xs">{client.billing ?? '—'}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" title="New booking" onClick={() => onNewBooking(client)}>
                      <CalendarPlus className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => onEdit(client)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={client.active ? 'Deactivate' : 'Reactivate'}
                      onClick={() => onToggleActive(client)}
                    >
                      {client.active ? <X className="size-3.5" /> : <RotateCcw className="size-3.5" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableCard>
  )
}
