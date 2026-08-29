import { Role } from '../../../generated/prisma/enums';
import { roleHasPermission } from '../permissions/permissions';
import { isBeforeArrival } from '@cockpit/shared';

/**
 * Everything that follows from editing a booking's assignment: whether the
 * editor is allowed to at all, whether the Send button re-arms, whether the
 * driver pipeline restarts, and whether the POC is told.
 *
 * Extracted because TripsService.update() and TripsService.assign() were each
 * deriving all four inline, from different-looking code, and the comments in
 * both said so ("Same rule as update()"). They are the same rules; what
 * genuinely differs between the two callers is the *intent* they build, so
 * that is what they pass in.
 *
 * Pure on purpose: `now` is a parameter, nothing is read from the database,
 * and refusals are returned rather than thrown. The caller turns a refusal
 * into the HTTP exception its route owes.
 */

/** The booking as stored, before the edit. */
export interface TripBeforeEdit {
  pickupAt: Date;
  driverId: string | null;
  partnerId: string | null;
  priceEur: number | null;
  partnerRateEur: number | null;
  pocName: string | null;
  pocPhone: string | null;
  steps: { step: string }[];
  assignmentCancelled: boolean;
}

/**
 * The booking as it would be stored after the edit — already resolved, so a
 * caller that cannot change a field (assign() touches neither the price nor
 * the POC) simply passes the value back unchanged and the rules below see no
 * change.
 */
export interface TripEditIntent {
  driverId: string | null;
  partnerId: string | null;
  subContractor: boolean;
  tracking: boolean;
  priceEur: number | null;
  partnerRateEur: number | null;
  pocName: string | null;
  pocPhone: string | null;
  /**
   * The caller wants the POC told the booking changed. Still gated below: a
   * booking with no driver has nothing to announce, and one with tracking off
   * is not announced at all.
   */
  notifyPoc: boolean;
}

export type EditRefusal =
  { kind: 'forbidden'; message: string } | { kind: 'invalid'; message: string };

export interface AssignmentDecision {
  /** null when the edit may go ahead. */
  refusal: EditRefusal | null;
  /** A sub-contract farmed out to a company with nobody named on file. */
  locked: boolean;
  /** The Send button's state after the write. */
  dispatched: boolean;
  /** The assignee changed: the pipeline restarts and any cancellation is undone. */
  reassigned: boolean;
  /**
   * The "Sent" step has to be (re)recorded. A locked sub-contract is pinned at
   * "Sent", so it must actually carry the step that says so — and a
   * reassignment has just wiped the progress it was part of. Without this the
   * booking reads "Send ?" on a Send button disabled as "Already sent".
   */
  stampTransmitted: boolean;
  /** Send the POC the "updated" WhatsApp message. */
  notifyPoc: boolean;
}

export interface DecideOptions {
  now: Date;
  /**
   * How the past-pickup refusal names what the caller was doing — the full PUT
   * is "Editing", the Planning drag & drop is "Reassigning". Same rule, and the
   * dispatcher is told which of the two they were denied.
   */
  pastEditAction: 'Editing' | 'Reassigning';
}

const TRANSMITTED_STEP = 'TRANSMITTED';

export function decideAssignment(
  before: TripBeforeEdit,
  after: TripEditIntent,
  user: { role: Role },
  options: DecideOptions,
): AssignmentDecision {
  // A sub-contract with no partner chauffeur has no driver to send anything
  // to: it is pinned at "Sent" rather than having its Send button re-armed.
  const locked = after.subContractor && !after.partnerId;
  const reassigned =
    after.driverId !== before.driverId || after.partnerId !== before.partnerId;

  const decision: Omit<AssignmentDecision, 'refusal'> = {
    locked,
    stampTransmitted:
      locked &&
      (reassigned ||
        !before.steps.some((step) => step.step === TRANSMITTED_STEP)),
    // Any saved edit — trip details as much as a driver/vehicle/partner
    // reassignment — invalidates a previous dispatch and re-arms the Send
    // button, so the dispatcher is prompted to re-send with the new
    // information (server.js:2470 set `trip.dispatched = false` unconditionally
    // on every PUT). The locked company-only sub-contract is the one exception.
    dispatched: locked,
    reassigned,
    notifyPoc: after.notifyPoc && !!after.driverId && after.tracking,
  };

  return {
    ...decision,
    refusal:
      refuseEditPermission(before, after, user, options) ??
      refusePocChange(before, after),
  };
}

/**
 * The two conditional permission gates, answerable from the request alone —
 * nothing has to be looked up first.
 *
 * Exported so a caller can ask before it starts resolving foreign keys, which
 * is where both routes ask: a dispatcher editing a past booking is told they
 * need the Admin role, not that some unrelated field of their payload is also
 * wrong. decideAssignment() asks again on the full intent; it is pure, so the
 * second answer is the same one.
 */
export function refuseEditPermission(
  before: Pick<TripBeforeEdit, 'pickupAt' | 'priceEur' | 'partnerRateEur'>,
  after: Pick<TripEditIntent, 'priceEur' | 'partnerRateEur'>,
  user: { role: Role },
  { now, pastEditAction }: DecideOptions,
): EditRefusal | null {
  // Ported from the legacy's openEditTripModal gate (common.js): editing a
  // booking whose pickup has already passed, or changing the Retail net /
  // Partner rate net, both need trip:edit-past / trip:edit-price. Unlike
  // trip:cancel these are conditional, so they are checked here rather than
  // via @RequirePermission() on the route. See docs/agents/permissions.md.
  if (
    before.pickupAt < now &&
    !roleHasPermission(user.role, 'trip:edit-past')
  ) {
    return {
      kind: 'forbidden',
      message: `${pastEditAction} a booking whose pickup is already in the past requires the Admin role.`,
    };
  }

  const priceChanged =
    after.priceEur !== before.priceEur ||
    after.partnerRateEur !== before.partnerRateEur;
  if (priceChanged && !roleHasPermission(user.role, 'trip:edit-price')) {
    return {
      kind: 'forbidden',
      message:
        'Changing the Retail net / Partner rate net requires the Admin role.',
    };
  }

  return null;
}

function refusePocChange(
  before: TripBeforeEdit,
  after: TripEditIntent,
): EditRefusal | null {
  // Changing who meets the passenger only makes sense while nobody is there
  // yet: once the driver is "In position" the name and number being edited
  // are the ones already in use on the ground. Legacy isBeforeArrival
  // (common.js:2391), which gated the POC fields of the quick-edit popup.
  // Not a permission — no role lifts it, it is the booking's own progress.
  const pocChanged =
    after.pocName !== before.pocName || after.pocPhone !== before.pocPhone;
  if (pocChanged && !isBeforeArrival(before)) {
    return {
      kind: 'invalid',
      message:
        'The POC can no longer be changed: the driver is already in position.',
    };
  }

  return null;
}
