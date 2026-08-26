import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientType } from '../../../generated/prisma/enums';

/**
 * Shared "Link to an Event" validation for drivers and fleet vehicles
 * (eventsOnly=true): both require their own base country/area plus a valid
 * linked event Client account. Ported from the legacy's single
 * validateEventLinkFields(), shared by createDriver/createFleetVehicle.
 */
@Injectable()
export class EventLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveEventClientId(
    eventCountry: string | undefined,
    eventArea: string | undefined,
    eventRef: string | undefined,
  ): Promise<string> {
    if (!eventCountry || !eventArea?.trim() || !eventRef) {
      throw new BadRequestException(
        'Country, Area and Event are required (via the Events popup)',
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
    return client.id;
  }
}
