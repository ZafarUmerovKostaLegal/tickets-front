import { useI18n } from '@shared/i18n';
import type { AppLocale } from '@shared/i18n/types';

const OPTIONS: { locale: AppLocale; labelKey: 'header.languageRu' | 'header.languageEn' }[] = [
    { locale: 'ru', labelKey: 'header.languageRu' },
    { locale: 'en', labelKey: 'header.languageEn' },
];

export function LanguageSwitcher() {
    const { locale, setLocale, t } = useI18n();

    return (
        <div
            className="header-user-menu__lang"
            role="group"
            aria-label={t('header.language')}
            onClick={(e) => e.stopPropagation()}
        >
            <span className="header-user-menu__lang-label">{t('header.language')}</span>
            <div className="header-user-menu__lang-options">
                {OPTIONS.map(({ locale: loc, labelKey }) => (
                    <button
                        key={loc}
                        type="button"
                        className={`header-user-menu__lang-btn${locale === loc ? ' header-user-menu__lang-btn--active' : ''}`}
                        role="menuitemradio"
                        aria-checked={locale === loc}
                        onClick={() => setLocale(loc)}
                    >
                        {t(labelKey)}
                    </button>
                ))}
            </div>
        </div>
    );
}
