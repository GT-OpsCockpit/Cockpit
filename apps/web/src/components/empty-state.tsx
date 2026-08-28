import type { LucideIcon } from 'lucide-react'
import { RotateCcw, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

interface EmptyStateProps {
  /** Icon for the genuinely-empty case — ignored (in favour of a search icon) once `hasActiveFilters` is true. */
  icon: LucideIcon
  title: string
  description: string
  /**
   * When set, switches the empty state to the "your filters matched nothing"
   * variant: a search icon, a generic message, and a reset button — instead
   * of telling the user there's simply no data at all.
   */
  hasActiveFilters?: boolean
  onResetFilters?: () => void
}

export function EmptyState({ icon: Icon, title, description, hasActiveFilters, onResetFilters }: EmptyStateProps) {
  if (hasActiveFilters) {
    return (
      <Empty className="border-none py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>No results for these filters</EmptyTitle>
          <EmptyDescription>Try widening your search.</EmptyDescription>
        </EmptyHeader>
        {onResetFilters && (
          <EmptyContent>
            <Button type="button" variant="outline" size="sm" onClick={onResetFilters}>
              <RotateCcw />
              Reset filters
            </Button>
          </EmptyContent>
        )}
      </Empty>
    )
  }

  return (
    <Empty className="border-none py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
