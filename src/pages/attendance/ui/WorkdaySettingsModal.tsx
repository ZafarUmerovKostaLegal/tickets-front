import { useState } from 'react';
import type { WorkdaySettings } from '@shared/lib/attendanceSettings';
import { useI18n } from '@shared/i18n';
type WorkdaySettingsModalProps = {
    initial: WorkdaySettings;
    onClose: () => void;
    onSave: (value: WorkdaySettings) => Promise<void>;
};
export function WorkdaySettingsModal({ initial, onClose, onSave }: WorkdaySettingsModalProps) {
    const { t } = useI18n();
    const [startTime, setStartTime] = useState(initial.startTime);
    const [endTime, setEndTime] = useState(initial.endTime);
    const [lateMinutes, setLateMinutes] = useState(String(initial.lateMinutes));
    const [dailyHours, setDailyHours] = useState(String(initial.dailyHours));
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const handleSave = async () => {
        setSaveError(null);
        setSaving(true);
        try {
            await onSave({
                startTime: startTime || '09:00',
                endTime: endTime || '18:00',
                lateMinutes: Number(lateMinutes) || 0,
                dailyHours: Number(dailyHours) || 0,
            });
            onClose();
        }
        catch (e) {
            setSaveError(e instanceof Error ? e.message : t('attendancePage.settingsModal.saveFailed'));
        }
        finally {
            setSaving(false);
        }
    };
    return (<div className="att-modal" role="dialog" aria-modal="true">
      <div className="att-modal__backdrop" aria-hidden/>
      <div className="att-modal__dialog">
        <div className="att-modal__head">
          <div className="att-modal__head-left">
            <div className="att-modal__head-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </div>
            <div>
              <h2 className="att-modal__title">{t('attendancePage.settingsModal.title')}</h2>
              <p className="att-modal__desc">{t('attendancePage.settingsModal.desc')}</p>
            </div>
          </div>
          <button type="button" className="att-modal__close" onClick={onClose} aria-label={t('attendancePage.close')} disabled={saving}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="att-modal__body">
          <div className="att-modal__row-2">
            <label className="att-modal__field">
              <span className="att-modal__label">{t('attendancePage.settingsModal.start')}</span>
              <input type="time" className="att-modal__input" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={saving}/>
            </label>
            <label className="att-modal__field">
              <span className="att-modal__label">{t('attendancePage.settingsModal.end')}</span>
              <input type="time" className="att-modal__input" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={saving}/>
            </label>
          </div>
          <label className="att-modal__field">
            <span className="att-modal__label">{t('attendancePage.settingsModal.lateMinutes')}</span>
            <input type="number" min={0} className="att-modal__input" value={lateMinutes} onChange={(e) => setLateMinutes(e.target.value)} disabled={saving}/>
            <span className="att-modal__hint">{t('attendancePage.settingsModal.lateHint')}</span>
          </label>
          <label className="att-modal__field">
            <span className="att-modal__label">{t('attendancePage.settingsModal.dailyHours')}</span>
            <input type="number" min={0} step="0.5" className="att-modal__input" value={dailyHours} onChange={(e) => setDailyHours(e.target.value)} disabled={saving}/>
            <span className="att-modal__hint">{t('attendancePage.settingsModal.dailyHint')}</span>
          </label>
          {saveError && <p className="att-modal__error" role="alert">{saveError}</p>}
        </div>

        <div className="att-modal__foot">
          <button type="button" className="att__btn att__btn--ghost" onClick={onClose} disabled={saving}>{t('attendancePage.settingsModal.cancel')}</button>
          <button type="button" className="att__btn att__btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? t('attendancePage.settingsModal.saving') : t('attendancePage.settingsModal.save')}
          </button>
        </div>
      </div>
    </div>);
}
