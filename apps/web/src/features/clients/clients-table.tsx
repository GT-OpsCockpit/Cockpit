import { Pencil, RotateCcw, X } from 'lucide-react'
import type { ClientEntity } from '@cockpit/shared/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { clientTypeLabel } from './client-status'

interface ClientsTableProps {
  clients: ClientEntity[]
  onEdit: (client: ClientEntity) => void
  onToggleActive: (client: ClientEntity) => void
}

export function ClientsTable({ clients, onEdit, onToggleActive }: ClientsTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border">
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
          {clients.length === 0 ? (
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
                <TableCell className="text-muted-foreground text-xs">{client.pocPhone ?? '—'}</TableCell>
                <TableCell className="text-xs">{client.billing ?? '—'}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex gap-1">
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
    </div>
  )
}
