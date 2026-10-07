import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState, useEffect } from 'react';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import './HelpPage.css';
const IconHelp = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }), _jsx("path", { d: "M12 17h.01" })] }));
const IconPrinter = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("polyline", { points: "6 9 6 2 18 2 18 9" }), _jsx("path", { d: "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" }), _jsx("rect", { x: "6", y: "14", width: "12", height: "8" })] }));
const IconWifi = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M5 13a10 10 0 0 1 14 0" }), _jsx("path", { d: "M8.5 16.429a5 5 0 0 1 7 0" }), _jsx("path", { d: "M2 8.82a15 15 0 0 1 20 0" }), _jsx("line", { x1: "12", y1: "20", x2: "12.01", y2: "20" })] }));
const IconMonitor = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "2", y: "3", width: "20", height: "14", rx: "2" }), _jsx("line", { x1: "8", y1: "21", x2: "16", y2: "21" }), _jsx("line", { x1: "12", y1: "17", x2: "12", y2: "21" })] }));
const IconKey = () => (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" }) }));
const IconBox = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" }), _jsx("polyline", { points: "3.27 6.96 12 12.01 20.73 6.96" }), _jsx("line", { x1: "12", y1: "22.08", x2: "12", y2: "12" })] }));
const IconMail = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" }), _jsx("polyline", { points: "22,6 12,13 2,6" })] }));
const FAQ_META = [
    { id: 'printer', icon: IconPrinter, color: 'blue' },
    { id: 'wifi', icon: IconWifi, color: 'violet' },
    { id: 'monitor', icon: IconMonitor, color: 'green' },
    { id: 'access', icon: IconKey, color: 'orange' },
    { id: 'supplies', icon: IconBox, color: 'blue' },
    { id: 'support', icon: IconMail, color: 'violet', mailto: 'zumerov@kostalegal.com' },
];
function faqKey(id, field) {
    return `helpPage.faq.${id}.${field}`;
}
export function HelpPage() {
    const { t } = useI18n();
    const [loading, setLoading] = useState(true);
    const faqItems = useMemo(() => FAQ_META.map((item) => ({
        ...item,
        question: t(faqKey(item.id, 'question')),
        answer: t(faqKey(item.id, 'answer')),
    })), [t]);
    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 450);
        return () => clearTimeout(timer);
    }, []);
    return (_jsx("div", { className: "help-page", children: _jsxs("main", { className: "help-page__main", children: [_jsx("header", { className: "help-page__header", children: _jsxs("div", { className: "help-page__header-inner", children: [_jsxs("div", { className: "help-page__header-start", children: [_jsx(AppBackButton, { className: "app-back-btn" }), _jsx(AppHomeLogo, { withSeparator: true }), _jsx("div", { children: _jsx("h1", { className: "help-page__title", children: t('helpPage.title') }) })] }), _jsx(AppPageSettings, {})] }) }), _jsx("div", { className: "help-page__content", children: _jsx("div", { className: "help-page__container", children: loading ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "help-page__hero help-page__hero--skeleton", children: [_jsx("div", { className: "help-page__skel help-page__skel--icon" }), _jsx("div", { className: "help-page__skel help-page__skel--title" }), _jsx("div", { className: "help-page__skel help-page__skel--text" })] }), _jsx("div", { className: "help-page__grid", children: [1, 2, 3, 4, 5, 6].map((i) => (_jsxs("div", { className: "help-page__card help-page__card--skeleton", children: [_jsx("div", { className: "help-page__skel help-page__skel--card-icon" }), _jsx("div", { className: "help-page__skel help-page__skel--card-title" }), _jsx("div", { className: "help-page__skel help-page__skel--card-line" }), _jsx("div", { className: "help-page__skel help-page__skel--card-line help-page__skel--short" })] }, i))) })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "help-page__hero", children: [_jsx("div", { className: "help-page__hero-icon", children: _jsx(IconHelp, {}) }), _jsx("h2", { className: "help-page__hero-title", children: t('helpPage.heroTitle') }), _jsx("p", { className: "help-page__hero-text", children: t('helpPage.heroText') })] }), _jsxs("section", { className: "help-page__faq", "aria-label": t('helpPage.faqAria'), children: [_jsx("h2", { className: "help-page__faq-heading", children: t('helpPage.faqHeading') }), _jsx("div", { className: "help-page__grid", children: faqItems.map((item, i) => {
                                                const Icon = item.icon;
                                                return (_jsxs("article", { className: `help-page__card help-page__card--${item.color}`, style: { animationDelay: `${i * 0.05}s` }, children: [_jsx("div", { className: "help-page__card-icon", children: _jsx(Icon, {}) }), _jsx("div", { className: "help-page__card-q", children: t('helpPage.questionLabel') }), _jsx("h3", { className: "help-page__card-title", children: item.question }), _jsx("div", { className: "help-page__card-a", children: t('helpPage.answerLabel') }), item.mailto ? (_jsx("a", { href: `mailto:${item.mailto}`, className: "help-page__card-email", children: item.mailto })) : (_jsx("p", { className: "help-page__card-text", children: item.answer }))] }, item.id));
                                            }) })] })] })) }) })] }) }));
}
