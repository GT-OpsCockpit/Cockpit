import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

/**
 * A filter control and its visible name. Until this existed a filter was only
 * legible while it was empty — the field's purpose lived in a `placeholder`
 * that vanished on the first keystroke, and a <Select> had no accessible name
 * at all (see the workaround trip-edit-rbac.spec.ts had to carry).
 *
 * `htmlFor` targets the control's own id, including a <SelectTrigger> or a
 * <SearchCombobox> trigger — both render a <button>, which is a labelable
 * element, so `getByLabel` resolves them like any input.
 *
 * A checkbox doesn't use this (its label sits to the right, not above): pair it
 * with <Label> inside a `flex h-9 items-center gap-2` so it lines up with the
 * other controls under `items-end`.
 */
export function FilterField({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string
  htmlFor: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-muted-foreground text-xs font-medium">
        {label}
      </Label>
      {children}
    </div>
  )
}
