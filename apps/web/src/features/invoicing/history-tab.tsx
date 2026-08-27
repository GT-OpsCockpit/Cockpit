/**
 * Structural placeholder, same as the legacy (invoicing.html:179-184: "Coming
 * soon", no logic ever implemented) — planned scope was immutable reports
 * filed by client/period/ref-PO/event. See docs/agents/event-log-design.md
 * before building this: it's the intended read surface for the domain-event
 * log proposed there, not a bespoke query over Invoice/Trip.
 */
export function HistoryTab() {
  return (
    <div className="grid gap-3">
      <h2 className="text-lg font-semibold">History</h2>
      <p className="text-muted-foreground text-sm">Coming soon.</p>
    </div>
  )
}
