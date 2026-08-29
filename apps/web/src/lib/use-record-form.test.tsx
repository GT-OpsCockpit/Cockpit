import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { z } from 'zod'
import { ApiError } from '@cockpit/shared/api'

const invalidateQueries = vi.fn()
const success = vi.fn()
const error = vi.fn()

vi.mock('@/lib/query-client', () => ({ queryClient: { invalidateQueries: (...a: unknown[]) => invalidateQueries(...a) } }))
vi.mock('sonner', () => ({ toast: { success: (m: string) => success(m), error: (m: string) => error(m) } }))

const { useRecordForm } = await import('./use-record-form')

afterEach(() => {
  cleanup()
  invalidateQueries.mockReset()
  success.mockReset()
  error.mockReset()
})

const schema = z.object({ name: z.string().min(1, 'Name is required.') })
type Values = z.infer<typeof schema>

function Harness({
  submit,
  close,
  onSuccess,
  disabled,
}: {
  submit: (values: Values) => Promise<{ ref: string }>
  close?: () => void
  onSuccess?: (result: { ref: string }, values: Values) => void | Promise<void>
  disabled?: boolean
}) {
  const record = useRecordForm<Values, { ref: string }>({
    schema,
    defaultValues: { name: 'Acme' },
    submit,
    success: (result) => `Record ${result.ref} created.`,
    error: 'Error creating record.',
    invalidate: [['records'], ['trips']],
    close: close ?? (() => {}),
    onSuccess,
    disabled,
  })
  return (
    <form onSubmit={record.onSubmit}>
      <input aria-label="Name" {...record.form.register('name')} />
      <p>{record.form.formState.errors.name?.message}</p>
      <button type="submit">Save</button>
    </form>
  )
}

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }))

describe('useRecordForm', () => {
  it('announces the write, closes, then refreshes every list it was given', async () => {
    const order: string[] = []
    const submit = vi.fn(async () => {
      order.push('submit')
      return { ref: 'R1' }
    })
    const close = vi.fn(() => void order.push('close'))
    invalidateQueries.mockImplementation(() => order.push('invalidate'))

    render(<Harness submit={submit} close={close} />)
    save()

    await waitFor(() => expect(close).toHaveBeenCalled())
    expect(submit).toHaveBeenCalledWith({ name: 'Acme' })
    expect(success).toHaveBeenCalledWith('Record R1 created.')
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['records'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trips'] })
    // The list must not refresh before the dialog is out of the way, or the
    // row behind it re-renders under the user's cursor.
    expect(order).toEqual(['submit', 'close', 'invalidate', 'invalidate'])
  })

  it('runs the chained flow before closing, so a draft opens while the dialog is still up', async () => {
    const order: string[] = []
    const submit = vi.fn(async () => ({ ref: 'R1' }))
    const onSuccess = vi.fn(async () => void order.push('onSuccess'))
    const close = vi.fn(() => void order.push('close'))

    render(<Harness submit={submit} close={close} onSuccess={onSuccess} />)
    save()

    await waitFor(() => expect(close).toHaveBeenCalled())
    expect(onSuccess).toHaveBeenCalledWith({ ref: 'R1' }, { name: 'Acme' })
    expect(order).toEqual(['onSuccess', 'close'])
  })

  it('empties a create form once it has created, so reopening it starts blank', async () => {
    render(<Harness submit={vi.fn(async () => ({ ref: 'R1' }))} />)
    const input = screen.getByLabelText('Name')
    fireEvent.change(input, { target: { value: 'Globex' } })
    save()
    await waitFor(() => expect(success).toHaveBeenCalled())
    await waitFor(() => expect(input).toHaveValue('Acme'))
  })

  it("surfaces the API's own message on failure, and leaves the dialog open", async () => {
    const close = vi.fn()
    const submit = vi.fn(async () => {
      throw new ApiError(409, { error: 'A trip with ref. T1 already exists' })
    })

    render(<Harness submit={submit as never} close={close} />)
    save()

    await waitFor(() => expect(error).toHaveBeenCalledWith('A trip with ref. T1 already exists'))
    expect(close).not.toHaveBeenCalled()
    expect(invalidateQueries).not.toHaveBeenCalled()
    expect(success).not.toHaveBeenCalled()
  })

  it('falls back to the caller\'s wording when the failure carries no API message', async () => {
    const submit = vi.fn(async () => {
      throw new Error('Network down')
    })
    render(<Harness submit={submit as never} />)
    save()
    await waitFor(() => expect(error).toHaveBeenCalledWith('Error creating record.'))
  })

  it('never writes while the schema rejects the form', async () => {
    const submit = vi.fn(async () => ({ ref: 'R1' }))
    render(<Harness submit={submit} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } })
    save()
    await waitFor(() => expect(screen.getByText('Name is required.')).toBeInTheDocument())
    expect(submit).not.toHaveBeenCalled()
    expect(success).not.toHaveBeenCalled()
  })

  // The UX-layer mirror of a server-side permission gate. The API enforces it
  // regardless — this only stops the request being made at all.
  it('never writes while disabled, even if the form is valid', async () => {
    const submit = vi.fn(async () => ({ ref: 'R1' }))
    render(<Harness submit={submit} disabled />)
    save()
    await waitFor(() => expect(submit).not.toHaveBeenCalled())
    expect(success).not.toHaveBeenCalled()
  })
})
