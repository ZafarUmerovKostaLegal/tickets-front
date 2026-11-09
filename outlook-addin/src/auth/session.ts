import { decryptSecret, encryptSecret } from './crypto';
import { getOrCreateDeviceId, getOrCreateDeviceSecret } from './device';

const REFRESH_KEY = 'kosta.outlook.refresh.enc';
const PROFILE_KEY = 'kosta.outlook.profile';

export type AuthProfile = {
  id: number;
  email: string;
  displayName: string;
};

type MemorySession = {
  accessToken: string;
  expiresAt: number;
  profile: AuthProfile | null;
};

let memory: MemorySession | null = null;

function roamingGet(key: string): string | null {
  try {
    const value = Office?.context?.roamingSettings?.get(key);
    return typeof value === 'string' && value.trim() ? value : null;
  } catch {
    return null;
  }
}

function roamingSet(key: string, value: string): void {
  try {
    const roaming = Office?.context?.roamingSettings;
    if (!roaming)
      return;
    roaming.set(key, value);
    roaming.saveAsync(() => undefined);
  } catch {
    /* ignore */
  }
}

function roamingRemove(key: string): void {
  try {
    const roaming = Office?.context?.roamingSettings;
    if (!roaming)
      return;
    roaming.remove(key);
    roaming.saveAsync(() => undefined);
  } catch {
    /* ignore */
  }
}

export function getDeviceId(): string {
  return getOrCreateDeviceId();
}

export function getAccessToken(): string | null {
  if (!memory || Date.now() >= memory.expiresAt - 30_000)
    return null;
  return memory.accessToken;
}

export function getProfile(): AuthProfile | null {
  if (memory?.profile)
    return memory.profile;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) as AuthProfile : null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken()) || Boolean(localStorage.getItem(REFRESH_KEY) || roamingGet(REFRESH_KEY));
}

export async function setSession(pair: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}, profile?: AuthProfile | null): Promise<void> {
  memory = {
    accessToken: pair.access_token,
    expiresAt: Date.now() + Math.max(60, pair.expires_in) * 1000,
    profile: profile ?? memory?.profile ?? null,
  };
  const enc = await encryptSecret(pair.refresh_token, getOrCreateDeviceSecret(), getDeviceId());
  localStorage.setItem(REFRESH_KEY, enc);
  roamingSet(REFRESH_KEY, enc);
  if (profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    roamingSet(PROFILE_KEY, JSON.stringify(profile));
    memory.profile = profile;
  }
}

export async function readRefreshToken(): Promise<string | null> {
  const enc = localStorage.getItem(REFRESH_KEY) || roamingGet(REFRESH_KEY);
  if (!enc)
    return null;
  return decryptSecret(enc, getOrCreateDeviceSecret(), getDeviceId());
}

export function clearSession(): void {
  memory = null;
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(PROFILE_KEY);
  roamingRemove(REFRESH_KEY);
  roamingRemove(PROFILE_KEY);
}

export function setProfile(profile: AuthProfile): void {
  if (memory)
    memory.profile = profile;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  roamingSet(PROFILE_KEY, JSON.stringify(profile));
}
