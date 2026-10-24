import type { UseFormReturn } from 'react-hook-form'
import { Car } from 'lucide-react'
import { useMetaControllerGetMeta } from '@cockpit/shared/api'
import { AreaField } from '@/components/area-field'
import { EmailInput } from '@/components/email-input'
import { PhoneInput } from '@/components/phone-input'
import { SearchCombobox } from '@/components/search-combobox'
import { useCountryOptions } from '@/hooks/use-country-options'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import type { PartnerFormValues } from './partner-form-schema'

function makesFor(category: string, categoryModels: Record<string, Record<string, string[]>>, fleetMakes: string[]): string[] {
  const models = categoryModels[category]
  return models ? Object.keys(models) : fleetMakes
}

function modelsFor(
  category: string,
  make: string,
  categoryModels: Record<string, Record<string, string[]>>,
  fleetModelsByMake: Record<string, string[]>,
): string[] {
  const models = categoryModels[category]
  return models ? (models[make] ?? []) : (fleetModelsByMake[make] ?? [])
}

/**
 * The "New partner" popup's fields. Field order: Company name, then the
 * Individual toggle right under it (disabled/hidden fields never clear what
 * was typed — Challenge UX decision, see docs/feature-requests/partner-companies.md),
 * then First/Last name, Country/Area, Phone/Mobile, Email — and, only once
 * Individual is checked, this partner's own vehicle (Category/Make/Model/
 * Color/Reg Nbr), created together with them and their driver record in one
 * request (see partner-form-mapping.ts, PartnersService.createIndividualRoster).
 */
export function PartnerFormFields({
  form,
  editing = false,
}: {
  form: UseFormReturn<PartnerFormValues>
  /** Hides the "this partner's vehicle" creation block — editing a Partner never touches its roster, see PartnersService.update(). */
  editing?: boolean
}) {
  const individual = form.watch('individual')
  const countryCode = form.watch('countryCode') ?? ''
  const countryOptions = useCountryOptions()
  const meta = useMetaControllerGetMeta()

  const category = form.watch('vehicleCategory') ?? ''
  const make = form.watch('vehicleMake') ?? ''
  const model = form.watch('vehicleModel') ?? ''
  const categoryOptions = (meta.data?.vehicleTypes ?? []).map((t) => t.name)
  const categoryModels = meta.data?.categoryModels ?? {}
  const fleetModelsByMake = meta.data?.fleetModelsByMake ?? {}
  const fleetMakes = meta.data?.fleetMakes ?? []
  const makeOptions = makesFor(category, categoryModels, fleetMakes)
  const modelOptions = modelsFor(category, make, categoryModels, fleetModelsByMake)

  // Same cascading Category -> Make -> Model idiom as vehicle-form-fields.tsx
  // (Fleet's own "New vehicle" popup) — each change snaps the next select to
  // a value that's actually valid for what was just picked.
  const onCategoryChange = (value: string) => {
    form.setValue('vehicleCategory', value)
    const nextMakes = makesFor(value, categoryModels, fleetMakes)
    const nextMake = nextMakes.includes(make) ? make : (nextMakes[0] ?? '')
    form.setValue('vehicleMake', nextMake)
    const nextModels = modelsFor(value, nextMake, categoryModels, fleetModelsByMake)
    form.setValue('vehicleModel', nextModels.includes(model) ? model : (nextModels[0] ?? ''))
  }
  const onMakeChange = (value: string) => {
    form.setValue('vehicleMake', value)
    const nextModels = modelsFor(category, value, categoryModels, fleetModelsByMake)
    form.setValue('vehicleModel', nextModels.includes(model) ? model : (nextModels[0] ?? ''))
  }

  return (
    <div className="grid gap-4">
      <FormField
        control={form.control}
        name="companyName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Company name</FormLabel>
            <FormControl>
              <Input
                {...field}
                disabled={individual}
                placeholder={individual ? 'Not needed for an individual partner' : 'e.g. Riviera VTC Services'}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="individual"
        render={({ field }) => (
          <FormItem className="bg-accent/40 flex flex-row items-center gap-2 rounded-md border p-3">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
            <FormLabel className="mb-0">This is an individual (not a company)</FormLabel>
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Ahmed" />
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
                <Input {...field} placeholder="e.g. Ben Salah" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <FormField
          control={form.control}
          name="mobile"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile</FormLabel>
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
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <EmailInput value={field.value ?? ''} onChange={field.onChange} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {individual && !editing && (
        <div className="bg-accent/40 grid grid-cols-1 gap-4 rounded-md border p-3 sm:grid-cols-2">
          <div className="flex items-center gap-1.5 text-sm font-medium sm:col-span-2">
            <Car className="size-4" aria-hidden="true" />
            This partner's vehicle
          </div>
          <FormField
            control={form.control}
            name="vehicleCategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select value={field.value} onValueChange={onCategoryChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Category…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vehicleRegNbr"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reg Nbr</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="AB-123-CD" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vehicleMake"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Make</FormLabel>
                <Select key={category} value={field.value} onValueChange={onMakeChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Make…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {makeOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vehicleModel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <Select key={`${category}:${make}`} value={field.value} onValueChange={(v) => form.setValue('vehicleModel', v)}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Model…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {modelOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vehicleColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Color</FormLabel>
                <Select value={field.value || meta.data?.fleetDefaultColor || ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Color…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(meta.data?.fleetColors ?? []).map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="inline-flex items-center gap-2">
                          <span className="size-3 rounded-full border" style={{ backgroundColor: c.hex }} />
                          {c.value}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          {/* Same free choice as the Fleet "New vehicle" popup's own 4WD
              checkbox (vehicle-form-fields.tsx) — nothing about being an
              individual sub-contractor's car implies either way. */}
          <FormField
            control={form.control}
            name="vehicleFourWD"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 self-end pb-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="mb-0">4WD</FormLabel>
              </FormItem>
            )}
          />
          <p className="text-muted-foreground text-xs sm:col-span-2">
            Creates a driver for {form.watch('firstName') || 'this partner'} (visible in the Drivers table, attached to this
            partner) and reserves this vehicle to them.
          </p>
        </div>
      )}

      {!individual && !editing && (
        <p className="text-muted-foreground bg-accent/40 rounded-md p-3 text-xs">
          Once saved, you can add drivers and vehicles under this company and assign jobs to them.
        </p>
      )}
    </div>
  )
}
