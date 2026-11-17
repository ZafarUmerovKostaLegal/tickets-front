export type AuthProfile = {
  id: number;
  email: string;
  displayName: string;
};

const PROFILE_KEY = 'kosta.outlook.profile';
const LEGACY_REFRESH = 'kosta.outlook.refresh.enc';
/** Add-in's own token slot — never overwrite or clear the Hub SPA session. */
const ADDIN_TOKEN_KEY = 'kosta.addin.hubToken';
/** Hub SPA key on the same origin: read-only fallback (older add-in builds wrote here). */
const HUB_TOKEN_KEY = 'access_token';

let sessionLive = false;
let profile: AuthProfile | null = null;
/** Azure Graph token (Mail.Read) — memory only, for conversation export. */
let azureAccessToken: string | null = null;
let azureAccessExpiresAt = 0;

function readStoredProfile(): AuthProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) as AuthProfile : null;
  } catch {
    return null;
  }
}

/** Drop separate Outlook-token leftovers from older builds. */
export function clearLegacyOutlookTokens(): void {
  try {
    localStorage.removeItem(LEGACY_REFRESH);
  } catch {
    /* ignore */
  }
  try {
    const roaming = Office?.context?.roamingSettings;
    if (!roaming)
      return;
    roaming.remove(LEGACY_REFRESH);
    roaming.saveAsync(() => undefined);
  } catch {
    /* ignore */
  }
}

export function getProfile(): AuthProfile | null {
  return profile ?? readStoredProfile();
}

export function isAuthenticated(): boolean {
  return sessionLive;
}

export function markAuthenticated(next: AuthProfile): void {
  sessionLive = true;
  profile = next;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  sessionLive = false;
  profile = null;
  azureAccessToken = null;
  azureAccessExpiresAt = 0;
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(ADDIN_TOKEN_KEY);
  } catch {
    /* ignore */
  }
  clearLegacyOutlookTokens();
}

export function storeAzureAccessToken(token: string, expiresInSec = 3600): void {
  azureAccessToken = token;
  azureAccessExpiresAt = Date.now() + Math.max(60, expiresInSec - 60) * 1000;
}

export function readAzureAccessToken(): string | null {
  if (!azureAccessToken || Date.now() >= azureAccessExpiresAt)
    return null;
  return azureAccessToken;
}

export function setProfile(next: AuthProfile): void {
  profile = next;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function readHubAccessToken(): string | null {
  try {
    const own = localStorage.getItem(ADDIN_TOKEN_KEY)?.trim();
    if (own)
      return own;
    return localStorage.getItem(HUB_TOKEN_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function storeHubAccessToken(token: string): void {
  try {
    localStorage.setItem(ADDIN_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}
