import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'

/**
 * Placeholder rows for a list table during its first (uncached) load, so an
 * empty table reads as "loading" rather than "nothing to display". Gated on
 * `isLoading`, never `isFetching` — background refetches (the Bookings SSE
 * stream fires them constantly) must not blank out rows already on screen.
 */
export function TableSkeletonRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row}>
          {Array.from({ length: columns }, (_, column) => (
            <TableCell key={column}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
