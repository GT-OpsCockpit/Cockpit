import { IsIn } from 'class-validator';
import { DRIVER_STEP_ORDER, type DriverStep } from '@cockpit/shared';

export class NotifyStepDto {
  // The five steps the driver can trigger from the public link — the same list
  // the pipeline order is built from, so a new step can't be accepted here
  // without existing there (@cockpit/shared/business/trip-progress.js).
  @IsIn(DRIVER_STEP_ORDER as readonly string[])
  step: DriverStep;
}
