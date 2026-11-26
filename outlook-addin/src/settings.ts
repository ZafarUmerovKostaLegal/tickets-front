export type FilingRule = {
  id: string;
  match: string;
  subject?: string;
  matterId: string;
  matterName: string;
  clientName: string;
  folderId?: string | null;
  folderPath?: Array<{ id: string; name: string }>;
  autoFile: boolean;
  enabled: boolean;
  scope?: 'personal' | 'shared';
  canEdit?: boolean;
};

export type RecentTarget = {
  matterId: string;
  matterName: string;
  matterCode: string;
  clientId: string;
  clientName: string;
  folderId: string | null;
  folderPath: Array<{ id: string; name: string }>;
  usedAt: string;
};

export type AddinSettings = {
  apiBase: string;
  rules: FilingRule[];
  filedMessageIds: string[];
  pinTipDismissed: boolean;
  collapsed: boolean;
  recentTargets: RecentTarget[];
};

const KEY = 'kosta.file.addin.settings';

export const DEFAULT_API_BASE = 'https://ticketsback.kostalegal.com/api/v1/files';

const ALLOWED_API_ORIGINS = new Set([
  'https://ticketsback.kostalegal.com',
  ...(import.meta.env.DEV ? ['https://localhost:8000', 'http://localhost:8000', 'http://127.0.0.1:8000'] : []),
]);

export const MAX_FILED = 400;

const ROAMING_MAX_FILED = 80;
const ROAMING_BUDGET_CHARS = 28_000;

const defaults: AddinSettings = {
  apiBase: DEFAULT_API_BASE,
  rules: [],
  filedMessageIds: [],
  pinTipDismissed: false,
  collapsed: false,
  recentTargets: [],
};

export const MAX_RECENT_TARGETS = 12;

export function isAllowedApiBase(value: string): boolean {
  try {
    const url = new URL(value);
    return ALLOWED_API_ORIGINS.has(url.origin) && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export function normalizeApiBase(value: string): string {
  let trimmed = String(value ?? '').trim().replace(/[!\s]+$/g, '').replace(/\/+$/, '');
  if (!trimmed)
    return DEFAULT_API_BASE;
  trimmed = trimmed.replace(/\/api\/v1\/file$/i, '/api/v1/files');
  return isAllowedApiBase(trimmed) ? trimmed : DEFAULT_API_BASE;
}

export function normalizeFiledId(messageId: string): string {
  return messageId.trim().replace(/^<|>$/g, '').toLowerCase();
}

function isRule(value: unknown): value is FilingRule {
  if (!value || typeof value !== 'object')
    return false;
  const r = value as Record<string, unknown>;
  return typeof r.id === 'string' && typeof r.match === 'string' && typeof r.matterId === 'string';
}

function normalizeCrumbs(value: unknown): Array<{ id: string; name: string }> {
  if (!Array.isArray(value))
    return [];
  return value
    .filter((c): c is { id: string; name: string } => Boolean(c) && typeof c.id === 'string' && typeof c.name === 'string')
    .map((c) => ({ id: c.id, name: c.name }));
}

function normalizeRules(value: unknown): FilingRule[] {
  if (!Array.isArray(value))
    return [];
  return value.filter(isRule).map((r) => ({
    id: r.id,
    match: r.match,
    matterId: r.matterId,
    matterName: String(r.matterName ?? ''),
    clientName: String(r.clientName ?? ''),
    folderId: typeof r.folderId === 'string' && r.folderId ? r.folderId : null,
    folderPath: normalizeCrumbs(r.folderPath),
    autoFile: r.autoFile !== false,
    enabled: r.enabled !== false,
  }));
}

export function normalizeRecentTargets(value: unknown): RecentTarget[] {
  if (!Array.isArray(value))
    return [];
  const seen = new Set<string>();
  const out: RecentTarget[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || typeof raw.matterId !== 'string' || !raw.matterId)
      continue;
    const folderId = typeof raw.folderId === 'string' && raw.folderId ? raw.folderId : null;
    const key = `${raw.matterId}|${folderId ?? ''}`;
    if (seen.has(key))
      continue;
    seen.add(key);
    out.push({
      matterId: raw.matterId,
      matterName: String(raw.matterName ?? ''),
      matterCode: String(raw.matterCode ?? ''),
      clientId: String(raw.clientId ?? ''),
      clientName: String(raw.clientName ?? ''),
      folderId,
      folderPath: normalizeCrumbs(raw.folderPath),
      usedAt: String(raw.usedAt ?? ''),
    });
    if (out.length >= MAX_RECENT_TARGETS)
      break;
  }
  return out;
}

function normalizeFiled(value: unknown, limit: number): string[] {
  if (!Array.isArray(value))
    return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    const id = normalizeFiledId(String(raw ?? ''));
    if (!id || seen.has(id))
      continue;
    seen.add(id);
    out.push(id);
    if (out.length >= limit)
      break;
  }
  return out;
}

export function parseSettings(raw: unknown, fallback: AddinSettings = defaults): AddinSettings {
  if (!raw || typeof raw !== 'object')
    return { ...fallback };
  const parsed = raw as Partial<AddinSettings>;
  return {
    apiBase: normalizeApiBase(String(parsed.apiBase || fallback.apiBase)),
    rules: Array.isArray(parsed.rules) ? normalizeRules(parsed.rules) : fallback.rules,
    filedMessageIds: Array.isArray(parsed.filedMessageIds)
      ? normalizeFiled(parsed.filedMessageIds, MAX_FILED)
      : fallback.filedMessageIds,
    pinTipDismissed: typeof parsed.pinTipDismissed === 'boolean' ? parsed.pinTipDismissed : fallback.pinTipDismissed,
    collapsed: typeof parsed.collapsed === 'boolean' ? parsed.collapsed : fallback.collapsed,
    recentTargets: Array.isArray(parsed.recentTargets) ? normalizeRecentTargets(parsed.recentTargets) : fallback.recentTargets,
  };
}

export function buildRoamingPayload(settings: AddinSettings): string {
  let filed = settings.filedMessageIds.slice(0, ROAMING_MAX_FILED);
  for (;;) {
    const json = JSON.stringify({ ...settings, filedMessageIds: filed });
    if (json.length <= ROAMING_BUDGET_CHARS || filed.length === 0)
      return json;
    filed = filed.slice(0, Math.floor(filed.length / 2));
  }
}

function readLocal(): AddinSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseSettings(JSON.parse(raw)) : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

function writeLocal(settings: AddinSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
  }
}

let cache = readLocal();

export function getSettings(): AddinSettings {
  return cache;
}

export function saveSettings(patch: Partial<AddinSettings>): AddinSettings {
  cache = parseSettings({ ...cache, ...patch }, cache);
  writeLocal(cache);
  try {
    const roaming = Office?.context?.roamingSettings;
    if (roaming) {
      roaming.set(KEY, buildRoamingPayload(cache));
      roaming.saveAsync(() => undefined);
    }
  } catch {
  }
  return cache;
}

export function loadRoamingSettings(): Promise<AddinSettings> {
  try {
    const raw = Office?.context?.roamingSettings?.get(KEY);
    if (typeof raw === 'string' && raw.trim()) {
      const remote = parseSettings(JSON.parse(raw), cache);
      cache = {
        ...remote,
        filedMessageIds: normalizeFiled([...remote.filedMessageIds, ...cache.filedMessageIds], MAX_FILED),
      };
      writeLocal(cache);
    }
  } catch {
  }
  return Promise.resolve(cache);
}

export function markFiled(messageId: string): void {
  markFiledMany([messageId]);
}

export function markFiledMany(messageIds: string[]): void {
  const fresh = messageIds.map(normalizeFiledId).filter(Boolean);
  if (!fresh.length)
    return;
  saveSettings({ filedMessageIds: normalizeFiled([...fresh, ...cache.filedMessageIds], MAX_FILED) });
}

export function wasFiled(messageId: string): boolean {
  const id = normalizeFiledId(messageId);
  return cache.filedMessageIds.includes(id);
}

export function rememberTarget(target: Omit<RecentTarget, 'usedAt'>): void {
  saveSettings({
    recentTargets: normalizeRecentTargets([{ ...target, usedAt: new Date().toISOString() }, ...cache.recentTargets]),
  });
}

export function newRuleId(): string {
  return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
