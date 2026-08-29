import { ClientEntityClientType } from '@cockpit/shared/api'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FilterField } from '@/components/filter-field'
import type { ClientFilters } from './client-status'

const ALL_TYPES = '__all__'

export function ClientFiltersBar({
  filters,
  onChange,
}: {
  filters: ClientFilters
  onChange: (filters: ClientFilters) => void
}) {
  const set = <K extends keyof ClientFilters>(key: K, value: ClientFilters[K]) => onChange({ ...filters, [key]: value })

  return (
    <div className="grid gap-3">
      <FilterField label="Search" htmlFor="cl-filter-search">
        <Input
          id="cl-filter-search"
          type="search"
          placeholder="Search by ref, name, email or acronym…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
      </FilterField>
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Type" htmlFor="cl-filter-type" className="w-44">
          <Select value={filters.type || ALL_TYPES} onValueChange={(v) => set('type', v === ALL_TYPES ? '' : (v as ClientFilters['type']))}>
            <SelectTrigger id="cl-filter-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TYPES}>All types</SelectItem>
              <SelectItem value={ClientEntityClientType.INDIVIDUAL}>Individual</SelectItem>
              <SelectItem value={ClientEntityClientType.COMPANY}>Company</SelectItem>
              <SelectItem value={ClientEntityClientType.EVENT}>Events</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <div className="flex h-9 items-center gap-2">
          <Checkbox
            id="show-inactive"
            checked={filters.showInactive}
            onCheckedChange={(checked) => set('showInactive', checked === true)}
          />
          <Label htmlFor="show-inactive" className="text-sm font-normal">
            Show deactivated
          </Label>
        </div>
      </div>
    </div>
  )
}
