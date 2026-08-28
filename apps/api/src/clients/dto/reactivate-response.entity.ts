export class ReactivateResponseEntity {
  ok: boolean;

  /** How many drivers were relinked. */
  drivers: number;

  /** How many fleet vehicles were relinked. */
  fleetVehicles: number;
}
