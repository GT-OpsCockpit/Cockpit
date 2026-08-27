import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { ClientsControllerListType, useClientsControllerList, useMetaControllerGetMeta } from '@cockpit/shared/api'
import type { DriverEntity } from '@cockpit/shared/api'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { useOptionMemory } from '@/lib/use-option-memory'
import { SearchCombobox } from '@/components/search-combobox'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import type { DriverFormValues } from './driver-form-schema'

const EVENT_PICKER_LIMIT = 20
const EVENT_PICKER_DEBOUNCE_MS = 300

export function DriverFormFields({
  form,
  driver,
  disabled = false,
}: {
  form: UseFormReturn<DriverFormValues>
  /** The driver being edited, if any (omit when creating) — seeds the Event combobox, see useOptionMemory. */
  driver?: DriverEntity | null
  disabled?: boolean
}) {
  const meta = useMetaControllerGetMeta()

  const [eventSearch, setEventSearch] = useState('')
  const debouncedEventSearch = useDebouncedValue(eventSearch, EVENT_PICKER_DEBOUNCE_MS)
  const eventClients = useClientsControllerList({
    type: ClientsControllerListType.EVENT,
    search: debouncedEventSearch || undefined,
    limit: EVENT_PICKER_LIMIT,
  })

  const eventsOnly = form.watch('eventsOnly')

  const countryOptions = (meta.data?.countries ?? []).map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))

  const eventResults = (eventClients.data?.data ?? []).map((c) => ({ value: c.ref, label: `${c.name} (${c.ref})` }))
  const eventOptions = useOptionMemory(
    eventResults,
    driver?.eventClient ? { value: driver.eventClient.ref, label: `${driver.eventClient.company} (${driver.eventClient.ref})` } : null,
  )

  return (
    <fieldset disabled={disabled} className="contents">
      <div className="grid gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <FormControl>
                  <Input placeholder="Leave empty for an internal driver" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+33…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="max-w-sm">
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="countryCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <SearchCombobox
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={countryOptions}
                    placeholder="Country…"
                    searchPlaceholder="Search country…"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="area"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Area</FormLabel>
                <FormControl>
                  <Input placeholder="Local" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="eventsOnly"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="mb-0">Events-only driver (linked to a single Event account)</FormLabel>
            </FormItem>
          )}
        />

        {eventsOnly && (
          <div className="bg-accent/40 grid grid-cols-1 gap-4 rounded-md border p-3 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="eventCountry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event country</FormLabel>
                  <FormControl>
                    <SearchCombobox
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={countryOptions}
                      placeholder="Country…"
                      searchPlaceholder="Search country…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventArea"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event area</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventRef"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event</FormLabel>
                  <FormControl>
                    <SearchCombobox
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={eventOptions}
                      placeholder="Select event…"
                      searchPlaceholder="Search event…"
                      searchValue={eventSearch}
                      onSearchChange={setEventSearch}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </div>
    </fieldset>
  )
}
