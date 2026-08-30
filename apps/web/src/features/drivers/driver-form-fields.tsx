import { useEffect, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { ClientsControllerListType, useClientsControllerList } from '@cockpit/shared/api'
import type { DriverEntity } from '@cockpit/shared/api'
import { useDebouncedSearch } from '@/lib/use-debounced-value'
import { SearchCombobox } from '@/components/search-combobox'
import { AreaField } from '@/components/area-field'
import { EmailInput } from '@/components/email-input'
import { PhoneInput } from '@/components/phone-input'
import { useCountryOptions } from '@/hooks/use-country-options'
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
  /** The driver being edited, if any (omit when creating) — labels the Event combobox before any search has run. */
  driver?: DriverEntity | null
  disabled?: boolean
}) {
  const [eventSearch, setEventSearch] = useState('')
  const { debounced: debouncedEventSearch, pending: eventSearchPending } = useDebouncedSearch(eventSearch, EVENT_PICKER_DEBOUNCE_MS)

  const eventsOnly = form.watch('eventsOnly')
  // "Partner" is a driver record carrying a Company — the same split as
  // isPartner (driver-status.ts).
  const company = form.watch('company')
  const isPartner = !!company?.trim()
  const countryCode = form.watch('countryCode') ?? ''
  const area = form.watch('area') ?? ''

  // Only the Events this driver could actually be linked to: happening where
  // it is, and not over yet. Filtered server-side (see ListClientsQueryDto) —
  // the listing is paginated, so narrowing the page here would hide a
  // mismatched event without excluding it. EventLinkService rejects the same
  // cases on save.
  const eventClients = useClientsControllerList(
    {
      type: ClientsControllerListType.EVENT,
      search: debouncedEventSearch || undefined,
      limit: EVENT_PICKER_LIMIT,
      eventCountry: countryCode || undefined,
      eventArea: area || undefined,
      eventNotEnded: true,
    },
    { query: { enabled: !!countryCode && !!area } },
  )

  // The link popup never let the operator choose where the Event was: it read
  // the record's own Country/Area and showed them greyed out (openEventLinkModal,
  // common.js:3034). Mirroring them here is what makes those read-only fields
  // true, and moving the driver invalidates a link to an event held elsewhere.
  useEffect(() => {
    if (!eventsOnly) return
    if (form.getValues('eventCountry') === countryCode && form.getValues('eventArea') === area) return
    form.setValue('eventCountry', countryCode)
    form.setValue('eventArea', area)
    form.setValue('eventRef', '')
  }, [eventsOnly, countryCode, area, form])

  const countryOptions = useCountryOptions()

  const eventOptions = (eventClients.data?.data ?? []).map((c) => ({ value: c.ref, label: `${c.name} (${c.ref})` }))
  const eventSelectedLabel = driver?.eventClient ? `${driver.eventClient.company} (${driver.eventClient.ref})` : undefined

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
                  <Input
                    placeholder="Leave empty for an internal driver"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e)
                      // An address kept from when this was a partner would sit
                      // there greyed out and still get saved — the legacy
                      // cleared it with the company (drivers.html:387). Not for
                      // an Events driver, whose email stays required and whose
                      // field stays enabled: clearing it there would wipe an
                      // address the operator had just typed, without a word.
                      if (!e.target.value.trim() && !eventsOnly) {
                        form.setValue('email', '', { shouldDirty: true })
                      }
                    }}
                  />
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
                  <PhoneInput value={field.value ?? ''} onChange={field.onChange} countryCode={countryCode} />
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
                {/* Only a partner is ever emailed — the sub-contracting drafts
                    go to their address, and an in-house chauffeur is reached on
                    WhatsApp. The legacy disabled and cleared the field for one
                    (drivers.html:385-387).
                    An Events driver is the exception the legacy got wrong:
                    ticking "Events-only" put "Email is required for an Events
                    driver" under a field the operator could not type in until
                    a Company was filled. The rule is right; it was the field
                    that had no business being greyed out. */}
                <EmailInput
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  disabled={!isPartner && !eventsOnly}
                  placeholder={isPartner || eventsOnly ? undefined : 'Partner companies only'}
                />
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
                    onChange={(value) => {
                      field.onChange(value)
                      // "Local" is France-only and a city belongs to one country,
                      // so an Area already on file is now invalid — force a fresh
                      // pick rather than let it silently rot (legacy
                      // resetAreaField, common.js:871).
                      form.setValue('area', '')
                    }}
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
            name="area"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Area</FormLabel>
                <FormControl>
                  <AreaField countryCode={countryCode} value={field.value ?? ''} onChange={field.onChange} />
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
                    <Input readOnly value={field.value ?? ''} placeholder="—" />
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
                    <Input readOnly value={field.value ?? ''} placeholder="—" />
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
                      loading={eventSearchPending || eventClients.isFetching}
                      selectedLabel={eventSelectedLabel}
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
