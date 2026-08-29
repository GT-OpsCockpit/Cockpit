import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsISO8601, IsOptional } from 'class-validator';

export const TRIP_PERIODS = [
  'upcoming',
  'today',
  'week',
  'past',
  'all',
] as const;
export type TripPeriod = (typeof TRIP_PERIODS)[number];

// 'daily' (default) = every non-Event-client trip, same as before this param
// existed — Bookings never sends it and keeps its current behavior. 'event'/
// 'all' exist for the Planning Gantt's Daily/Event/All toggle.
export const TRIP_CATEGORIES = ['daily', 'event', 'all'] as const;
export type TripCategory = (typeof TRIP_CATEGORIES)[number];

export class ListTripsQueryDto {
  /**
   * Explicit pickup window, as ISO instants: `from` inclusive, `to` exclusive.
   *
   * For the callers whose window is a real date range rather than one of the
   * named periods below — the Planning Gantt navigates to an arbitrary date
   * plus a 1-3 day span, the Invoicing/Partner logs to a billing month. They
   * used to ask for `period=all` (no bound at all) and narrow in the browser.
   *
   * Giving either bound replaces `period` entirely, so a caller that means
   * "this window" cannot accidentally also get the 'upcoming' default.
   */
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  /**
   * Only bookings farmed out to a partner — the Invoicing Partner log, which
   * shows nothing else. Omit for no filtering; `false` is not a filter for
   * "no partner", there is no caller for that.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasPartner?: boolean;

  /** Defaults to 'upcoming' in TripsService.list() — see periodDateRange(). */
  @IsOptional()
  @IsIn(TRIP_PERIODS)
  period?: TripPeriod;

  /** Defaults to 'daily' in TripsService.list(). */
  @IsOptional()
  @IsIn(TRIP_CATEGORIES)
  category?: TripCategory;

  /**
   * Opt-in "live dispatch board" window: drops a trip whose pickup was before
   * today (Paris) once it already has a driver — an already-handled job is
   * clutter on the board, while an unassigned one still needs attention.
   *
   * Off by default on purpose. In the legacy this was `baseVisibility`
   * (dispatcher.html:349-363), applied client-side by the Bookings page and
   * by nothing else: Invoicing, Events, the Partner log and the Planning
   * Gantt all read the unfiltered list, and must keep seeing past assigned
   * trips (Invoicing's whole job is billing completed months).
   */
  // Query params arrive as strings — @Type(() => Boolean) would map "false"
  // to `true` (Boolean('false') is truthy), so this needs an explicit check.
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  board?: boolean;
}
