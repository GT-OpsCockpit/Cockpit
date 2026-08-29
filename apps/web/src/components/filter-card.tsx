import type * as React from 'react'
import { cn } from '@/lib/utils'
import { FilterResetButton } from '@/components/filter-reset-button'

/**
 * The frame every filter block sits in — deliberately the same visual language
 * as <TableCard> (`rounded-xl` + a light `ring`) so a page reads as one system:
 * the filters and the results they produce are two panels of the same kit, not
 * a loose row of inputs floating above a card.
 *
 * The reset button lives here rather than in each bar so its position is
 * identical on all 8 list pages — the page already holds `hasActiveFilters` /
 * `onReset` for its empty state, and used to pass them straight through.
 */
export function FilterCard({
  title = 'Filters',
  hasActiveFilters,
  onReset,
  className,
  children,
}: {
  title?: string
  hasActiveFilters: boolean
  onReset: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <div data-slot="filter-card" className={cn('rounded-xl bg-card p-4 ring-1 ring-foreground/10', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-muted-foreground text-sm font-semibold">{title}</h2>
        <FilterResetButton onReset={onReset} hasActiveFilters={hasActiveFilters} />
      </div>
      {children}
    </div>
  )
}
