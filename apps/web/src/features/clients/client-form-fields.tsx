import { useEffect, useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { ClientEntityBilling, ClientEntityClientType } from '@cockpit/shared/api'
import { SearchCombobox } from '@/components/search-combobox'
import { AreaField } from '@/components/area-field'
import { EmailInput } from '@/components/email-input'
import { PhoneInput } from '@/components/phone-input'
import { useCountryOptions } from '@/hooks/use-country-options'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import type { ClientFormValues } from './client-form-schema'

export function ClientFormFields({
  form,
  disabled = false,
  typeLocked = false,
}: {
  form: UseFormReturn<ClientFormValues>
  disabled?: boolean
  /** Locks just the Account-type select (Events creation flow — see features/events/event-client-create-dialog.tsx). */
  typeLocked?: boolean
}) {
  const clientType = form.watch('clientType')
  const eventCountry = form.watch('eventCountry') ?? ''
  const isCompany = clientType === ClientEntityClientType.COMPANY
  const isEvent = clientType === ClientEntityClientType.EVENT
  const isIndividual = !isCompany && !isEvent

  const contactFirstName = form.watch('contactFirstName') ?? ''
  const contactLastName = form.watch('contactLastName') ?? ''

  // POC Full Name follows the contact's first + last name until someone types
  // in it themselves, and never again after that (pocNameAutoSynced,
  // clients.html:488-498). The server already falls back to the contact's name
  // for an empty POC, so this is typing comfort — but it is what makes what
  // will be saved visible instead of guessed at.
  //
  // Seeded as already-touched when a POC is on file: the legacy's flag only
  // ever governed its creation form, while v2 shares these fields with the
  // edit dialog, where a POC already recorded is usually a deliberately
  // different person. Correcting a typo in the contact's name must not
  // silently rewrite them.
  const pocNameTouched = useRef(!!form.getValues('pocName')?.trim())

  useEffect(() => {
    if (!isIndividual || pocNameTouched.current) return
    // Both empty leaves the last synced value in place rather than blanking
    // the field, same as the legacy.
    const full = [contactFirstName.trim(), contactLastName.trim()].filter(Boolean).join(' ')
    if (full) form.setValue('pocName', full)
  }, [isIndividual, contactFirstName, contactLastName, form])

  const countryOptions = useCountryOptions()

  return (
    <fieldset disabled={disabled} className="contents">
      <div className="grid gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="clientType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={typeLocked}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={ClientEntityClientType.INDIVIDUAL}>Individual</SelectItem>
                    <SelectItem value={ClientEntityClientType.COMPANY}>Company</SelectItem>
                    <SelectItem value={ClientEntityClientType.EVENT}>Events</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="billing"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={ClientEntityBilling.ACCOUNT}>Central</SelectItem>
                    <SelectItem value={ClientEntityBilling.CARD}>Card</SelectItem>
                    <SelectItem value={ClientEntityBilling.CASH}>Cash</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        {isIndividual && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="contactFirstName"
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
              name="contactLastName"
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
        )}

        {(isCompany || isEvent) && (
          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{isEvent ? 'Event name' : 'Company name'}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {isEvent && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              control={form.control}
              name="eventCountry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event country</FormLabel>
                  <FormControl>
                    <SearchCombobox
                      value={field.value ?? ''}
                      onChange={(value) => {
                        field.onChange(value)
                        // "Local" is France-only and a city belongs to one country,
                        // so an Area already on file is now invalid — force a fresh
                        // pick rather than let it silently rot (legacy
                        // resetAreaField, common.js:871).
                        form.setValue('eventArea', '')
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
              name="eventArea"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event area</FormLabel>
                  <FormControl>
                    <AreaField countryCode={eventCountry} value={field.value ?? ''} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventStartDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventEndDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            control={form.control}
            name="acronym"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Acronym</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                {/* The 4-character cap (restored 2026-08-29) had nowhere to
                    report itself, so a longer acronym made Create do nothing. */}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="refPoOther"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ref. / PO / Other</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vatNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>VAT number</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <EmailInput value={field.value ?? ''} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem className="lg:col-span-2">
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal code</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="countryCode"
          render={({ field }) => (
            <FormItem className="max-w-xs">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="pocName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>POC Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Contact name"
                    {...field}
                    onChange={(e) => {
                      pocNameTouched.current = true
                      field.onChange(e)
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pocPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>POC Mobile</FormLabel>
                <FormControl>
                  <PhoneInput
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    countryCode={form.watch('countryCode')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pocEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>POC Email</FormLabel>
                <FormControl>
                  <EmailInput value={field.value ?? ''} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </fieldset>
  )
}
