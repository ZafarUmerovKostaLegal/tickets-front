import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '@shared/i18n';
import { applyPageTitle, isTimerTitleOverrideActive, resolvePageTitleSection } from '@shared/lib/pageTitle';
import { isDesktopApp } from '@shared/lib/initDesktopShell';

export function DocumentTitle() {
    const { pathname, search } = useLocation();
    const { t } = useI18n();

    useLayoutEffect(() => {
        const section = resolvePageTitleSection(pathname, search, t);
        const brandSubtitle = t('brand.subtitle');
        applyPageTitle(section, brandSubtitle);

        if (isTimerTitleOverrideActive() || !isDesktopApp())
            return;

        void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
            if (!isTimerTitleOverrideActive())
                void getCurrentWindow().setTitle(document.title);
        }).catch(() => {
        });
    }, [pathname, search, t]);

    return null;
}
