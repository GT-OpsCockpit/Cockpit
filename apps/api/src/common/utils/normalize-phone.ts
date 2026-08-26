/** Digits-only phone normalization, applied everywhere a phone number is stored (POC, driver, client). */
export function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? '').replace(/[^0-9]/g, '');
}
