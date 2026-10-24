import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { BreakdownRow } from './finance-aggregations'
import { formatMoney } from './format-money'

const BAR_COLOR = '#3fc373'
const TOP_N_IN_CHART = 8

export function BreakdownSection({ rows }: { rows: BreakdownRow[] }) {
  const topRows = rows.slice(0, TOP_N_IN_CHART)
  // Longest label first (top of a horizontal bar chart renders top-down),
  // so the chart doesn't cut short labels off — recharts sizes the Y axis
  // to its widest tick, not the container.
  const yAxisWidth = Math.min(180, Math.max(60, ...topRows.map((r) => (r.label?.length ?? 8) * 6.5)))

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">No revenue in this period for the current filters.</p>
  }

  return (
    <div className="grid gap-4">
      <ResponsiveContainer width="100%" height={Math.max(200, topRows.length * 36)}>
        <BarChart data={topRows} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={yAxisWidth} />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            formatter={(value: number) => formatMoney(value)}
            labelFormatter={(label: string) => label}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="total" name="Revenue" fill={BAR_COLOR} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <Table className="table-fixed">
        <colgroup>
          <col className="w-[55%]" />
          <col className="w-[15%]" />
          <col className="w-[15%]" />
          <col className="w-[15%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Trips</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Share</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className="text-right tabular-nums">{row.count}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(row.total)}</TableCell>
              <TableCell className="text-right tabular-nums">{(row.share * 100).toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
