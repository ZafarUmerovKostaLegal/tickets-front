import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState, useEffect } from 'react';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { IconCalendarCheck, IconFileText, IconTicket, IconWallet, } from '@widgets/sidebar/ui/SidebarIcons';
import './RulesPage.css';
const RULES_META = [
    { id: 'createTicket', icon: IconTicket, color: 'blue' },
    { id: 'description', icon: IconFileText, color: 'violet' },
    { id: 'priority', icon: IconTicket, color: 'green' },
    { id: 'attachments', icon: IconFileText, color: 'orange' },
    { id: 'expenseRequest', icon: IconWallet, color: 'blue' },
    { id: 'vacationRequest', icon: IconCalendarCheck, color: 'violet' },
];
const SKELETON_CARD_COUNT = RULES_META.length;
function sectionKey(id, field) {
    return `rulesPage.sections.${id}.${field}`;
}
export function RulesPage() {
    const { t } = useI18n();
    const [loading, setLoading] = useState(true);
    const rulesSections = useMemo(() => RULES_META.map((section) => ({
        ...section,
        title: t(sectionKey(section.id, 'title')),
        text: t(sectionKey(section.id, 'text')),
    })), [t]);
    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 450);
        return () => clearTimeout(timer);
    }, []);
    return (_jsx("div", { className: "rules-page", children: _jsxs("main", { className: "rules-page__main", children: [_jsx("header", { className: "rules-page__header", children: _jsxs("div", { className: "rules-page__header-inner", children: [_jsxs("div", { className: "rules-page__header-start", children: [_jsx(AppBackButton, { className: "app-back-btn" }), _jsx(AppHomeLogo, { withSeparator: true }), _jsxs("div", { children: [_jsx("h1", { className: "rules-page__title", children: t('rulesPage.title') }), _jsx("p", { className: "rules-page__subtitle", children: t('rulesPage.subtitle') })] })] }), _jsx(AppPageSettings, {})] }) }), _jsx("div", { className: "rules-page__content", children: _jsx("div", { className: "rules-page__container", children: loading ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "rules-page__hero rules-page__hero--skeleton", children: [_jsx("div", { className: "rules-page__skel rules-page__skel--icon" }), _jsx("div", { className: "rules-page__skel rules-page__skel--title" }), _jsx("div", { className: "rules-page__skel rules-page__skel--text" })] }), _jsx("div", { className: "rules-page__grid", children: Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (_jsxs("div", { className: "rules-page__card rules-page__card--skeleton", children: [_jsx("div", { className: "rules-page__skel rules-page__skel--card-icon" }), _jsx("div", { className: "rules-page__skel rules-page__skel--card-title" }), _jsx("div", { className: "rules-page__skel rules-page__skel--card-line" }), _jsx("div", { className: "rules-page__skel rules-page__skel--card-line rules-page__skel--short" })] }, i))) })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "rules-page__hero", children: [_jsx("div", { className: "rules-page__hero-icon", children: _jsx(IconFileText, {}) }), _jsx("h2", { className: "rules-page__hero-title", children: t('rulesPage.heroTitle') }), _jsx("p", { className: "rules-page__hero-text", children: t('rulesPage.heroText') })] }), _jsx("div", { className: "rules-page__grid", children: rulesSections.map((section, i) => {
                                        const Icon = section.icon;
                                        return (_jsxs("article", { className: `rules-page__card rules-page__card--${section.color}`, style: { animationDelay: `${i * 0.05}s` }, children: [_jsx("div", { className: "rules-page__card-icon", children: _jsx(Icon, {}) }), _jsx("h3", { className: "rules-page__card-title", children: section.title }), _jsx("div", { className: "rules-page__card-body", children: _jsx("p", { className: "rules-page__text", children: section.text }) })] }, section.id));
                                    }) })] })) }) })] }) }));
}
