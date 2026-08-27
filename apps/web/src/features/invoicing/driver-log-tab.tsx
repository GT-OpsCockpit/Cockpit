/**
 * Structural placeholder, same as the legacy (invoicing.html:129-134: "Coming
 * soon", no logic ever implemented) — planned scope was a per-driver export
 * with costs + total. Before building this for real, read
 * docs/agents/event-log-design.md: it and History both want the same
 * underlying domain-event log, and building this one first without that
 * design in place risks a bespoke aggregation that History would have to
 * duplicate or rework.
 */
export function DriverLogTab() {
  return (
    <div className="grid gap-3">
      <h2 className="text-lg font-semibold">Driver log</h2>
      <p className="text-muted-foreground text-sm">Coming soon.</p>
    </div>
  )
}
