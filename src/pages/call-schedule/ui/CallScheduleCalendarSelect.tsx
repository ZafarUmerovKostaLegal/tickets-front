import { useMemo } from 'react';
import { useI18n } from '@shared/i18n';
import { sanitizeHttpsWebUrl } from '@shared/lib/safeWebLink';
import { OutlookCalendarSelect } from '@shared/ui/OutlookCalendarSelect';
import { isKostaCalendarName } from '@shared/ui/outlookCalendarSelectUtils';

const OUTLOOK_CALENDAR_M365 = 'https://outlook.office.com/calendar/';

export type CallScheduleCalendarItem = { id: string; name: string };

export { isKostaCalendarName };

type CallScheduleCalendarSelectProps = {
    value: string;
    onChange: (calendarId: string) => void;
    calendars: readonly CallScheduleCalendarItem[];
    disabled?: boolean;
};

export function CallScheduleCalendarSelect({
    value,
    onChange,
    calendars,
    disabled = false,
}: CallScheduleCalendarSelectProps) {
    const { t } = useI18n();
    const defaultLabel = t('callSchedulePage.calendarDefault');
    const hasKostaInMailbox = useMemo(
        () => calendars.some((c) => isKostaCalendarName(c.name)),
        [calendars],
    );
    const m365Url = useMemo(() => {
        const u = sanitizeHttpsWebUrl(OUTLOOK_CALENDAR_M365);
        return u || OUTLOOK_CALENDAR_M365;
    }, []);

    return (
        <div className="csched-cal-menu">
            <OutlookCalendarSelect
                value={value}
                onChange={onChange}
                calendars={calendars}
                showLabel={t('callSchedulePage.calendarShow')}
                listAriaLabel={t('callSchedulePage.calendarListAria')}
                defaultCalendarLabel={defaultLabel}
                disabled={disabled}
                layout="block"
            />
            <p className="csched-rail__m365-wrap">
                <a href={m365Url} className="csched-rail__m365" target="_blank" rel="noopener noreferrer">
                    {hasKostaInMailbox ? t('callSchedulePage.openM365Kosta') : t('callSchedulePage.openM365')}
                </a>
            </p>
        </div>
    );
}

export function CschedCalendarBlockSkeleton() {
    return (
        <div className="csched-rail__block csched-rail__block--muted csched-rail__block--skeleton" aria-hidden>
            <div className="csched-rail__skel csched-rail__skel--title" role="presentation"/>
            <div className="csched-rail__skel-group">
                <div className="csched-rail__skel csched-rail__skel--label" role="presentation"/>
                <div className="csched-rail__skel csched-rail__skel--select" role="presentation"/>
            </div>
            <div className="csched-rail__skel csched-rail__skel--hint" role="presentation"/>
        </div>
    );
}
