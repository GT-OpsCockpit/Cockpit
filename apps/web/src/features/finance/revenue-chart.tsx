import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { RevenueMonthPoint } from './finance-aggregations'
import { formatMoney } from './format-money'

// Current period first (most prominent), then progressively fainter for
// older comparison years — the same "how far back" visual logic as the
// live clock's two-line Paris/local order, just expressed in color instead
// of position.
const COLOR_CURRENT = '#3fc373'
const COLOR_PREV1 = '#3b82f6'
const COLOR_PREV2 = '#94a3b8'

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; payload: RevenueMonthPoint }> }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  const rows: Array<{ label: string; value: number; color: string }> = [
    { label: point.currentMonthLabel, value: point.current, color: COLOR_CURRENT },
  ]
  if (point.prev1MonthLabel != null && point.prev1 !== undefined) {
    rows.push({ label: point.prev1MonthLabel, value: point.prev1, color: COLOR_PREV1 })
  }
  if (point.prev2MonthLabel != null && point.prev2 !== undefined) {
    rows.push({ label: point.prev2MonthLabel, value: point.prev2, color: COLOR_PREV2 })
  }
  return (
    <div className="rounded-lg border bg-popover p-2.5 text-xs shadow-md">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2 whitespace-nowrap">
          <span className="size-2 rounded-full" style={{ backgroundColor: row.color }} />
          <span className="text-muted-foreground">{row.label}</span>
          <span className="ml-auto font-medium tabular-nums">{formatMoney(row.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function RevenueChart({ points, compareYears }: { points: RevenueMonthPoint[]; compareYears: 0 | 1 | 2 }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="current" name="This period" fill={COLOR_CURRENT} radius={[3, 3, 0, 0]} />
        {compareYears >= 1 && <Bar dataKey="prev1" name="-1 year" fill={COLOR_PREV1} radius={[3, 3, 0, 0]} />}
        {compareYears >= 2 && <Bar dataKey="prev2" name="-2 years" fill={COLOR_PREV2} radius={[3, 3, 0, 0]} />}
      </BarChart>
    </ResponsiveContainer>
  )
}
