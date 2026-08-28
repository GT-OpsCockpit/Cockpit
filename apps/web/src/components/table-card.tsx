import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * The frame every list table sits in. Same visual language as <Card> —
 * `rounded-xl` + a light `ring` instead of a hard border — so tables, cards and
 * floating surfaces read as one system (see docs/UI_REFRESH_PLAN.md).
 * `overflow-hidden` is what lets the header's tint follow the rounded corners;
 * horizontal scrolling still happens inside <Table>'s own container.
 */
export function TableCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="table-card"
      className={cn('overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10', className)}
      {...props}
    />
  )
}
