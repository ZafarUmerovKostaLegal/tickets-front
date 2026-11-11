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
const MAX_FILED = 400;

const defaults: AddinSettings = {
  apiBase: 'https://ticketsback.kostalegal.com/api/v1/files',
  rules: [],
  filedMessageIds: [],
  conversationDocs: {},
  pinTipDismissed: false,
};

function normalizeApiBase(value: string): string {
  let trimmed = value.trim().replace(/[!\s]+$/g, '').replace(/\/+$/, '');
  if (!trimmed)
    return defaults.apiBase;
  // Truncation / typo: .../api/v1/file  →  .../api/v1/files
  trimmed = trimmed.replace(/\/api\/v1\/file$/i, '/api/v1/files');
  return trimmed;
}

function fromStorage(): AddinSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw)
      return { ...defaults, rules: [], filedMessageIds: [] };
    const parsed = JSON.parse(raw) as Partial<AddinSettings>;
    return {
      apiBase: normalizeApiBase(String(parsed.apiBase || defaults.apiBase)),
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
      filedMessageIds: Array.isArray(parsed.filedMessageIds) ? parsed.filedMessageIds.map(String) : [],
      conversationDocs: parsed.conversationDocs && typeof parsed.conversationDocs === 'object'
        ? parsed.conversationDocs as Record<string, ConversationDocRef>
        : {},
      pinTipDismissed: Boolean(parsed.pinTipDismissed),
    };
  } catch {
    return { ...defaults, rules: [], filedMessageIds: [] };
  }
}

let cache = fromStorage();

export function getSettings(): AddinSettings {
  return cache;
}

export function saveSettings(patch: Partial<AddinSettings>): AddinSettings {
  cache = {
    ...cache,
    ...patch,
    apiBase: normalizeApiBase(patch.apiBase ?? cache.apiBase),
    rules: patch.rules ?? cache.rules,
    filedMessageIds: patch.filedMessageIds ?? cache.filedMessageIds,
    conversationDocs: patch.conversationDocs ?? cache.conversationDocs,
    pinTipDismissed: patch.pinTipDismissed ?? cache.pinTipDismissed,
  };
  localStorage.setItem(KEY, JSON.stringify(cache));
  try {
    const roaming = Office?.context?.roamingSettings;
    if (roaming) {
      roaming.set(KEY, JSON.stringify(cache));
      roaming.saveAsync(() => undefined);
    }
  } catch {
    /* roaming optional */
  }
  return cache;
}

export function loadRoamingSettings(): Promise<AddinSettings> {
  return new Promise((resolve) => {
    try {
      const roaming = Office?.context?.roamingSettings;
      if (!roaming) {
        resolve(cache);
        return;
      }
      const raw = roaming.get(KEY);
      if (typeof raw === 'string' && raw.trim()) {
        const parsed = JSON.parse(raw) as Partial<AddinSettings>;
        cache = {
          apiBase: String(parsed.apiBase || cache.apiBase || defaults.apiBase),
          rules: Array.isArray(parsed.rules) ? parsed.rules : cache.rules,
          filedMessageIds: Array.isArray(parsed.filedMessageIds)
            ? parsed.filedMessageIds.map(String)
            : cache.filedMessageIds,
          conversationDocs: parsed.conversationDocs && typeof parsed.conversationDocs === 'object'
            ? parsed.conversationDocs as Record<string, ConversationDocRef>
            : cache.conversationDocs,
          pinTipDismissed: typeof parsed.pinTipDismissed === 'boolean'
            ? parsed.pinTipDismissed
            : cache.pinTipDismissed,
        };
        localStorage.setItem(KEY, JSON.stringify(cache));
      }
    } catch {
      /* keep local */
    }
    resolve(cache);
  });
}

function normalizeFiledId(messageId: string): string {
  return messageId.trim().replace(/^<|>$/g, '').toLowerCase();
}

export function markFiled(messageId: string): void {
  const id = normalizeFiledId(messageId);
  const next = [id, ...cache.filedMessageIds.map(normalizeFiledId).filter((x) => x && x !== id)].slice(0, MAX_FILED);
  saveSettings({ filedMessageIds: next });
}

export function wasFiled(messageId: string): boolean {
  const id = normalizeFiledId(messageId);
  return cache.filedMessageIds.some((x) => normalizeFiledId(x) === id);
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
