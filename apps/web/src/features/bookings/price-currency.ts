/**
 * Typing a price in a foreign currency: the booking stores euros, so the amount
 * typed is converted at today's rate (euros per one unit of the currency, as
 * the FX endpoint returns it) and shown back as its euro equivalent.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

/** Euros for an amount typed in a foreign currency. */
export function eurFromForeign(amount: number, eurPerUnit: number): number {
  return round2(amount * eurPerUnit)
}

/** The amount in a foreign currency that a euro price corresponds to. */
export function foreignFromEur(eur: number, eurPerUnit: number): number {
  return round2(eur / eurPerUnit)
}

/** The currencies a price may be typed in: always the euro, and the one of the country the service runs in when it is not the euro. */
export function entryCurrencies(foreignCurrency?: string): string[] {
  return foreignCurrency && foreignCurrency !== 'EUR' ? ['EUR', foreignCurrency] : ['EUR']
}
