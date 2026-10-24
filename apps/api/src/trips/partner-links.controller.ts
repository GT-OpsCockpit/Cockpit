import { Controller, Get, Header, Param, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { TripsService } from './trips.service';
import {
  partnerAvailablePage,
  partnerDeclinedPage,
  partnerLinkPage,
} from './partner-link.util';

/**
 * The page behind the "Confirm booking" button of a partner's email. Public
 * (the partner has no Cockpit account), protected by the signed token in the
 * link. HTML, not JSON, so it stays out of the generated API client.
 */
@ApiExcludeController()
@Controller('partner-links')
export class PartnerLinksController {
  constructor(private readonly tripsService: TripsService) {}

  // Opening the link only shows a button: mail scanners and link previews
  // follow every link in an email, and must not be able to confirm for the partner.
  @Public()
  @Get(':ref/confirm')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async preview(
    @Param('ref') ref: string,
    @Query('t') token = '',
  ): Promise<string> {
    const result = await this.tripsService.partnerLinkPreview(ref, token);
    if (result.state === 'invalid') {
      return partnerLinkPage({
        title: 'This link is no longer valid',
        message:
          'The booking has changed or been reassigned. Please use the latest email you received, or contact the dispatch team.',
      });
    }
    if (result.state === 'already') {
      return partnerLinkPage({
        title: 'Booking already confirmed',
        message: `Booking ${ref} is confirmed. Thank you.`,
      });
    }
    if (result.state === 'declined') {
      return partnerLinkPage({
        title: `Booking ${ref} was declined`,
        message:
          'You declined this booking. If you can take it after all, tell the dispatch team — they will decide whether to assign it to you.',
        button: {
          action: `/api/partner-links/${encodeURIComponent(ref)}/confirm?t=${encodeURIComponent(token)}`,
          label: 'I can take this booking',
        },
      });
    }
    return partnerLinkPage({
      title: `Confirm booking ${ref}`,
      message: result.trip?.pickup ?? '',
      button: {
        action: `/api/partner-links/${encodeURIComponent(ref)}/confirm?t=${encodeURIComponent(token)}`,
        label: 'Confirm booking',
      },
    });
  }

  @Public()
  @Post(':ref/confirm')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async confirm(
    @Param('ref') ref: string,
    @Query('t') token = '',
  ): Promise<string> {
    const result = await this.tripsService.confirmByPartnerLink(ref, token);
    if (result.outcome === 'invalid') return INVALID_PAGE();
    if (result.outcome === 'declined') {
      return partnerAvailablePage({ tripRef: ref, mailto: result.mailto });
    }
    return partnerLinkPage({
      title:
        result.outcome === 'confirmed'
          ? 'Booking confirmed'
          : 'Booking already confirmed',
      message: `Thank you — booking ${ref} is confirmed.`,
    });
  }

  // Same two-step shape as Confirm: the GET only shows a button.
  @Public()
  @Get(':ref/decline')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async declinePreview(
    @Param('ref') ref: string,
    @Query('t') token = '',
  ): Promise<string> {
    const result = await this.tripsService.partnerLinkPreview(ref, token);
    if (result.state === 'invalid') return INVALID_PAGE();
    return partnerLinkPage({
      title: `Decline booking ${ref}`,
      message: result.trip?.pickup ?? '',
      button: {
        action: `/api/partner-links/${encodeURIComponent(ref)}/decline?t=${encodeURIComponent(token)}`,
        label: 'Decline booking',
        danger: true,
      },
    });
  }

  // Marks the booking Declined, then hands the partner a pre-filled email to
  // the dispatch mailbox to give the reason.
  @Public()
  @Post(':ref/decline')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async decline(
    @Param('ref') ref: string,
    @Query('t') token = '',
  ): Promise<string> {
    const result = await this.tripsService.declineByPartnerLink(ref, token);
    if (!result) return INVALID_PAGE();
    return partnerDeclinedPage({ tripRef: ref, mailto: result.mailto });
  }
}

const INVALID_PAGE = () =>
  partnerLinkPage({
    title: 'This link is no longer valid',
    message:
      'The booking has changed or been reassigned. Please use the latest email you received, or contact the dispatch team.',
  });
