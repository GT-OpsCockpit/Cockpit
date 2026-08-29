import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FilterField } from '@/components/filter-field'
import type { VehicleFilters } from './vehicle-status'

export function VehicleFiltersBar({
  filters,
  onChange,
}: {
  filters: VehicleFilters
  onChange: (filters: VehicleFilters) => void
}) {
  const set = <K extends keyof VehicleFilters>(key: K, value: VehicleFilters[K]) => onChange({ ...filters, [key]: value })

  return (
    <div className="grid gap-3">
      <FilterField label="Search" htmlFor="vh-filter-search">
        <Input
          id="vh-filter-search"
          type="search"
          placeholder="Search by ref, reg nbr, make, model or acronym…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
      </FilterField>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex h-9 items-center gap-2">
          <Checkbox
            id="show-inactive-vehicles"
            checked={filters.showInactive}
            onCheckedChange={(checked) => set('showInactive', checked === true)}
          />
          <Label htmlFor="show-inactive-vehicles" className="text-sm font-normal">
            Show deactivated
          </Label>
        </div>
      </div>
    </div>
  )
}
