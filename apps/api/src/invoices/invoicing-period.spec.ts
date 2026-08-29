import { DateTime } from 'luxon';
import { invoicingDefaultPeriod } from './invoicing-period';

// Mid-March 2026, Paris.
const NOW = DateTime.fromISO('2026-03-17T11:00:00', { zone: 'Europe/Paris' });
const at = (iso: string) => new Date(iso);

describe('invoicingDefaultPeriod', () => {
  it('opens on the whole of last month — invoicing bills completed months', () => {
    expect(invoicingDefaultPeriod(null, NOW)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('reaches back to the month of the oldest unbilled booking, so a backlog stays in view', () => {
    expect(invoicingDefaultPeriod(at('2025-11-20T10:00:00Z'), NOW)).toEqual({
      start: '2025-11-01',
      end: '2026-02-28',
    });
  });

  it('stays on last month when the oldest unbilled booking is already inside it', () => {
    expect(invoicingDefaultPeriod(at('2026-02-14T10:00:00Z'), NOW)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('stays on last month when the only unbilled bookings are still ahead', () => {
    expect(invoicingDefaultPeriod(at('2026-06-01T10:00:00Z'), NOW)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  // A pickup just after Paris midnight belongs to the Paris day, not the UTC
  // one — reading it in UTC would put a 1 Jan booking in December.
  it('reads the booking in Paris, not UTC', () => {
    expect(invoicingDefaultPeriod(at('2025-12-31T23:30:00Z'), NOW).start).toBe(
      '2026-01-01',
    );
  });
});
