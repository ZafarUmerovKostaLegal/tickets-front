import { sendHeartbeat } from './api';
import { currentAuthMethod } from './auth/authApi';
import { ssoState } from './auth/naa';

const CLIENT_KEY = 'kosta.addin.clientId';
const INTERVAL_MS = 5 * 60_000;

function clientId(host: string): string {
  try {
    const saved = localStorage.getItem(CLIENT_KEY);
    if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved))
      return saved;
    const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    const id = `${host}-${random}`.slice(0, 64);
    localStorage.setItem(CLIENT_KEY, id);
    return id;
  } catch {
    return `${host}-session-${Date.now().toString(36)}`;
  }
}

export function officeHost(): string {
  try {
    const host = String(Office?.context?.host ?? '').toLowerCase();
    if (host.includes('outlook'))
      return 'outlook';
    if (host.includes('word'))
      return 'word';
    if (host.includes('excel'))
      return 'excel';
    if (host.includes('powerpoint'))
      return 'powerpoint';
  } catch {
  }
  return 'unknown';
}

export function officePlatform(): string {
  try {
    const platform = String(Office?.context?.platform ?? '').toLowerCase();
    if (platform === 'pc')
      return 'windows';
    if (platform === 'mac')
      return 'mac';
    if (platform === 'officeonline')
      return 'web';
    if (platform === 'ios')
      return 'ios';
    if (platform === 'android')
      return 'android';
  } catch {
  }
  return 'unknown';
}

function officeVersion(): string {
  try {
    return String(Office?.context?.diagnostics?.version ?? '').slice(0, 40);
  } catch {
    return '';
  }
}

export function startPresence(): () => void {
  const host = officeHost();
  const beat = () => {
    if (document.visibilityState === 'hidden')
      return;
    const sso = ssoState();
    void sendHeartbeat({
      clientId: clientId(host),
      host,
      platform: officePlatform(),
      officeVersion: officeVersion(),
      addinVersion: import.meta.env.VITE_ADDIN_VERSION || '',
      authMethod: currentAuthMethod(),
      ssoStatus: sso.status,
      ssoError: sso.error,
    }).catch(() => undefined);
  };
  beat();
  const timer = window.setInterval(beat, INTERVAL_MS);
  const onVisible = () => {
    if (document.visibilityState === 'visible')
      beat();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
