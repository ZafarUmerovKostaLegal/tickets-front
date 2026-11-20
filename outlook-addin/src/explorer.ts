import type { BrowseFolder, ClientNode, Crumb, Filing, Location, Suggestion } from './api';
import type { FilingRule, RecentTarget } from './settings';

export type FolderNode = BrowseFolder & { children: FolderNode[] };

const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

export function buildFolderTree(rows: readonly BrowseFolder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  rows.forEach((row) => byId.set(row.id, { ...row, children: [] }));
  const roots: FolderNode[] = [];
  byId.forEach((node) => {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent && parent !== node)
      parent.children.push(node);
    else
      roots.push(node);
  });
  const sort = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => collator.compare(a.name, b.name));
    nodes.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}

export function folderPath(rows: readonly BrowseFolder[], folderId: string | null): Crumb[] {
  if (!folderId)
    return [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const out: Crumb[] = [];
  const seen = new Set<string>();
  let current: string | null = folderId;
  while (current && byId.has(current) && !seen.has(current)) {
    seen.add(current);
    const row: BrowseFolder = byId.get(current)!;
    out.unshift({ id: row.id, name: row.name });
    current = row.parentId;
  }
  return out;
}

function norm(value: string): string {
  return value.toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();
}

export function isOwnMatter(matter: ClientNode['matters'][number]): boolean {
  return matter.mine !== false || matter.favorite;
}

export function hasForeignMatters(clients: readonly ClientNode[]): boolean {
  return clients.some((client) => client.matters.some((m) => m.level !== 'none' && !isOwnMatter(m)));
}

export function filterClients(
  clients: readonly ClientNode[],
  query: string,
  options: { hideClosed?: boolean; onlyMine?: boolean } = {},
): ClientNode[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const out: ClientNode[] = [];
  for (const client of clients) {
    const matters = client.matters.filter((m) => (
      m.level !== 'none'
      && !(options.hideClosed && m.closed)
      && !(options.onlyMine && !isOwnMatter(m))
    ));
    if (!words.length) {
      if (matters.length)
        out.push({ ...client, matters });
      continue;
    }
    const clientText = norm(client.name);
    const hits = matters.filter((m) => {
      const text = `${clientText} ${norm(m.name)} ${norm(m.code)}`;
      return words.every((word) => text.includes(word));
    });
    if (hits.length)
      out.push({ ...client, matters: hits });
  }
  return out;
}

export function locationKey(location: Pick<Location, 'matterId' | 'folderId'>): string {
  return `${location.matterId}|${location.folderId ?? ''}`;
}

export type SuggestedLocation = Location & {
  reason: Suggestion['reason'] | 'rule' | 'local';
  count: number;
  filedHere: boolean;
};

export function mergeSuggestions(input: {
  rule: FilingRule | null;
  server: readonly Suggestion[];
  recent: readonly RecentTarget[];
  filings: readonly Filing[];
  limit?: number;
}): SuggestedLocation[] {
  const filed = new Set(input.filings.filter((f) => f.sameMessage).map(locationKey));
  const out: SuggestedLocation[] = [];
  const seen = new Set<string>();
  const push = (location: Location, reason: SuggestedLocation['reason'], count: number) => {
    const key = locationKey(location);
    if (seen.has(key))
      return;
    seen.add(key);
    out.push({ ...location, reason, count, filedHere: filed.has(key) });
  };
  if (input.rule && input.rule.folderId) {
    push({
      matterId: input.rule.matterId,
      matterName: input.rule.matterName,
      matterCode: '',
      clientId: '',
      clientName: input.rule.clientName,
      folderId: input.rule.folderId,
      folderPath: input.rule.folderPath ?? [],
    }, 'rule', 0);
  }
  input.server.forEach((row) => push(row, row.reason, row.count));
  input.recent.forEach((row) => push(row, 'local', 0));
  return out.slice(0, input.limit ?? 6);
}

export function reasonLabel(location: SuggestedLocation, sender: string): string {
  const domain = sender.includes('@') ? sender.split('@')[1] : '';
  switch (location.reason) {
    case 'rule':
      return 'правило';
    case 'conversation':
      return 'эта переписка';
    case 'sender':
      return location.count > 1 ? `отправитель · ${location.count}` : 'отправитель';
    case 'domain':
      return location.count > 1 ? `${domain} · ${location.count}` : domain || 'компания';
    default:
      return 'недавно';
  }
}

export function filedSummary(filings: readonly Filing[]): { message: Filing[]; thread: Filing[] } {
  const message = filings.filter((f) => f.sameMessage);
  const ownDocs = new Set(message.map((f) => f.documentId));
  const thread = filings.filter((f) => !f.sameMessage && !ownDocs.has(f.documentId));
  const uniq = (rows: Filing[]) => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = `${row.documentId}`;
      if (seen.has(key))
        return false;
      seen.add(key);
      return true;
    });
  };
  return { message: uniq(message), thread: uniq(thread) };
}
