import type { AuthenticationResult, IPublicClientApplication } from '@azure/msal-browser';

export const GRAPH_SCOPES = ['User.Read', 'Mail.Read'];

export type AzureAppInfo = { clientId: string; tenantId: string };

export type SsoStatus = 'ok' | 'unsupported' | 'failed' | 'consent' | 'unknown';

let pcaPromise: Promise<IPublicClientApplication | null> | null = null;
let pcaKey = '';
let lastStatus: SsoStatus = 'unknown';
let lastError = '';

export function ssoState(): { status: SsoStatus; error: string } {
  return { status: lastStatus, error: lastError };
}

function remember(status: SsoStatus, error = ''): void {
  lastStatus = status;
  lastError = error.slice(0, 300);
}

function describe(error: unknown): { status: SsoStatus; text: string } {
  const code = String((error as { errorCode?: unknown })?.errorCode ?? '').trim();
  const message = String((error as { errorMessage?: unknown; message?: unknown })?.errorMessage
    ?? (error as { message?: unknown })?.message ?? error ?? '').trim();
  const text = [code, message].filter(Boolean).join(': ') || 'unknown error';
  const consent = /interaction_required|consent_required|login_required|no_account|AADSTS65001/i.test(text);
  return { status: consent ? 'consent' : 'failed', text };
}

let hostBridge = false;

export function enableHostAuthBridge(on: boolean): void {
  hostBridge = on;
}

export function naaSupported(): boolean {
  if (hostBridge)
    return true;
  try {
    return Boolean(Office?.context?.requirements?.isSetSupported?.('NestedAppAuth', '1.1'));
  } catch {
    return false;
  }
}

async function getPca(app: AzureAppInfo): Promise<IPublicClientApplication | null> {
  if (!naaSupported()) {
    remember('unsupported', 'NestedAppAuth 1.1 is not supported by this Office');
    return null;
  }
  const key = `${app.tenantId}|${app.clientId}`;
  if (!pcaPromise || pcaKey !== key) {
    pcaKey = key;
    pcaPromise = import('@azure/msal-browser')
      .then(({ createNestablePublicClientApplication }) => createNestablePublicClientApplication({
        auth: {
          clientId: app.clientId,
          authority: `https://login.microsoftonline.com/${app.tenantId}`,
        },
        cache: { cacheLocation: 'localStorage' },
      }))
      .catch((error: unknown) => {
        remember('failed', describe(error).text);
        return null;
      });
  }
  return pcaPromise;
}

function usable(result: AuthenticationResult | null | undefined): result is AuthenticationResult {
  return Boolean(result?.accessToken && result.idToken);
}

export async function naaTokenSilent(app: AzureAppInfo): Promise<AuthenticationResult | null> {
  const pca = await getPca(app);
  if (!pca)
    return null;
  try {
    const account = pca.getActiveAccount() ?? pca.getAllAccounts()[0];
    const result = await pca.acquireTokenSilent({ scopes: GRAPH_SCOPES, ...(account ? { account } : {}) });
    if (result.account)
      pca.setActiveAccount(result.account);
    if (!usable(result)) {
      remember('failed', 'Empty token from Office');
      return null;
    }
    remember('ok');
    return result;
  } catch (error) {
    const { status, text } = describe(error);
    remember(status, text);
    return null;
  }
}

export async function naaTokenInteractive(app: AzureAppInfo): Promise<AuthenticationResult | null> {
  const pca = await getPca(app);
  if (!pca)
    return null;
  try {
    const result = await pca.acquireTokenPopup({ scopes: GRAPH_SCOPES });
    if (result.account)
      pca.setActiveAccount(result.account);
    if (!usable(result)) {
      remember('failed', 'Empty token from Office');
      return null;
    }
    remember('ok');
    return result;
  } catch (error) {
    remember('failed', describe(error).text);
    return null;
  }
}

export function ssoProblem(): string {
  const { status, error } = ssoState();
  if (status === 'ok' || status === 'unknown')
    return '';
  if (status === 'unsupported')
    return 'Эта версия Office не поддерживает единый вход. Обновите Microsoft 365 (Outlook и Office версии 2409 и новее).';
  if (/AADSTS50011|redirect.?uri/i.test(error))
    return `В Azure у приложения Kosta не добавлен адрес brk-multihub://${window.location.host} (платформа «Single-page application»). Его добавляет администратор.`;
  if (/AADSTS65001|AADSTS65004|consent/i.test(error))
    return 'Нужно один раз разрешить вход: нажмите «Войти через Microsoft». Если Office просит согласие администратора — его даёт администратор в Azure.';
  if (/AADSTS700016|AADSTS90002/i.test(error))
    return 'Office не нашёл приложение Kosta в Azure — сообщите администратору.';
  if (status === 'consent')
    return 'Office просит подтвердить вход: нажмите «Войти через Microsoft» один раз — дальше остальные программы войдут сами.';
  return 'Office не выдал вход автоматически — сообщите администратору текст ниже.';
}
