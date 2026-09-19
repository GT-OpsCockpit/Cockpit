import { useMemo, useState } from 'react'
import { useMetaControllerGetMeta, useTripsControllerList } from '@cockpit/shared/api'
import { PageTitle } from '@/components/layout/page-title'
import { FilterCard } from '@/components/filter-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { filtersChanged } from '@/lib/utils'
import { useTripEvents } from '../bookings/use-trip-events'
import { FinanceFiltersBar } from './finance-filters-bar'
import { defaultFinanceFilters, FINANCE_BREAKDOWN_LABELS } from './finance-filters'
import { buildBreakdown, buildRevenueSeries, resolveFetchWindow } from './finance-aggregations'
import { RevenueChart } from './revenue-chart'
import { BreakdownSection } from './breakdown-section'
import { formatDelta, formatMoney } from './format-money'

/**
 * Revenue analytics: monthly evolution (optionally overlaid against the same
 * period 1-2 years back) plus a breakdown by client/country/vehicle category,
 * both scoped by local-vs-farmed-out and by geography (a country, or
 * worldwide). See finance-aggregations.ts for how a plain trip list becomes
 * these two views — there is no dedicated reporting endpoint, this reads the
 * same /api/trips the Bookings board does and aggregates in the browser.
 */
export function FinancePage() {
  useTripEvents()

  const [filters, setFilters] = useState(defaultFinanceFilters())
  const hasActiveFilters = filtersChanged(filters, defaultFinanceFilters())
  const resetFilters = () => setFilters(defaultFinanceFilters())

  const fetchWindow = useMemo(() => resolveFetchWindow(filters), [filters])
  const trips = useTripsControllerList({
    from: fetchWindow.start.toISO() ?? undefined,
    to: fetchWindow.end.toISO() ?? undefined,
    category: 'all',
  })
  const meta = useMetaControllerGetMeta()

  const countryNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of meta.data?.countries ?? []) map[c.code] = c.name
    return map
  }, [meta.data])

  const allTrips = trips.data ?? []
  const revenue = useMemo(() => buildRevenueSeries(allTrips, filters), [allTrips, filters])
  const breakdown = useMemo(() => buildBreakdown(allTrips, filters, countryNames), [allTrips, filters, countryNames])

  return (
    <div className="grid gap-6">
      <PageTitle />

      <FilterCard hasActiveFilters={hasActiveFilters} onReset={resetFilters}>
        <FinanceFiltersBar filters={filters} onChange={setFilters} />
      </FilterCard>

      {trips.isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner /> Loading trips…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-xs font-medium">This period</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">{formatMoney(revenue.totals.current)}</div>
              </CardContent>
            </Card>
            {revenue.totals.prev1 !== undefined && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-muted-foreground text-xs font-medium">vs -1 year</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-semibold tabular-nums">{formatMoney(revenue.totals.prev1)}</div>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {formatDelta(revenue.totals.current, revenue.totals.prev1)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
            {revenue.totals.prev2 !== undefined && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-muted-foreground text-xs font-medium">vs -2 years</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-semibold tabular-nums">{formatMoney(revenue.totals.prev2)}</div>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {formatDelta(revenue.totals.current, revenue.totals.prev2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Revenue evolution</CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueChart points={revenue.points} compareYears={filters.compareYears} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{FINANCE_BREAKDOWN_LABELS[filters.breakdownBy]}</CardTitle>
            </CardHeader>
            <CardContent>
              <BreakdownSection rows={breakdown} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
