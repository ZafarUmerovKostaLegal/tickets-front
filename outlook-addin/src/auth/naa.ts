/**
 * Nested App Authentication: Outlook / Office hands us a token for the account already signed in,
 * so the user never sees a separate Microsoft login.
 *
 * Azure app registration needs the SPA redirect URI `brk-multihub://<add-in host>`
 * (e.g. brk-multihub://tickets.kostalegal.com). Without it the silent call fails and the pane
 * falls back to the dialog login button.
 */
import type { AuthenticationResult, IPublicClientApplication } from '@azure/msal-browser';

export const GRAPH_SCOPES = ['User.Read', 'Mail.Read'];

export type AzureAppInfo = { clientId: string; tenantId: string };

let pcaPromise: Promise<IPublicClientApplication | null> | null = null;
let pcaKey = '';

export function naaSupported(): boolean {
  try {
    return Boolean(Office?.context?.requirements?.isSetSupported?.('NestedAppAuth', '1.1'));
  } catch {
    return false;
  }
}

async function getPca(app: AzureAppInfo): Promise<IPublicClientApplication | null> {
  if (!naaSupported())
    return null;
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
      .catch(() => null);
  }
  return pcaPromise;
}

function usable(result: AuthenticationResult | null | undefined): result is AuthenticationResult {
  return Boolean(result?.accessToken && result.idToken);
}

/** Silent token from the Outlook account. Returns null when NAA is unavailable or needs consent. */
export async function naaTokenSilent(app: AzureAppInfo): Promise<AuthenticationResult | null> {
  const pca = await getPca(app);
  if (!pca)
    return null;
  try {
    const account = pca.getActiveAccount() ?? pca.getAllAccounts()[0];
    const result = await pca.acquireTokenSilent({ scopes: GRAPH_SCOPES, ...(account ? { account } : {}) });
    if (result.account)
      pca.setActiveAccount(result.account);
    return usable(result) ? result : null;
  } catch {
    return null;
  }
}

/** Consent / MFA prompt shown by Outlook itself (one click, no extra Kosta dialog). */
export async function naaTokenInteractive(app: AzureAppInfo): Promise<AuthenticationResult | null> {
  const pca = await getPca(app);
  if (!pca)
    return null;
  try {
    const result = await pca.acquireTokenPopup({ scopes: GRAPH_SCOPES });
    if (result.account)
      pca.setActiveAccount(result.account);
    return usable(result) ? result : null;
  } catch {
    return null;
  }
}
