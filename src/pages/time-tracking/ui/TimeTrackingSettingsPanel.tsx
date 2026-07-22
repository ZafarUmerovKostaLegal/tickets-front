import { useState } from 'react';
import { useI18n } from '@shared/i18n';
import { TimeTrackingClientTasksPanel } from './TimeTrackingClientTasksPanel';
import { TimeTrackingClientExpenseCategoriesPanel } from './TimeTrackingClientExpenseCategoriesPanel';
import { TimeTrackingTeamsPanel } from './TimeTrackingTeamsPanel';
import { TimeTrackingBankDetailsPanel } from './TimeTrackingBankDetailsPanel';

type SettingsTabId = 'tasks' | 'expense-categories' | 'teams' | 'bank-details';

export function TimeTrackingSettingsPanel() {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<SettingsTabId>('tasks');
    const settingsTabs: {
        id: SettingsTabId;
        labelKey:
            | 'timeTrackingPage.settings.tabs.tasks'
            | 'timeTrackingPage.settings.tabs.expenseCategories'
            | 'timeTrackingPage.settings.tabs.teams'
            | 'timeTrackingPage.settings.tabs.bankDetails';
    }[] = [
        { id: 'tasks', labelKey: 'timeTrackingPage.settings.tabs.tasks' },
        { id: 'expense-categories', labelKey: 'timeTrackingPage.settings.tabs.expenseCategories' },
        { id: 'teams', labelKey: 'timeTrackingPage.settings.tabs.teams' },
        { id: 'bank-details', labelKey: 'timeTrackingPage.settings.tabs.bankDetails' },
    ];
    return (<div className="tt-settings">
      <div className="tt-reports__type-block">
        <p className="tt-reports__type-block-title" id="tt-settings-section-heading">
          {t('timeTrackingPage.settings.sectionTitle')}
        </p>
        <nav className="tt-reports__type-nav" role="tablist" aria-labelledby="tt-settings-section-heading">
          {settingsTabs.map((tab) => (<button key={tab.id} type="button" role="tab" id={`tt-settings-tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls="tt-settings-tabpanel" className={`tt-reports__type-tab${activeTab === tab.id ? ' tt-reports__type-tab--active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {t(tab.labelKey)}
            </button>))}
        </nav>
      </div>
      <div key={activeTab} id="tt-settings-tabpanel" role="tabpanel" className="tt-settings__tab-panel" aria-labelledby={`tt-settings-tab-${activeTab}`}>
        {activeTab === 'tasks' && <TimeTrackingClientTasksPanel />}
        {activeTab === 'expense-categories' && <TimeTrackingClientExpenseCategoriesPanel />}
        {activeTab === 'teams' && <TimeTrackingTeamsPanel />}
        {activeTab === 'bank-details' && <TimeTrackingBankDetailsPanel />}
      </div>

    </div>);
}
