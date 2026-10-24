import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { ClientEntityBilling, ClientEntityClientType } from '@cockpit/shared/api'
import { Form } from '@/components/ui/form'

vi.mock('@cockpit/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cockpit/shared/api')>()),
  useMetaControllerGetMeta: () => ({
    data: { countries: [{ name: 'France', code: 'FR', tz: 'Europe/Paris', currency: 'EUR' }] },
  }),
  useMetaControllerGetAreaSuggestions: () => ({ data: { countryCode: 'FR', cities: ['Nice'], localAllowed: true } }),
}))

const { ClientFormFields } = await import('./client-form-fields')
import type { ClientFormValues } from './client-form-schema'

afterEach(cleanup)

function Harness({ defaults }: { defaults?: Partial<ClientFormValues> }) {
  const form = useForm<ClientFormValues>({
    defaultValues: {
      clientType: ClientEntityClientType.INDIVIDUAL,
      contactFirstName: '',
      contactLastName: '',
      billing: ClientEntityBilling.ACCOUNT,
      ...defaults,
    } as ClientFormValues,
  })
  return (
    <Form {...form}>
      <ClientFormFields form={form} />
    </Form>
  )
}

// The single legacy POC field was retired from this form: points of contact
// live in the per-client contact list (ClientContactsSection), the only thing a
// booking's POC picker reads.
describe('ClientFormFields — no legacy POC fields', () => {
  it('has no POC Name / Phone / Email inputs on the client form', () => {
    render(<Harness />)

    expect(screen.queryByLabelText('POC Name')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('POC Phone')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('POC Email')).not.toBeInTheDocument()
  })
})
