export interface ClientNameInput {
  ref: string;
  company?: string | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
}

export function clientDisplayName(client: ClientNameInput): string;

export interface DriverNameInput {
  firstName?: string | null;
  lastName?: string | null;
}

export function driverDisplayName(driver: DriverNameInput): string;

export interface DriverLabelInput extends DriverNameInput {
  ref: string;
  company?: string | null;
}

export function driverLabel(driver: DriverLabelInput): string;
export function partnerLabel(driver: DriverLabelInput): string;
