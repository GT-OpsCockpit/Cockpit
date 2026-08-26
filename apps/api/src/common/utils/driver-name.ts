/** Same derivation as the legacy's createDriver()/updateDriver(): first+last, joined and trimmed (possibly empty for a nameless partner company). */
export function computeDriverName(driver: {
  firstName: string | null;
  lastName: string | null;
}): string {
  return [driver.firstName, driver.lastName].filter(Boolean).join(' ').trim();
}
