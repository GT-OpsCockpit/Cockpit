import { z } from 'zod'

export const priceListFormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  active: z.boolean(),
})

export type PriceListFormValues = z.infer<typeof priceListFormSchema>

export function priceListFormDefaults(): PriceListFormValues {
  return {
    name: '',
    active: true,
  }
}
