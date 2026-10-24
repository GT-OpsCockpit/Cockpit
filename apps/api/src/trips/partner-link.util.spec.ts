import {
  buildAvailableMailto,
  buildDeclineMailto,
  buildPartnerEmailHtml,
  escapeHtml,
  partnerAvailablePage,
  partnerDeclinedPage,
  signPartnerLink,
  verifyPartnerLink,
} from './partner-link.util';

const SECRET = 'a-test-secret-of-sufficient-length';

describe('partner link token', () => {
  const FP = '["Nice Airport","Hotel",1,"TSF",2]';

  it('verifies for the same booking, partner and details', () => {
    const token = signPartnerLink(SECRET, 'R-CC1-26-3', 'D-FR-EXT-001', FP);
    expect(verifyPartnerLink(SECRET, 'R-CC1-26-3', 'D-FR-EXT-001', FP, token)).toBe(true);
  });

  it('is refused for another partner, booking, secret — or once the details changed', () => {
    const token = signPartnerLink(SECRET, 'R-CC1-26-3', 'D-FR-EXT-001', FP);
    expect(verifyPartnerLink(SECRET, 'R-CC1-26-3', 'D-FR-EXT-002', FP, token)).toBe(false);
    expect(verifyPartnerLink(SECRET, 'R-CC1-26-4', 'D-FR-EXT-001', FP, token)).toBe(false);
    expect(verifyPartnerLink('another-secret-long-enough', 'R-CC1-26-3', 'D-FR-EXT-001', FP, token)).toBe(false);
    expect(verifyPartnerLink(SECRET, 'R-CC1-26-3', 'D-FR-EXT-001', '["Cannes"]', token)).toBe(false);
  });

  it('is refused for an empty or truncated token', () => {
    expect(verifyPartnerLink(SECRET, 'R-CC1-26-3', 'D-FR-EXT-001', FP, '')).toBe(false);
    expect(verifyPartnerLink(SECRET, 'R-CC1-26-3', 'D-FR-EXT-001', FP, 'abc')).toBe(false);
  });
});

describe('buildDeclineMailto', () => {
  it('pre-fills the reply the partner types their reason into', () => {
    const href = buildDeclineMailto({
      to: 'contact@gt-ops.club',
      tripRef: 'R-CC1-26-3',
      companyName: 'GT Ops',
      partnerName: 'Riviera Cars',
    });
    expect(href.startsWith('mailto:contact@gt-ops.club?subject=')).toBe(true);
    const query = new URLSearchParams(href.split('?')[1]);
    expect(query.get('subject')).toBe('DECLINED BOOKING - R-CC1-26-3');
    const body = query.get('body')!.replace(/\r\n/g, '\n');
    expect(body).toBe(
      [
        'Dear GT Ops,',
        '',
        'We regret to inform you that we are unable to confirm the booking R-CC1-26-3 for the following reason:',
        '',
        '',
        '',
        'Best,',
        'Riviera Cars',
      ].join('\n'),
    );
  });

  it('falls back to "Team" when the company has no name', () => {
    const href = buildDeclineMailto({ to: 'a@b.c', tripRef: 'R-1', companyName: null, partnerName: 'P' });
    expect(decodeURIComponent(href)).toContain('Dear Team,');
  });
});

describe('buildPartnerEmailHtml', () => {
  const links = { confirmUrl: 'http://x/api/partner-links/R-1/confirm?t=abc', declineUrl: 'http://x/api/partner-links/R-1/decline?t=abc' };

  it('keeps the reviewed text, escaped, and adds both buttons', () => {
    const html = buildPartnerEmailHtml('Dear Team,\n\nInfo: <b>VIP</b> & more', links);
    expect(html).toContain('Dear Team,<br><br>Info: &lt;b&gt;VIP&lt;/b&gt; &amp; more');
    expect(html).toContain('>Confirm booking</a>');
    expect(html).toContain('>Decline</a>');
    expect(html).toContain('href="http://x/api/partner-links/R-1/confirm?t=abc"');
    expect(html).toContain('href="http://x/api/partner-links/R-1/decline?t=abc"');
  });

  it('renders **word** markers as bold', () => {
    expect(buildPartnerEmailHtml('Status : **Canceled**', links)).toContain('<strong>Canceled</strong>');
  });

  it('escapes quotes in links', () => {
    expect(escapeHtml('a"b\'c')).toBe('a&quot;b&#39;c');
  });
});

describe('partnerDeclinedPage', () => {
  it('opens the pre-filled reply and offers a visible link to it', () => {
    const mailto = 'mailto:contact@gt-ops.club?subject=S&body=B';
    const html = partnerDeclinedPage({ tripRef: 'R-1', mailto });
    expect(html).toContain('Booking R-1 declined');
    expect(html).toContain('window.location.href="mailto:contact@gt-ops.club?subject=S&body=B"');
    expect(html).toContain('href="mailto:contact@gt-ops.club?subject=S&amp;body=B"');
  });
});

describe('available-after-decline reply', () => {
  it('tells the dispatcher the partner can take the job, for them to decide', () => {
    const href = buildAvailableMailto({ to: 'contact@gt-ops.club', tripRef: 'R-1', companyName: 'GT Ops', partnerName: 'Riviera Cars' });
    const query = new URLSearchParams(href.split('?')[1]);
    expect(query.get('subject')).toBe('AVAILABLE FOR BOOKING - R-1');
    const body = query.get('body')!.replace(/\r\n/g, '\n');
    expect(body).toBe(
      [
        'Dear GT Ops,',
        '',
        'We are now able to take care of the booking R-1.',
        'Please let us know if you would like to assign it to us.',
        '',
        'Best,',
        'Riviera Cars',
      ].join('\n'),
    );
    expect(partnerAvailablePage({ tripRef: 'R-1', mailto: href })).toContain('Booking R-1');
  });
});
