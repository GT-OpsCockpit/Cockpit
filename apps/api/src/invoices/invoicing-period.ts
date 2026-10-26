import { DateTime } from 'luxon';

const PARIS_ZONE = 'Europe/Paris';

/**
 * The billing period the Customer tab opens on.
 *
 * Date out is the end of the CURRENT month, so a trip can be invoiced as soon
 * as it is finished (the legacy stopped at the end of the previous month,
 * invoicing.html:221-233, which left the running month out of view). Date in is
 * the 1st of the previous month, UNLESS an even older booking is still unbilled, in which case it
 * pulls back to the 1st of THAT booking's month, so a backlog from further back
 * never silently falls outside the default view. Adapted from the legacy's
 * computeCustomerDefaultPeriod.
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
  const currentMonthEnd = paris.endOf('month');

  let start = previousMonthStart;
  if (oldestUnbilledPickup) {
    const backlogMonthStart = DateTime.fromJSDate(oldestUnbilledPickup)
      .setZone(PARIS_ZONE)
      .startOf('month');
    if (backlogMonthStart < previousMonthStart) start = backlogMonthStart;
  }
  return { start: start.toISODate()!, end: currentMonthEnd.toISODate()! };
}
