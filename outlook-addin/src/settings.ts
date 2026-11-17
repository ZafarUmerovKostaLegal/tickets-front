export type FilingRule = {
  id: string;
  match: string;
  matterId: string;
  matterName: string;
  clientName: string;
  autoFile: boolean;
  enabled: boolean;
};

export type ConversationDocRef = {
  documentId: string;
  matterId: string;
  fileName: string;
  messageCount: number;
  updatedAt: string;
};

export type AddinSettings = {
  /** File Manager API, e.g. https://ticketsback.kostalegal.com/api/v1/files */
  apiBase: string;
  rules: FilingRule[];
  filedMessageIds: string[];
  /** conversationStorageKey → FM document (single thread file) */
  conversationDocs: Record<string, ConversationDocRef>;
  /** User dismissed the “pin the pane” tip after pinning once. */
  pinTipDismissed: boolean;
};

const KEY = 'kosta.file.addin.settings';

export const DEFAULT_API_BASE = 'https://ticketsback.kostalegal.com/api/v1/files';

/**
 * The Hub bearer token is sent to `apiBase`, so it may only point to our own gateways.
 * Anything else falls back to the default instead of leaking the token.
 */
const ALLOWED_API_ORIGINS = new Set([
  'https://ticketsback.kostalegal.com',
  ...(import.meta.env.DEV ? ['https://localhost:8000', 'http://localhost:8000', 'http://127.0.0.1:8000'] : []),
]);

/** Local history limits (localStorage, ~5 MB). */
export const MAX_FILED = 400;
export const MAX_CONVERSATION_DOCS = 200;

/** Office roaming settings are capped at 32 KB per add-in — keep a smaller slice there. */
const ROAMING_MAX_FILED = 80;
const ROAMING_MAX_CONVERSATION_DOCS = 40;
const ROAMING_BUDGET_CHARS = 28_000;

const defaults: AddinSettings = {
  apiBase: DEFAULT_API_BASE,
  rules: [],
  filedMessageIds: [],
  conversationDocs: {},
  pinTipDismissed: false,
};

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
  // Truncation / typo: .../api/v1/file  →  .../api/v1/files
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

function normalizeRules(value: unknown): FilingRule[] {
  if (!Array.isArray(value))
    return [];
  return value.filter(isRule).map((r) => ({
    id: r.id,
    match: r.match,
    matterId: r.matterId,
    matterName: String(r.matterName ?? ''),
    clientName: String(r.clientName ?? ''),
    autoFile: r.autoFile !== false,
    enabled: r.enabled !== false,
  }));
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

/** Keep the most recently updated conversation documents. */
export function trimConversationDocs(
  docs: Record<string, ConversationDocRef>,
  limit: number,
): Record<string, ConversationDocRef> {
  const entries = Object.entries(docs)
    .filter(([, ref]) => ref && typeof ref.documentId === 'string')
    .sort((a, b) => String(b[1].updatedAt).localeCompare(String(a[1].updatedAt)))
    .slice(0, limit);
  return Object.fromEntries(entries);
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
    conversationDocs: parsed.conversationDocs && typeof parsed.conversationDocs === 'object'
      ? trimConversationDocs(parsed.conversationDocs as Record<string, ConversationDocRef>, MAX_CONVERSATION_DOCS)
      : fallback.conversationDocs,
    pinTipDismissed: typeof parsed.pinTipDismissed === 'boolean' ? parsed.pinTipDismissed : fallback.pinTipDismissed,
  };
}

/**
 * Serialise the roaming copy within the Office 32 KB limit: rules and flags always fit,
 * the dedupe history is trimmed until the payload is small enough.
 */
export function buildRoamingPayload(settings: AddinSettings): string {
  let filed = settings.filedMessageIds.slice(0, ROAMING_MAX_FILED);
  let docs = trimConversationDocs(settings.conversationDocs, ROAMING_MAX_CONVERSATION_DOCS);
  for (;;) {
    const json = JSON.stringify({ ...settings, filedMessageIds: filed, conversationDocs: docs });
    if (json.length <= ROAMING_BUDGET_CHARS || (filed.length === 0 && Object.keys(docs).length === 0))
      return json;
    filed = filed.slice(0, Math.floor(filed.length / 2));
    docs = trimConversationDocs(docs, Math.floor(Object.keys(docs).length / 2));
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
    /* storage full or blocked — roaming copy still works */
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
    /* roaming optional */
  }
  return cache;
}

/** Merge roaming settings (other devices) into the local copy. */
export function loadRoamingSettings(): Promise<AddinSettings> {
  try {
    const raw = Office?.context?.roamingSettings?.get(KEY);
    if (typeof raw === 'string' && raw.trim()) {
      const remote = parseSettings(JSON.parse(raw), cache);
      cache = {
        ...remote,
        // History is trimmed in roaming — keep the union with the fuller local copy.
        filedMessageIds: normalizeFiled([...remote.filedMessageIds, ...cache.filedMessageIds], MAX_FILED),
        conversationDocs: trimConversationDocs({ ...cache.conversationDocs, ...remote.conversationDocs }, MAX_CONVERSATION_DOCS),
      };
      writeLocal(cache);
    }
  } catch {
    /* keep local */
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

export function getConversationDoc(storageKey: string): ConversationDocRef | null {
  return cache.conversationDocs[storageKey] || null;
}

export function setConversationDoc(storageKey: string, ref: ConversationDocRef): void {
  saveSettings({
    conversationDocs: {
      ...cache.conversationDocs,
      [storageKey]: ref,
    },
  });
}

export function newRuleId(): string {
  return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
