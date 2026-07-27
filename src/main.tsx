import './processPolyfill';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@app';
import { RootErrorBoundary } from '@app/ui/RootErrorBoundary';
import { I18nProvider } from '@shared/i18n';
import { injectPublicEnv } from '@shared/config';
import { initDesktopShell } from '@shared/lib/initDesktopShell';
import { reconcileDesktopAuthCallbackLocation } from '@shared/lib/desktopAuth';
import { initSafeAreaInsets } from '@shared/lib/safeAreaInsets';
import { applyDocumentLocale, getInitialLocale } from '@shared/i18n';
import { applyTheme, getInitialTheme } from '@shared/lib/theme';
import { installStaleBundleReload, stripLegacyReloadQueryParams } from '@app/lib/staleBundleError';
import { installGlobalErrorReporting } from '@shared/lib/clientErrorReporter';
injectPublicEnv();
installGlobalErrorReporting();
stripLegacyReloadQueryParams();
installStaleBundleReload();
if (!reconcileDesktopAuthCallbackLocation()) {
    applyTheme(getInitialTheme());
    applyDocumentLocale(getInitialLocale());
    initSafeAreaInsets();
    void initDesktopShell();
    const root = document.getElementById('root');
    if (!root)
        throw new Error('Root element not found');
    createRoot(root).render(
        <StrictMode>
            <RootErrorBoundary>
                <I18nProvider>
                    <App />
                </I18nProvider>
            </RootErrorBoundary>
        </StrictMode>,
    );
}
