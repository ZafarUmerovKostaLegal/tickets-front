import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './TimeTrackingForms.css';
import { useState } from 'react';
import { useI18n } from '@shared/i18n';
import { TimeTrackingClientTasksPanel } from './TimeTrackingClientTasksPanel';
import { TimeTrackingClientExpenseCategoriesPanel } from './TimeTrackingClientExpenseCategoriesPanel';
import { TimeTrackingTeamsPanel } from './TimeTrackingTeamsPanel';
import { TimeTrackingBankDetailsPanel } from './TimeTrackingBankDetailsPanel';
export function TimeTrackingSettingsPanel() {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState('tasks');
    const settingsTabs = [
        { id: 'tasks', labelKey: 'timeTrackingPage.settings.tabs.tasks' },
        { id: 'expense-categories', labelKey: 'timeTrackingPage.settings.tabs.expenseCategories' },
        { id: 'teams', labelKey: 'timeTrackingPage.settings.tabs.teams' },
        { id: 'bank-details', labelKey: 'timeTrackingPage.settings.tabs.bankDetails' },
    ];
    return (_jsxs("div", { className: "tt-settings", children: [_jsxs("div", { className: "tt-reports__type-block", children: [_jsx("p", { className: "tt-reports__type-block-title", id: "tt-settings-section-heading", children: t('timeTrackingPage.settings.sectionTitle') }), _jsx("nav", { className: "tt-reports__type-nav", role: "tablist", "aria-labelledby": "tt-settings-section-heading", children: settingsTabs.map((tab) => (_jsx("button", { type: "button", role: "tab", id: `tt-settings-tab-${tab.id}`, "aria-selected": activeTab === tab.id, "aria-controls": "tt-settings-tabpanel", className: `tt-reports__type-tab${activeTab === tab.id ? ' tt-reports__type-tab--active' : ''}`, onClick: () => setActiveTab(tab.id), children: t(tab.labelKey) }, tab.id))) })] }), _jsxs("div", { id: "tt-settings-tabpanel", role: "tabpanel", className: "tt-settings__tab-panel", "aria-labelledby": `tt-settings-tab-${activeTab}`, children: [activeTab === 'tasks' && _jsx(TimeTrackingClientTasksPanel, {}), activeTab === 'expense-categories' && _jsx(TimeTrackingClientExpenseCategoriesPanel, {}), activeTab === 'teams' && _jsx(TimeTrackingTeamsPanel, {}), activeTab === 'bank-details' && _jsx(TimeTrackingBankDetailsPanel, {})] }, activeTab)] }));
}
