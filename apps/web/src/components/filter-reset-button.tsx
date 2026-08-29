import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Always rendered (not only once a filter is active) so its position in the
 * filter bar never shifts — just disabled until `hasActiveFilters` is true.
 */
export function FilterResetButton({
  onReset,
  hasActiveFilters,
  className,
}: {
  onReset: () => void
  hasActiveFilters: boolean
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!hasActiveFilters}
      onClick={onReset}
      className={className}
    >
      <RotateCcw />
      Reset filters
    </Button>
  )
}
