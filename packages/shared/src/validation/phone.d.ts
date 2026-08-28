export function isValidPhone(value: string | null | undefined): boolean;
export function toE164(
  value: string | null | undefined,
  defaultCountry?: string | null,
): string | null;
export function formatPhoneDisplay(value: string | null | undefined): string;
export function phoneCountry(value: string | null | undefined): string | null;
