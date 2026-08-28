export interface MarginInput {
  priceEur?: number | null;
  partnerRateEur?: number | null;
  countryCode?: string | null;
}

export function marginPercent(input: MarginInput): number | null;

export interface AsdTotalInput {
  rate?: number | null;
  hours?: number | null;
  service?: string | null;
}

export function asdTotal(input: AsdTotalInput): number | null;
