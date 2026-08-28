import { useMetaControllerGetAreaSuggestions } from '@cockpit/shared/api'
import { SearchCombobox } from '@/components/search-combobox'

/**
 * The Area field, constrained by the Country field it is paired with.
 *
 * The rules are the API's (`GET /meta/areas`, see
 * apps/api/src/common/business/area-suggestions.ts): the country's major
 * cities capped by zone, and "Local" offered only in France. They live
 * server-side because `area` drives the Local/Farm-out split and driver
 * eligibility — a wrong value cascades into both.
 *
 * Two properties of the legacy field are deliberately kept (common.js:832
 * initAreaCombo):
 *  - it still accepts free text, so an uncatalogued city can be typed in;
 *  - "Local" stays *visible* everywhere but selectable only in France.
 *
 * Clearing the field when the country changes (common.js:871, resetAreaField)
 * is the Country field's own onChange, not an effect here: only a real user
 * change must wipe the area, and an effect would also fire while an edit
 * dialog is populating its form from the record being edited.
 */
export function AreaField({
  countryCode,
  value,
  onChange,
  disabled,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel,
}: {
  /** The value of the Country field this Area belongs to ('' when none is chosen yet). */
  countryCode: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  'aria-label'?: string
}) {
  const suggestions = useMetaControllerGetAreaSuggestions(
    { countryCode },
    { query: { enabled: countryCode !== '' } },
  )

  const localAllowed = suggestions.data?.localAllowed ?? false
  const options = [
    { value: 'Local', label: 'Local', disabled: !localAllowed },
    ...(suggestions.data?.cities ?? []).map((city) => ({ value: city, label: city })),
  ]

  return (
    <SearchCombobox
      id={id}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      aria-label={ariaLabel}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      allowCustomValue
      placeholder={countryCode ? 'Area…' : 'Choose a country first…'}
      searchPlaceholder="Search or type an area…"
      emptyText={countryCode ? 'No major city on file — type one.' : 'Choose a country first.'}
    />
  )
}
