import { toIso2 } from '@cockpit/shared'
import { cn } from '@/lib/utils'

/**
 * Country flag for a catalogue code — including the pseudo-codes the catalogue
 * carries for split countries ('US-NY', 'AU-NSW'…), which `toIso2` reduces to
 * the real ISO alpha-2 the flag sprite is keyed by.
 *
 * Decorative on purpose: every place this is rendered also shows the country's
 * name or calling code, so announcing the flag would just repeat it. The muted
 * background keeps the slot visible for the handful of dialling territories
 * flag-icons has no flag for (Ascension, Tristan da Cunha) instead of
 * collapsing the row.
 */
export function CountryFlag({ code, className }: { code: string | null | undefined; className?: string }) {
  const iso2 = toIso2(code)
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-muted inline-block h-3 w-4 shrink-0 rounded-[2px] bg-cover bg-center',
        iso2 && `fi fi-${iso2.toLowerCase()}`,
        className,
      )}
    />
  )
}
