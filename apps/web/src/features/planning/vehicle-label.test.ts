import { describe, expect, it } from 'vitest'
import { shortMake } from './vehicle-label'

describe('shortMake', () => {
  it('shortens Mercedes-Benz to M-B, whatever its case', () => {
    expect(shortMake('Mercedes-Benz')).toBe('M-B')
    expect(shortMake('mercedes-benz')).toBe('M-B')
  })

  it('leaves the other makes as they are', () => {
    expect(shortMake('Tesla')).toBe('Tesla')
  })
})
