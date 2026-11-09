export type FilingRule = {
  id: string;
  match: string;
  matterId: string;
  matterName: string;
  clientName: string;
  autoFile: boolean;
  enabled: boolean;
};

export type AddinSettings = {
  /** File Manager API, e.g. https://ticketsback.kostalegal.com/api/v1/files */
  apiBase: string;
  rules: FilingRule[];
  filedMessageIds: string[];
};

const KEY = 'kosta.file.addin.settings';
const MAX_FILED = 400;

const defaults: AddinSettings = {
  apiBase: 'https://ticketsback.kostalegal.com/api/v1/files',
  rules: [],
  filedMessageIds: [],
};

function normalizeApiBase(value: string): string {
  let trimmed = value.trim().replace(/[!\s]+$/g, '').replace(/\/+$/, '');
  if (!trimmed)
    return defaults.apiBase;
  // Common typo from truncated UI: .../api/v1/file or .../file!
  if (/\/api\/v1\/files?$/i.test(trimmed))
    return trimmed.replace(/\/api\/v1\/file$/i, '/api/v1/files');
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
        };
        localStorage.setItem(KEY, JSON.stringify(cache));
      }
    } catch {
      /* keep local */
    }
    resolve(cache);
  });
}

export function markFiled(messageId: string): void {
  const next = [messageId, ...cache.filedMessageIds.filter((id) => id !== messageId)].slice(0, MAX_FILED);
  saveSettings({ filedMessageIds: next });
}

export function wasFiled(messageId: string): boolean {
  return cache.filedMessageIds.includes(messageId);
}

export function newRuleId(): string {
  return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
