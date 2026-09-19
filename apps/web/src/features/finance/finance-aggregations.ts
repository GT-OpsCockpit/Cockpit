import { DateTime } from 'luxon'
import type { TripEntity } from '@cockpit/shared/api'
import type { FinanceBreakdownDimension, FinanceFilters, FinanceScope } from './finance-filters'

/** Every date here is anchored to Paris — same convention as the live clock
 * and the rest of the app's "today" logic — so "this year" means the same
 * thing for every viewer regardless of their own browser time zone. */
const ZONE = 'Europe/Paris'

export interface FinancePeriod {
  start: DateTime
  /** Exclusive, first instant *after* the period. */
  end: DateTime
}

/** Resolves the filters' period into concrete start/end instants. Always
 * whole months, so the revenue chart's monthly buckets never end up with a
 * partial first/last month silently under-counting a period's edge. */
export function resolveFinancePeriod(filters: FinanceFilters): FinancePeriod {
  const now = DateTime.now().setZone(ZONE)
  switch (filters.periodPreset) {
    case 'ytd':
      return { start: now.startOf('year'), end: now.startOf('month').plus({ months: 1 }) }
    case 'thisYear':
      return { start: now.startOf('year'), end: now.startOf('year').plus({ years: 1 }) }
    case 'lastYear': {
      const start = now.startOf('year').minus({ years: 1 })
      return { start, end: start.plus({ years: 1 }) }
    }
    case 'custom': {
      const parsedFrom = filters.customFrom ? DateTime.fromISO(filters.customFrom, { zone: ZONE }) : null
      const parsedTo = filters.customTo ? DateTime.fromISO(filters.customTo, { zone: ZONE }) : null
      const start = (parsedFrom?.isValid ? parsedFrom : now.startOf('year')).startOf('month')
      const endDay = parsedTo?.isValid ? parsedTo : now
      const end = endDay.startOf('month').plus({ months: 1 })
      return start < end ? { start, end } : { start: end.minus({ months: 1 }), end }
    }
    case 'last12':
    default:
      return { start: now.startOf('month').minus({ months: 11 }), end: now.startOf('month').plus({ months: 1 }) }
  }
}

/** The full fetch window the API call needs: the current period, widened
 * back far enough to also cover every comparison year the chart will draw —
 * one round trip instead of N+1. */
export function resolveFetchWindow(filters: FinanceFilters): FinancePeriod {
  const period = resolveFinancePeriod(filters)
  return { start: period.start.minus({ years: filters.compareYears }), end: period.end }
}

function monthStartsInRange(period: FinancePeriod): DateTime[] {
  const months: DateTime[] = []
  let cursor = period.start.startOf('month')
  while (cursor < period.end) {
    months.push(cursor)
    cursor = cursor.plus({ months: 1 })
  }
  return months
}

/** `local` = kept in-house (not sub-contracted), `farmout` = handed to a
 * partner — mirrors the `subContractor` flag the booking form itself sets. */
function matchesScope(trip: TripEntity, scope: FinanceScope): boolean {
  if (scope === 'local') return !trip.subContractor
  if (scope === 'farmout') return trip.subContractor
  return true
}

function matchesGeography(trip: TripEntity, countryCode: string | null): boolean {
  return countryCode == null || trip.countryCode === countryCode
}

/** The figure this whole page reports on: what the booking actually billed
 * at, in EUR. A farmed-out trip's cost to the partner (`partnerRateEur`) is
 * margin/cost analysis, a different question than "how much revenue did this
 * period generate" — deliberately not netted out here. */
function revenueOf(trip: TripEntity): number {
  return trip.priceEur != null ? Number(trip.priceEur) : 0
}

function filterTrips(trips: TripEntity[], filters: FinanceFilters): TripEntity[] {
  return trips.filter((t) => matchesScope(t, filters.scope) && matchesGeography(t, filters.countryCode))
}

export interface RevenueMonthPoint {
  /** X-axis label, from the *current* period's calendar — comparison years
   * are aligned by position (1st month of the period against 1st month of
   * the same period a year earlier), not by calendar month name, so a custom
   * range that doesn't start in January still overlays correctly. */
  label: string
  current: number
  currentMonthLabel: string
  prev1?: number
  prev1MonthLabel?: string
  prev2?: number
  prev2MonthLabel?: string
}

export interface RevenueSeries {
  points: RevenueMonthPoint[]
  totals: { current: number; prev1?: number; prev2?: number }
}

/** One bucket per calendar month → summed revenue, for trips already
 * filtered to a single scope/geography. */
function monthlyTotals(trips: TripEntity[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const trip of trips) {
    const key = DateTime.fromISO(trip.pickupAt, { zone: ZONE }).toFormat('yyyy-LL')
    totals.set(key, (totals.get(key) ?? 0) + revenueOf(trip))
  }
  return totals
}

export function buildRevenueSeries(allTrips: TripEntity[], filters: FinanceFilters): RevenueSeries {
  const scoped = filterTrips(allTrips, filters)
  const totals = monthlyTotals(scoped)
  const period = resolveFinancePeriod(filters)
  const months = monthStartsInRange(period)

  const points: RevenueMonthPoint[] = months.map((month) => {
    const currentKey = month.toFormat('yyyy-LL')
    const point: RevenueMonthPoint = {
      label: month.toFormat(months.length > 12 ? 'LLL yy' : 'LLL'),
      current: totals.get(currentKey) ?? 0,
      currentMonthLabel: month.toFormat('LLLL yyyy'),
    }
    if (filters.compareYears >= 1) {
      const m = month.minus({ years: 1 })
      point.prev1 = totals.get(m.toFormat('yyyy-LL')) ?? 0
      point.prev1MonthLabel = m.toFormat('LLLL yyyy')
    }
    if (filters.compareYears >= 2) {
      const m = month.minus({ years: 2 })
      point.prev2 = totals.get(m.toFormat('yyyy-LL')) ?? 0
      point.prev2MonthLabel = m.toFormat('LLLL yyyy')
    }
    return point
  })

  const sum = (key: 'current' | 'prev1' | 'prev2') => points.reduce((acc, p) => acc + (p[key] ?? 0), 0)
  return {
    points,
    totals: {
      current: sum('current'),
      prev1: filters.compareYears >= 1 ? sum('prev1') : undefined,
      prev2: filters.compareYears >= 2 ? sum('prev2') : undefined,
    },
  }
}

export interface BreakdownRow {
  key: string
  label: string
  total: number
  count: number
  share: number
}

/** Only trips inside the *current* period contribute — the wider fetch
 * window exists for the chart's comparison years, not for this table.
 *
 * `countryNames` maps an ISO code to a display name (from /meta) — optional
 * so this stays a pure, easily-testable function even without it, falling
 * back to the bare code. */
export function buildBreakdown(
  allTrips: TripEntity[],
  filters: FinanceFilters,
  countryNames?: Record<string, string>,
): BreakdownRow[] {
  const period = resolveFinancePeriod(filters)
  const scoped = filterTrips(allTrips, filters).filter((t) => {
    const at = DateTime.fromISO(t.pickupAt, { zone: ZONE })
    return at >= period.start && at < period.end
  })

  const buckets = new Map<string, { label: string; total: number; count: number }>()
  for (const trip of scoped) {
    const { key, label } = groupKey(trip, filters.breakdownBy, countryNames)
    const bucket = buckets.get(key) ?? { label, total: 0, count: 0 }
    bucket.total += revenueOf(trip)
    bucket.count += 1
    buckets.set(key, bucket)
  }

  const grandTotal = [...buckets.values()].reduce((acc, b) => acc + b.total, 0)
  return [...buckets.entries()]
    .map(([key, b]) => ({ key, label: b.label, total: b.total, count: b.count, share: grandTotal > 0 ? b.total / grandTotal : 0 }))
    .sort((a, b) => b.total - a.total)
}

function groupKey(
  trip: TripEntity,
  dimension: FinanceBreakdownDimension,
  countryNames?: Record<string, string>,
): { key: string; label: string } {
  if (dimension === 'client') {
    // `client.name` is a derived display name (company, or contact first+last)
    // and is normally always set — but a record created with none of those
    // filled in has nothing to derive it from, so fall back to the ref rather
    // than crash the chart on an edge case in the underlying data.
    return { key: trip.client.ref, label: trip.client.name || trip.client.ref }
  }
  if (dimension === 'vehicle') {
    return trip.vehicleType
      ? { key: trip.vehicleType.ref, label: trip.vehicleType.name || trip.vehicleType.ref }
      : { key: '__none__', label: 'Unspecified' }
  }
  // country
  return trip.countryCode
    ? { key: trip.countryCode, label: countryNames?.[trip.countryCode] || trip.countryCode }
    : { key: '__none__', label: 'Unspecified' }
}
