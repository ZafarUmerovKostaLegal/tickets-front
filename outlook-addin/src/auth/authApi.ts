import { createPkcePair, randomState } from './pkce';
import {
  clearSession,
  getAccessToken,
  getDeviceId,
  readRefreshToken,
  setProfile,
  setSession,
  type AuthProfile,
} from './session';
import { getSettings } from '../settings';

type TokenPair = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
};

function authBase(): string {
  const configured = getSettings().authBase.replace(/\/+$/, '');
  if (configured)
    return configured;
  const api = getSettings().apiBase.replace(/\/+$/, '');
  if (api.endsWith('/files'))
    return api.slice(0, -'/files'.length) + '/auth/outlook';
  if (api.includes('/api/v1/'))
    return api.replace(/\/api\/v1\/.*$/, '/api/v1/auth/outlook');
  return '';
}

function redirectUri(): string {
  // Vite base is /outlook-addin/ in prod (same Hub domain)
  const base = import.meta.env.BASE_URL || '/';
  return new URL('auth/callback.html', `${window.location.origin}${base}`).href;
}

async function postJson<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const root = authBase();
  if (!root)
    throw new Error('Укажите Auth URL (например https://hub.example.com/api/v1/auth/outlook)');
  const response = await fetch(`${root}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const data = await response.json() as { detail?: string };
      if (data.detail)
        detail = data.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (response.status === 204)
    return undefined as T;
  return await response.json() as T;
}

export async function refreshAccessToken(): Promise<string> {
  const refresh = await readRefreshToken();
  if (!refresh)
    throw new Error('Нет refresh token — войдите снова');
  const deviceId = getDeviceId();
  const pair = await postJson<TokenPair>('/refresh', {
    refreshToken: refresh,
    deviceId,
  }, { 'X-Outlook-Device-Id': deviceId });
  await setSession(pair);
  return pair.access_token;
}

export async function ensureAccessToken(): Promise<string> {
  const current = getAccessToken();
  if (current)
    return current;
  return refreshAccessToken();
}

export async function fetchOutlookMe(accessToken?: string): Promise<AuthProfile> {
  const root = authBase();
  const token = accessToken || await ensureAccessToken();
  const response = await fetch(`${root}/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Outlook-Device-Id': getDeviceId(),
    },
  });
  if (!response.ok)
    throw new Error('Не удалось загрузить профиль');
  const data = await response.json() as { id: number; email: string; display_name?: string };
  const profile = {
    id: data.id,
    email: data.email,
    displayName: data.display_name || data.email,
  };
  setProfile(profile);
  return profile;
}

export async function logoutOutlook(): Promise<void> {
  try {
    const token = getAccessToken();
    if (token) {
      await postJson('/logout', {}, {
        Authorization: `Bearer ${token}`,
        'X-Outlook-Device-Id': getDeviceId(),
      });
    }
  } catch {
    /* still clear local */
  }
  clearSession();
}

/**
 * Open Azure login in Office dialog (or window), exchange code for outlook tokens.
 */
export async function loginWithMicrosoft(): Promise<AuthProfile> {
  const root = authBase();
  if (!root)
    throw new Error('Сначала укажите Auth / API URL в настройках');

  const { verifier, challenge } = await createPkcePair();
  const state = randomState();
  sessionStorage.setItem('kosta.outlook.pkce', JSON.stringify({ verifier, state }));

  const loginMeta = await fetch(
    `${root}/login-url?${new URLSearchParams({ redirect_uri: redirectUri(), state })}`,
  );
  if (!loginMeta.ok)
    throw new Error('Не удалось получить URL входа Azure');
  const { authorizeUrl } = await loginMeta.json() as { authorizeUrl: string };
  const url = new URL(authorizeUrl);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  const code = await openLoginDialog(url.toString(), state);
  const pair = await postJson<TokenPair>('/exchange', {
    code,
    redirectUri: redirectUri(),
    codeVerifier: verifier,
    deviceId: getDeviceId(),
  });
  await setSession(pair);
  return fetchOutlookMe(pair.access_token);
}

function openLoginDialog(authorizeUrl: string, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const finish = (code: string, state: string) => {
      if (state && state !== expectedState) {
        reject(new Error('OAuth state mismatch'));
        return;
      }
      resolve(code);
    };

    if (typeof Office !== 'undefined' && Office.context?.ui?.displayDialogAsync) {
      Office.context.ui.displayDialogAsync(
        authorizeUrl,
        { height: 60, width: 40 },
        (result) => {
          if (result.status !== Office.AsyncResultStatus.Succeeded) {
            reject(result.error ?? new Error('Dialog failed'));
            return;
          }
          const dialog = result.value;
          dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => {
            try {
              const payload = JSON.parse((arg as { message: string }).message) as {
                code?: string;
                state?: string;
                error?: string;
              };
              dialog.close();
              if (payload.error)
                reject(new Error(payload.error));
              else if (payload.code)
                finish(payload.code, payload.state || '');
              else
                reject(new Error('Пустой ответ OAuth'));
            } catch (error) {
              dialog.close();
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          });
          dialog.addEventHandler(Office.EventType.DialogEventReceived, () => {
            reject(new Error('Окно входа закрыто'));
          });
        },
      );
      return;
    }

    const popup = window.open(authorizeUrl, 'kosta-outlook-login', 'width=480,height=640');
    if (!popup) {
      reject(new Error('Браузер заблокировал окно входа'));
      return;
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin)
        return;
      const data = event.data as { type?: string; code?: string; state?: string; error?: string };
      if (data?.type !== 'kosta-outlook-oauth')
        return;
      window.removeEventListener('message', onMessage);
      popup.close();
      if (data.error)
        reject(new Error(data.error));
      else if (data.code)
        finish(data.code, data.state || '');
      else
        reject(new Error('Пустой ответ OAuth'));
    };
    window.addEventListener('message', onMessage);
  });
}
