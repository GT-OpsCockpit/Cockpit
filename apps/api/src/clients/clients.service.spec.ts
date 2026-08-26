import { computeClientName } from './clients.service';

describe('computeClientName', () => {
  it('prefers the company name when present', () => {
    expect(
      computeClientName({
        ref: 'CC1',
        company: '  Acme Corp  ',
        contactFirstName: 'Jane',
        contactLastName: 'Doe',
      }),
    ).toBe('Acme Corp');
  });

  it('falls back to the contact full name when there is no company', () => {
    expect(
      computeClientName({
        ref: 'CI1',
        company: null,
        contactFirstName: 'Jane',
        contactLastName: 'Doe',
      }),
    ).toBe('Jane Doe');
  });

  it('falls back to "Account {ref}" when neither is set', () => {
    expect(
      computeClientName({
        ref: 'CI2',
        company: null,
        contactFirstName: null,
        contactLastName: null,
      }),
    ).toBe('Account CI2');
  });
});
