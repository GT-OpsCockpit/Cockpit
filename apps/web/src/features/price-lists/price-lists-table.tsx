import { Pencil, Tag } from 'lucide-react'
import type { PriceListEntity } from '@cockpit/shared/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/table-card'
import { EmptyState } from '@/components/empty-state'

export function PriceListsTable({
  priceLists,
  loading,
  onEdit,
}: {
  priceLists: PriceListEntity[]
  loading: boolean
  onEdit: (priceList: PriceListEntity) => void
}) {
  return (
    <TableCard>
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[10%]" />
          <col className="w-[28%]" />
          <col className="w-[10%]" />
          <col className="w-[13%]" />
          <col className="w-[29%]" />
          <col className="w-[10%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Ref</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Routes</TableHead>
            <TableHead>Clients</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground text-center text-sm">
                Loading…
              </TableCell>
            </TableRow>
          ) : priceLists.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState icon={Tag} title="No price lists to display" description="Price lists created will appear here." />
              </TableCell>
            </TableRow>
          ) : (
            priceLists.map((priceList) => (
              <TableRow key={priceList.id}>
                <TableCell className="text-xs">{priceList.ref}</TableCell>
                <TableCell className="text-xs font-medium">{priceList.name}</TableCell>
                <TableCell className="text-xs">
                  {priceList.active ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">{(priceList.entries ?? []).length}</TableCell>
                <TableCell className="text-xs">
                  {(priceList.clients ?? []).length > 0 ? (priceList.clients ?? []).map((c) => c.name).join(', ') : '—'}
                </TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(priceList)}>
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
