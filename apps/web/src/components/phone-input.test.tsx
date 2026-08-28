import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PhoneInput } from './phone-input'

afterEach(cleanup)

// Same <label for> + id pairing that <FormLabel>/<FormControl> produce around
// this field in the forms, so a regression in prop forwarding shows up here as
// getByLabelText no longer finding the input.
function LabelledPhoneInput({
  value,
  onChange,
  countryCode,
}: {
  value: string
  onChange: (value: string) => void
  countryCode?: string
}) {
  return (
    <div>
      <label htmlFor="phone-field">Mobile</label>
      <PhoneInput id="phone-field" value={value} onChange={onChange} countryCode={countryCode} />
    </div>
  )
}

function ControlledPhoneInput({ countryCode }: { countryCode?: string }) {
  const [value, setValue] = useState('')
  return (
    <div>
      <label htmlFor="phone-field">Mobile</label>
      <PhoneInput id="phone-field" value={value} onChange={setValue} countryCode={countryCode} />
      <output data-testid="value">{value}</output>
    </div>
  )
}

describe('PhoneInput', () => {
  it('is reachable via its associated label', () => {
    render(<LabelledPhoneInput value="" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Mobile')).toBeInTheDocument()
  })

  it('shows the calling code of the record country before anything is typed', () => {
    render(<LabelledPhoneInput value="" onChange={vi.fn()} countryCode="GB" />)
    expect(screen.getByLabelText('Country calling code')).toHaveTextContent('+44')
  })

  it('reduces a catalogue pseudo-code to its ISO country', () => {
    // 'US-NY' is not alpha-2 — libphonenumber would reject it outright.
    render(<LabelledPhoneInput value="" onChange={vi.fn()} countryCode="US-NY" />)
    expect(screen.getByLabelText('Country calling code')).toHaveTextContent('+1')
  })

  it('falls back to France when the record has no country', () => {
    render(<LabelledPhoneInput value="" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Country calling code')).toHaveTextContent('+33')
  })

  it('reads a national number under the record country and emits E.164', () => {
    render(<ControlledPhoneInput countryCode="FR" />)
    fireEvent.change(screen.getByLabelText('Mobile'), { target: { value: '06 12 34 56 78' } })
    expect(screen.getByTestId('value')).toHaveTextContent('+33612345678')
  })

  it('reads a pasted international number under its own country, not the record one', () => {
    render(<ControlledPhoneInput countryCode="FR" />)
    fireEvent.change(screen.getByLabelText('Mobile'), { target: { value: '+447911123456' } })
    expect(screen.getByTestId('value')).toHaveTextContent('+447911123456')
    expect(screen.getByLabelText('Country calling code')).toHaveTextContent('+44')
  })

  it('starts empty rather than pre-filled with a calling-code scaffold', () => {
    // An optional field left untouched must submit as empty, and a "+33"
    // sitting in the box is both a value and a duplicate of the selector.
    const onChange = vi.fn()
    render(<LabelledPhoneInput value="" onChange={onChange} countryCode="FR" />)
    expect(screen.getByLabelText('Mobile')).toHaveValue('')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('reads an existing E.164 value back with its own country, not the record’s', () => {
    // A UK POC on a French booking: the number decides the flag, not the trip.
    render(<LabelledPhoneInput value="+442071234000" onChange={vi.fn()} countryCode="FR" />)
    expect(screen.getByLabelText('Country calling code')).toHaveTextContent('+44')
  })

  it('reports an emptied field as an empty string, never undefined', () => {
    // The form schemas keep every field a controlled string; undefined would
    // flip the input to uncontrolled mid-edit.
    const onChange = vi.fn()
    render(<LabelledPhoneInput value="+33612345678" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Mobile'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('switches the calling code from the country list', () => {
    render(<ControlledPhoneInput countryCode="FR" />)
    fireEvent.click(screen.getByLabelText('Country calling code'))
    fireEvent.change(screen.getByPlaceholderText('Search country…'), { target: { value: '+44' } })
    fireEvent.click(screen.getByRole('option', { name: /United Kingdom/ }))
    expect(screen.getByLabelText('Country calling code')).toHaveTextContent('+44')
  })
})
