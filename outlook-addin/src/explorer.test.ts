import { describe, expect, it } from 'vitest';
import type { ClientNode, Filing, Suggestion } from './api';
import { buildFolderTree, filedSummary, filterClients, folderPath, mergeSuggestions, reasonLabel } from './explorer';
import { hubDocumentUrl, locationLabel, messageFileName } from './naming';
import { normalizeRecentTargets } from './settings';

const folders = [
  { id: 'b', parentId: null, name: 'Correspondence', documents: 0 },
  { id: 'a', parentId: null, name: 'Agreements', documents: 2 },
  { id: 'e', parentId: 'b', name: 'Emails', documents: 5 },
  { id: 'loop', parentId: 'loop', name: 'Self', documents: 0 },
];

const clients: ClientNode[] = [
  {
    id: 'c1', name: 'Acme LLC', archived: false, favorite: false,
    matters: [
      { id: 'm1', name: 'Acme v. Beta', code: 'KL-1', closed: false, level: 'edit', favorite: false, documents: 0 },
      { id: 'm2', name: 'Old deal', code: 'KL-2', closed: true, level: 'edit', favorite: false, documents: 0 },
    ],
  },
  {
    id: 'c2', name: 'Ёлка', archived: false, favorite: false,
    matters: [{ id: 'm3', name: 'Аренда', code: 'KL-3', closed: false, level: 'read', favorite: false, documents: 0 }],
  },
];

const loc = (matterId: string, folderId: string | null) => ({
  matterId, matterName: matterId, matterCode: '', clientId: 'c1', clientName: 'Acme', folderId, folderPath: [],
});

describe('folder tree', () => {
  it('nests and sorts folders, survives self-references', () => {
    const tree = buildFolderTree(folders);
    expect(tree.map((n) => n.name)).toEqual(['Agreements', 'Correspondence', 'Self']);
    expect(tree[1]!.children.map((n) => n.name)).toEqual(['Emails']);
  });

  it('builds the path from the root', () => {
    expect(folderPath(folders, 'e').map((c) => c.name)).toEqual(['Correspondence', 'Emails']);
    expect(folderPath(folders, null)).toEqual([]);
    expect(folderPath(folders, 'loop')).toEqual([{ id: 'loop', name: 'Self' }]);
  });
});

describe('filterClients', () => {
  it('hides closed matters unless asked and matches every word', () => {
    expect(filterClients(clients, '', { hideClosed: true })[0]!.matters.map((m) => m.id)).toEqual(['m1']);
    expect(filterClients(clients, 'acme kl-2').map((c) => c.matters.map((m) => m.id))).toEqual([['m2']]);
  });

  it('treats ё as е and searches client names', () => {
    expect(filterClients(clients, 'елка').map((c) => c.id)).toEqual(['c2']);
  });
});

describe('mergeSuggestions', () => {
  const server: Suggestion[] = [
    { ...loc('m1', 'e'), reason: 'conversation', count: 1, lastFiledAt: null },
    { ...loc('m2', null), reason: 'domain', count: 3, lastFiledAt: null },
  ];

  it('puts the rule first and drops duplicates', () => {
    const rows = mergeSuggestions({
      rule: { id: 'r', match: '@acme.com', matterId: 'm2', matterName: 'm2', clientName: 'Acme', folderId: 'x', folderPath: [], autoFile: false, enabled: true },
      server,
      recent: [{ ...loc('m1', 'e'), usedAt: '' }, { ...loc('m9', null), usedAt: '' }],
      filings: [],
    });
    expect(rows.map((r) => `${r.matterId}:${r.reason}`)).toEqual(['m2:rule', 'm1:conversation', 'm2:domain', 'm9:local']);
  });

  it('marks places where this message already is', () => {
    const filing = { ...loc('m1', 'e'), sameMessage: true } as Filing;
    const rows = mergeSuggestions({ rule: null, server, recent: [], filings: [filing] });
    expect(rows[0]!.filedHere).toBe(true);
    expect(rows[1]!.filedHere).toBe(false);
  });

  it('labels reasons in Russian', () => {
    const rows = mergeSuggestions({ rule: null, server, recent: [], filings: [] });
    expect(reasonLabel(rows[0]!, 'a@acme.com')).toBe('эта переписка');
    expect(reasonLabel(rows[1]!, 'a@acme.com')).toBe('acme.com · 3');
  });
});

describe('filedSummary', () => {
  it('separates this message from the rest of the thread', () => {
    const rows = [
      { documentId: 'd1', sameMessage: true },
      { documentId: 'd1', sameMessage: true },
      { documentId: 'd2', sameMessage: false },
      { documentId: 'd1', sameMessage: false },
    ] as Filing[];
    const { message, thread } = filedSummary(rows);
    expect(message.map((f) => f.documentId)).toEqual(['d1']);
    expect(thread.map((f) => f.documentId)).toEqual(['d2']);
  });
});

describe('naming', () => {
  it('names a message by date, sender and subject with a stable hash', () => {
    const name = messageFileName({ subject: 'Re: SPA / final?', received: '2026-11-18T10:00:00Z', fromName: 'Ivan Petrov', messageId: 'abc@x' });
    expect(name).toMatch(/^2026-11-18 Ivan Petrov - Re_ SPA _ final_ \[[0-9a-z]{6}\]\.eml$/);
    expect(messageFileName({ subject: 'Re: SPA / final?', received: '2026-11-18T10:00:00Z', fromName: 'Ivan Petrov', messageId: 'abc@x' })).toBe(name);
    expect(messageFileName({ subject: 'Re: SPA / final?', received: '2026-11-18T10:00:00Z', fromName: 'Ivan Petrov', messageId: 'other@x' })).not.toBe(name);
  });

  it('builds labels and Hub links', () => {
    expect(locationLabel({ clientName: 'Acme', matterName: 'Deal', matterCode: 'KL-1', folderPath: [{ name: 'Emails' }] })).toBe('Acme › KL-1 Deal › Emails');
    expect(hubDocumentUrl('https://hub.test/', { matterId: 'm 1', folderId: 'f', documentId: 'd' }))
      .toBe('https://hub.test/files?view=matter&matter=m+1&folder=f&doc=d');
  });
});

describe('recent targets', () => {
  it('dedupes by place and drops broken rows', () => {
    const rows = normalizeRecentTargets([{ ...loc('m1', 'e'), usedAt: '2' }, { ...loc('m1', 'e'), usedAt: '1' }, { matterId: '' }, null]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.usedAt).toBe('2');
  });
});
