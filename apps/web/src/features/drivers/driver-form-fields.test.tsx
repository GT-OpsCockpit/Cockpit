import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { Form } from '@/components/ui/form'

const useClients = vi.fn(() => ({ data: { data: [] }, isFetching: false }))
vi.mock('@cockpit/shared/api', () => ({
  ClientsControllerListType: { EVENT: 'EVENT' },
  useClientsControllerList: (...args: unknown[]) => useClients(...(args as [])) as unknown,
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

afterEach(() => {
  cleanup()
  useClients.mockClear()
})

function Harness({
  onValues,
  defaults,
  onForm,
}: {
  onValues: (values: DriverFormValues) => void
  defaults?: Partial<DriverFormValues>
  /** Hands the caller the form instance, to drive validation state directly. */
  onForm?: (form: UseFormReturn<DriverFormValues>) => void
}) {
  const form = useForm<DriverFormValues>({
    defaultValues: { countryCode: 'FR', area: 'Nice', eventsOnly: false, ...defaults },
  })
  onValues(form.watch())
  onForm?.(form)
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
  // openEventLinkModal (common.js:3034) read Country/Area off the record and
  // showed them greyed out — they were never a second, independent choice, and
  // the Events offered were filtered down to that exact location.
  describe('linking to an Event', () => {
    it("mirrors the driver's own location onto the Event link, read-only", () => {
      let latest: DriverFormValues | undefined
      render(
        <Harness
          onValues={(values) => (latest = values)}
          defaults={{ eventsOnly: true, eventCountry: 'MC', eventArea: 'Monaco', eventRef: 'C-MC-1' }}
        />,
      )

      expect(latest?.eventCountry).toBe('FR')
      expect(latest?.eventArea).toBe('Nice')
      // The link was to an event held elsewhere — it cannot survive the move.
      expect(latest?.eventRef).toBe('')
      expect(screen.getByLabelText('Event country')).toHaveAttribute('readonly')
      expect(screen.getByLabelText('Event area')).toHaveAttribute('readonly')
    })

    it('asks the API for the Events happening there, and only those', () => {
      render(<Harness onValues={vi.fn()} defaults={{ eventsOnly: true }} />)

      expect(useClients).toHaveBeenCalledWith(
        expect.objectContaining({ eventCountry: 'FR', eventArea: 'Nice', eventNotEnded: true }),
        expect.objectContaining({ query: { enabled: true } }),
      )
    })

    it('asks for nothing while the driver has no location of its own', () => {
      render(<Harness onValues={vi.fn()} defaults={{ eventsOnly: true, countryCode: '', area: '' }} />)

      expect(useClients).toHaveBeenLastCalledWith(
        expect.objectContaining({ eventCountry: undefined, eventArea: undefined }),
        expect.objectContaining({ query: { enabled: false } }),
      )
    })
  })

  // Only a partner is ever emailed — the sub-contracting drafts go to their
  // address, an in-house chauffeur is reached on WhatsApp. The legacy disabled
  // and cleared the field for one (drivers.html:385-387).
  it('locks the Email field for an in-house driver, and opens it once a Company is named', () => {
    render(<Harness onValues={() => {}} defaults={{ company: '' }} />)
    expect(screen.getByLabelText('Email')).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Riviera Cars' } })
    expect(screen.getByLabelText('Email')).toBeEnabled()
  })

  it('clears an address left over from when the driver was a partner', () => {
    let latest: DriverFormValues | undefined
    render(
      <Harness
        onValues={(values) => (latest = values)}
        defaults={{ company: 'Riviera Cars', email: 'paul@riviera.test' }}
      />,
    )

    fireEvent.change(screen.getByLabelText('Company'), { target: { value: '  ' } })
    expect(latest?.email).toBe('')
  })

})

// Country is required of every kind of driver (record-requirements.js), but
// its FormItem carried no <FormMessage/>: the schema rejected the submission
// and the form said nothing, leaving the Create button looking broken.
describe('DriverFormFields — Country', () => {
  it('shows the validation message under the Country field', async () => {
    let form: UseFormReturn<DriverFormValues> | undefined
    render(<Harness onValues={() => {}} onForm={(f) => (form = f)} defaults={{ countryCode: '' }} />)

    await act(async () => {
      form!.setError('countryCode', { message: 'Country is required.' })
    })

    expect(screen.getByText('Country is required.')).toBeInTheDocument()
  })
})

// Ticking "Events-only" put "Email is required for an Events driver" under a
// field the operator could not type in: Email only enabled itself once a
// Company was filled (drivers.html:385). The message was right — the rule does
// demand an email — so it is the field that had to give.
describe('DriverFormFields — the Events driver\'s email', () => {
  const emailField = () => screen.getByLabelText('Email')

  it('stays disabled for an in-house chauffeur, who is reached on WhatsApp', () => {
    render(<Harness onValues={() => {}} defaults={{ company: '', eventsOnly: false }} />)
    expect(emailField()).toBeDisabled()
  })

  it('enables itself as soon as Events-only is ticked, Company or not', () => {
    render(<Harness onValues={() => {}} defaults={{ company: '', eventsOnly: true }} />)
    expect(emailField()).toBeEnabled()
  })

  // Clearing the Company wipes the email, so that an address left over from
  // when the record was a partner cannot be saved behind a greyed-out field.
  // For an Events driver the field is not greyed out and the address is
  // required, so wiping it would destroy what was just typed.
  it('keeps an Events driver\'s email when the Company is cleared', () => {
    let latest: DriverFormValues | undefined
    render(
      <Harness
        onValues={(values) => (latest = values)}
        defaults={{ company: 'Acme', email: 'a@b.test', eventsOnly: true }}
      />,
    )

    fireEvent.change(screen.getByLabelText('Company'), { target: { value: '' } })

    expect(latest?.email).toBe('a@b.test')
  })

  it("still clears a partner's email when the Company is cleared", () => {
    let latest: DriverFormValues | undefined
    render(
      <Harness
        onValues={(values) => (latest = values)}
        defaults={{ company: 'Acme', email: 'a@b.test', eventsOnly: false }}
      />,
    )

    fireEvent.change(screen.getByLabelText('Company'), { target: { value: '' } })

    expect(latest?.email).toBe('')
  })
})
