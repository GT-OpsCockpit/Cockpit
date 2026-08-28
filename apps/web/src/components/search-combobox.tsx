import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface ComboboxOption {
  value: string
  label: string
  description?: string
  /**
   * Shown but not selectable — the legacy's greyed-out entries (e.g. "Local",
   * listed in every country's Area but only valid in France, see initAreaCombo
   * / common.js:832). Greying it out rather than dropping it is deliberate: an
   * absent option reads as "no such concept", a disabled one as "not here".
   */
  disabled?: boolean
}

interface SearchComboboxProps {
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  emptyText?: string
  searchPlaceholder?: string
  /** Controlled search text — pass this + onSearchChange to drive an async/remote search (address, POC…). */
  searchValue?: string
  onSearchChange?: (value: string) => void
  /**
   * Remote searches only: true while a query for the current search text is
   * in flight (typically `query.isFetching`, debounce included — see
   * `pendingSearch` below). Without it the list silently keeps showing the
   * *previous* search's results, which reads as "the search did nothing".
   */
  loading?: boolean
  /** Remote searches only: shown while `loading` and no result is on screen yet. */
  loadingText?: string
  /**
   * Lets the user commit whatever they typed, even when it matches no option
   * — the field then suggests rather than closes the list. Needed by Area,
   * constrained to the country's major cities yet still accepting a city that
   * isn't catalogued, exactly as the legacy's was.
   */
  allowCustomValue?: boolean
  /** `allowCustomValue` only: label of the row that commits the typed text. */
  customValueLabel?: (search: string) => string
  /**
   * Fallback label for `value` when it isn't in `options` — a remote search
   * only ever holds the current slice of results, so the selected item drops
   * out of it as soon as the user searches for something else. The combobox
   * already remembers every label it has itself displayed; this covers the
   * one case it cannot know, a value selected before this component mounted
   * (editing a trip whose client/driver no search has returned yet).
   */
  selectedLabel?: string
  disabled?: boolean
  className?: string
  /** Optional lucide icon rendered before the value, the way <InputGroupAddon align="inline-start"> does on plain inputs. */
  icon?: LucideIcon
  /**
   * Forwarded onto the trigger button so this composes with shadcn's <FormControl> the same way
   * <SelectTrigger> does elsewhere in the form — without these, <FormLabel>'s htmlFor pointed at
   * an id that was never rendered anywhere (no accessible name on the trigger button; see the
   * "Incorrect use of `<label for=…>`" DevTools warning documented in the Bookings handoff docs).
   */
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  /**
   * For a standalone combobox with no <FormLabel>/htmlFor pairing (e.g. a
   * filter bar) — role="combobox" computes its accessible name from a
   * label, not from the trigger's own text content, so without this the
   * field has no accessible name at all despite showing a value visually.
   */
  'aria-label'?: string
}

/**
 * Remembers the label of every option this combobox has displayed, so the
 * trigger keeps showing the selected item's name after that item falls out
 * of a remote search's results.
 *
 * Deliberately state + effect, not a ref mutated during render: the labels
 * change because a query (an external system) resolved, and this project's
 * React Compiler requires render purity — a memoized render could skip
 * re-running and read a stale ref.
 */
function useLabelMemory(options: ComboboxOption[]): Map<string, string> {
  const [memory, setMemory] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    setMemory((prev) => {
      let changed = false
      const next = new Map(prev)
      for (const option of options) {
        if (next.get(option.value) !== option.label) {
          next.set(option.value, option.label)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [options])

  return memory
}

/** Generic searchable combobox (Popover + Command) — the shared primitive behind Country/Customer/Driver/Address/POC pickers. */
export function SearchCombobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  emptyText = 'No results.',
  searchPlaceholder = 'Search…',
  searchValue,
  onSearchChange,
  loading = false,
  loadingText = 'Searching…',
  allowCustomValue = false,
  customValueLabel = (search) => `Use “${search}”`,
  selectedLabel,
  disabled,
  className,
  icon: Icon,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel,
}: SearchComboboxProps) {
  const [open, setOpen] = useState(false)
  // A free-text combobox has to read back what was typed in order to commit
  // it, so it drives the search box itself unless the caller already does
  // (remote mode). Cleared on close, or reopening would show the last search.
  const [ownSearch, setOwnSearch] = useState('')
  const remote = onSearchChange !== undefined
  const search = searchValue ?? (allowCustomValue ? ownSearch : undefined)
  const handleSearchChange = onSearchChange ?? (allowCustomValue ? setOwnSearch : undefined)
  const labelMemory = useLabelMemory(options)
  // A free-text value is its own label — it is whatever the user typed, and
  // no option carries it.
  const currentLabel =
    options.find((o) => o.value === value)?.label ??
    labelMemory.get(value) ??
    selectedLabel ??
    (allowCustomValue && value ? value : undefined)

  const trimmedSearch = (search ?? '').trim()
  const showCustomValue =
    allowCustomValue &&
    trimmedSearch.length > 0 &&
    !options.some((o) => !o.disabled && o.label.toLowerCase() === trimmedSearch.toLowerCase())

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setOwnSearch('')
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full min-w-0 justify-between font-normal', !currentLabel && 'text-muted-foreground', className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            {Icon && <Icon className="size-4 shrink-0 opacity-60" aria-hidden="true" />}
            <span className="min-w-0 truncate">{currentLabel ?? placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={!remote}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={handleSearchChange}
            loading={loading}
          />
          {/*
            While a remote search is in flight the rows below still hold the
            *previous* query's results — dim them and show cmdk's <Command.Loading>
            so a search that returns the same (or no) rows still visibly does
            something. aria-busy lets a screen reader hear the same thing.
          */}
          <CommandList aria-busy={loading}>
            {loading && <CommandLoading>{loadingText}</CommandLoading>}
            {/* cmdk's <Command.Empty> renders on its own whenever nothing matched — gate it
                off while loading so an in-flight search never reads as "No results." */}
            {/* With a free-text row on screen there is always something to pick,
                so "No results." would be contradicting it. */}
            {!loading && !showCustomValue && <CommandEmpty>{emptyText}</CommandEmpty>}
            {showCustomValue && (
              <CommandGroup forceMount>
                <CommandItem
                  forceMount
                  value={`__custom__${trimmedSearch}`}
                  onSelect={() => {
                    onChange(trimmedSearch)
                    handleOpenChange(false)
                  }}
                >
                  <Check className={cn('mr-2 size-4', value === trimmedSearch ? 'opacity-100' : 'opacity-0')} />
                  <span>{customValueLabel(trimmedSearch)}</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup className={cn(loading && 'opacity-50 transition-opacity')}>
              {options.map((option) => (
                <CommandItem
                  // cmdk matches on this string when it does the filtering
                  // (local mode) — but labels aren't unique in remote results
                  // (two drivers can share a name), and same-value items
                  // highlight as one, so key off the real value there.
                  // Falls back to the label for the ""-valued "All …" reset
                  // row the filter bars prepend: cmdk treats an empty
                  // data-value as "no item", which would make that row
                  // unreachable by keyboard.
                  key={option.value}
                  value={remote ? option.value || option.label : option.label}
                  disabled={option.disabled}
                  onSelect={() => {
                    onChange(option.value)
                    handleOpenChange(false)
                  }}
                >
                  <Check className={cn('mr-2 size-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.description && (
                      <span className="text-muted-foreground text-xs">{option.description}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
