/**
 * Finance dashboard filters. Kept deliberately separate from the trip-list
 * filters used elsewhere (Bookings/Invoicing/Events): this page aggregates
 * across a whole period rather than listing individual trips, so its filter
 * shape (a period + a comparison depth + two revenue-scope dimensions)
 * doesn't map onto <ListTripsQueryDto> — see finance-aggregations.ts for how
 * a raw trip list is turned into what this page actually renders.
 */

export const FINANCE_PERIOD_PRESETS = ['last12', 'ytd', 'thisYear', 'lastYear', 'custom'] as const
export type FinancePeriodPreset = (typeof FINANCE_PERIOD_PRESETS)[number]

/** `all` = local + farmed-out combined, the two others isolate one side. */
export const FINANCE_SCOPES = ['all', 'local', 'farmout'] as const
export type FinanceScope = (typeof FINANCE_SCOPES)[number]

export const FINANCE_BREAKDOWN_DIMENSIONS = ['client', 'country', 'vehicle'] as const
export type FinanceBreakdownDimension = (typeof FINANCE_BREAKDOWN_DIMENSIONS)[number]

export interface FinanceFilters {
  periodPreset: FinancePeriodPreset
  /** Only read when periodPreset === 'custom'. ISO date (yyyy-MM-dd), local <input type="date"> value. */
  customFrom: string
  customTo: string
  scope: FinanceScope
  /** null = worldwide. A country code (e.g. 'FR') otherwise. */
  countryCode: string | null
  /** How many previous years to overlay on the revenue chart — 0 disables the comparison entirely. */
  compareYears: 0 | 1 | 2
  breakdownBy: FinanceBreakdownDimension
}

export function defaultFinanceFilters(): FinanceFilters {
  return {
    periodPreset: 'last12',
    customFrom: '',
    customTo: '',
    scope: 'all',
    countryCode: null,
    compareYears: 1,
    breakdownBy: 'client',
  }
}

export const FINANCE_PERIOD_LABELS: Record<FinancePeriodPreset, string> = {
  last12: 'Last 12 months',
  ytd: 'Year to date',
  thisYear: 'This year',
  lastYear: 'Last year',
  custom: 'Custom range',
}

export const FINANCE_SCOPE_LABELS: Record<FinanceScope, string> = {
  all: 'Local + Farm out',
  local: 'Local only',
  farmout: 'Farm out only',
}

export const FINANCE_BREAKDOWN_LABELS: Record<FinanceBreakdownDimension, string> = {
  client: 'By client',
  country: 'By country',
  vehicle: 'By vehicle category',
}
