import type { ContactValues } from './client-contacts-list'

/**
 * Saves the contacts typed into the New account form, one after the other so
 * they keep the order they were listed in. A contact that fails doesn't stop
 * the ones after it; returns how many couldn't be saved.
 */
export async function saveContactsInOrder(
  contacts: ContactValues[],
  add: (data: { name: string; phone?: string; email?: string }) => Promise<unknown>,
): Promise<number> {
  let failed = 0
  for (const contact of contacts) {
    try {
      await add({ name: contact.name, phone: contact.phone || undefined, email: contact.email || undefined })
    } catch {
      failed += 1
    }
  }
  return failed
}
