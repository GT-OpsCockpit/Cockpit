import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { STEP_ICONS } from '@/features/bookings/trip-step-icons'

/** Shared mobile-card shell for /driver/:ref and /track/:ref — no auth, no app nav. */
export function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted flex min-h-svh justify-center px-4 py-6">
      <Card className="w-full max-w-md gap-0 overflow-hidden py-0">{children}</Card>
    </div>
  )
}

export function PublicPageEmpty({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground p-10 text-center text-sm">{children}</p>
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="text-muted-foreground w-[76px] shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

/** Same lucide vocabulary as the dispatcher's status badge — one glyph per step, app-wide. */
export function StepIcon({ done, step }: { done: boolean; step: string }) {
  const Icon = STEP_ICONS[step]
  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full transition-colors [&>svg]:size-4',
        done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
      )}
    >
      {done ? <Check aria-hidden="true" /> : Icon ? <Icon aria-hidden="true" /> : null}
    </div>
  )
}
