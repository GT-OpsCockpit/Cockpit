import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { Form } from '@/components/ui/form'

vi.mock('@cockpit/shared/api', () => ({
  ClientsControllerListType: { EVENT: 'EVENT' },
  useClientsControllerList: () => ({ data: { data: [] }, isFetching: false }),
  useMetaControllerGetMeta: () => ({
    data: {
      countries: [
        { name: 'France', code: 'FR', tz: 'Europe/Paris', currency: 'EUR' },
        { name: 'Italy', code: 'IT', tz: 'Europe/Rome', currency: 'EUR' },
      ],
    },
  }),
  useMetaControllerGetAreaSuggestions: () => ({ data: { countryCode: 'FR', cities: ['Nice'], localAllowed: true } }),
}))

const { DriverFormFields } = await import('./driver-form-fields')
import type { DriverFormValues } from './driver-form-schema'

afterEach(cleanup)

function Harness({ onValues }: { onValues: (values: DriverFormValues) => void }) {
  const form = useForm<DriverFormValues>({
    defaultValues: { countryCode: 'FR', area: 'Nice', eventsOnly: false },
  })
  onValues(form.watch())
  return (
    <Form {...form}>
      <DriverFormFields form={form} />
    </Form>
  )
}

describe('DriverFormFields', () => {
  // "Local" is France-only and a city belongs to exactly one country, so an
  // Area kept across a country change is silently wrong — and `area` feeds
  // both the Local/Farm-out split and driver eligibility. The legacy cleared
  // it on every country change (resetAreaField, common.js:871).
  it('clears the Area as soon as the Country changes', () => {
    let latest: DriverFormValues | undefined
    render(<Harness onValues={(values) => (latest = values)} />)

    expect(screen.getByLabelText('Area')).toHaveTextContent('Nice')

    fireEvent.click(screen.getByLabelText('Country'))
    fireEvent.click(screen.getByRole('option', { name: 'Italy (IT)' }))

    expect(latest?.area).toBe('')
  })
})
