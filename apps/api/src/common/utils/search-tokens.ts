/** One `field contains token` clause, in the shape Prisma's `where.OR` expects. */
type ContainsClause<F extends string> = {
  [K in F]?: { contains: string; mode: 'insensitive' };
};

/**
 * Turns a free-text search box into a Prisma filter: every whitespace-separated
 * token must appear in at least one of `fields` (tokens AND-ed, fields OR-ed).
 *
 * Matching the whole string against each column separately — which is what this
 * replaces — could never find anything spanning two columns, and the names
 * users actually type are exactly that: `name` is derived from
 * firstName + lastName (computeClientName / computeDriverName), a vehicle is
 * "make model". So "Marc Dubois", "Julien Petit" and "Mercedes V-Class" all
 * returned nothing, while the search placeholders promise to search by name.
 *
 * Single-token searches (a ref, an email, a reg number) behave exactly as
 * before. Returns undefined for a blank search so callers can skip the filter.
 */
export function searchTokensFilter<F extends string>(
  search: string | null | undefined,
  fields: readonly F[],
): { AND: { OR: ContainsClause<F>[] }[] } | undefined {
  const tokens = (search ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return undefined;

  return {
    AND: tokens.map((token) => ({
      OR: fields.map(
        (field) =>
          ({
            [field]: { contains: token, mode: 'insensitive' },
          }) as ContainsClause<F>,
      ),
    })),
  };
}
