import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const addContact = vi.fn(async () => ({}))
const invalidateQueries = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/query-client', () => ({ queryClient: { invalidateQueries, setQueryData: vi.fn() } }))
vi.mock('@cockpit/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cockpit/shared/api')>()),
  useClientsControllerListContacts: () => ({ data: [] }),
  useClientsControllerAddContact: () => ({ mutateAsync: addContact }),
  useClientsControllerUpdateContact: () => ({ mutateAsync: vi.fn() }),
  useClientsControllerDeleteContact: () => ({ mutateAsync: vi.fn() }),
  useClientsControllerReorderContacts: () => ({ mutateAsync: vi.fn() }),
}))

const { ClientContactsSection } = await import('./client-contacts-section')
const { getClientsControllerListContactsQueryKey } = await import('@cockpit/shared/api')

afterEach(cleanup)

describe('ClientContactsSection', () => {
  // The list showed nothing after "Contact added": the refresh used a
  // hand-written key that wasn't the one the list is read under.
  it('refreshes the list under the key it is read with once a contact is added', async () => {
    render(<ClientContactsSection clientRef="CC4" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add a contact' }))
    fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'Carla Petit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(addContact).toHaveBeenCalledWith({
        ref: 'CC4',
        data: { name: 'Carla Petit', phone: undefined, email: undefined },
      }),
    )
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getClientsControllerListContactsQueryKey('CC4') }),
    )
  })
})
