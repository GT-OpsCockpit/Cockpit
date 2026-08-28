import { normalizeEmail, suggestEmailDomain } from '@cockpit/shared'
import { Input } from '@/components/ui/input'

/**
 * Email field: a plain input that trims and lowercases on blur (the same
 * `normalizeEmail` the API applies before every uniqueness lookup, so what the
 * user sees is what gets stored), plus a one-click fix for a mistyped common
 * domain.
 *
 * Format validation stays in the zod schema via `isValidEmail`, not here —
 * that's the project's convention, and it keeps the API and the form agreeing
 * on one regex. <FormMessage> renders the error; this only adds the suggestion.
 *
 * The suggestion never rewrites anything on its own: "gmail.co" is a live
 * domain, so a near-miss is a question, not a correction.
 */
export function EmailInput({
  value,
  onChange,
  disabled,
  placeholder,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  'aria-label'?: string
}) {
  const suggestion = suggestEmailDomain(value)

  return (
    <div className="grid gap-1.5">
      <Input
        id={id}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-label={ariaLabel}
        type="email"
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // On blur, not on change: lowercasing mid-word fights anyone typing a
        // capital, and the field is only ever read after it loses focus.
        onBlur={() => {
          const normalized = normalizeEmail(value)
          if (normalized !== value) onChange(normalized)
        }}
      />
      {suggestion && !disabled && (
        <p className="text-muted-foreground text-xs">
          Did you mean{' '}
          <button
            type="button"
            className="text-foreground underline underline-offset-2"
            onClick={() => onChange(suggestion)}
          >
            {suggestion}
          </button>
          ?
        </p>
      )}
    </div>
  )
}
