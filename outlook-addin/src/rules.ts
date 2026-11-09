import type { FilingRule } from './settings';

function normalizeMatch(value: string): string {
  return value.trim().toLowerCase();
}

/** MacroView-style: exact address or domain (`@acme.com` / `acme.com`). */
export function matchRule(fromEmail: string, rules: FilingRule[]): FilingRule | null {
  const email = normalizeMatch(fromEmail);
  if (!email || !email.includes('@'))
    return null;
  const domain = email.split('@')[1] ?? '';
  const enabled = rules.filter((rule) => rule.enabled && rule.match.trim() && rule.matterId);

  const exact = enabled.find((rule) => {
    const match = normalizeMatch(rule.match);
    return match === email || match.replace(/^mailto:/, '') === email;
  });
  if (exact)
    return exact;

  const byDomain = enabled.find((rule) => {
    const match = normalizeMatch(rule.match).replace(/^@/, '');
    if (!match || match.includes('@'))
      return false;
    return domain === match || domain.endsWith(`.${match}`);
  });
  return byDomain ?? null;
}

export function describeMatch(rule: FilingRule): string {
  const match = rule.match.trim();
  if (match.includes('@') && !match.startsWith('@'))
    return `отправитель ${match}`;
  return `домен ${match.replace(/^@/, '')}`;
}
