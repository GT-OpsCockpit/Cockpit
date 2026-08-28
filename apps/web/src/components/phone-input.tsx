import { useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { getCountryCallingCode, type CountryCode } from 'libphonenumber-js/max'
import PhoneInputWithCountry from 'react-phone-number-input/max'
import { toIso2 } from '@cockpit/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { CountryFlag } from '@/components/country-flag'

interface CountrySelectOption {
  value?: CountryCode
  label: string
  divider?: boolean
}

/**
 * The calling-code picker sitting in front of the number. Not <SearchCombobox>:
 * that one's trigger shows the option's full label, and here the trigger has to
 * stay narrow — a flag and "+33" — while the list shows the country name. The
 * Popover + Command primitives underneath are the same ones.
 */
function CountryCallingCodeSelect({
  value,
  onChange,
  options,
  disabled,
  readOnly,
}: {
  value?: CountryCode
  onChange: (value?: CountryCode) => void
  options: CountrySelectOption[]
  disabled?: boolean
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selectable = options.filter((o) => !o.divider && o.value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          // The number input next to it carries the <FormLabel>'s htmlFor, so this
          // button needs a name of its own or it announces as just "combobox".
          aria-label="Country calling code"
          disabled={disabled || readOnly}
          className="shrink-0 gap-1.5 px-2 font-normal"
        >
          <CountryFlag code={value} />
          <span className="text-muted-foreground text-sm tabular-nums">
            {value ? `+${getCountryCallingCode(value)}` : '—'}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[18rem] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country…" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {selectable.map((option) => (
                <CommandItem
                  key={option.value}
                  // cmdk filters on this string, so the calling code has to be in
                  // it — "+33" and "33" are how people look a country up here.
                  value={`${option.label} ${option.value} +${getCountryCallingCode(option.value as CountryCode)}`}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <CountryFlag code={option.value} />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    +{getCountryCallingCode(option.value as CountryCode)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function PhoneInputContainer({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-2', className)} {...props} />
}

/**
 * Phone number field. The value is always E.164 ("+33612345678") — the format
 * the API stores and Twilio dials — so the country is carried by the number
 * itself and never needs its own column.
 *
 * Neither `international` nor `country` is set, only `defaultCountry`, which
 * puts the field in libphonenumber's "international or national" mode — the one
 * that accepts both of the things a dispatcher actually types:
 *
 *   "06 12 34 56 78"  read as the default country's number  -> +33612345678
 *   "+44 7911 123456" read as its own country, flag follows -> +447911123456
 *
 * Forcing `international` instead pre-fills the input with a "+33" scaffold,
 * which duplicates the calling code already shown in the selector and, once
 * cleared, leaves a pasted "+44…" number with no plus sign and the wrong flag.
 *
 * No `react-phone-number-input/style.css` import: every sub-component is
 * replaced by a shadcn one, and the library's stylesheet would only fight
 * Tailwind v4 (in particular the global `* { @apply border-border }` reset).
 */
export function PhoneInput({
  value,
  onChange,
  countryCode,
  disabled,
  placeholder,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel,
}: {
  /** E.164, or '' when empty — the form schemas keep every field a controlled string. */
  value: string
  onChange: (value: string) => void
  /**
   * The record's country field, used only to pick the calling code shown before
   * anything is typed. A catalogue pseudo-code ('US-NY') is fine, `toIso2`
   * reduces it. Never derived from this once a number exists: a POC's number is
   * routinely in a different country from the booking.
   */
  countryCode?: string | null
  disabled?: boolean
  placeholder?: string
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  'aria-label'?: string
}) {
  const defaultCountry = (toIso2(countryCode) ?? 'FR') as CountryCode

  return (
    <PhoneInputWithCountry
      defaultCountry={defaultCountry}
      // react-hook-form keeps fields as controlled strings, but the library
      // reports an emptied field as `undefined`.
      value={value || undefined}
      onChange={(next) => onChange(next ?? '')}
      disabled={disabled}
      placeholder={placeholder}
      id={id}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      aria-label={ariaLabel}
      containerComponent={PhoneInputContainer}
      countrySelectComponent={CountryCallingCodeSelect}
      inputComponent={Input}
    />
  )
}
