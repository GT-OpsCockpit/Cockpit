import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum SubcontractEmailKind {
  /** The mission recap sent when a job is farmed out. */
  ASSIGNED = 'assigned',
  /** The notice sent when a farmed-out job is taken back off the partner. */
  CANCELLED = 'cancelled',
}

export class SubcontractEmailQueryDto {
  @IsEnum(SubcontractEmailKind)
  kind: SubcontractEmailKind;

  /**
   * Whose draft to write, when it isn't (or is no longer) the trip's own
   * partner. The cancellation notice needs this: the front reads the draft
   * *before* clearing partnerRef, and the legacy had the same ordering
   * constraint ("`partner` must be captured by the caller BEFORE the trip's
   * partnerRef is cleared", common.js:2686).
   */
  @IsOptional()
  @IsString()
  partnerRef?: string;
}
