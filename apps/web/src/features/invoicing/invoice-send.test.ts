import { describe, expect, it } from 'vitest'
import { baseClient } from '../bookings/test-fixtures'
import { baseInvoice } from './test-fixtures'
import { buildInvoiceMailto } from './invoice-send'

describe('buildInvoiceMailto', () => {
  it('prefers the client email over pocEmail, and includes subject + totals in the body', () => {
    const invoice = baseInvoice({
      ref: 'INV1',
      client: baseClient({ company: 'Acme Corp', email: 'billing@acme.com', pocEmail: 'poc@acme.com' }),
      totalHT: '100',
      totalTTC: '110',
    })
    const url = buildInvoiceMailto(invoice)
    expect(url).toMatch(/^mailto:billing@acme\.com\?subject=Invoice%20INV1&body=/)
    const body = decodeURIComponent(url.split('body=')[1])
    expect(body).toContain('Total Net: 100.00 €')
    expect(body).toContain('VAT: 10.00 €')
    expect(body).toContain('Total Gross: 110.00 €')
  })

  it('falls back to pocEmail when email is unset', () => {
    const invoice = baseInvoice({ client: baseClient({ email: null, pocEmail: 'poc@acme.com' }) })
    expect(buildInvoiceMailto(invoice)).toMatch(/^mailto:poc@acme\.com\?/)
  })
})
