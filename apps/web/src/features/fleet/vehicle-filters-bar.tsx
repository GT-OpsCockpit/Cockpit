import { useMemo } from 'react'
import { useMetaControllerGetMeta, usePartnersControllerList } from '@cockpit/shared/api'
import { FilterField } from '@/components/filter-field'
import { SearchCombobox } from '@/components/search-combobox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchAndInactiveFiltersBar } from '@/components/search-and-inactive-filters-bar'
import { useCountryOptions } from '@/hooks/use-country-options'
import type { VehicleFilters } from './vehicle-status'

const ALL_LOCALITY = '__all__'

export function VehicleFiltersBar({
  filters,
  onChange,
}: {
  filters: VehicleFilters
  onChange: (filters: VehicleFilters) => void
}) {
  const meta = useMetaControllerGetMeta()
  const partners = usePartnersControllerList({})
  const countryOptions = [{ value: '', label: 'All countries' }, ...useCountryOptions()]

  const areaOptions = useMemo(() => {
    const cities = Array.from(new Set((meta.data?.majorCities ?? []).map((c) => c.name))).sort()
    return [{ value: '', label: 'All areas' }, ...cities.map((name) => ({ value: name, label: name }))]
  }, [meta.data?.majorCities])

  const modelOptions = useMemo(() => {
    const models = Array.from(new Set(Object.values(meta.data?.fleetModelsByMake ?? {}).flat())).sort()
    return [{ value: '', label: 'All models' }, ...models.map((m) => ({ value: m, label: m }))]
  }, [meta.data?.fleetModelsByMake])

  const companyOptions = [
    { value: '', label: 'All companies' },
    ...(partners.data ?? []).map((p) => ({ value: p.id, label: p.individual ? p.contactName : (p.companyName ?? p.contactName) })),
  ]

  const set = <K extends keyof VehicleFilters>(key: K, value: VehicleFilters[K]) => onChange({ ...filters, [key]: value })

  return (
    <SearchAndInactiveFiltersBar
      filters={filters}
      onChange={onChange}
      idPrefix="vh"
      searchPlaceholder="Search by ref, reg nbr, make, model or acronym…"
    >
      <FilterField label="In house" htmlFor="vh-filter-isLocal" className="w-36">
        <Select
          value={filters.isLocal === '' ? ALL_LOCALITY : filters.isLocal}
          onValueChange={(v) => set('isLocal', v === ALL_LOCALITY ? '' : (v as VehicleFilters['isLocal']))}
        >
          <SelectTrigger id="vh-filter-isLocal" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_LOCALITY}>All</SelectItem>
            <SelectItem value="true">In house</SelectItem>
            <SelectItem value="false">External</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Company" htmlFor="vh-filter-company" className="w-44">
        <SearchCombobox
          id="vh-filter-company"
          className="w-full"
          value={filters.partnerId}
          onChange={(v) => set('partnerId', v)}
          options={companyOptions}
          placeholder="All companies"
          searchPlaceholder="Search company…"
        />
      </FilterField>

      <FilterField label="Country" htmlFor="vh-filter-country" className="w-40">
        <SearchCombobox
          id="vh-filter-country"
          className="w-full"
          value={filters.countryCode}
          onChange={(v) => set('countryCode', v)}
          options={countryOptions}
          placeholder="All countries"
          searchPlaceholder="Search country…"
        />
      </FilterField>

      <FilterField label="Area" htmlFor="vh-filter-area" className="w-40">
        <SearchCombobox
          id="vh-filter-area"
          className="w-full"
          value={filters.area}
          onChange={(v) => set('area', v)}
          options={areaOptions}
          placeholder="All areas"
          searchPlaceholder="Search area…"
        />
      </FilterField>

      <FilterField label="Vehicle model" htmlFor="vh-filter-model" className="w-40">
        <SearchCombobox
          id="vh-filter-model"
          className="w-full"
          value={filters.model}
          onChange={(v) => set('model', v)}
          options={modelOptions}
          placeholder="All models"
          searchPlaceholder="Search model…"
        />
      </FilterField>
    </SearchAndInactiveFiltersBar>
  )
}
