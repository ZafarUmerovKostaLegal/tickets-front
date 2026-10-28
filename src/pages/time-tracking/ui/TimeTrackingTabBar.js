import { jsx as _jsx } from "react/jsx-runtime";
import { useI18n } from '@shared/i18n';
export function TimeTrackingTabBar({ tabs, activeTab, onTabChange }) {
    const { t } = useI18n();
    return (_jsx("nav", { className: "time-page__tabbar", role: "tablist", "aria-label": t('timeTrackingPage.page.sectionsTablistAria'), children: tabs.map((tab) => (_jsx("button", { type: "button", role: "tab", "aria-selected": activeTab === tab.id, "aria-controls": `time-tab-${tab.id}`, id: `time-tab-btn-${tab.id}`, className: `time-page__tab ${activeTab === tab.id ? 'time-page__tab--active' : ''}`, onClick: () => onTabChange(tab.id), children: tab.label }, tab.id))) }));
}
