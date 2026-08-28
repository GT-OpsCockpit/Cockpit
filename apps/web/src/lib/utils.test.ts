import { describe, expect, it } from 'vitest'
import { filtersChanged } from './utils'

describe('filtersChanged', () => {
  it('is false when the filters equal their defaults', () => {
    expect(filtersChanged({ search: '', showInactive: false }, { search: '', showInactive: false })).toBe(false)
  })

  it('is true when any field differs from the defaults', () => {
    expect(filtersChanged({ search: 'jane', showInactive: false }, { search: '', showInactive: false })).toBe(true)
  })

  it('is true when a boolean field differs from the defaults', () => {
    expect(filtersChanged({ search: '', showInactive: true }, { search: '', showInactive: false })).toBe(true)
  })
})
