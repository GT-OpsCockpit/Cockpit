/** The billing period the Invoicing Customer tab opens on — see invoicingDefaultPeriod(). */
export class InvoicingPeriodEntity {
  /** Paris-local `yyyy-MM-dd`, inclusive. */
  start: string;
  /** Paris-local `yyyy-MM-dd`, inclusive. */
  end: string;
}
