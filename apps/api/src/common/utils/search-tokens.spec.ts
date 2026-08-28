import { searchTokensFilter } from './search-tokens';

const FIELDS = ['ref', 'contactFirstName', 'contactLastName'] as const;

describe('searchTokensFilter', () => {
  it('returns undefined for a blank search, so the caller adds no filter at all', () => {
    expect(searchTokensFilter(undefined, FIELDS)).toBeUndefined();
    expect(searchTokensFilter(null, FIELDS)).toBeUndefined();
    expect(searchTokensFilter('', FIELDS)).toBeUndefined();
    expect(searchTokensFilter('   ', FIELDS)).toBeUndefined();
  });

  it('searches a single token across every field — unchanged from the previous behaviour', () => {
    expect(searchTokensFilter('Dubois', FIELDS)).toEqual({
      AND: [
        {
          OR: [
            { ref: { contains: 'Dubois', mode: 'insensitive' } },
            { contactFirstName: { contains: 'Dubois', mode: 'insensitive' } },
            { contactLastName: { contains: 'Dubois', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });

  it('requires every token to match some field, which is what lets a full name span two columns', () => {
    const filter = searchTokensFilter('Marc Dubois', FIELDS);

    expect(filter?.AND).toHaveLength(2);
    expect(filter?.AND[0].OR).toContainEqual({
      contactFirstName: { contains: 'Marc', mode: 'insensitive' },
    });
    expect(filter?.AND[1].OR).toContainEqual({
      contactLastName: { contains: 'Dubois', mode: 'insensitive' },
    });
  });

  it('is order-insensitive — "Dubois Marc" builds the same two token groups', () => {
    const straight = searchTokensFilter('Marc Dubois', FIELDS);
    const reversed = searchTokensFilter('Dubois Marc', FIELDS);

    expect(reversed?.AND).toEqual([straight!.AND[1], straight!.AND[0]]);
  });

  it('collapses runs of whitespace and ignores leading/trailing spaces', () => {
    expect(searchTokensFilter('  Marc   Dubois  ', FIELDS)).toEqual(
      searchTokensFilter('Marc Dubois', FIELDS),
    );
  });
});
