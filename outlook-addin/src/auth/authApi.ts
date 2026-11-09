import { createPkcePair, randomState } from './pkce';
import {
  clearSession,
  isAuthenticated,
  markAuthenticated,
  readHubAccessToken,
  setProfile,
  storeHubAccessToken,
  type AuthProfile,
} from './session';
import { getSettings } from '../settings';

function gatewayOrigin(): string {
  const api = getSettings().apiBase.replace(/\/+$/, '');
  if (!api)
    return '';
  try {
    return new URL(api).origin;
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

function loginUrlEndpoint(): string {
  const origin = gatewayOrigin();
  return origin ? `${origin}/api/v1/auth/outlook/login-url` : '';
}

function azureExchangeUrl(): string {
  const origin = gatewayOrigin();
  return origin ? `${origin}/api/v1/auth/azure/exchange` : '';
}

function oauthRedirectUri(): string {
  const base = import.meta.env.BASE_URL || '/';
  return new URL('auth/callback.html', `${window.location.origin}${base}`).href;
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

function outlookEmailHint(): string {
  try {
    return (Office?.context?.mailbox?.userProfile?.emailAddress || '').trim();
  } catch {
    return '';
  }
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

/** Cookie / localStorage Hub token already present in this WebView. */
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
 * Interactive Microsoft login in Outlook WebView.
 * Silent prompt=none does not work here (AADSTS50058 — no Azure cookies in this WebView).
 * login_hint only pre-fills the Outlook mailbox address.
 */
export async function loginWithHub(): Promise<AuthProfile> {
  if (!gatewayOrigin())
    throw new Error('Укажите File Manager API в настройках');

  const { verifier, challenge } = await createPkcePair();
  const state = randomState();
  const redirectUri = oauthRedirectUri();
  const hint = outlookEmailHint();

  const qs = new URLSearchParams({
    redirect_uri: redirectUri,
    state,
  });
  if (hint)
    qs.set('login_hint', hint);

  const metaRes = await fetch(`${loginUrlEndpoint()}?${qs.toString()}`);
  if (!metaRes.ok)
    throw new Error('Не удалось получить URL входа Azure');
  const meta = await metaRes.json() as { authorizeUrl: string };
  const authorize = new URL(meta.authorizeUrl);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  // Never use prompt=none in Outlook WebView — it causes AADSTS50058

  const code = await openOAuthDialog(authorize.toString(), state);
  const exchangeRes = await fetch(azureExchangeUrl(), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      code,
      redirectUri,
      codeVerifier: verifier,
    }),
  });
  if (!exchangeRes.ok) {
    let detail = `HTTP ${exchangeRes.status}`;
    try {
      const body = await exchangeRes.json() as { detail?: string };
      if (body.detail)
        detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  const pair = await exchangeRes.json() as { access_token?: string };
  if (!pair.access_token)
    throw new Error('Пустой ответ exchange');
  storeHubAccessToken(pair.access_token);
  return fetchHubMe();
}

function humanizeOAuthError(raw: string): string {
  const text = (raw || '').trim();
  if (/AADSTS50058/i.test(text) || /silent sign-in/i.test(text))
    return 'Нужен обычный вход (тихий вход в Outlook недоступен). Нажмите «Войти в Kosta Hub».';
  if (/AADSTS65001/i.test(text) || /consent/i.test(text))
    return 'Нужно согласие Azure для приложения Kosta. Нажмите «Войти в Kosta Hub» и подтвердите доступ.';
  if (/login_required|interaction_required|consent_required/i.test(text))
    return 'Microsoft требует подтверждение входа. Нажмите «Войти в Kosta Hub».';
  return text || 'Ошибка входа Microsoft';
}

function openOAuthDialog(authorizeUrl: string, expectedState: string): Promise<string> {
  const bridge = `${hubLoginPageUrl()}?${new URLSearchParams({ azure: authorizeUrl }).toString()}`;

  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = (code: string) => {
      if (settled)
        return;
      settled = true;
      resolve(code);
    };
    const fail = (error: Error) => {
      if (settled)
        return;
      settled = true;
      reject(error);
    };

    const handlePayload = (payload: { code?: string; state?: string; error?: string }) => {
      if (payload.error)
        fail(new Error(humanizeOAuthError(payload.error)));
      else if (payload.code) {
        if (payload.state && payload.state !== expectedState)
          fail(new Error('OAuth state mismatch'));
        else
          ok(payload.code);
      } else {
        fail(new Error('Пустой ответ OAuth'));
      }
    };

    if (typeof Office !== 'undefined' && Office.context?.ui?.displayDialogAsync) {
      Office.context.ui.displayDialogAsync(
        bridge,
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
                code?: string;
                state?: string;
                error?: string;
                ok?: boolean;
              };
              dialog.close();
              handlePayload(payload);
            } catch (error) {
              dialog.close();
              fail(error instanceof Error ? error : new Error(String(error)));
            }
          });
          dialog.addEventHandler(Office.EventType.DialogEventReceived, () => {
            if (isAuthenticated())
              fail(new Error('Окно закрыто после входа — обновите панель'));
            else
              fail(new Error('Окно входа закрыто — войдите ещё раз и дождитесь завершения'));
          });
        },
      );
      return;
    }

    const popup = window.open(bridge, 'kosta-hub-login', 'width=480,height=680');
    if (!popup) {
      fail(new Error('Браузер заблокировал окно входа'));
      return;
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin)
        return;
      const data = event.data as {
        type?: string;
        code?: string;
        state?: string;
        error?: string;
      };
      if (data?.type !== 'kosta-outlook-oauth' && data?.type !== 'kosta-hub-oauth')
        return;
      window.removeEventListener('message', onMessage);
      popup.close();
      handlePayload(data);
    };
    window.addEventListener('message', onMessage);
  });
}
