/** One dormant Events driver or vehicle that could be relinked to a new Event. */
export class ReactivationCandidateEntity {
  ref: string;

  /** Row label: the driver's name, or "REG-NBR (Category)" for a vehicle. */
  label: string;

  /** The Event it is still scoped to — the one it is dormant under. */
  previousEventRef: string;

  previousEventName: string;
}

export class ReactivationCandidatesEntity {
  drivers: ReactivationCandidateEntity[];
  fleetVehicles: ReactivationCandidateEntity[];
}
