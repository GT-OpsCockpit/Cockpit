/**
 * Which fields a record must carry, given the type it is.
 *
 * Every roster record in this app is discriminated by a type — an account is
 * Individual / Company / Events, a driver is own-chauffeur / partner-company /
 * Events, a vehicle is Local / external — and each discriminant decides a
 * different set of required fields. That decision used to be written six
 * times: once per service on the API (throwing BadRequestException) and once
 * per Zod schema on the web (adding issues), each schema carrying a "Mirrors X
 * exactly" comment — the admission that the two were kept in step by hand.
 * The API's own TODO named this as how the create/update event-field bugs
 * happened.
 *
 * The rules live here and are read through two adapters:
 *   - apps/api/src/common/business/assert-required-fields.ts → throws
 *   - apps/web/src/lib/required-fields-issues.ts            → adds Zod issues
 *
 * So this module returns *values* and never throws: that is what makes both
 * adapters possible and what makes the rules testable as a table.
 *
 * Plain JS (not .ts) for the same reason as validation/email.js — see the
 * comment there.
 */

/**
 * Present, in the sense each side already used: a string must hold something
 * other than whitespace, anything else need only be truthy.
 *
 * The non-string case is real — ClientsService.update() merges the incoming
 * DTO over the stored row, where the event dates are Date objects.
 */
function has(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  return !!value;
}

/**
 * A date column as a comparable YYYY-MM-DD day. Both forms turn up: the form
 * hands over what an <input type="date"> holds, while ClientsService.update()
 * merges the DTO over the stored row, where these are Date objects.
 */
function day(value) {
  if (!has(value)) return null;
  return typeof value === 'string'
    ? value.slice(0, 10)
    : new Date(value).toISOString().slice(0, 10);
}

/**
 * A gap carries every field it concerns, not just the first: "an Individual
 * account needs a first and last name" is one rule about two fields, and the
 * form has to mark both.
 */
function gap(fields, message) {
  return { fields, message };
}

const CLIENT_TYPE_COMPANY = 'COMPANY';
const CLIENT_TYPE_EVENT = 'EVENT';

function clientGaps(values) {
  const gaps = [];
  const isCompany = values.clientType === CLIENT_TYPE_COMPANY;
  const isEvent = values.clientType === CLIENT_TYPE_EVENT;

  if (isCompany && !has(values.company)) {
    gaps.push(gap(['company'], 'Company name is required for a Company-type account.'));
  }
  if (isEvent && !has(values.company)) {
    gaps.push(gap(['company'], 'Event name is required for an Events-type account.'));
  }
  if (isEvent) {
    // Four gaps rather than the API's single combined message: the form has
    // four fields to mark, and one message cannot say which of them is empty.
    if (!has(values.eventCountry)) {
      gaps.push(gap(['eventCountry'], 'Country is required for an Events-type account.'));
    }
    if (!has(values.eventArea)) {
      gaps.push(gap(['eventArea'], 'Area is required for an Events-type account.'));
    }
    if (!has(values.eventStartDate)) {
      gaps.push(gap(['eventStartDate'], 'Start date is required for an Events-type account.'));
    }
    if (!has(values.eventEndDate)) {
      gaps.push(gap(['eventEndDate'], 'End date is required for an Events-type account.'));
    }
    // An inverted range is accepted nowhere downstream: the "not ended"
    // filter, the availability window, the reactivation candidates and the
    // Events bulk (which then creates zero bookings, silently) all read it as
    // an event that never happens. The legacy refused it twice over — Confirm
    // disabled, and dateEnd.min pinned to dateStart (clients.html:436-448).
    // Only asked once both dates are there; a missing one is already reported.
    const start = day(values.eventStartDate);
    const end = day(values.eventEndDate);
    if (start && end && end < start) {
      gaps.push(
        gap(
          ['eventStartDate', 'eventEndDate'],
          'End date must be on or after the start date.',
        ),
      );
    }
  }
  if (!isCompany && !isEvent && !(has(values.contactFirstName) && has(values.contactLastName))) {
    gaps.push(
      gap(
        ['contactFirstName', 'contactLastName'],
        'First and last name are required for an Individual-type account.',
      ),
    );
  }
  return gaps;
}

/**
 * Three kinds of driver, in the order the legacy's validateDriverFields tested
 * them: an Events driver, then an own chauffeur (no Company), then a partner —
 * whose requirements differ again depending on whether a person is named or
 * the record stands for the company itself.
 */
function driverGaps(values) {
  const gaps = [];

  // Where the driver is based — asked of every kind alike, so it comes before
  // the discriminant rather than being repeated inside each branch (each of
  // which returns early). The legacy marked the field `required` on its one
  // driver form, for every kind (drivers.html:205), and v2 keys three things
  // on it: the ref prefix, the Area suggestions, and whether an Event link is
  // allowed at all (EventLinkService rejects a record whose country doesn't
  // match its event's). A driver with no country is a record none of those
  // three can answer for.
  if (!has(values.countryCode)) gaps.push(gap(['countryCode'], 'Country is required.'));

  if (values.eventsOnly) {
    if (!has(values.company)) gaps.push(gap(['company'], 'Company is required for an Events driver.'));
    if (!has(values.firstName)) gaps.push(gap(['firstName'], 'First name is required for an Events driver.'));
    if (!has(values.lastName)) gaps.push(gap(['lastName'], 'Last name is required for an Events driver.'));
    if (!has(values.email)) gaps.push(gap(['email'], 'Email is required for an Events driver.'));
    if (!has(values.phone)) gaps.push(gap(['phone'], 'Phone is required for an Events driver.'));
    // The location the Event is linked by. Enforced on the API today only as
    // a side effect of EventLinkService.resolveEventClientId() rejecting the
    // link — so answering "what does an Events driver need" meant reading
    // three files in two apps. It is one of the rules now.
    gaps.push(...eventLinkGaps(values));
    return gaps;
  }

  const isPartner = has(values.company);
  const hasName = has(values.firstName) || has(values.lastName);

  if (!isPartner) {
    if (!has(values.firstName)) gaps.push(gap(['firstName'], 'First name is required.'));
    if (!has(values.lastName)) gaps.push(gap(['lastName'], 'Last name is required.'));
    if (!has(values.phone)) gaps.push(gap(['phone'], 'Phone is required.'));
    return gaps;
  }

  if (hasName) {
    if (!has(values.email)) gaps.push(gap(['email'], 'Email is required for a partner chauffeur.'));
    if (!has(values.phone)) gaps.push(gap(['phone'], 'Phone is required for a partner chauffeur.'));
    return gaps;
  }

  if (!has(values.email)) gaps.push(gap(['email'], 'Email is required for a partner company.'));
  return gaps;
}

function fleetVehicleGaps(values) {
  const gaps = [];
  // Same default as FleetVehiclesService.assertValid(): a vehicle is Local
  // unless it says otherwise.
  const isLocal = values.isLocal === undefined ? true : !!values.isLocal;

  if (!isLocal) {
    if (!has(values.countryCode)) {
      gaps.push(gap(['countryCode'], 'Country is required for an external (non-local) vehicle.'));
    }
    if (!has(values.area)) {
      gaps.push(gap(['area'], 'Area is required for an external (non-local) vehicle.'));
    }
    if (!has(values.partnerCompany)) {
      gaps.push(gap(['partnerCompany'], 'Partner is required for an external (non-local) vehicle.'));
    }
  }
  if (values.eventsOnly) gaps.push(...eventLinkGaps(values));
  return gaps;
}

/** What the "Link to an Event" popup submits — shared by drivers and vehicles. */
function eventLinkGaps(values) {
  const gaps = [];
  if (!has(values.eventCountry)) gaps.push(gap(['eventCountry'], 'Country is required to link an Event.'));
  if (!has(values.eventArea)) gaps.push(gap(['eventArea'], 'Area is required to link an Event.'));
  if (!has(values.eventRef)) gaps.push(gap(['eventRef'], 'An Event must be selected.'));
  return gaps;
}

const RULES = {
  client: clientGaps,
  driver: driverGaps,
  fleetVehicle: fleetVehicleGaps,
};

/**
 * Every required field the given record is missing, in the order a reader
 * would go down the form. An empty array means nothing is missing.
 *
 * What this does NOT cover, deliberately: whether what was typed is *valid*
 * (a real email, a real phone, an acronym short enough, a year in range).
 * That is a different question — it has its own shared seam already
 * (@cockpit/shared/validation) and it does not depend on the discriminant.
 */
export function missingFields(kind, values) {
  const rule = RULES[kind];
  if (!rule) throw new TypeError(`Unknown record kind "${kind}"`);
  return rule(values ?? {});
}
