import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FilterResetButton } from '@/components/filter-reset-button'
import type { DriverFilters } from './driver-status'

export function DriverFiltersBar({
  filters,
  onChange,
  hasActiveFilters,
  onReset,
}: {
  filters: DriverFilters
  onChange: (filters: DriverFilters) => void
  hasActiveFilters: boolean
  onReset: () => void
}) {
  const set = <K extends keyof DriverFilters>(key: K, value: DriverFilters[K]) => onChange({ ...filters, [key]: value })

  return (
    <div className="grid gap-3">
      <Input
        type="search"
        placeholder="Search by ref, name, company, email or phone…"
        value={filters.search}
        onChange={(e) => set('search', e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id="show-inactive-drivers"
          checked={filters.showInactive}
          onCheckedChange={(checked) => set('showInactive', checked === true)}
        />
        <Label htmlFor="show-inactive-drivers" className="text-sm font-normal">
          Show deactivated
        </Label>
        <FilterResetButton onReset={onReset} hasActiveFilters={hasActiveFilters} />
      </div>
    </div>
  )
}
