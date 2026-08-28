import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchDraft = vi.fn()
const warn = vi.fn()
vi.mock('@cockpit/shared/api', () => ({
  tripsControllerSubcontractEmail: (...args: unknown[]) => fetchDraft(...(args as [])) as unknown,
}))
vi.mock('sonner', () => ({ toast: { warning: (msg: string) => warn(msg) } }))

const { openSubcontractEmailDraft } = await import('./subcontract-email')

let href = ''
beforeEach(() => {
  href = ''
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      get href() {
        return href
      },
      set href(value: string) {
        href = value
      },
    },
  })
})

afterEach(() => {
  fetchDraft.mockReset()
  warn.mockReset()
})

describe('openSubcontractEmailDraft', () => {
  it('opens a mailto: on the draft the API composed, escaped', async () => {
    fetchDraft.mockResolvedValue({
      to: 'paul@riviera.test',
      subject: 'Booking R-CI1-26-1',
      body: 'Ref: R-CI1-26-1\nInfo: Gate B & C',
    })

    await openSubcontractEmailDraft('R-CI1-26-1', 'assigned')

    expect(fetchDraft).toHaveBeenCalledWith('R-CI1-26-1', {
      kind: 'assigned',
      partnerRef: undefined,
    })
    expect(href).toContain('mailto:paul@riviera.test?subject=Booking%20R-CI1-26-1')
    // The newline and the ampersand must survive as escapes, or the body is
    // truncated at the first & by the mail client.
    expect(href).toContain('%0A')
    expect(href).toContain('%26')
  })

  // The cancellation notice goes to the partner the booking is being taken
  // away from, who is no longer on the trip by then (common.js:2686).
  it('passes an explicit partnerRef through', async () => {
    fetchDraft.mockResolvedValue({ to: 'x@y.test', subject: 's', body: 'b' })

    await openSubcontractEmailDraft('R-1', 'cancelled', 'D-FR-PA-RIV-001')

    expect(fetchDraft).toHaveBeenCalledWith('R-1', {
      kind: 'cancelled',
      partnerRef: 'D-FR-PA-RIV-001',
    })
  })

  it('opens nothing when there is no address on file, and says so', async () => {
    fetchDraft.mockResolvedValue({ to: null, subject: 's', body: 'b' })

    await openSubcontractEmailDraft('R-1', 'assigned')

    expect(href).toBe('')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No email address on file'))
  })

  // The booking is already saved by the time this runs — a draft that can't
  // be prepared must not read as the save having failed.
  it('never throws when the draft cannot be prepared', async () => {
    fetchDraft.mockRejectedValue(new Error('boom'))

    await expect(openSubcontractEmailDraft('R-1', 'assigned')).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not be prepared'))
  })
})
