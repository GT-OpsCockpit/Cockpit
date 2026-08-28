import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientType } from '../../../generated/prisma/enums';
import { todayUtcMidnight } from '../business/assignability';

/** Everything the "Link to an Event" popup submits, plus the record's own location. */
export interface EventLinkInput {
  /** The record's own Country — what the popup shows read-only as "Country". */
  recordCountryCode?: string | null;
  /** The record's own Area — what the popup shows read-only as "Area". */
  recordArea?: string | null;
  eventCountry?: string;
  eventArea?: string;
  eventRef?: string;
}

/** Case- and whitespace-insensitive, the way the legacy compared areas (locAreaKey). */
function sameArea(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}

/**
 * Shared "Link to an Event" validation for drivers and fleet vehicles
 * (eventsOnly=true). Ported from the legacy's openEventLinkModal
 * (common.js:3034) and validateEventLinkFields.
 *
 * The popup never let the operator pick a location: it read the record's own
 * Country/Area, showed them greyed out, and offered only the Events accounts
 * matching them — so the three rules below are what that UI *was*. They live
 * here rather than in the browser because the Events picker is paginated:
 * filtering its page client-side would hide a mismatched event without
 * preventing the link (see docs/LEGACY_PARITY_AUDIT.md §4.3).
 */
@Injectable()
export class EventLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveEventClientId(input: EventLinkInput): Promise<string> {
    const { eventCountry, eventArea, eventRef } = input;
    if (!eventCountry || !eventArea?.trim() || !eventRef) {
      throw new BadRequestException(
        'Country, Area and Event are required (via the Events popup)',
      );
    }

    // 1. The location submitted is the record's own, not a second choice.
    if (
      input.recordCountryCode !== eventCountry ||
      !sameArea(input.recordArea, eventArea)
    ) {
      throw new BadRequestException(
        "The Event's Country and Area must be this record's own Country and Area — set them first, then link an Event happening there.",
      );
    }

    const client = await this.prisma.client.findUnique({
      where: { ref: eventRef },
    });
    if (!client || client.clientType !== ClientType.EVENT) {
      throw new BadRequestException(
        'The linked Event was not found (choose one from the Events popup)',
      );
    }

    // 2. Only an Event that hasn't ended can be linked — there is no point
    //    scoping a driver to one that is already over.
    if (client.eventEndDate && client.eventEndDate < todayUtcMidnight()) {
      throw new BadRequestException(
        `Event "${client.company ?? client.ref}" has already ended — link an upcoming one.`,
      );
    }

    // 3. …and it has to be happening where the record is.
    if (
      client.eventCountry !== eventCountry ||
      !sameArea(client.eventArea, eventArea)
    ) {
      throw new BadRequestException(
        `Event "${client.company ?? client.ref}" happens in ${client.eventCountry ?? '—'} / ${client.eventArea ?? '—'}, not in ${eventCountry} / ${eventArea}.`,
      );
    }

    return client.id;
  }
}
