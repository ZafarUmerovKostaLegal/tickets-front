/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_API_BASE,
  MAX_FILED,
  buildRoamingPayload,
  isAllowedApiBase,
  normalizeApiBase,
  parseSettings,
  type AddinSettings,
} from './settings';

describe('API base allowlist', () => {
  it('accepts only our gateway', () => {
    expect(isAllowedApiBase('https://ticketsback.kostalegal.com/api/v1/files')).toBe(true);
    expect(isAllowedApiBase('https://evil.example/api/v1/files')).toBe(false);
    expect(isAllowedApiBase('https://ticketsback.kostalegal.com.evil.io/api/v1/files')).toBe(false);
    expect(isAllowedApiBase('http://ticketsback.kostalegal.com/api/v1/files')).toBe(false);
    expect(isAllowedApiBase('not a url')).toBe(false);
  });

  it('falls back to the default instead of sending the token elsewhere', () => {
    expect(normalizeApiBase('https://evil.example/api/v1/files')).toBe(DEFAULT_API_BASE);
    expect(normalizeApiBase('')).toBe(DEFAULT_API_BASE);
  });

  it('fixes trailing slashes, junk and the /file typo', () => {
    expect(normalizeApiBase('https://ticketsback.kostalegal.com/api/v1/file/ !')).toBe(DEFAULT_API_BASE);
    expect(normalizeApiBase('https://ticketsback.kostalegal.com/api/v2/files///')).toBe('https://ticketsback.kostalegal.com/api/v2/files');
  });
});

describe('parseSettings', () => {
  it('returns defaults for garbage', () => {
    expect(parseSettings(null).apiBase).toBe(DEFAULT_API_BASE);
    expect(parseSettings('x').rules).toEqual([]);
  });

  it('drops malformed rules and fills defaults', () => {
    const s = parseSettings({
      rules: [
        { id: 'r1', match: '@a.com', matterId: 'm1' },
        { id: 2, match: '@b.com', matterId: 'm2' },
        null,
      ],
    });
    expect(s.rules).toEqual([
      { id: 'r1', match: '@a.com', matterId: 'm1', matterName: '', clientName: '', folderId: null, folderPath: [], autoFile: true, enabled: true },
    ]);
  });

  it('dedupes and caps the filed history', () => {
    const ids = Array.from({ length: MAX_FILED + 50 }, (_, i) => `<ID${i}@x>`);
    const s = parseSettings({ filedMessageIds: ['<A@x>', 'a@x', ...ids] });
    expect(s.filedMessageIds[0]).toBe('a@x');
    expect(s.filedMessageIds).toHaveLength(MAX_FILED);
    expect(new Set(s.filedMessageIds).size).toBe(MAX_FILED);
  });
});

describe('roaming payload', () => {
  it('stays under the Office 32 KB roaming limit and keeps rules intact', () => {
    const settings: AddinSettings = {
      apiBase: DEFAULT_API_BASE,
      rules: Array.from({ length: 30 }, (_, i) => ({
        id: `r${i}`, match: `@client${i}.com`, matterId: `m${i}`, matterName: `Matter ${i}`, clientName: `Client ${i}`, autoFile: true, enabled: true,
      })),
      filedMessageIds: Array.from({ length: MAX_FILED }, (_, i) => `${'x'.repeat(60)}${i}@mail.example.com`),
      pinTipDismissed: true,
    };
    const payload = buildRoamingPayload(settings);
    expect(payload.length).toBeLessThanOrEqual(28_000);
    const parsed = JSON.parse(payload) as AddinSettings;
    expect(parsed.rules).toHaveLength(30);
    expect(parsed.pinTipDismissed).toBe(true);
    expect(parsed.filedMessageIds.length).toBeGreaterThan(0);
  });
});
