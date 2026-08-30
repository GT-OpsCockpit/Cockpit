/**
 * Structural placeholder, same as the legacy (finance.html: "Coming soon",
 * no logic ever implemented — see docs/LEGACY_FEATURES.md §"finance.html").
 * Unlike Invoicing's Driver log/History tabs, there's no documented intended
 * scope to build toward here; this was the last page in the original
 * build-out, nothing more.
 */
import { PageTitle } from '@/components/layout/page-title'

export function FinancePage() {
  return (
    <div className="grid gap-6">
      <PageTitle />
      <p className="text-muted-foreground text-sm">Coming soon.</p>
    </div>
  )
}
