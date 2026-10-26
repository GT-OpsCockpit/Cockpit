import { describe, expect, it, vi } from 'vitest'
import { saveContactsInOrder } from './save-contacts'

const contacts = [
  { name: 'Alice', phone: '+33612345678', email: 'alice@example.com' },
  { name: 'Bob', phone: '', email: '' },
  { name: 'Carla', phone: '', email: 'carla@example.com' },
]

describe('saveContactsInOrder', () => {
  it('saves them one at a time, in the listed order, leaving out what is empty', async () => {
    const order: string[] = []
    let running = 0
    const add = vi.fn(async (data: { name: string }) => {
      running += 1
      expect(running).toBe(1)
      await Promise.resolve()
      order.push(data.name)
      running -= 1
    })

    expect(await saveContactsInOrder(contacts, add)).toBe(0)
    expect(order).toEqual(['Alice', 'Bob', 'Carla'])
    expect(add).toHaveBeenNthCalledWith(2, { name: 'Bob', phone: undefined, email: undefined })
  })

  it('carries on past a failure and reports how many failed', async () => {
    const add = vi.fn(async (data: { name: string }) => {
      if (data.name === 'Bob') throw new Error('nope')
    })

    expect(await saveContactsInOrder(contacts, add)).toBe(1)
    expect(add).toHaveBeenCalledTimes(3)
  })
})
