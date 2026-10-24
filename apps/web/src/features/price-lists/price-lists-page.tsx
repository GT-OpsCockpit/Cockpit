import { useState } from 'react'
import type { PriceListEntity } from '@cockpit/shared/api'
import { usePriceListsControllerList } from '@cockpit/shared/api'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { PageTitle } from '@/components/layout/page-title'
import { FilterCard } from '@/components/filter-card'
import { FilterField } from '@/components/filter-field'
import { Input } from '@/components/ui/input'
import { PriceListCreateDialog } from './price-list-create-dialog'
import { PriceListEditDialog } from './price-list-edit-dialog'
import { PriceListsTable } from './price-lists-table'

export function PriceListsPage() {
  const [search, setSearch] = useState('')
  // Just the ref — PriceListEditDialog fetches its own live copy, see its comment.
  const [editTargetRef, setEditTargetRef] = useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search, 300)

  const priceLists = usePriceListsControllerList({ search: debouncedSearch || undefined })
  const hasActiveFilters = search.trim().length > 0

  const handleEdit = (priceList: PriceListEntity) => setEditTargetRef(priceList.ref)

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <PageTitle />
        <PriceListCreateDialog />
      </div>

      <FilterCard hasActiveFilters={hasActiveFilters} onReset={() => setSearch('')}>
        <FilterField label="Search" htmlFor="pl-filter-search" className="w-80">
          <Input
            id="pl-filter-search"
            placeholder="Search by name or ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </FilterField>
      </FilterCard>

      <PriceListsTable
        priceLists={priceLists.data ?? []}
        loading={priceLists.isLoading}
        onEdit={handleEdit}
      />

      <PriceListEditDialog priceListRef={editTargetRef} onOpenChange={(open) => !open && setEditTargetRef(null)} />
    </div>
  )
}
