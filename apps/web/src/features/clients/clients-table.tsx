import { CalendarPlus, Pencil, RotateCcw, X } from 'lucide-react'
import type { ClientEntity } from '@cockpit/shared/api'
import { formatPhoneDisplay } from '@cockpit/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/table-card'
import { TableSkeletonRows } from '@/components/table-skeleton-rows'
import { clientTypeLabel } from './client-status'

interface ClientsTableProps {
  clients: ClientEntity[]
  /** First (uncached) load of the clients query — shows skeleton rows instead of the empty-state line. */
  loading?: boolean
  onEdit: (client: ClientEntity) => void
  onToggleActive: (client: ClientEntity) => void
  onNewBooking: (client: ClientEntity) => void
}

export function ClientsTable({ clients, loading = false, onEdit, onToggleActive, onNewBooking }: ClientsTableProps) {
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ref</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>POC phone</TableHead>
            <TableHead>Billing</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableSkeletonRows columns={7} />
          ) : clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground text-center">
                No accounts to display.
              </TableCell>
            </TableRow>
          ) : (
            clients.map((client) => (
              <TableRow key={client.ref} className={cn(!client.active && 'opacity-50')}>
                <TableCell className="text-xs font-medium">{client.ref}</TableCell>
                <TableCell className="text-xs">
                  {client.name}
                  {client.acronym && <span className="text-muted-foreground text-[10px]"> ({client.acronym})</span>}
                </TableCell>
                <TableCell className="text-xs">{clientTypeLabel(client.clientType)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{client.email ?? '—'}</TableCell>
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
