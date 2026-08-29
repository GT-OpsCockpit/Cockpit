import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FilterField } from '@/components/filter-field'
import type { TripPeriod } from '../bookings/booking-filters'
import type { PlanningCategory, PlanningFilters, PlanningView } from './planning-status'

const PERIOD_OPTIONS: { value: TripPeriod; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
]

const ALL = '__all__'

interface PlanningFiltersBarProps {
  filters: PlanningFilters
  onChange: (filters: PlanningFilters) => void
  resourceOptions: { value: string; label: string }[]
  resourceLabel: string
}

/** Mirrors the legacy's two toolbars (planning-chauffeur.html:36-62) — Daily/Event/All + period/resource filter, then List/Timeline + date/days (Timeline only). */
export function PlanningFiltersBar({ filters, onChange, resourceOptions, resourceLabel }: PlanningFiltersBarProps) {
  const set = <K extends keyof PlanningFilters>(key: K, value: PlanningFilters[K]) =>
    onChange({ ...filters, [key]: value })

  // The tab groups carry no label of their own — a tab list already shows every
  // option it offers, so naming it would only repeat what is on screen.
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Tabs value={filters.category} onValueChange={(v) => set('category', v as PlanningCategory)}>
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="event">Event</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {filters.view === 'list' && (
          <FilterField label="Period" htmlFor="pl-filter-period" className="w-36">
            <Select value={filters.period} onValueChange={(v) => set('period', v as TripPeriod)}>
              <SelectTrigger id="pl-filter-period" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        )}

        <FilterField
          label={`${resourceLabel.charAt(0).toUpperCase()}${resourceLabel.slice(1)}`}
          htmlFor="pl-filter-resource"
          className="w-48"
        >
          <Select value={filters.resourceRef || ALL} onValueChange={(v) => set('resourceRef', v === ALL ? '' : v)}>
            <SelectTrigger id="pl-filter-resource" className="w-full">
              <SelectValue placeholder={`All ${resourceLabel}s`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All {resourceLabel}s</SelectItem>
              {resourceOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Tabs value={filters.view} onValueChange={(v) => set('view', v as PlanningView)}>
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
        </Tabs>

        {filters.view === 'timeline' && (
          <>
            <FilterField label="Date" htmlFor="pl-filter-date" className="w-40">
              <Input
                id="pl-filter-date"
                type="date"
                className="w-full"
                value={filters.timelineDate}
                onChange={(e) => set('timelineDate', e.target.value)}
              />
            </FilterField>
            <Tabs
              value={String(filters.timelineDays)}
              onValueChange={(v) => set('timelineDays', Number(v) as 1 | 2 | 3)}
            >
              <TabsList>
                <TabsTrigger value="1">1 day</TabsTrigger>
                <TabsTrigger value="2">2 days</TabsTrigger>
                <TabsTrigger value="3">3 days</TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        )}
      </div>
    </div>
  )
}
