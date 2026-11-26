import { describe, expect, it } from 'vitest';
import { matchRule } from './rules';
import type { FilingRule } from './settings';

const rule = (p: Partial<FilingRule>): FilingRule => ({
  id: p.match ?? 'r',
  match: '',
  matterId: 'm1',
  matterName: 'Matter',
  clientName: 'Client',
  autoFile: true,
  enabled: true,
  ...p,
});

describe('matchRule', () => {
  const rules = [
    rule({ id: 'domain', match: '@acme.com', matterId: 'm-domain' }),
    rule({ id: 'exact', match: 'Boss@Acme.com', matterId: 'm-exact' }),
    rule({ id: 'bare', match: 'beta.uz', matterId: 'm-beta' }),
    rule({ id: 'off', match: '@off.com', enabled: false }),
  ];

  it('prefers an exact address over a domain rule, case-insensitively', () => {
    expect(matchRule('boss@acme.com', rules)?.id).toBe('exact');
    expect(matchRule('other@acme.com', rules)?.id).toBe('domain');
  });

  it('matches subdomains and bare domains', () => {
    expect(matchRule('a@mail.acme.com', rules)?.id).toBe('domain');
    expect(matchRule('a@beta.uz', rules)?.id).toBe('bare');
    expect(matchRule('a@notbeta.uz', rules)).toBeNull();
  });

  it('ignores disabled, empty and matter-less rules', () => {
    expect(matchRule('x@off.com', rules)).toBeNull();
    expect(matchRule('x@y.com', [rule({ match: '@y.com', matterId: '' })])).toBeNull();
    expect(matchRule('x@y.com', [rule({ match: '   ' })])).toBeNull();
  });

  it('returns null for invalid sender addresses', () => {
    expect(matchRule('', rules)).toBeNull();
    expect(matchRule('not-an-email', rules)).toBeNull();
  });

  it('routes one sender into different rules by subject', () => {
    const rules = [
      rule({ id: 'any', match: '@client.com' }),
      rule({ id: 'invoices', match: '@client.com', subject: 'Invoice, счёт' }),
      rule({ id: 'court', match: '', subject: 'court hearing' }),
    ];
    expect(matchRule('a@client.com', rules, 'Re: INVOICE 12')?.id).toBe('invoices');
    expect(matchRule('a@client.com', rules, 'Hello')?.id).toBe('any');
    expect(matchRule('judge@court.uz', rules, 'Court  hearing')?.id).toBe('court');
    expect(matchRule('judge@court.uz', rules, 'Hello')).toBeNull();
  });
});
