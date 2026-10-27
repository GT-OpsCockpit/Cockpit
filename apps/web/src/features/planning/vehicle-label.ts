/** Makes the planning writes in short, so a vehicle row stays on one line. */
const SHORT_MAKES: Record<string, string> = {
  'mercedes-benz': 'M-B',
}

/** "Mercedes-Benz" → "M-B"; any other make is left as it is. */
export function shortMake(make: string): string {
  return SHORT_MAKES[make.trim().toLowerCase()] ?? make
}
