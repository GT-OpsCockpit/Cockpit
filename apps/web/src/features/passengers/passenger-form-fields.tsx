import { User } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'
import { useClientsControllerList } from '@cockpit/shared/api'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmailInput } from '@/components/email-input'
import { PhoneInput } from '@/components/phone-input'
import { SearchCombobox, type ComboboxOption } from '@/components/search-combobox'
import type { PassengerFormValues } from './passenger-form-schema'

const CLIENT_PICKER_LIMIT = 100

export function PassengerFormFields({ form }: { form: UseFormReturn<PassengerFormValues> }) {
  // A plain fetch of the first 100 accounts, filtered client-side by
  // SearchCombobox's own built-in (cmdk) matching — simpler than the
  // debounced server-search comboboxes elsewhere (trip-form-fields.tsx)
  // since this list only has to be "good enough to find one account by
  // name", not handle an unbounded roster.
  const clients = useClientsControllerList({ limit: CLIENT_PICKER_LIMIT })
  const clientOptions: ComboboxOption[] = (clients.data?.data ?? []).map((c) => ({
    value: c.ref,
    label: c.name,
  }))

  return (
    <div className="grid gap-4 sm:grid-cols-2">
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
      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mobile</FormLabel>
            <FormControl>
              <PhoneInput value={field.value ?? ''} onChange={field.onChange} />
            </FormControl>
            <FormMessage />
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
      <FormField
        control={form.control}
        name="clientRef"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Client account</FormLabel>
            <FormControl>
              <SearchCombobox
                icon={User}
                value={field.value ?? ''}
                onChange={field.onChange}
                options={clientOptions}
                placeholder="Independent (no client)"
                searchPlaceholder="Search account…"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
