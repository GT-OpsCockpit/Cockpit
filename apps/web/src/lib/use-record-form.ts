import { useForm, type DefaultValues, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { QueryKey } from '@tanstack/react-query'
import type { ZodType } from 'zod'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'

/**
 * The write path every record dialog in the app shares: validate, call the
 * mutation, announce it, close, refresh the list — and on failure, surface the
 * API's own message instead of the exception.
 *
 * Callers own what makes their record a record (schema, mapping, mutation,
 * wording) and the fields they render. Everything above is decided here, so a
 * change to the error wording, the toast, or when the cache is invalidated is
 * one edit rather than ten.
 *
 * Same division as ConfirmActionDialog, one layer down: that one owns the
 * dialog, this one owns the submit.
 */
export interface RecordFormOptions<TValues extends FieldValues, TResult> {
  schema: ZodType<TValues, TValues>
  /** Creating: the blank form, re-applied on every close. Editing: pass `values` instead. */
  defaultValues?: DefaultValues<TValues>
  /**
   * Editing: re-seeds the form whenever the record behind it changes
   * (react-hook-form's `values`, not `defaultValues` — the dialog stays mounted
   * between rows).
   */
  values?: TValues
  submit: (values: TValues) => Promise<TResult>
  /** The success toast. Gets the mutation's result, so it can name the new ref. */
  success: (result: TResult, values: TValues) => string
  /** Prefix for the failure toast — the API's own message is appended when it has one. */
  error: string
  /** The list query keys the write invalidates — always a list, even for one. */
  invalidate: QueryKey[]
  /**
   * Closes the dialog. Called after `onSuccess`, before invalidation. A create
   * form (one given `defaultValues`) empties itself straight after, so
   * reopening it starts blank.
   */
  close: () => void
  /**
   * Where a flow chains something onto a successful write — offering to relink
   * an Event's crew, opening a sub-contract email draft. Awaited, so a draft
   * opens before the dialog goes away.
   */
  onSuccess?: (result: TResult, values: TValues) => void | Promise<void>
  /**
   * Refuses to submit at all. UX-layer mirror of a server-side permission gate
   * — the API enforces it regardless (see docs/agents/permissions.md).
   */
  disabled?: boolean
}

export interface RecordForm<TValues extends FieldValues> {
  form: UseFormReturn<TValues>
  onSubmit: (event?: React.BaseSyntheticEvent) => Promise<void>
  isSubmitting: boolean
  /** Resets the form to its blank state — what a create dialog does on close. */
  reset: () => void
}

export function useRecordForm<TValues extends FieldValues, TResult>({
  schema,
  defaultValues,
  values,
  submit,
  success,
  error,
  invalidate,
  close,
  onSuccess,
  disabled = false,
}: RecordFormOptions<TValues, TResult>): RecordForm<TValues> {
  const form = useForm<TValues>({
    resolver: zodResolver(schema),
    ...(values !== undefined ? { values } : {}),
    ...(defaultValues !== undefined ? { defaultValues } : {}),
  })

  const onSubmit = form.handleSubmit(async (submitted) => {
    if (disabled) return
    try {
      const result = await submit(submitted)
      toast.success(success(result, submitted))
      await onSuccess?.(result, submitted)
      close()
      if (defaultValues !== undefined) form.reset(defaultValues)
      for (const queryKey of invalidate) void queryClient.invalidateQueries({ queryKey })
    } catch (caught) {
      toast.error(getApiErrorMessage(caught, error))
    }
  })

  return {
    form,
    onSubmit,
    isSubmitting: form.formState.isSubmitting,
    reset: () => form.reset(defaultValues),
  }
}
