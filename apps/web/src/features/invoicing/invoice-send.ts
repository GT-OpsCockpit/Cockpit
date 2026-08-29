import type { InvoiceEntity } from '@cockpit/shared/api'
import { clientDisplayName } from '@cockpit/shared'
import { round2 } from './invoice-calc'

/**
 * Opens a mailto: draft to the client's email — no real email is sent by
 * the app itself, same as the legacy's sendInvoice (invoicing.html:598-610).
 */
export function buildInvoiceMailto(invoice: InvoiceEntity): string {
  const to = invoice.client.email || invoice.client.pocEmail || ''
  const subject = encodeURIComponent(`Invoice ${invoice.ref}`)
  const totalHT = Number(invoice.totalHT)
  const totalTTC = Number(invoice.totalTTC)
  const vat = round2(totalTTC - totalHT)
  const period = `${invoice.periodStart?.slice(0, 10) ?? '…'} to ${invoice.periodEnd?.slice(0, 10) ?? '…'}`
  const body = encodeURIComponent(
    `Please find attached invoice ${invoice.ref} for ${clientDisplayName(invoice.client)}, period ${period}.\n\n` +
      `Total Net: ${totalHT.toFixed(2)} €\nVAT: ${vat.toFixed(2)} €\nTotal Gross: ${totalTTC.toFixed(2)} €`,
  )
  return `mailto:${to}?subject=${subject}&body=${body}`
}
