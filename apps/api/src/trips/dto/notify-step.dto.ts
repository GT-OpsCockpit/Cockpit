import { IsIn } from 'class-validator';

export const DRIVER_STEP_VALUES = [
  'ACCEPTED',
  'ENROUTE',
  'ARRIVED',
  'ONBOARD',
  'DROPPED',
] as const;

export class NotifyStepDto {
  @IsIn(DRIVER_STEP_VALUES)
  step: (typeof DRIVER_STEP_VALUES)[number];
}
