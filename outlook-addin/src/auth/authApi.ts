import {
  naaTokenInteractive,
  naaTokenSilent,
  usesExternalDialogAuth,
  type AzureAppInfo,
} from './naa';
import { createPkcePair, randomState } from './pkce';
import {
  clearSession,
  isAuthenticated,
  markAuthenticated,
  readAzureAccessToken,
  readHubAccessToken,
  setProfile,
  storeAzureAccessToken,
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

function azureBootstrapUrl(): string {
  const origin = gatewayOrigin();
  return origin ? `${origin}/api/v1/auth/azure/bootstrap` : '';
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
    }
  }
  clearSession();
}

const AZURE_APP_KEY = 'kosta.addin.azureApp';

function readCachedAzureApp(): AzureAppInfo | null {
  try {
    const raw = localStorage.getItem(AZURE_APP_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<AzureAppInfo> : null;
    return parsed?.clientId && parsed.tenantId ? { clientId: parsed.clientId, tenantId: parsed.tenantId } : null;
  } catch {
    return null;
  }
}

type LoginMeta = { authorizeUrl: string; clientId?: string; tenantId?: string };

async function fetchLoginMeta(params: Record<string, string>): Promise<LoginMeta> {
  const qs = new URLSearchParams({ redirect_uri: oauthRedirectUri(), ...params });
  const response = await fetch(`${loginUrlEndpoint()}?${qs.toString()}`);
  if (!response.ok)
    throw new Error('Не удалось получить URL входа Azure');
  return await response.json() as LoginMeta;
}

function appFromMeta(meta: LoginMeta): AzureAppInfo {
  const authorize = new URL(meta.authorizeUrl);
  const clientId = meta.clientId || authorize.searchParams.get('client_id') || '';
  const tenantId = meta.tenantId || authorize.pathname.split('/')[1] || '';
  if (!clientId || !tenantId)
    throw new Error('В ответе login-url нет clientId/tenantId — задеплойте back');
  return { clientId, tenantId };
}

async function azureApp(): Promise<AzureAppInfo> {
  const cached = readCachedAzureApp();
  if (cached)
    return cached;
  const app = appFromMeta(await fetchLoginMeta({ state: 'naa' }));
  try {
    localStorage.setItem(AZURE_APP_KEY, JSON.stringify(app));
  } catch {
  }
  return app;
}

async function bootstrapHub(accessToken: string, idToken: string, expiresInSec: number): Promise<AuthProfile> {
  const response = await fetch(azureBootstrapUrl(), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ accessToken, idToken }),
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json() as { detail?: string };
      if (body.detail)
        detail = body.detail;
    } catch {
    }
    throw new Error(response.status === 403 ? 'Учётная запись заблокирована в Kosta Hub' : detail);
  }
  const pair = await response.json() as { access_token?: string };
  if (!pair.access_token)
    throw new Error('Пустой ответ bootstrap');
  storeHubAccessToken(pair.access_token);
  storeAzureAccessToken(accessToken, expiresInSec);
  return fetchHubMe();
}

function secondsLeft(expiresOn: Date | null | undefined): number {
  return expiresOn ? Math.max(60, Math.round((expiresOn.getTime() - Date.now()) / 1000)) : 3600;
}

export type AuthMethod = 'token' | 'cookie' | 'sso' | 'dialog' | 'zoom' | 'unknown';

let authMethod: AuthMethod = 'unknown';

export function currentAuthMethod(): AuthMethod {
  return authMethod;
}

async function hubSession(): Promise<AuthProfile | null> {
  const hadToken = Boolean(readHubAccessToken());
  try {
    const me = await fetchHubMe();
    authMethod = hadToken ? 'token' : 'cookie';
    return me;
  } catch {
    return null;
  }
}

async function officeSso(): Promise<AuthProfile | null> {
  try {
    const result = await naaTokenSilent(await azureApp());
    if (!result)
      return null;
    const me = await bootstrapHub(result.accessToken, result.idToken, secondsLeft(result.expiresOn));
    authMethod = 'sso';
    return me;
  } catch {
    return null;
  }
}

let silentInFlight: Promise<AuthProfile | null> | null = null;

export function signInSilently(options: { force?: boolean } = {}): Promise<AuthProfile | null> {
  if (silentInFlight)
    return silentInFlight;
  silentInFlight = (async () => {
    if (!gatewayOrigin())
      return null;
    if (!options.force) {
      const me = await hubSession();
      if (me)
        return me;
    }
    // Teams: nestable MSAL hits OneAuth 2400 — skip and use host dialog instead.
    if (!usesExternalDialogAuth()) {
      const sso = await officeSso();
      if (sso)
        return sso;
    }
    if (options.force) {
      storeHubAccessToken('');
      return hubSession();
    }
    return null;
  })().finally(() => {
    silentInFlight = null;
  });
  return silentInFlight;
}

export async function signInWithZoomCode(code: string, codeVerifier: string): Promise<AuthProfile> {
  const origin = gatewayOrigin();
  if (!origin)
    throw new Error('Не задан адрес Kosta Hub');
  const response = await fetch(`${origin}/api/v1/auth/outlook/zoom/bootstrap`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ code, codeVerifier }),
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json() as { detail?: string };
      if (body.detail)
        detail = body.detail;
    } catch {
    }
    throw new Error(detail);
  }
  const pair = await response.json() as { access_token?: string };
  if (!pair.access_token)
    throw new Error('Пустой ответ сервера');
  storeHubAccessToken(pair.access_token);
  authMethod = 'zoom';
  return fetchHubMe();
}

export async function getGraphToken(): Promise<string | null> {
  const cached = readAzureAccessToken();
  if (cached)
    return cached;
  try {
    const result = await naaTokenSilent(await azureApp());
    if (!result)
      return null;
    storeAzureAccessToken(result.accessToken, secondsLeft(result.expiresOn));
    return result.accessToken;
  } catch {
    return null;
  }
}

export async function loginWithHub(): Promise<AuthProfile> {
  if (!gatewayOrigin())
    throw new Error('Укажите File Manager API в настройках');
  // In Teams the nestable MSAL popup hits OneAuth 2400 and closes immediately.
  // Go straight to the host auth dialog (Teams authentication.authenticate).
  if (!usesExternalDialogAuth()) {
    try {
      const result = await naaTokenInteractive(await azureApp());
      if (result) {
        const me = await bootstrapHub(result.accessToken, result.idToken, secondsLeft(result.expiresOn));
        authMethod = 'sso';
        return me;
      }
    } catch {
    }
  }
  const me = await loginWithDialog();
  authMethod = 'dialog';
  return me;
}

async function loginWithDialog(): Promise<AuthProfile> {
  const { verifier, challenge } = await createPkcePair();
  const state = officeDialogAvailable() ? randomState() : `${RELAY_PREFIX}${randomState()}${randomState()}`;
  const redirectUri = oauthRedirectUri();
  const hint = outlookEmailHint();

  const meta = await fetchLoginMeta(hint ? { state, login_hint: hint } : { state });
  const { clientId, tenantId } = appFromMeta(meta);
  const authorize = new URL(meta.authorizeUrl);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');

  const code = await openOAuthDialog(authorize.toString(), state);

  const azureTokens = await redeemSpaCodeInBrowser({
    tenantId,
    clientId,
    code,
    redirectUri,
    codeVerifier: verifier,
  });
  if (!azureTokens.id_token)
    throw new Error('Microsoft не вернул id_token — войдите снова');
  return bootstrapHub(azureTokens.access_token, azureTokens.id_token, azureTokens.expires_in || 3600);
}

const AZURE_SCOPES = 'openid profile email offline_access User.Read Mail.Read';

async function redeemSpaCodeInBrowser(input: {
  tenantId: string;
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ access_token: string; id_token?: string; expires_in?: number }> {
  const tokenUrl = `https://login.microsoftonline.com/${input.tenantId}/oauth2/v2.0/token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: input.clientId,
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
      scope: AZURE_SCOPES,
    }),
  });
  const payload = await response.json() as {
    access_token?: string;
    id_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(
      humanizeOAuthError(payload.error_description || payload.error || `HTTP ${response.status}`),
    );
  }
  return {
    access_token: payload.access_token,
    id_token: payload.id_token,
    expires_in: payload.expires_in,
  };
}

function humanizeOAuthError(raw: string): string {
  const text = (raw || '').trim();
  if (/AADSTS9002327/i.test(text) || /Single-Page Application/i.test(text))
    return 'SPA redirect: код Azure нужно обменивать в браузере. Задеплойте обновлённый front+back и войдите снова.';
  if (/AADSTS50058/i.test(text) || /silent sign-in/i.test(text))
    return 'Нужен обычный вход (тихий вход в Outlook недоступен). Нажмите «Войти в Kosta Hub».';
  if (/AADSTS65001/i.test(text) || /consent/i.test(text))
    return 'Нужно согласие Azure для приложения Kosta. Нажмите «Войти в Kosta Hub» и подтвердите доступ.';
  if (/login_required|interaction_required|consent_required/i.test(text))
    return 'Microsoft требует подтверждение входа. Нажмите «Войти в Kosta Hub».';
  return text || 'Ошибка входа Microsoft';
}

const OAUTH_AUTHORIZE_KEY = 'kosta.outlook.oauth.authorize';
const RELAY_PREFIX = 'tr.';

function officeDialogAvailable(): boolean {
  return typeof Office !== 'undefined' && Boolean(Office.context?.ui?.displayDialogAsync);
}

type RelayPayload = { type?: string; code?: string; state?: string; error?: string };

async function takeRelay(state: string): Promise<RelayPayload | null> {
  try {
    const response = await fetch(`${gatewayOrigin()}/api/v1/auth/outlook/relay?${new URLSearchParams({ state }).toString()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.status !== 200)
      return null;
    const data = await response.json() as RelayPayload;
    return { type: 'kosta-outlook-oauth', code: data.code || '', state: data.state || state, error: data.error || '' };
  } catch {
    return null;
  }
}

function openOAuthDialog(authorizeUrl: string, expectedState: string): Promise<string> {
  try {
    localStorage.setItem(OAUTH_AUTHORIZE_KEY, authorizeUrl);
  } catch {
  }
  const bridge = hubLoginPageUrl();

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

    const handlePayload = (payload: {
      type?: string;
      code?: string;
      state?: string;
      error?: string;
    }) => {
      if (payload.type === 'kosta-outlook-ready')
        return false;
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
      return true;
    };

    const sendAuthorizeToDialog = (dialog: Office.Dialog) => {
      const payload = JSON.stringify({ authorizeUrl });
      const anyDialog = dialog as Office.Dialog & {
        messageChild?: (message: string, options?: object) => void;
      };
      try {
        if (typeof anyDialog.messageChild === 'function') {
          anyDialog.messageChild(payload);
          return true;
        }
      } catch {
      }
      return false;
    };

    if (officeDialogAvailable()) {
      Office.context.ui.displayDialogAsync(
        bridge,
        { height: 65, width: 42, displayInIframe: false },
        (result) => {
          if (result.status !== Office.AsyncResultStatus.Succeeded) {
            fail(result.error ?? new Error('Не удалось открыть окно входа. Если был запрос Allow — нажмите Allow.'));
            return;
          }
          const dialog = result.value;
          let pushes = 0;
          const push = () => {
            if (settled || pushes > 8)
              return;
            pushes += 1;
            sendAuthorizeToDialog(dialog);
          };
          push();
          const pushTimer = window.setInterval(push, 500);

          dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => {
            try {
              const payload = JSON.parse((arg as { message: string }).message) as {
                type?: string;
                code?: string;
                state?: string;
                error?: string;
              };
              if (payload.type === 'kosta-outlook-ready') {
                push();
                return;
              }
              window.clearInterval(pushTimer);
              dialog.close();
              handlePayload(payload);
            } catch (error) {
              window.clearInterval(pushTimer);
              dialog.close();
              fail(error instanceof Error ? error : new Error(String(error)));
            }
          });
          dialog.addEventHandler(Office.EventType.DialogEventReceived, () => {
            window.clearInterval(pushTimer);
            if (isAuthenticated())
              fail(new Error('Окно закрыто после входа — обновите панель'));
            else
              fail(new Error('Окно входа закрыто. Если был белый диалог — нажмите Allow, затем «Войти» снова.'));
          });
        },
      );
      return;
    }

    // Teams only accepts authenticate() URLs on domains from the app manifest (validDomains).
    // login.microsoftonline.com as the start URL → "Auth url is not valid".
    // Start on our hub-login page (tickets.kostalegal.com), then redirect to Azure from there.
    const withAzure = `${hubLoginPageUrl()}?${new URLSearchParams({ azure: authorizeUrl }).toString()}`;
    // Prefer short URL + localStorage when the query would be huge (some Teams builds reject long auth URLs).
    const teamsAuthUrl = withAzure.length <= 1800 ? withAzure : hubLoginPageUrl();

    let relayTimer = 0;
    let relayStop = 0;
    if (expectedState.startsWith(RELAY_PREFIX)) {
      const deadline = Date.now() + 5 * 60_000;
      const poll = async () => {
        if (settled || Date.now() > deadline)
          return;
        const relayed = await takeRelay(expectedState);
        if (relayed && !settled) {
          handlePayload(relayed);
          return;
        }
        if (relayStop && Date.now() > relayStop) {
          fail(new Error('Вход не завершён: окно Microsoft закрылось. Нажмите «Войти через Microsoft» снова и дождитесь возврата в Kosta File.'));
          return;
        }
        relayTimer = window.setTimeout(() => void poll(), 1200);
      };
      relayTimer = window.setTimeout(() => void poll(), 1500);
    }
    const waitRelay = (error: Error) => {
      if (!relayTimer || settled) {
        fail(error);
        return;
      }
      relayStop = Date.now() + 6000;
    };

    void (async () => {
      try {
        const { authentication } = await import('@microsoft/teams-js');
        const raw = await authentication.authenticate({
          url: teamsAuthUrl,
          width: 520,
          height: 720,
        });
        let payload: { type?: string; code?: string; state?: string; error?: string };
        if (typeof raw === 'string' && raw.startsWith('{'))
          payload = JSON.parse(raw) as typeof payload;
        else if (typeof raw === 'string' && raw.length > 8)
          payload = { type: 'kosta-outlook-oauth', code: raw, state: expectedState };
        else
          throw new Error('Пустой ответ окна входа Teams');
        handlePayload(payload);
        return;
      } catch (error) {
        const text = String((error as { message?: unknown })?.message ?? error ?? '');
        if (/auth url is not valid/i.test(text)) {
          fail(new Error(
            'Teams не принял URL входа. Обновите приложение пакетом KostaFile.Teams.zip (в validDomains должен быть tickets.kostalegal.com).',
          ));
          return;
        }
        if (/cancelled|canceled|user_cancelled|user canceled/i.test(text)) {
          waitRelay(new Error(
            'Вход не завершён: окно Microsoft закрылось. Нажмите «Войти через Microsoft» снова и дождитесь возврата в Kosta File.',
          ));
          return;
        }
        if (usesExternalDialogAuth() && text) {
          waitRelay(new Error(humanizeOAuthError(text) || 'Не удалось открыть вход Teams'));
          return;
        }
      }

      const popup = window.open(withAzure, 'kosta-hub-login', 'width=480,height=680');
      if (!popup) {
        fail(new Error(
          'Не удалось открыть окно входа. Разрешите всплывающие окна или обновите приложение Kosta File в Teams.',
        ));
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
        if (data?.type === 'kosta-outlook-ready')
          return;
        if (data?.type !== 'kosta-outlook-oauth' && data?.type !== 'kosta-hub-oauth')
          return;
        window.removeEventListener('message', onMessage);
        popup.close();
        handlePayload(data);
      };
      window.addEventListener('message', onMessage);
    })();
  });
}
