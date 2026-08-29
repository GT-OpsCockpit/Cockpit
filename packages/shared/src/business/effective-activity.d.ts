/** A date column as it may be read here: a Date, the ISO string it crosses the wire as, or absent. */
type DateLike = Date | string | null | undefined;

interface UnavailabilityWindow {
  date?: DateLike;
  startDate?: DateLike;
  endDate?: DateLike;
}

interface EventWindow {
  eventStartDate?: DateLike;
  eventEndDate?: DateLike;
}

interface ActivityRecord {
  active?: boolean;
  eventsOnly?: boolean;
  unavailability?: UnavailabilityWindow | null;
}

/** Why a record is not available today — null when it is. */
export type InactivityReason = 'DEACTIVATED' | 'UNAVAILABLE' | 'OUTSIDE_EVENT';

export interface EffectiveActivity {
  active: boolean;
  reason: InactivityReason | null;
}

export function todayDateStr(now?: Date): string;

export function isWithinAvailabilityWindow(
  unavailability: UnavailabilityWindow | null | undefined,
  today?: string,
): boolean;

export function isWithinEventWindow(
  record: { eventsOnly?: boolean } | null | undefined,
  event: EventWindow | null | undefined,
  today?: string,
): boolean;

export function effectiveActivity(
  record: ActivityRecord,
  event?: EventWindow | null,
  today?: string,
): EffectiveActivity;
