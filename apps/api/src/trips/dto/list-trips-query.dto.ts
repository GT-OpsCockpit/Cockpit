import { IsIn, IsOptional } from 'class-validator';

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
  /** Defaults to 'upcoming' in TripsService.list() — see periodDateRange(). */
  @IsOptional()
  @IsIn(TRIP_PERIODS)
  period?: TripPeriod;

  /** Defaults to 'daily' in TripsService.list(). */
  @IsOptional()
  @IsIn(TRIP_CATEGORIES)
  category?: TripCategory;
}
