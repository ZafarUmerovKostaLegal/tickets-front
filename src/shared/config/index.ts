export { routes, getTicketDetailUrl, getUserEditUrl, getProjectDetailUrl, getTimeTrackingNewProjectUrl, getExpensesOpenUrl, } from './routes';
export { getApiBaseUrl, getAuthCallbackUrl, getAzureLoginUrl, getAzureLogoutUrl, getTicketsWsUrl, getNotificationsWsUrl, getChatWsUrl, getAttendanceApiBase, upgradeUrlToPageSecurity, AUTH_ERROR_AUTH_FAILED, isSessionCookieOnly, } from './env';
export { isTauriDesktopClient } from './desktopClient';
export { injectPublicEnv } from './injectPublicEnv';
export {
    APP_BRAND_SUBTITLE,
    APP_BRAND_TITLE,
    APP_INSTALLER_DISPLAY_NAME,
    APP_LOGO_PATH,
    APP_PRODUCT_NAME,
    APP_WINDOW_TITLE,
} from './appBranding';
