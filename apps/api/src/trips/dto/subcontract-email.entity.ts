/** A ready-to-open mailto: draft — nothing is sent by the app itself. */
export class SubcontractEmailEntity {
  /** The partner's email on file, or null when there is none and no draft can be written. */
  to: string | null;

  subject: string;

  body: string;
}
