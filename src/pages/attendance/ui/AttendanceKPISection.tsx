import type { AttendanceSummary } from '../model/types';
import type { WorkdaySettings } from '@shared/lib/attendanceSettings';
import { useI18n } from '@shared/i18n';
import { fillAttendanceTemplate } from '../model/attendanceI18n';

type AttendanceKPISectionProps = {
    summary: AttendanceSummary;
    settings: WorkdaySettings;
    loading: boolean;
};

const LEGACY_KPI_ICONS = {
    entries: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    late: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    overtime: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
    hours: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
} as const;

const DAILY_ONTIME_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

const DAILY_ABSENT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
  </svg>
);

export function AttendanceKPISection({ summary, settings, loading }: AttendanceKPISectionProps) {
    const { t } = useI18n();
    const lateSub = fillAttendanceTemplate(t('attendancePage.kpi.lateSub'), {
        startTime: settings.startTime,
        lateMinutes: String(settings.lateMinutes),
    });

    if (summary.dailyMode) {
        const dailyCards = [
            { key: 'tracked', color: 'blue', label: t('attendancePage.kpi.tracked'), value: summary.entries, sub: t('attendancePage.kpi.trackedSub'), icon: LEGACY_KPI_ICONS.entries },
            { key: 'ontime', color: 'green', label: t('attendancePage.kpi.onTime'), value: summary.present_on_time ?? 0, sub: t('attendancePage.kpi.ontimeSub'), icon: DAILY_ONTIME_ICON },
            { key: 'late', color: 'orange', label: t('attendancePage.kpi.lateDaily'), value: summary.lateness, sub: lateSub, icon: LEGACY_KPI_ICONS.late },
            { key: 'absent', color: 'violet', label: t('attendancePage.kpi.absent'), value: summary.absent ?? 0, sub: t('attendancePage.kpi.absentSub'), icon: DAILY_ABSENT_ICON },
        ] as const;
        return (
          <section className="att__kpi">
            {dailyCards.map((card) => (
              <div key={card.key} className={`att__kpi-card att__kpi-card--${card.color}`}>
                <div className="att__kpi-icon">{card.icon}</div>
                {loading ? (
                  <div className="att__kpi-skel">
                    <span />
                    <span />
                  </div>
                ) : (
                  <>
                    <span className="att__kpi-value">{card.value}</span>
                    <span className="att__kpi-label">{card.label}</span>
                    <span className="att__kpi-sub">{card.sub}</span>
                  </>
                )}
              </div>
            ))}
          </section>
        );
    }

    const legacyCards = [
        { key: 'entries', color: 'blue', label: t('attendancePage.kpi.entries'), value: summary.entries, sub: t('attendancePage.kpi.entriesSub'), icon: LEGACY_KPI_ICONS.entries },
        { key: 'late', color: 'orange', label: t('attendancePage.kpi.late'), value: summary.lateness, sub: lateSub, icon: LEGACY_KPI_ICONS.late },
        {
            key: 'overtime',
            color: 'violet',
            label: t('attendancePage.kpi.overtime'),
            value: summary.overtime,
            sub: fillAttendanceTemplate(t('attendancePage.kpi.overtimeSub'), { dailyHours: String(settings.dailyHours) }),
            icon: LEGACY_KPI_ICONS.overtime,
        },
        {
            key: 'hours',
            color: 'green',
            label: t('attendancePage.kpi.hours'),
            value: summary.total_hours.toFixed(1),
            sub: fillAttendanceTemplate(t('attendancePage.kpi.hoursSub'), { avgHours: summary.avg_hours_per_entry.toFixed(1) }),
            icon: LEGACY_KPI_ICONS.hours,
        },
    ] as const;

    return (
      <section className="att__kpi">
        {legacyCards.map((card) => (
          <div key={card.key} className={`att__kpi-card att__kpi-card--${card.color}`}>
            <div className="att__kpi-icon">{card.icon}</div>
            {loading ? (
              <div className="att__kpi-skel">
                <span />
                <span />
              </div>
            ) : (
              <>
                <span className="att__kpi-value">{card.value}</span>
                <span className="att__kpi-label">{card.label}</span>
                <span className="att__kpi-sub">{card.sub}</span>
              </>
            )}
          </div>
        ))}
      </section>
    );
}
