import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useI18n } from '@shared/i18n';
const OPTIONS = [
    { locale: 'ru', labelKey: 'header.languageRu' },
    { locale: 'en', labelKey: 'header.languageEn' },
];
export function LanguageSwitcher() {
    const { locale, setLocale, t } = useI18n();
    return (_jsxs("div", { className: "header-user-menu__lang", role: "group", "aria-label": t('header.language'), onClick: (e) => e.stopPropagation(), children: [_jsx("span", { className: "header-user-menu__lang-label", children: t('header.language') }), _jsx("div", { className: "header-user-menu__lang-options", children: OPTIONS.map(({ locale: loc, labelKey }) => (_jsx("button", { type: "button", className: `header-user-menu__lang-btn${locale === loc ? ' header-user-menu__lang-btn--active' : ''}`, role: "menuitemradio", "aria-checked": locale === loc, onClick: () => setLocale(loc), children: t(labelKey) }, loc))) })] }));
}
