import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ClientContactsList, type ListedContact } from './client-contacts-list'

afterEach(cleanup)

const contacts: ListedContact[] = [
  { id: 'c1', name: 'Alice Martin', phone: '', email: 'alice@example.com' },
  { id: 'c2', name: 'Bob Durand', phone: '', email: '' },
]

function setup(overrides: Partial<React.ComponentProps<typeof ClientContactsList>> = {}) {
  const props = {
    contacts,
    onSave: vi.fn(async () => true),
    onRemove: vi.fn(async () => true),
    onReorder: vi.fn(async () => undefined),
    ...overrides,
  }
  render(<ClientContactsList {...props} />)
  return props
}

describe('ClientContactsList', () => {
  it('lists each contact in order, with a dash for what is missing', () => {
    setup()
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('1')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Alice Martin')).toBeInTheDocument()
    expect(within(rows[0]).getByText('alice@example.com')).toBeInTheDocument()
    expect(within(rows[1]).getByText('2')).toBeInTheDocument()
    expect(within(rows[1]).getAllByText('—')).toHaveLength(2)
  })

  it('opens the contact in a popup from the pencil, and saves the change', async () => {
    const { onSave } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Alice Martin' }))

    expect(screen.getByRole('heading', { name: 'Edit contact' })).toBeInTheDocument()
    const name = screen.getByPlaceholderText('Full name')
    expect(name).toHaveValue('Alice Martin')
    fireEvent.change(name, { target: { value: 'Alice Martin-Dupont' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith('c1', {
        name: 'Alice Martin-Dupont',
        phone: '',
        email: 'alice@example.com',
      }),
    )
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit contact' })).not.toBeInTheDocument())
  })

  it('keeps the popup open, with what was typed, when the save fails', async () => {
    const { onSave } = setup({ onSave: vi.fn(async () => false) })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Bob Durand' }))
    fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'Robert Durand' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(screen.getByRole('heading', { name: 'Edit contact' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Full name')).toHaveValue('Robert Durand')
  })

  it('refuses a contact without a name, or with a malformed email', () => {
    const { onSave } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Add a contact' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('Name is required.')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'Carla' } })
    const email = screen.getAllByRole('textbox').find((input) => input.getAttribute('type') === 'email')!
    fireEvent.change(email, { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('adds a contact from an empty popup', async () => {
    const { onSave } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Add a contact' }))
    expect(screen.getByRole('heading', { name: 'Add a contact' })).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'Carla Petit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null, { name: 'Carla Petit', phone: '', email: '' }))
  })

  it('asks before removing, and removes only once confirmed', async () => {
    const { onRemove } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Alice Martin' }))

    expect(screen.getByText('Remove this contact?')).toBeInTheDocument()
    expect(onRemove).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith('c1'))
  })

  it('removes nothing when the confirmation is cancelled', () => {
    const { onRemove } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Alice Martin' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onRemove).not.toHaveBeenCalled()
  })

  // The popup opens from inside the New account form: its submit must not
  // reach that form and create the account half-typed.
  it('does not submit a form it is placed inside', async () => {
    const outerSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    const onSave = vi.fn(async () => true)
    render(
      <form onSubmit={outerSubmit}>
        <ClientContactsList contacts={[]} onSave={onSave} onRemove={vi.fn()} onReorder={vi.fn()} />
      </form>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add a contact' }))
    fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'Carla' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(outerSubmit).not.toHaveBeenCalled()
  })
})
