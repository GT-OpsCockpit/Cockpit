/**
 * Which partners may be offered for a sub-contracted booking: the ones based in
 * the country AND the zone of the pickup or of the drop-off. A Zurich airport →
 * Zurich city transfer offers only Zurich partners; a Zurich → Nice one offers
 * those of Zurich and those of Nice.
 */

/** One end of the booking: its country, and the text that names where it is (area, address). */
export interface BookingEnd {
  countryCode?: string | null
  text?: string | null
}

/** "Zürich", "ZURICH " and "zurich" are the same place. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function partnerServesEnd(partner: { countryCode?: string | null; area?: string | null }, end: BookingEnd): boolean {
  if (!end.countryCode || partner.countryCode !== end.countryCode) return false
  const area = normalize(partner.area ?? '')
  // No zone on file, or "Local" (a French on-site base, not a named city): the country is all there is to match.
  if (!area || area === 'local') return true
  return normalize(end.text ?? '').includes(area)
}

/**
 * Whether the partner is based at one of the booking's ends. With no end known
 * yet (the form's country is still empty) every partner is offered — the list
 * must not read empty before the dispatcher has said where the job is.
 */
export function partnerServesBooking(
  partner: { countryCode?: string | null; area?: string | null },
  ends: BookingEnd[],
): boolean {
  const known = ends.filter((end) => end.countryCode)
  if (known.length === 0) return true
  return known.some((end) => partnerServesEnd(partner, end))
}
