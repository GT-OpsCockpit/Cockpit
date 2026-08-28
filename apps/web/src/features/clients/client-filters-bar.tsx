import { ClientEntityClientType } from '@cockpit/shared/api'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FilterResetButton } from '@/components/filter-reset-button'
import type { ClientFilters } from './client-status'

const ALL_TYPES = '__all__'

export function ClientFiltersBar({
  filters,
  onChange,
  hasActiveFilters,
  onReset,
}: {
  filters: ClientFilters
  onChange: (filters: ClientFilters) => void
  hasActiveFilters: boolean
  onReset: () => void
}) {
  const set = <K extends keyof ClientFilters>(key: K, value: ClientFilters[K]) => onChange({ ...filters, [key]: value })

  return (
    <div className="grid gap-3">
      <Input
        type="search"
        placeholder="Search by ref, name, email or acronym…"
        value={filters.search}
        onChange={(e) => set('search', e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filters.type || ALL_TYPES} onValueChange={(v) => set('type', v === ALL_TYPES ? '' : (v as ClientFilters['type']))}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>All types</SelectItem>
            <SelectItem value={ClientEntityClientType.INDIVIDUAL}>Individual</SelectItem>
            <SelectItem value={ClientEntityClientType.COMPANY}>Company</SelectItem>
            <SelectItem value={ClientEntityClientType.EVENT}>Events</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-inactive"
            checked={filters.showInactive}
            onCheckedChange={(checked) => set('showInactive', checked === true)}
          />
          <Label htmlFor="show-inactive" className="text-sm font-normal">
            Show deactivated
          </Label>
        </div>
        <FilterResetButton onReset={onReset} hasActiveFilters={hasActiveFilters} />
      </div>
    </div>
  )
}
