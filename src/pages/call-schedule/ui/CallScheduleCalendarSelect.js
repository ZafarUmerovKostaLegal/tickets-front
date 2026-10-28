import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useI18n } from '@shared/i18n';
import { sanitizeHttpsWebUrl } from '@shared/lib/safeWebLink';
import { OutlookCalendarSelect } from '@shared/ui/OutlookCalendarSelect';
import { isKostaCalendarName } from '@shared/ui/outlookCalendarSelectUtils';
const OUTLOOK_CALENDAR_M365 = 'https://outlook.office.com/calendar/';
export { isKostaCalendarName };
export function CallScheduleCalendarSelect({ value, onChange, calendars, disabled = false, }) {
    const { t } = useI18n();
    const defaultLabel = t('callSchedulePage.calendarDefault');
    const hasKostaInMailbox = useMemo(() => calendars.some((c) => isKostaCalendarName(c.name)), [calendars]);
    const m365Url = useMemo(() => {
        const u = sanitizeHttpsWebUrl(OUTLOOK_CALENDAR_M365);
        return u || OUTLOOK_CALENDAR_M365;
    }, []);
    return (_jsxs("div", { className: "csched-cal-menu", children: [_jsx(OutlookCalendarSelect, { value: value, onChange: onChange, calendars: calendars, showLabel: t('callSchedulePage.calendarShow'), listAriaLabel: t('callSchedulePage.calendarListAria'), defaultCalendarLabel: defaultLabel, disabled: disabled, layout: "block" }), _jsx("p", { className: "csched-rail__m365-wrap", children: _jsx("a", { href: m365Url, className: "csched-rail__m365", target: "_blank", rel: "noopener noreferrer", children: hasKostaInMailbox ? t('callSchedulePage.openM365Kosta') : t('callSchedulePage.openM365') }) })] }));
}
export function CschedCalendarBlockSkeleton() {
    return (_jsxs("div", { className: "csched-rail__block csched-rail__block--muted csched-rail__block--skeleton", "aria-hidden": true, children: [_jsx("div", { className: "csched-rail__skel csched-rail__skel--title", role: "presentation" }), _jsxs("div", { className: "csched-rail__skel-group", children: [_jsx("div", { className: "csched-rail__skel csched-rail__skel--label", role: "presentation" }), _jsx("div", { className: "csched-rail__skel csched-rail__skel--select", role: "presentation" })] }), _jsx("div", { className: "csched-rail__skel csched-rail__skel--hint", role: "presentation" })] }));
}
