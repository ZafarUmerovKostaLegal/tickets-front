import {
  clearSession,
  isAuthenticated,
  markAuthenticated,
  readHubAccessToken,
  setProfile,
  type AuthProfile,
} from './session';
import { getSettings } from '../settings';

function gatewayOrigin(): string {
  const api = getSettings().apiBase.replace(/\/+$/, '');
  if (!api)
    return '';
  try {
    const url = new URL(api);
    return url.origin;
  } catch {
    return '';
  }
}

function usersMeUrl(): string {
  const origin = gatewayOrigin();
  return origin ? `${origin}/api/v1/users/me` : '';
}

function sessionLogoutUrl(): string {
  const origin = gatewayOrigin();
  return origin ? `${origin}/api/v1/auth/azure/session/logout` : '';
}

function azureLoginUrl(): string {
  const origin = gatewayOrigin();
  return origin ? `${origin}/api/v1/auth/azure/login` : '';
}

function hubLoginPageUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return new URL('auth/hub-login.html', `${window.location.origin}${base}`).href;
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = readHubAccessToken();
  if (token)
    headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchHubMe(): Promise<AuthProfile> {
  const url = usersMeUrl();
  if (!url)
    throw new Error('Укажите File Manager API в настройках');
  const response = await fetch(url, {
    credentials: 'include',
    headers: authHeaders(),
  });
  if (!response.ok)
    throw new Error(response.status === 401 ? 'Нет сессии Hub' : `HTTP ${response.status}`);
  const data = await response.json() as {
    id: number;
    email: string;
    display_name?: string;
    displayName?: string;
  };
  const profile: AuthProfile = {
    id: data.id,
    email: data.email,
    displayName: data.display_name || data.displayName || data.email,
  };
  markAuthenticated(profile);
  setProfile(profile);
  return profile;
}

/** Restore Hub session (cookie / same-origin token) if already logged in. */
export async function ensureHubSession(): Promise<boolean> {
  try {
    await fetchHubMe();
    return true;
  } catch {
    clearSession();
    return false;
  }
}

export async function logoutHub(): Promise<void> {
  const url = sessionLogoutUrl();
  if (url) {
    try {
      await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
      });
    } catch {
      /* still clear local */
    }
  }
  clearSession();
}

/**
 * Same Hub Microsoft login as the website (session cookie on ticketsback).
 * No separate Outlook token family.
 */
export async function loginWithHub(): Promise<AuthProfile> {
  if (!gatewayOrigin())
    throw new Error('Укажите File Manager API в настройках');
  const loginPage = hubLoginPageUrl();
  const params = new URLSearchParams({
    azure: azureLoginUrl(),
    done: new URL('auth/hub-done.html', `${window.location.origin}${import.meta.env.BASE_URL || '/'}`).href,
  });
  try {
    await openHubLoginDialog(`${loginPage}?${params.toString()}`);
  } catch (error) {
    // Cookie may already be set even if dialog closed without messageParent
    if (await ensureHubSession())
      return fetchHubMe();
    throw error;
  }
  return fetchHubMe();
}

function openHubLoginDialog(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = () => {
      if (settled)
        return;
      settled = true;
      resolve();
    };
    const fail = (error: Error) => {
      if (settled)
        return;
      settled = true;
      reject(error);
    };

    if (typeof Office !== 'undefined' && Office.context?.ui?.displayDialogAsync) {
      Office.context.ui.displayDialogAsync(
        url,
        { height: 65, width: 42, displayInIframe: false },
        (result) => {
          if (result.status !== Office.AsyncResultStatus.Succeeded) {
            fail(result.error ?? new Error('Не удалось открыть окно входа'));
            return;
          }
          const dialog = result.value;
          dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => {
            try {
              const payload = JSON.parse((arg as { message: string }).message) as {
                ok?: boolean;
                error?: string;
              };
              dialog.close();
              if (payload.error)
                fail(new Error(payload.error));
              else if (payload.ok)
                ok();
              else
                fail(new Error('Пустой ответ входа'));
            } catch (error) {
              dialog.close();
              fail(error instanceof Error ? error : new Error(String(error)));
            }
          });
          dialog.addEventHandler(Office.EventType.DialogEventReceived, () => {
            // User closed dialog — parent will probe session next
            if (isAuthenticated())
              ok();
            else
              fail(new Error('Окно входа закрыто'));
          });
        },
      );
      return;
    }

    const popup = window.open(url, 'kosta-hub-login', 'width=480,height=680');
    if (!popup) {
      reject(new Error('Браузер заблокировал окно входа'));
      return;
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin)
        return;
      const data = event.data as { type?: string; ok?: boolean; error?: string };
      if (data?.type !== 'kosta-hub-oauth')
        return;
      window.removeEventListener('message', onMessage);
      popup.close();
      if (data.error)
        reject(new Error(data.error));
      else if (data.ok)
        resolve();
      else
        reject(new Error('Пустой ответ входа'));
    };
    window.addEventListener('message', onMessage);
  });
}
