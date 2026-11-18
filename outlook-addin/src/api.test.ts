/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearApiCaches, listMatters, mapClientsToMatters, uploadToCorrespondence } from './api';
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

describe('mapClientsToMatters', () => {
  it('keeps only writable matters and sorts by client, then matter', () => {
    const rows = mapClientsToMatters({
      clients: [
        { id: 'c2', name: 'Яблоко', matters: [{ id: 'm3', name: 'B', code: '', closed: false, level: 'write' }] },
        {
          id: 'c1',
          name: 'Альфа',
          matters: [
            { id: 'm2', name: 'Z', code: 'Z1', closed: false, level: 'owner' },
            { id: 'm1', name: 'A', code: 'A1', closed: true, level: 'write' },
            { id: 'mx', name: 'Read only', code: '', closed: false, level: 'read' },
          ],
        },
      ],
    });
    expect(rows.map((r) => r.id)).toEqual(['m1', 'm2', 'm3']);
    expect(rows[0]).toMatchObject({ clientId: 'c1', clientName: 'Альфа', closed: true });
  });
});

describe('listMatters cache', () => {
  it('reuses the list until forced', async () => {
    const calls = mockFetch(() => ({ body: { clients: [] } }));
    await listMatters();
    await listMatters();
    expect(calls).toHaveLength(1);
    await listMatters({ force: true });
    expect(calls).toHaveLength(2);
  });

  it('sends the add-in token and a clear message on 401', async () => {
    localStorage.setItem('kosta.addin.hubToken', 'tok');
    mockFetch(() => ({ status: 401, body: {} }));
    await expect(listMatters({ force: true })).rejects.toThrow('Сессия Hub истекла');
    const init = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]![1];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
});

describe('uploadToCorrespondence', () => {
  const file = new File(['x'], 'a.eml');

  it('creates Correspondence/Emails once and caches the folder for the next uploads', async () => {
    const calls = mockFetch((url, init) => {
      if (url.includes('/browse'))
        return { body: { folders: [] } };
      if (url.endsWith('/folders'))
        return { body: { id: JSON.parse(String(init.body)).name === 'Correspondence' ? 'corr' : 'emails' } };
      return { body: { documents: [{ id: 'doc1' }] } };
    });
    expect(await uploadToCorrespondence('m1', 'Emails', file)).toEqual([{ id: 'doc1' }]);
    expect(calls.filter((c) => c.method === 'POST' && c.url.endsWith('/folders'))).toHaveLength(2);
    const before = calls.length;
    await uploadToCorrespondence('m1', 'Emails', file);
    expect(calls.length - before).toBe(1);
  });

  it('recreates the folder and retries once when the cached folder is gone', async () => {
    let uploads = 0;
    const calls = mockFetch((url) => {
      if (url.includes('/browse')) {
        const isRoot = !url.includes('folderId');
        return { body: { folders: isRoot ? [{ id: 'corr', name: 'Correspondence' }] : [{ id: 'corr', name: 'Correspondence' }, { id: `emails${uploads}`, name: 'emails', parentId: 'corr' }] } };
      }
      uploads += 1;
      return uploads === 2 ? { status: 404, body: { detail: 'folder not found' } } : { body: { documents: [{ id: `d${uploads}` }] } };
    });
    await uploadToCorrespondence('m1', 'Emails', file);
    const result = await uploadToCorrespondence('m1', 'Emails', file);
    expect(result).toEqual([{ id: 'd3' }]);
    expect(calls.filter((c) => c.url.includes('/browse')).length).toBe(4);
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
