import { useMetaControllerGetMeta } from '@cockpit/shared/api'
import { CountryFlag } from '@/components/country-flag'

/**
 * A country code as a reader sees it: flag + name. Tables and read-only cards
 * used to print the bare code, which is unreadable for anything past the dozen
 * codes a dispatcher has memorised — and outright cryptic for the catalogue's
 * split entries ('US-NY', 'RU-SVE').
 *
 * Just one representation is shown, not both: the catalogue's name already
 * carries the split entries' region ("United States (New York)"), so a
 * separate "US-NY" code chip next to it was saying the same thing twice —
 * and, on a narrow column, wrapped ugly mid-word on top of that. If the code
 * matches the catalogue (picked from a list), its name is what's shown; if
 * it doesn't (free text, or a code no longer in the catalogue), the raw text
 * is shown as typed, unadorned.
 */
const SHORT_COUNTRY_NAMES: Record<string, string> = {
  'United States': 'US',
  'United Kingdom': 'UK',
  'United Arab Emirates': 'UAE',
  'Democratic Republic of the Congo': 'DR Congo',
  'Central African Republic': 'CAR',
  'Dominican Republic': 'Dominican Rep.',
}

export function CountryLabel({ code }: { code: string | null | undefined }) {
  const meta = useMetaControllerGetMeta()
  if (!code) return <>—</>
  const fullName = meta.data?.countries.find((c) => c.code === code)?.name
  const name = fullName ? (SHORT_COUNTRY_NAMES[fullName] ?? fullName) : fullName
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <CountryFlag code={code} />
      <span>{name ?? code}</span>
    </span>
  )
}
