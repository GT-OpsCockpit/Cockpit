import { useMetaControllerGetMeta, usePartnersControllerList } from '@cockpit/shared/api'
import { FilterField } from '@/components/filter-field'
import { SearchCombobox } from '@/components/search-combobox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchAndInactiveFiltersBar } from '@/components/search-and-inactive-filters-bar'
import { useCountryOptions } from '@/hooks/use-country-options'
import type { DriverFilters } from './driver-status'

const ALL_LOCALITY = '__all__'
const ALL_CATEGORY = '__all__'

export function DriverFiltersBar({
  filters,
  onChange,
}: {
  filters: DriverFilters
  onChange: (filters: DriverFilters) => void
}) {
  const meta = useMetaControllerGetMeta()
  const partners = usePartnersControllerList({})
  const countryOptions = [{ value: '', label: 'All countries' }, ...useCountryOptions()]

  const cities = Array.from(new Set((meta.data?.majorCities ?? []).map((c) => c.name))).sort()
  const areaOptions = [{ value: '', label: 'All areas' }, ...cities.map((name) => ({ value: name, label: name }))]

  const companyOptions = [
    { value: '', label: 'All companies' },
    ...(partners.data ?? []).map((p) => ({ value: p.id, label: p.individual ? p.contactName : (p.companyName ?? p.contactName) })),
  ]

  const set = <K extends keyof DriverFilters>(key: K, value: DriverFilters[K]) => onChange({ ...filters, [key]: value })

  return (
    <SearchAndInactiveFiltersBar
      filters={filters}
      onChange={onChange}
      idPrefix="dr"
      searchPlaceholder="Search by ref, name, company, email or phone…"
    >
      <FilterField label="In house" htmlFor="dr-filter-inHouse" className="w-36">
        <Select
          value={filters.inHouse === '' ? ALL_LOCALITY : filters.inHouse}
          onValueChange={(v) => set('inHouse', v === ALL_LOCALITY ? '' : (v as DriverFilters['inHouse']))}
        >
          <SelectTrigger id="dr-filter-inHouse" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_LOCALITY}>All</SelectItem>
            <SelectItem value="true">In house</SelectItem>
            <SelectItem value="false">Partner</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Company" htmlFor="dr-filter-company" className="w-44">
        <SearchCombobox
          id="dr-filter-company"
          className="w-full"
          value={filters.partnerId}
          onChange={(v) => set('partnerId', v)}
          options={companyOptions}
          placeholder="All companies"
          searchPlaceholder="Search company…"
        />
      </FilterField>

      <FilterField label="Country" htmlFor="dr-filter-country" className="w-40">
        <SearchCombobox
          id="dr-filter-country"
          className="w-full"
          value={filters.countryCode}
          onChange={(v) => set('countryCode', v)}
          options={countryOptions}
          placeholder="All countries"
          searchPlaceholder="Search country…"
        />
      </FilterField>

      <FilterField label="Area" htmlFor="dr-filter-area" className="w-40">
        <SearchCombobox
          id="dr-filter-area"
          className="w-full"
          value={filters.area}
          onChange={(v) => set('area', v)}
          options={areaOptions}
          placeholder="All areas"
          searchPlaceholder="Search area…"
        />
      </FilterField>

      <FilterField label="Vehicle category" htmlFor="dr-filter-category" className="w-40">
        <Select value={filters.category || ALL_CATEGORY} onValueChange={(v) => set('category', v === ALL_CATEGORY ? '' : v)}>
          <SelectTrigger id="dr-filter-category" className="w-full">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORY}>All categories</SelectItem>
            {(meta.data?.vehicleTypes ?? []).map((v) => (
              <SelectItem key={v.ref} value={v.name}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
    </SearchAndInactiveFiltersBar>
  )
}
