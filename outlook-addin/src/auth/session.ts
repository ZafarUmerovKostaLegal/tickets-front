export type AuthProfile = {
  id: number;
  email: string;
  displayName: string;
};

const PROFILE_KEY = 'kosta.outlook.profile';
const LEGACY_REFRESH = 'kosta.outlook.refresh.enc';

let sessionLive = false;
let profile: AuthProfile | null = null;

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
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
  clearLegacyOutlookTokens();
}

export function setProfile(next: AuthProfile): void {
  profile = next;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Hub SPA token on same origin (when cookie-only is off). */
export function readHubAccessToken(): string | null {
  try {
    const token = localStorage.getItem('access_token');
    return token?.trim() || null;
  } catch {
    return null;
  }
}
