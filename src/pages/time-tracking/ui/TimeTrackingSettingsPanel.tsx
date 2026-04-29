import { useState } from 'react';
import { TimeTrackingClientTasksPanel } from './TimeTrackingClientTasksPanel';
import { TimeTrackingClientExpenseCategoriesPanel } from './TimeTrackingClientExpenseCategoriesPanel';
type SettingsTabId = 'tasks' | 'expense-categories';
type SettingsTab = {
    id: SettingsTabId;
    label: string;
};
const SETTINGS_TABS: SettingsTab[] = [
    { id: 'tasks', label: 'Задачи' },
    { id: 'expense-categories', label: 'Категории расходов' },
];
export function TimeTrackingSettingsPanel() {
    const [activeTab, setActiveTab] = useState<SettingsTabId>('tasks');
    return (<div className="tt-settings">
      <div className="tt-reports__type-block">
        <p className="tt-reports__type-block-title" id="tt-settings-section-heading">
          Справочники и доступ
        </p>
        <nav className="tt-reports__type-nav" role="tablist" aria-labelledby="tt-settings-section-heading">
          {SETTINGS_TABS.map((tab) => (<button key={tab.id} type="button" role="tab" id={`tt-settings-tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls="tt-settings-tabpanel" className={`tt-reports__type-tab${activeTab === tab.id ? ' tt-reports__type-tab--active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>))}
        </nav>
      </div>
      <div key={activeTab} id="tt-settings-tabpanel" role="tabpanel" className="tt-settings__tab-panel" aria-labelledby={`tt-settings-tab-${activeTab}`}>
        {activeTab === 'tasks' && <TimeTrackingClientTasksPanel />}
        {activeTab === 'expense-categories' && <TimeTrackingClientExpenseCategoriesPanel />}
      </div>

    </div>);
}
