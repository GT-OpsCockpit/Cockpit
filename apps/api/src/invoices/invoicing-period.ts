import { DateTime } from 'luxon';

const PARIS_ZONE = 'Europe/Paris';

/**
 * The billing period the Customer tab opens on.
 *
 * Date out is the end of the month BEFORE the current one — invoicing targets
 * completed past months, not the still-running one. Date in is the 1st of that
 * same month, UNLESS an even older booking is still unbilled, in which case it
 * pulls back to the 1st of THAT booking's month, so a backlog from further back
 * never silently falls outside the default view. Ported from the legacy's
 * computeCustomerDefaultPeriod (invoicing.html:221-233).
 *
 * The browser used to work this out by scanning every unbilled trip it had
 * downloaded, which is why the tab asked for the whole history. It only ever
 * needed the oldest one.
 */
export function invoicingDefaultPeriod(
  oldestUnbilledPickup: Date | null,
  now: DateTime,
): { start: string; end: string } {
  const paris = now.setZone(PARIS_ZONE);
  const previousMonthStart = paris.startOf('month').minus({ months: 1 });
  const previousMonthEnd = paris.startOf('month').minus({ days: 1 });

  let start = previousMonthStart;
  if (oldestUnbilledPickup) {
    const backlogMonthStart = DateTime.fromJSDate(oldestUnbilledPickup)
      .setZone(PARIS_ZONE)
      .startOf('month');
    if (backlogMonthStart < previousMonthStart) start = backlogMonthStart;
  }
  return { start: start.toISODate()!, end: previousMonthEnd.toISODate()! };
}
