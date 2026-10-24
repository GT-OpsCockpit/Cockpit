import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The signed link in a partner's "NEW/UPDATED BOOKING" email. The token proves
 * "this link was issued for this booking, this very partner and these very
 * details" — nothing else is stored — so a link from an older email stops
 * working as soon as the booking is given to somebody else or edited.
 */
export function signPartnerLink(
  secret: string,
  tripRef: string,
  partnerKey: string,
  fingerprint: string,
): string {
  return createHmac('sha256', secret)
    .update(`${tripRef}\n${partnerKey}\n${fingerprint}`)
    .digest('base64url');
}

export function verifyPartnerLink(
  secret: string,
  tripRef: string,
  partnerKey: string,
  fingerprint: string,
  token: string,
): boolean {
  const expected = Buffer.from(
    signPartnerLink(secret, tripRef, partnerKey, fingerprint),
  );
  const given = Buffer.from(token ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * What a partner's mail client opens for "Decline": a draft addressed to the
 * dispatch mailbox, ready for them to type the reason into.
 */
export function buildDeclineMailto(args: {
  to: string;
  tripRef: string;
  companyName: string | null;
  partnerName: string;
}): string {
  const body = [
    `Dear ${args.companyName || 'Team'},`,
    '',
    `We regret to inform you that we are unable to confirm the booking ${args.tripRef} for the following reason:`,
    '',
    '',
    '',
    'Best,',
    args.partnerName,
  ].join('\r\n');
  const subject = `DECLINED BOOKING - ${args.tripRef}`;
  return `mailto:${args.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The reviewed plain-text body as HTML, followed by the two buttons. The text
 * is escaped (the dispatcher may have typed anything into the preview);
 * `**word**` — the markers the plain-text drafts use — becomes bold.
 */
export function buildPartnerEmailHtml(
  body: string,
  links: { confirmUrl: string; declineUrl: string },
): string {
  const text = escapeHtml(body)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\r?\n/g, '<br>');
  const button =
    'display:inline-block;padding:11px 22px;border-radius:6px;font-weight:bold;text-decoration:none;font-size:14px;';
  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111;">',
    `<div>${text}</div>`,
    '<p style="margin:28px 0 8px;">',
    `<a href="${escapeHtml(links.confirmUrl)}" style="${button}background:#16a34a;color:#ffffff;">Confirm booking</a>`,
    '&nbsp;&nbsp;',
    `<a href="${escapeHtml(links.declineUrl)}" style="${button}background:#ffffff;color:#b91c1c;border:1px solid #b91c1c;">Decline</a>`,
    '</p>',
    '</div>',
  ].join('');
}

/** The small standalone page a partner lands on after clicking "Confirm booking". */
export function partnerLinkPage(args: {
  title: string;
  message: string;
  button?: { action: string; label: string; danger?: boolean };
}): string {
  const form = args.button
    ? `<form method="post" action="${escapeHtml(args.button.action)}"><button type="submit" style="margin-top:20px;padding:12px 26px;border:0;border-radius:6px;background:${args.button.danger ? '#b91c1c' : '#16a34a'};color:#fff;font-size:15px;font-weight:bold;cursor:pointer;">${escapeHtml(args.button.label)}</button></form>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(args.title)}</title></head><body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;"><div style="max-width:460px;margin:12vh auto;padding:32px;background:#fff;border-radius:10px;text-align:center;"><h1 style="font-size:20px;margin:0 0 12px;">${escapeHtml(args.title)}</h1><p style="color:#444;line-height:1.5;margin:0;">${escapeHtml(args.message)}</p>${form}</div></body></html>`;
}

/**
 * A page that opens the partner's mail client on a pre-filled reply (and keeps
 * a visible button to it, in case the browser blocks the automatic jump).
 */
export function partnerMailPage(args: {
  title: string;
  message: string;
  mailto: string;
  buttonLabel: string;
  color: string;
}): string {
  const href = escapeHtml(args.mailto);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(args.title)}</title></head><body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;"><div style="max-width:460px;margin:12vh auto;padding:32px;background:#fff;border-radius:10px;text-align:center;"><h1 style="font-size:20px;margin:0 0 12px;">${escapeHtml(args.title)}</h1><p style="color:#444;line-height:1.5;margin:0;">${escapeHtml(args.message)}</p><p style="margin-top:20px;"><a href="${href}" style="display:inline-block;padding:12px 26px;border-radius:6px;background:${args.color};color:#fff;font-size:15px;font-weight:bold;text-decoration:none;">${escapeHtml(args.buttonLabel)}</a></p></div><script>window.location.href=${JSON.stringify(args.mailto).replace(/</g, '\\u003c')};</script></body></html>`;
}

/** Shown once a decline is recorded. */
export function partnerDeclinedPage(args: { tripRef: string; mailto: string }): string {
  return partnerMailPage({
    title: `Booking ${args.tripRef} declined`,
    message: 'The dispatch team has been notified. Please add the reason in the email that opens now.',
    mailto: args.mailto,
    buttonLabel: 'Write the reason',
    color: '#b91c1c',
  });
}

/** Shown when a partner who declined says they can do it after all — nothing changes in Cockpit, the email is the message. */
export function partnerAvailablePage(args: { tripRef: string; mailto: string }): string {
  return partnerMailPage({
    title: `Booking ${args.tripRef}`,
    message: 'You had declined this booking. Send us the email that opens now to let us know you can take it — we will come back to you.',
    mailto: args.mailto,
    buttonLabel: 'Write to the dispatch team',
    color: '#16a34a',
  });
}

/** The reply a partner who had declined sends to say they can take the job after all; the dispatcher decides whether to assign it. */
export function buildAvailableMailto(args: {
  to: string;
  tripRef: string;
  companyName: string | null;
  partnerName: string;
}): string {
  const body = [
    `Dear ${args.companyName || 'Team'},`,
    '',
    `We are now able to take care of the booking ${args.tripRef}.`,
    'Please let us know if you would like to assign it to us.',
    '',
    'Best,',
    args.partnerName,
  ].join('\r\n');
  const subject = `AVAILABLE FOR BOOKING - ${args.tripRef}`;
  return `mailto:${args.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
