/**
 * The company-info singleton row. Before the first save, GET returns a
 * degenerate `{ id: 1, saved: false }` value — a structurally valid (if
 * sparse) instance of this same shape, since every other field is already
 * nullable/optional on the Prisma model.
 */
export class CompanyInfoEntity {
  id: number;
  name?: string | null;
  legalName?: string | null;
  street1?: string | null;
  zipCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  vatNbr?: string | null;
  email?: string | null;
  website?: string | null;
  ownerSurname?: string | null;
  ownerName?: string | null;
  mobile?: string | null;
  ownerEmail?: string | null;
  saved: boolean;
}
