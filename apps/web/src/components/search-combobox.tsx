import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
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

export interface ComboboxOption {
  value: string
  label: string
  description?: string
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
  disabled?: boolean
  className?: string
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
  disabled,
  className,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel,
}: SearchComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          className={cn('w-full min-w-0 justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="min-w-0 truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={onSearchChange === undefined}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={onSearchChange}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
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
