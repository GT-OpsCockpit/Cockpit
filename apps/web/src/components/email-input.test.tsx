import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EmailInput } from './email-input'

afterEach(cleanup)

function ControlledEmailInput({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <div>
      <label htmlFor="email-field">Email</label>
      <EmailInput id="email-field" value={value} onChange={setValue} />
    </div>
  )
}

describe('EmailInput', () => {
  it('is reachable via its associated label', () => {
    render(<ControlledEmailInput />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
  })

  it('lowercases on blur, not while typing', () => {
    const onChange = vi.fn()
    render(<EmailInput value=" Foo@Bar.COM " onChange={onChange} aria-label="Email" />)
    const input = screen.getByLabelText('Email')

    // Capitals survive the keystroke — lowercasing mid-word fights the typist.
    // (The surrounding whitespace is gone already: an <input type="email">
    // strips it itself, per the HTML spec's value sanitization.)
    fireEvent.change(input, { target: { value: ' Foo@Bar.COMx ' } })
    expect(onChange).toHaveBeenLastCalledWith('Foo@Bar.COMx')

    fireEvent.blur(input)
    expect(onChange).toHaveBeenLastCalledWith('foo@bar.com')
  })

  it('offers a one-click fix for a mistyped common domain', () => {
    render(<ControlledEmailInput initial="romain@gmial.com" />)
    fireEvent.click(screen.getByRole('button', { name: 'romain@gmail.com' }))
    expect(screen.getByLabelText('Email')).toHaveValue('romain@gmail.com')
  })

  it('stays quiet on a correct or unknown domain', () => {
    render(<ControlledEmailInput initial="romain@placeloop.com" />)
    expect(screen.queryByText(/Did you mean/)).not.toBeInTheDocument()
  })

  it('stays quiet while the address is still incomplete', () => {
    render(<ControlledEmailInput initial="romain@gmial" />)
    expect(screen.queryByText(/Did you mean/)).not.toBeInTheDocument()
  })
})
