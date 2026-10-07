import { closeTicketsWs } from '@entities/ticket/ticketsWs';
import { resetNotificationsClient } from '@entities/notification/wsClient';
import { getApiBaseUrl, getAzureLogoutUrl, getAzureLoginUrl, isSessionCookieOnly } from '@shared/config';
import { clearClientSessionSecrets } from './authSessionCleanup';
const TOKEN_KEY = 'access_token';
const SESSION_COOKIE_HINT = 'kl_session_cookie_ok';
export function setSessionCookieHint(active) {
    if (active) {
        localStorage.setItem(SESSION_COOKIE_HINT, '1');
    }
    else {
        localStorage.removeItem(SESSION_COOKIE_HINT);
    }
}
export function hasSessionCookieHint() {
    return localStorage.getItem(SESSION_COOKIE_HINT) === '1';
}
export function getAccessToken() {
    if (isSessionCookieOnly()) {
        localStorage.removeItem(TOKEN_KEY);
        return null;
    }
    return localStorage.getItem(TOKEN_KEY);
}
export function setAccessToken(token) {
    if (isSessionCookieOnly()) {
        localStorage.removeItem(TOKEN_KEY);
        return;
    }
    localStorage.setItem(TOKEN_KEY, token);
}
export function removeAccessToken() {
    localStorage.removeItem(TOKEN_KEY);
}
export function isAuthenticated() {
    if (getAccessToken())
        return true;
    if (hasSessionCookieHint())
        return true;
    return false;
}
export async function logout() {
    try {
        closeTicketsWs();
    }
    catch {
    }
    try {
        resetNotificationsClient();
    }
    catch {
    }
    try {
        const { disableChatBrowserPush } = await import('@entities/chat/lib/chatBrowserPush');
        await disableChatBrowserPush();
    }
    catch {
    }
    const base = getApiBaseUrl();
    if (isSessionCookieOnly() && base) {
        try {
            await fetch(`${base.replace(/\/+$/, '')}/api/v1/auth/azure/session/logout`, {
                method: 'POST',
                credentials: 'include',
            });
        }
        catch {
        }
    }
    removeAccessToken();
    setSessionCookieHint(false);
    clearClientSessionSecrets();
    const azureLogoutUrl = getAzureLogoutUrl();
    if (azureLogoutUrl) {
        window.location.href = azureLogoutUrl;
    }
    else {
        window.location.href = getAzureLoginUrl() || '/';
    }
}
