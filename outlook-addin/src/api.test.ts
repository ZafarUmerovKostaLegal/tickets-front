/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearApiCaches, ensureEmailsFolder, listClients } from './api';
import { mapWithConcurrency } from './conversationBuild';

type Call = { method: string; url: string };

function mockFetch(handler: (url: string, init: RequestInit) => { status?: number; body: unknown }) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ method: init.method ?? 'GET', url });
    const { status = 200, body } = handler(url, init);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }));
  return calls;
}

beforeEach(() => {
  clearApiCaches();
  localStorage.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe('listClients cache', () => {
  it('reuses the list until forced', async () => {
    const calls = mockFetch(() => ({ body: { clients: [] } }));
    await listClients();
    await listClients();
    expect(calls).toHaveLength(1);
    await listClients({ force: true });
    expect(calls).toHaveLength(2);
  });

  it('sends the add-in token and a clear message on 401', async () => {
    localStorage.setItem('kosta.addin.hubToken', 'tok');
    mockFetch(() => ({ status: 401, body: {} }));
    await expect(listClients({ force: true })).rejects.toThrow('Сессия Hub истекла');
    const init = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]![1];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
});

describe('ensureEmailsFolder', () => {
  it('creates Correspondence/Emails once and caches the folder', async () => {
    const calls = mockFetch((url, init) => {
      if (url.includes('/browse'))
        return { body: { folders: [] } };
      return { body: { id: JSON.parse(String(init.body)).name === 'Correspondence' ? 'corr' : 'emails' } };
    });
    expect(await ensureEmailsFolder('m1')).toBe('emails');
    expect(calls.filter((c) => c.method === 'POST' && c.url.endsWith('/folders'))).toHaveLength(2);
    const before = calls.length;
    expect(await ensureEmailsFolder('m1')).toBe('emails');
    expect(calls.length).toBe(before);
  });

  it('reuses existing folders instead of creating duplicates', async () => {
    const calls = mockFetch((url) => ({
      body: {
        folders: url.includes('folderId')
          ? [{ id: 'corr', name: 'Correspondence' }, { id: 'em', name: 'emails', parentId: 'corr' }]
          : [{ id: 'corr', name: 'Correspondence' }],
      },
    }));
    expect(await ensureEmailsFolder('m1')).toBe('em');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});

describe('mapWithConcurrency', () => {
  it('keeps order and never exceeds the limit', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapWithConcurrency([5, 1, 4, 2, 3, 0], 2, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, n));
      active -= 1;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30, 0]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});
