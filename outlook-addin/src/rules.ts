import type { FilingRule } from './settings';

function normalizeMatch(value: string): string {
  return value.trim().toLowerCase().replace(/^mailto:/, '');
}

function subjectPhrases(raw: string | undefined): string[] {
  return (raw ?? '').split(/[,;\n]+/).map((part) => part.trim().replace(/\s+/g, ' ').toLowerCase()).filter(Boolean);
}

function senderScore(match: string, email: string, domain: string): number {
  if (!match)
    return 1;
  if (match.includes('@') && !match.startsWith('@'))
    return match === email ? 3 + match.length : 0;
  const bare = match.replace(/^@/, '');
  if (!bare)
    return 0;
  return domain === bare || domain.endsWith(`.${bare}`) ? 2 + bare.length / 1000 : 0;
}

export function matchRule(fromEmail: string, rules: FilingRule[], subject = ''): FilingRule | null {
  const email = normalizeMatch(fromEmail);
  const domain = email.includes('@') ? email.split('@')[1] ?? '' : '';
  const text = subject.replace(/\s+/g, ' ').trim().toLowerCase();
  let best: { score: number[]; rule: FilingRule } | null = null;
  for (const rule of rules) {
    if (!rule.enabled || !rule.matterId)
      continue;
    const match = normalizeMatch(rule.match);
    const phrases = subjectPhrases(rule.subject);
    if (!match && !phrases.length)
      continue;
    if (match && !email.includes('@'))
      continue;
    const sender = senderScore(match, email, domain);
    if (!sender)
      continue;
    if (phrases.length && !phrases.some((phrase) => text.includes(phrase)))
      continue;
    const score = [rule.scope === 'shared' ? 0 : 1, phrases.length ? 1 : 0, match ? 1 : 0, sender];
    if (!best || compare(score, best.score) > 0)
      best = { score, rule };
  }
  return best?.rule ?? null;
}

function compare(a: number[], b: number[]): number {
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index])
      return a[index] - b[index];
  }
  return 0;
}
