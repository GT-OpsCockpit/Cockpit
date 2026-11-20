/** A ready-to-open mailto: draft — nothing is sent by the app itself. */
export class SubcontractEmailEntity {
  /** The partner's email on file, or null when there is none and no draft can be written. */
  to: string | null;

  subject: string;

  body: string;
}

/** What a partner email's Send did: the email always, and a WhatsApp copy when the partner has a number. */
export class SubcontractEmailSentEntity {
  ok: true;

  /** The address the email went to. */
  to: string;

  /** The number the WhatsApp copy went to, or null when none was sent. */
  whatsappTo: string | null;

  /** Why the WhatsApp copy failed, or null (also null when the partner has no number). */
  whatsappWarning: string | null;
}
