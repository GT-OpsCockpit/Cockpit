import { useMetaControllerGetMeta } from '@cockpit/shared/api'
import { CountryFlag } from '@/components/country-flag'
import type { ComboboxOption } from '@/components/search-combobox'

/**
 * The country catalogue as <SearchCombobox> options, flag included — the one
 * shape every country picker uses (bookings, drivers, vehicles, clients,
 * company). Previously copy-pasted into each of those five files, which is how
 * the Events filter bar ended up rendering a differently-labelled list.
 *
 * The code stays in the label: several entries share a name prefix ("United
 * States (New York)" / "(California)"), and the code is what the rest of the
 * app — driver refs, Area suggestions — actually keys on.
 */
export function useCountryOptions(): ComboboxOption[] {
  const meta = useMetaControllerGetMeta()
  return (meta.data?.countries ?? []).map((c) => ({
    value: c.code,
    label: `${c.name} (${c.code})`,
    prefix: <CountryFlag code={c.code} />,
  }))
}
