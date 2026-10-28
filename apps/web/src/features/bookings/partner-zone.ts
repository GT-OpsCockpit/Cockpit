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

/**
 * Monaco has no partner network of its own: the French partners of the Riviera
 * serve it. It also is the country a drop-off inherits when a saved route is
 * reversed (the route fills addresses, not countries), so a Monaco → Nice
 * transfer can carry Monaco at both ends. For matching a partner, Monaco
 * counts as France.
 */
function servedCountry(code: string): string {
  return code === 'MC' ? 'FR' : code
}

function partnerServesEnd(partner: { countryCode?: string | null; area?: string | null }, end: BookingEnd): boolean {
  if (!end.countryCode || !partner.countryCode || servedCountry(partner.countryCode) !== servedCountry(end.countryCode)) return false
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

/**
 * Whether a partner's driver can take a job asking for this vehicle category. A
 * partner with a single car reserved to them (`fleetReserved`) offers only that
 * car's category — a Van booking is not offered to the owner of an E-Business
 * sedan. A driver with no reserved car brings whatever their company has, so
 * nothing rules them out; nor does a booking with no category chosen yet.
 */
export function partnerCarFits(
  driver: { fleetReserved?: { categoryId: string } | null },
  vehicleTypeId: string | undefined,
): boolean {
  if (!vehicleTypeId || !driver.fleetReserved) return true
  return driver.fleetReserved.categoryId === vehicleTypeId
}
