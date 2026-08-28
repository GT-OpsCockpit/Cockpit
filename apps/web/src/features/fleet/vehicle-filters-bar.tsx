import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FilterResetButton } from '@/components/filter-reset-button'
import type { VehicleFilters } from './vehicle-status'

export function VehicleFiltersBar({
  filters,
  onChange,
  hasActiveFilters,
  onReset,
}: {
  filters: VehicleFilters
  onChange: (filters: VehicleFilters) => void
  hasActiveFilters: boolean
  onReset: () => void
}) {
  const set = <K extends keyof VehicleFilters>(key: K, value: VehicleFilters[K]) => onChange({ ...filters, [key]: value })

  return (
    <div className="grid gap-3">
      <Input
        type="search"
        placeholder="Search by ref, reg nbr, make, model or acronym…"
        value={filters.search}
        onChange={(e) => set('search', e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id="show-inactive-vehicles"
          checked={filters.showInactive}
          onCheckedChange={(checked) => set('showInactive', checked === true)}
        />
        <Label htmlFor="show-inactive-vehicles" className="text-sm font-normal">
          Show deactivated
        </Label>
        <FilterResetButton onReset={onReset} hasActiveFilters={hasActiveFilters} />
      </div>
    </div>
  )
}
