import { useMetaControllerGetMeta } from '@cockpit/shared/api'
import { CountryFlag } from '@/components/country-flag'

/**
 * A country code as a reader sees it: flag + name. Tables and read-only cards
 * used to print the bare code, which is unreadable for anything past the dozen
 * codes a dispatcher has memorised — and outright cryptic for the catalogue's
 * split entries ('US-NY', 'RU-SVE').
 *
 * The code stays alongside the name because it is what the rest of the app keys
 * on (driver refs, Area suggestions), so a row still matches what a filter or a
 * ref shows.
 */
export function CountryLabel({ code }: { code: string | null | undefined }) {
  const meta = useMetaControllerGetMeta()
  if (!code) return <>—</>
  const name = meta.data?.countries.find((c) => c.code === code)?.name
  return (
    <span className="inline-flex items-center gap-1.5">
      <CountryFlag code={code} />
      {/* Until /meta resolves — or for a code no longer in the catalogue —
          the raw code is still more useful than an empty cell. */}
      <span>{name ? `${name} (${code})` : code}</span>
    </span>
  )
}
