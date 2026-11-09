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
  /** File Manager API, e.g. https://hub/api/v1/files */
  apiBase: string;
  /** Outlook auth API, e.g. https://hub/api/v1/auth/outlook (optional if derived from apiBase) */
  authBase: string;
  rules: FilingRule[];
  filedMessageIds: string[];
};

const KEY = 'kosta.file.addin.settings';
const MAX_FILED = 400;

const defaults: AddinSettings = {
  apiBase: '',
  authBase: '',
  rules: [],
  filedMessageIds: [],
};

function fromStorage(): AddinSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw)
      return { ...defaults, rules: [], filedMessageIds: [] };
    const parsed = JSON.parse(raw) as Partial<AddinSettings> & { authToken?: string };
    return {
      apiBase: String(parsed.apiBase ?? ''),
      authBase: String(parsed.authBase ?? ''),
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
          apiBase: String(parsed.apiBase ?? cache.apiBase),
          authBase: String(parsed.authBase ?? cache.authBase),
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
