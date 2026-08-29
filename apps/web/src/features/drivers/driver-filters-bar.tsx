import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FilterField } from '@/components/filter-field'
import type { DriverFilters } from './driver-status'

export function DriverFiltersBar({
  filters,
  onChange,
}: {
  filters: DriverFilters
  onChange: (filters: DriverFilters) => void
}) {
  const set = <K extends keyof DriverFilters>(key: K, value: DriverFilters[K]) => onChange({ ...filters, [key]: value })

  return (
    <div className="grid gap-3">
      <FilterField label="Search" htmlFor="dr-filter-search">
        <Input
          id="dr-filter-search"
          type="search"
          placeholder="Search by ref, name, company, email or phone…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
      </FilterField>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex h-9 items-center gap-2">
          <Checkbox
            id="show-inactive-drivers"
            checked={filters.showInactive}
            onCheckedChange={(checked) => set('showInactive', checked === true)}
          />
          <Label htmlFor="show-inactive-drivers" className="text-sm font-normal">
            Show deactivated
          </Label>
        </div>
      </div>
    </div>
  )
}
