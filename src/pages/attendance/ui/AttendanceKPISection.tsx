import type { AttendanceSummary } from '../model/types';
import type { WorkdaySettings } from '@shared/lib/attendanceSettings';
type AttendanceKPISectionProps = {
    summary: AttendanceSummary;
    settings: WorkdaySettings;
    loading: boolean;
};
const LEGACY_KPI = [
    {
        key: 'entries',
        label: 'Записей',
        valueKey: 'entries' as const,
        subKey: 'entries_sub' as const,
        color: 'blue' as const,
        icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>),
    },
    {
        key: 'late',
        label: 'Опозданий',
        valueKey: 'lateness' as const,
        subKey: 'late_sub' as const,
        color: 'orange' as const,
        icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>),
    },
    {
        key: 'overtime',
        label: 'Переработок',
        valueKey: 'overtime' as const,
        subKey: 'overtime_sub' as const,
        color: 'violet' as const,
        icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>),
    },
    {
        key: 'hours',
        label: 'Всего часов',
        valueKey: 'total_hours' as const,
        subKey: 'hours_sub' as const,
        color: 'green' as const,
        icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>),
    },
] as const;
const DAILY_KPI = [
    {
        key: 'tracked',
        label: 'В учёте',
        valueKey: 'entries' as const,
        subKey: 'tracked_sub' as const,
        color: 'blue' as const,
        icon: LEGACY_KPI[0].icon,
    },
    {
        key: 'ontime',
        label: 'Вовремя',
        valueKey: 'present_on_time' as const,
        subKey: 'ontime_sub' as const,
        color: 'green' as const,
        icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5"/>
      </svg>),
    },
    {
        key: 'late',
        label: 'Опоздали',
        valueKey: 'lateness' as const,
        subKey: 'late_sub' as const,
        color: 'orange' as const,
        icon: LEGACY_KPI[1].icon,
    },
    {
        key: 'absent',
        label: 'Отсутствуют',
        valueKey: 'absent' as const,
        subKey: 'absent_sub' as const,
        color: 'violet' as const,
        icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
      </svg>),
    },
] as const;
export function AttendanceKPISection({ summary, settings, loading }: AttendanceKPISectionProps) {
    const legacySubs = {
        entries_sub: 'за выбранный период',
        late_sub: `после ${settings.startTime} + ${settings.lateMinutes} мин`,
        overtime_sub: `больше ${settings.dailyHours} ч в день`,
        hours_sub: `≈ ${summary.avg_hours_per_entry.toFixed(1)} ч / запись`,
    };
    const dailySubs = {
        tracked_sub: 'сотрудников с маппингом на камеры',
        ontime_sub: `первый проход до границы опоздания`,
        late_sub: `после ${settings.startTime} + ${settings.lateMinutes} мин`,
        absent_sub: 'нет событий за выбранный день',
    };
    if (summary.dailyMode) {
        const dailyValues: Record<(typeof DAILY_KPI)[number]['valueKey'], number> = {
            entries: summary.entries,
            present_on_time: summary.present_on_time ?? 0,
            lateness: summary.lateness,
            absent: summary.absent ?? 0,
        };
        return (<section className="att__kpi">
        {DAILY_KPI.map((card) => (<div key={card.key} className={`att__kpi-card att__kpi-card--${card.color}`}>
            <div className="att__kpi-icon">{card.icon}</div>
            {loading ? (<div className="att__kpi-skel">
                <span />
                <span />
              </div>) : (<>
                <span className="att__kpi-value">{dailyValues[card.valueKey]}</span>
                <span className="att__kpi-label">{card.label}</span>
                <span className="att__kpi-sub">{dailySubs[card.subKey]}</span>
              </>)}
          </div>))}
      </section>);
    }
    const values = {
        entries: summary.entries,
        lateness: summary.lateness,
        overtime: summary.overtime,
        total_hours: summary.total_hours.toFixed(1),
    };
    return (<section className="att__kpi">
      {LEGACY_KPI.map((card) => (<div key={card.key} className={`att__kpi-card att__kpi-card--${card.color}`}>
          <div className="att__kpi-icon">{card.icon}</div>
          {loading ? (<div className="att__kpi-skel">
              <span />
              <span />
            </div>) : (<>
              <span className="att__kpi-value">{values[card.valueKey]}</span>
              <span className="att__kpi-label">{card.label}</span>
              <span className="att__kpi-sub">{legacySubs[card.subKey]}</span>
            </>)}
        </div>))}
    </section>);
}
