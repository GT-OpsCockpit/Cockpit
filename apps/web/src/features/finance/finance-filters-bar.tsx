import { FilterField } from '@/components/filter-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchCombobox } from '@/components/search-combobox'
import { useCountryOptions } from '@/hooks/use-country-options'
import {
  FINANCE_BREAKDOWN_DIMENSIONS,
  FINANCE_BREAKDOWN_LABELS,
  FINANCE_PERIOD_LABELS,
  FINANCE_PERIOD_PRESETS,
  FINANCE_SCOPE_LABELS,
  FINANCE_SCOPES,
  type FinanceBreakdownDimension,
  type FinanceFilters,
  type FinancePeriodPreset,
  type FinanceScope,
} from './finance-filters'

const WORLDWIDE = '__worldwide__'
const COMPARE_OPTIONS = [
  { value: '0', label: "Don't compare" },
  { value: '1', label: 'vs last year' },
  { value: '2', label: 'vs last 2 years' },
]

export function FinanceFiltersBar({
  filters,
  onChange,
}: {
  filters: FinanceFilters
  onChange: (filters: FinanceFilters) => void
}) {
  const countryOptions = useCountryOptions()
  const set = <K extends keyof FinanceFilters>(key: K, value: FinanceFilters[K]) =>
    onChange({ ...filters, [key]: value })

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterField label="Period" htmlFor="fin-filter-period" className="w-44">
        <Select value={filters.periodPreset} onValueChange={(v) => set('periodPreset', v as FinancePeriodPreset)}>
          <SelectTrigger id="fin-filter-period" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FINANCE_PERIOD_PRESETS.map((p) => (
              <SelectItem key={p} value={p}>
                {FINANCE_PERIOD_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      {filters.periodPreset === 'custom' && (
        <>
          <FilterField label="From" htmlFor="fin-filter-from" className="w-40">
            <Input
              id="fin-filter-from"
              type="date"
              value={filters.customFrom}
              onChange={(e) => set('customFrom', e.target.value)}
            />
          </FilterField>
          <FilterField label="To" htmlFor="fin-filter-to" className="w-40">
            <Input
              id="fin-filter-to"
              type="date"
              value={filters.customTo}
              onChange={(e) => set('customTo', e.target.value)}
            />
          </FilterField>
        </>
      )}

      <FilterField label="Compare" htmlFor="fin-filter-compare" className="w-40">
        <Select value={String(filters.compareYears)} onValueChange={(v) => set('compareYears', Number(v) as 0 | 1 | 2)}>
          <SelectTrigger id="fin-filter-compare" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPARE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Scope" htmlFor="fin-filter-scope" className="w-40">
        <Select value={filters.scope} onValueChange={(v) => set('scope', v as FinanceScope)}>
          <SelectTrigger id="fin-filter-scope" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FINANCE_SCOPES.map((s) => (
              <SelectItem key={s} value={s}>
                {FINANCE_SCOPE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Geography" htmlFor="fin-filter-geo" className="w-52">
        <SearchCombobox
          id="fin-filter-geo"
          className="w-full"
          value={filters.countryCode ?? WORLDWIDE}
          onChange={(v) => set('countryCode', v === WORLDWIDE ? null : v)}
          options={[{ value: WORLDWIDE, label: '🌍 Worldwide' }, ...countryOptions]}
          placeholder="Worldwide"
          searchPlaceholder="Search country…"
        />
      </FilterField>

      <FilterField label="Breakdown" htmlFor="fin-filter-breakdown" className="w-44">
        <Select value={filters.breakdownBy} onValueChange={(v) => set('breakdownBy', v as FinanceBreakdownDimension)}>
          <SelectTrigger id="fin-filter-breakdown" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FINANCE_BREAKDOWN_DIMENSIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {FINANCE_BREAKDOWN_LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
    </div>
  )
}
