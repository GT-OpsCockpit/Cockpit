import { Pencil, Users } from 'lucide-react'
import type { PassengerEntity } from '@cockpit/shared/api'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/table-card'
import { EmptyState } from '@/components/empty-state'

export function PassengersTable({
  passengers,
  loading,
  onEdit,
}: {
  passengers: PassengerEntity[]
  loading: boolean
  onEdit: (passenger: PassengerEntity) => void
}) {
  return (
    <TableCard>
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[9%]" />
          <col className="w-[20%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
          <col className="w-[20%]" />
          <col className="w-[10%]" />
          <col className="w-[9%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Ref</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Routes</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground text-center text-sm">
                Loading…
              </TableCell>
            </TableRow>
          ) : passengers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>
                <EmptyState icon={Users} title="No passengers to display" description="Passengers created will appear here." />
              </TableCell>
            </TableRow>
          ) : (
            passengers.map((passenger) => (
              <TableRow key={passenger.id}>
                <TableCell className="text-xs">{passenger.ref}</TableCell>
                <TableCell className="text-xs font-medium">{passenger.name || '—'}</TableCell>
                <TableCell className="text-xs">{passenger.client?.name ?? '—'}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{passenger.phone ?? '—'}</TableCell>
                <TableCell className="text-xs">{passenger.email ?? '—'}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{passenger.routes.length}</TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(passenger)}>
                    <Pencil className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableCard>
  )
}
