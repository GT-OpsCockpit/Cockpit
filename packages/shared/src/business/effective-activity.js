/**
 * Whether a driver or fleet vehicle counts as available *today* — the legacy's
 * isEffectivelyActive (common.js:3010), which combined the manual active flag
 * with two automatic gates: an unavailability marker covering today, and an
 * Events-scoped record sitting outside its event's date range.
 *
 * Shared because both sides ask it, of the same records, and must agree: the
 * API answers it as Prisma filters when narrowing an assignment picker
 * (common/business/assignability.ts, which has to filter in the query because
 * those lists are paginated), and the Drivers/Vehicles tables ask it per row to
 * grey the row and name the reason. Only the second needs a value-level answer
 * — that is what lives here.
 *
 * Deliberately structural rather than keyed off marker type strings: a single
 * `date` (a day off) or a `startDate`/`endDate` range (everything else), so a
 * new marker type on either the driver or the vehicle side needs no change.
 *
 * Plain JS (not .ts) for the same reason as validation/email.js — see the
 * comment there.
 */

/**
 * Today as YYYY-MM-DD on the reader's own clock — deliberately not the UTC
 * date, so "today" is the operator's day, exactly as the legacy read it.
 */
export function todayDateStr(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The YYYY-MM-DD part of a stored date. These columns are dates, but cross the
 * wire as full ISO timestamps, so the day is all that may be compared.
 */
function dayOf(value) {
  if (!value) return null;
  return typeof value === 'string'
    ? value.slice(0, 10)
    : todayDateStr(new Date(value));
}

/** True unless an unavailability marker covers today. No marker passes trivially. */
export function isWithinAvailabilityWindow(
  unavailability,
  today = todayDateStr(),
) {
  if (!unavailability) return true;
  const day = dayOf(unavailability.date);
  if (day) return today !== day;
  const start = dayOf(unavailability.startDate);
  const end = dayOf(unavailability.endDate);
  if (start && end) return !(today >= start && today <= end);
  return true;
}

/**
 * True unless the record is Events-scoped and today falls outside its linked
 * event — it is resting before the event starts, or done once it has ended. An
 * event with no dates on file is not evidence that it is over.
 */
export function isWithinEventWindow(record, event, today = todayDateStr()) {
  if (!record?.eventsOnly) return true;
  const start = dayOf(event?.eventStartDate);
  const end = dayOf(event?.eventEndDate);
  if (!start || !end) return true;
  return today >= start && today <= end;
}

/**
 * Whether the record is available today, and if not, which of the three
 * reasons to show. One badge, in the legacy's own precedence: a manual
 * deactivation is stated ahead of any automatic gate, and a marker in effect
 * ahead of the event window (inactivityBadge, common.js:3486-3493).
 */
export function effectiveActivity(record, event, today = todayDateStr()) {
  if (record.active === false) return { active: false, reason: 'DEACTIVATED' };
  if (!isWithinAvailabilityWindow(record.unavailability, today)) {
    return { active: false, reason: 'UNAVAILABLE' };
  }
  if (!isWithinEventWindow(record, event, today)) {
    return { active: false, reason: 'OUTSIDE_EVENT' };
  }
  return { active: true, reason: null };
}
