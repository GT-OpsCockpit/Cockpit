import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
      pocName: '',
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

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

// The server already falls back to the contact's name when POC Name is left
// empty, so this is pure typing comfort — but it is the difference between
// seeing what will be saved and guessing at it (pocNameAutoSynced,
// clients.html:488-498).
describe('ClientFormFields — POC Full Name auto-sync', () => {
  it('fills POC Name from the contact first and last name', () => {
    render(<Harness />)

    type('First name', 'Marc')
    type('Last name', 'Dubois')

    expect(screen.getByLabelText('POC Name')).toHaveValue('Marc Dubois')
  })

  it('stops syncing for good once POC Name is edited by hand', () => {
    render(<Harness />)

    type('First name', 'Marc')
    type('POC Name', 'Claire Bonnet')
    type('Last name', 'Dubois')

    expect(screen.getByLabelText('POC Name')).toHaveValue('Claire Bonnet')
  })

  // The legacy's flag only ever governed its creation form; v2 shares these
  // fields with the edit dialog, where a POC already on file is usually a
  // deliberately different person. Correcting a typo in the contact's name
  // must not silently rewrite them.
  it('leaves a POC Name already on file alone when editing', () => {
    render(<Harness defaults={{ contactFirstName: 'Marc', contactLastName: 'Dubois', pocName: 'Claire Bonnet' }} />)

    type('First name', 'Marco')

    expect(screen.getByLabelText('POC Name')).toHaveValue('Claire Bonnet')
  })

  it('does not sync for a Company account, which has no contact name fields', () => {
    render(<Harness defaults={{ clientType: ClientEntityClientType.COMPANY }} />)

    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
    expect(screen.getByLabelText('POC Name')).toHaveValue('')
  })
})
