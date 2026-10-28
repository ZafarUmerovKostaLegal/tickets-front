import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useMemo, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { buildCallJoinLinkList, createCallScheduleEvent, getCallScheduleCalendars, getCallScheduleEvents, hasAnyJoinLink, listCallScheduleDayFiles, uploadCallScheduleDayFile, downloadCallScheduleDayFile, deleteCallScheduleDayFile, fetchCallScheduleDayFileCounts, CallScheduleApiError, } from '@entities/call-schedule';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { useCurrentUser } from '@shared/hooks';
import { canAccessAdminOnlyModules } from '@shared/lib/orgRoles';
import { sanitizeHttpsWebUrl } from '@shared/lib/safeWebLink';
import { eventCountLabel, fmtDuration, formatDateLong, localeTag, monthTitle, weekdayLabels, } from '../lib/callScheduleFormat';
import { joinLabelWithoutOpenPrefix, translateJoinLabel } from '../lib/callJoinLabels';
import { CallScheduleCalendarSelect, CschedCalendarBlockSkeleton, isKostaCalendarName } from './CallScheduleCalendarSelect';
import './CallSchedulePage.css';
function pad2(n) {
    return String(n).padStart(2, '0');
}
function toIso(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function formatFileSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
function sameYmd(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isToday(d) {
    return sameYmd(d, new Date());
}
function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}
function buildMonthWeeks(anchorMonth) {
    const viewY = anchorMonth.getFullYear();
    const viewM = anchorMonth.getMonth();
    const first = new Date(viewY, viewM, 1);
    const padStart = (first.getDay() + 6) % 7;
    const start = new Date(viewY, viewM, 1 - padStart);
    const weeks = [];
    const cur = new Date(start);
    for (let w = 0; w < 6; w++) {
        const row = [];
        for (let i = 0; i < 7; i++) {
            row.push({ d: new Date(cur), inMonth: cur.getMonth() === viewM });
            cur.setDate(cur.getDate() + 1);
        }
        weeks.push(row);
    }
    return weeks;
}
const MONTH_CELL_EVENT_CAP = 2;
function CallEventDetailModal({ event, onClose }) {
    const { t, locale } = useI18n();
    const uid = useId();
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return createPortal(_jsx("div", { className: "csched-modal-overlay", role: "presentation", children: _jsxs("div", { className: "csched-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-call-title`, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "csched-modal__head", children: [_jsx("h2", { id: `${uid}-call-title`, className: "csched-modal__title", children: event.title }), _jsx("button", { type: "button", className: "csched-modal__close", onClick: onClose, "aria-label": t('callSchedulePage.closeAria'), children: _jsx("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsx("div", { className: "csched-modal__body", children: _jsxs("dl", { className: "csched-modal__dl", children: [_jsxs("div", { className: "csched-modal__row", children: [_jsx("dt", { children: t('callSchedulePage.labelDate') }), _jsx("dd", { children: formatDateLong(event.date, locale) })] }), _jsxs("div", { className: "csched-modal__row", children: [_jsx("dt", { children: t('callSchedulePage.labelTime') }), _jsxs("dd", { children: [event.time, " ", _jsxs("span", { className: "csched-modal__muted", children: ["(", fmtDuration(event.durationMin, t), ")"] })] })] }), event.client ? (_jsxs("div", { className: "csched-modal__row", children: [_jsx("dt", { children: t('callSchedulePage.labelClient') }), _jsx("dd", { children: event.client })] })) : null, event.participants && event.participants.length > 0 ? (_jsxs("div", { className: "csched-modal__row", children: [_jsx("dt", { children: t('callSchedulePage.labelParticipants') }), _jsx("dd", { children: _jsx("ul", { className: "csched-modal__list", children: event.participants.map((p) => (_jsx("li", { children: p }, p))) }) })] })) : null, event.description ? (_jsxs("div", { className: "csched-modal__row csched-modal__row--block", children: [_jsx("dt", { children: t('callSchedulePage.labelDescription') }), _jsx("dd", { className: "csched-modal__desc", children: event.description })] })) : null, hasAnyJoinLink(event) ? (_jsxs("div", { className: "csched-modal__row csched-modal__row--block", children: [_jsx("dt", { children: t('callSchedulePage.labelJoinLinks') }), _jsx("dd", { className: "csched-modal__joins", children: buildCallJoinLinkList(event).map((row) => {
                                            const safe = sanitizeHttpsWebUrl(row.url);
                                            return safe ? (_jsx("a", { className: `csched-modal__join ${row.className}`, href: safe, target: "_blank", rel: "noopener noreferrer", children: translateJoinLabel(row, t) }, row.key)) : (_jsxs("span", { className: "csched-modal__join csched-modal__join--unsafe", title: t('callSchedulePage.linkUnsafeTitle'), children: [joinLabelWithoutOpenPrefix(row, t), ' ', t('callSchedulePage.linkUnavailable')] }, row.key));
                                        }) })] })) : null, event.dialIn ? (_jsxs("div", { className: "csched-modal__row", children: [_jsx("dt", { children: t('callSchedulePage.labelPhone') }), _jsx("dd", { children: event.dialIn })] })) : null] }) }), _jsx("div", { className: "csched-modal__foot", children: _jsx("button", { type: "button", className: "csched-modal__btn csched-modal__btn--primary", onClick: onClose, children: t('callSchedulePage.close') }) })] }) }), document.body);
}
function CallDayListModal({ dateIso, events, onClose, onSelectEvent, onFilesChanged, }) {
    const { t, locale } = useI18n();
    const { user } = useCurrentUser();
    const uid = useId();
    const fileInputRef = useRef(null);
    const [files, setFiles] = useState([]);
    const [filesLoading, setFilesLoading] = useState(true);
    const [filesError, setFilesError] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const canAdminDelete = canAccessAdminOnlyModules(user?.role);
    const reloadFiles = useCallback(async (signal) => {
        setFilesLoading(true);
        setFilesError(null);
        try {
            const list = await listCallScheduleDayFiles(dateIso, signal);
            if (signal?.aborted)
                return;
            setFiles(list);
        }
        catch (e) {
            if (signal?.aborted)
                return;
            const msg = e instanceof CallScheduleApiError ? e.message : t('callSchedulePage.dayFiles.errLoad');
            setFilesError(msg);
            setFiles([]);
        }
        finally {
            if (!signal?.aborted)
                setFilesLoading(false);
        }
    }, [dateIso, t]);
    useEffect(() => {
        const controller = new AbortController();
        void reloadFiles(controller.signal);
        return () => controller.abort();
    }, [reloadFiles]);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    const onUploadPick = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file)
            return;
        setUploading(true);
        setFilesError(null);
        try {
            const created = await uploadCallScheduleDayFile(dateIso, file);
            setFiles((prev) => [created, ...prev.filter((f) => f.id !== created.id)]);
            onFilesChanged?.();
        }
        catch (err) {
            const msg = err instanceof CallScheduleApiError ? err.message : t('callSchedulePage.dayFiles.errUpload');
            setFilesError(msg);
        }
        finally {
            setUploading(false);
        }
    };
    const onDownload = async (f) => {
        setBusyId(f.id);
        setFilesError(null);
        try {
            await downloadCallScheduleDayFile(dateIso, f.id, f.originalName);
        }
        catch (err) {
            const msg = err instanceof CallScheduleApiError ? err.message : t('callSchedulePage.dayFiles.errDownload');
            setFilesError(msg);
        }
        finally {
            setBusyId(null);
        }
    };
    const onDelete = async (f) => {
        setBusyId(f.id);
        setFilesError(null);
        try {
            await deleteCallScheduleDayFile(dateIso, f.id);
            setFiles((prev) => prev.filter((x) => x.id !== f.id));
            onFilesChanged?.();
        }
        catch (err) {
            const msg = err instanceof CallScheduleApiError ? err.message : t('callSchedulePage.dayFiles.errDelete');
            setFilesError(msg);
        }
        finally {
            setBusyId(null);
        }
    };
    return createPortal(_jsx("div", { className: "csched-modal-overlay", role: "presentation", children: _jsxs("div", { className: "csched-modal csched-daylist", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-daylist`, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "csched-modal__head", children: [_jsx("h2", { id: `${uid}-daylist`, className: "csched-modal__title csched-daylist__title", children: formatDateLong(dateIso, locale) }), _jsx("button", { type: "button", className: "csched-modal__close", onClick: onClose, "aria-label": t('callSchedulePage.closeAria'), children: _jsx("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "csched-modal__body csched-daylist__body", children: [_jsx("p", { className: "csched-daylist__meta", children: events.length > 0 ? eventCountLabel(events.length, locale, t) : t('callSchedulePage.dayFiles.noEvents') }), events.length > 0 ? (_jsx("ul", { className: "csched-daylist__list", role: "list", children: events.map((ev) => (_jsx("li", { className: "csched-daylist__item", children: _jsxs("button", { type: "button", className: "csched-daylist__row", onClick: () => onSelectEvent(ev), children: [_jsx("span", { className: "csched-daylist__time", children: ev.time }), _jsx("span", { className: "csched-daylist__etitle", children: ev.title })] }) }, ev.id))) })) : null, _jsxs("section", { className: "csched-dayfiles", "aria-labelledby": `${uid}-dayfiles`, children: [_jsxs("div", { className: "csched-dayfiles__head", children: [_jsx("h3", { id: `${uid}-dayfiles`, className: "csched-dayfiles__title", children: t('callSchedulePage.dayFiles.title') }), _jsx("input", { ref: fileInputRef, type: "file", className: "csched-dayfiles__input", onChange: onUploadPick, disabled: uploading }), _jsx("button", { type: "button", className: "csched-dayfiles__upload", disabled: uploading, onClick: () => fileInputRef.current?.click(), children: uploading ? t('callSchedulePage.dayFiles.uploading') : t('callSchedulePage.dayFiles.upload') })] }), filesError ? _jsx("p", { className: "csched-dayfiles__error", role: "alert", children: filesError }) : null, filesLoading ? (_jsx("p", { className: "csched-dayfiles__hint", children: t('callSchedulePage.dayFiles.loading') })) : files.length === 0 ? (_jsx("p", { className: "csched-dayfiles__hint", children: t('callSchedulePage.dayFiles.empty') })) : (_jsx("ul", { className: "csched-dayfiles__list", role: "list", children: files.map((f) => {
                                        const canDelete = user?.id != null && (f.uploadedByUserId === user.id || canAdminDelete);
                                        const busy = busyId === f.id;
                                        return (_jsxs("li", { className: "csched-dayfiles__item", children: [_jsxs("div", { className: "csched-dayfiles__meta", children: [_jsx("span", { className: "csched-dayfiles__name", title: f.originalName, children: f.originalName }), _jsx("span", { className: "csched-dayfiles__size", children: formatFileSize(f.sizeBytes) })] }), _jsxs("div", { className: "csched-dayfiles__actions", children: [_jsx("button", { type: "button", className: "csched-dayfiles__btn", disabled: busy || uploading, onClick: () => void onDownload(f), children: t('callSchedulePage.dayFiles.download') }), canDelete ? (_jsx("button", { type: "button", className: "csched-dayfiles__btn csched-dayfiles__btn--danger", disabled: busy || uploading, onClick: () => void onDelete(f), children: busy ? t('callSchedulePage.dayFiles.deleting') : t('callSchedulePage.dayFiles.delete') })) : null] })] }, f.id));
                                    }) }))] })] }), _jsx("div", { className: "csched-modal__foot", children: _jsx("button", { type: "button", className: "csched-modal__btn csched-modal__btn--primary", onClick: onClose, children: t('callSchedulePage.close') }) })] }) }), document.body);
}
function CreateCallEventModal({ open, onClose, onCreated, initialDateIso, calendarId, }) {
    const { t } = useI18n();
    const formId = useId();
    const [subject, setSubject] = useState('');
    const [dateIso, setDateIso] = useState(initialDateIso);
    const [timeFrom, setTimeFrom] = useState('10:00');
    const [timeTo, setTimeTo] = useState('10:30');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);
    useEffect(() => {
        if (open) {
            setDateIso(initialDateIso);
            setFormError(null);
        }
    }, [open, initialDateIso]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !saving)
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, saving]);
    if (!open)
        return null;
    const submit = async (e) => {
        e.preventDefault();
        setFormError(null);
        const subj = subject.trim();
        if (!subj) {
            setFormError(t('callSchedulePage.errSubject'));
            return;
        }
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
        if (!m) {
            setFormError(t('callSchedulePage.errDate'));
            return;
        }
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        const [fh, fm] = timeFrom.split(':').map((x) => Number(x));
        const [th, tm] = timeTo.split(':').map((x) => Number(x));
        if (![fh, fm, th, tm].every((n) => Number.isFinite(n))) {
            setFormError(t('callSchedulePage.errTime'));
            return;
        }
        const start = new Date(y, mo - 1, d, fh, fm, 0, 0);
        const end = new Date(y, mo - 1, d, th, tm, 0, 0);
        if (end.getTime() <= start.getTime()) {
            setFormError(t('callSchedulePage.errEndBeforeStart'));
            return;
        }
        setSaving(true);
        try {
            await createCallScheduleEvent({
                subject: subj,
                start: start.toISOString(),
                end: end.toISOString(),
                body: body.trim() || null,
                calendarId: calendarId === 'default' ? null : calendarId,
                timeZone: 'UTC',
            });
            onCreated();
            onClose();
        }
        catch (err) {
            const msg = err instanceof CallScheduleApiError ? err.message : t('callSchedulePage.errCreateEvent');
            setFormError(msg);
        }
        finally {
            setSaving(false);
        }
    };
    return createPortal(_jsx("div", { className: "csched-modal-overlay", role: "presentation", children: _jsx("div", { className: "csched-modal csched-modal--form", role: "dialog", "aria-modal": "true", "aria-labelledby": `${formId}-title`, onClick: (e) => e.stopPropagation(), children: _jsxs("form", { onSubmit: submit, children: [_jsxs("div", { className: "csched-modal__head", children: [_jsx("h2", { id: `${formId}-title`, className: "csched-modal__title", children: t('callSchedulePage.newCallSlot') }), _jsx("button", { type: "button", className: "csched-modal__close", onClick: onClose, "aria-label": t('callSchedulePage.closeAria'), disabled: saving, children: _jsx("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "csched-modal__body csched-form", children: [formError ? (_jsx("p", { className: "csched-form__err", role: "alert", children: formError })) : null, _jsxs("label", { className: "csched-form__field", children: [_jsx("span", { className: "csched-form__label", children: t('callSchedulePage.formSubject') }), _jsx("input", { className: "csched-form__input", value: subject, onChange: (e) => setSubject(e.target.value), maxLength: 500, required: true, disabled: saving, placeholder: t('callSchedulePage.formSubjectPlaceholder') })] }), _jsxs("label", { className: "csched-form__field", children: [_jsx("span", { className: "csched-form__label", children: t('callSchedulePage.formDate') }), _jsx("input", { className: "csched-form__input", type: "date", value: dateIso, onChange: (e) => setDateIso(e.target.value), required: true, disabled: saving })] }), _jsxs("div", { className: "csched-form__row2", children: [_jsxs("label", { className: "csched-form__field", children: [_jsx("span", { className: "csched-form__label", children: t('callSchedulePage.formFrom') }), _jsx("input", { className: "csched-form__input", type: "time", value: timeFrom, onChange: (e) => setTimeFrom(e.target.value), required: true, disabled: saving })] }), _jsxs("label", { className: "csched-form__field", children: [_jsx("span", { className: "csched-form__label", children: t('callSchedulePage.formTo') }), _jsx("input", { className: "csched-form__input", type: "time", value: timeTo, onChange: (e) => setTimeTo(e.target.value), required: true, disabled: saving })] })] }), _jsxs("label", { className: "csched-form__field", children: [_jsx("span", { className: "csched-form__label", children: t('callSchedulePage.formBody') }), _jsx("textarea", { className: "csched-form__textarea", value: body, onChange: (e) => setBody(e.target.value), rows: 3, disabled: saving, placeholder: t('callSchedulePage.formBodyPlaceholder') })] })] }), _jsxs("div", { className: "csched-modal__foot", children: [_jsx("button", { type: "button", className: "csched-modal__btn", onClick: onClose, disabled: saving, children: t('callSchedulePage.cancel') }), _jsx("button", { type: "submit", className: "csched-modal__btn csched-modal__btn--primary", disabled: saving, children: saving ? t('callSchedulePage.creating') : t('callSchedulePage.create') })] })] }) }) }), document.body);
}
export function CallSchedulePage() {
    const { t, locale } = useI18n();
    const weekdays = useMemo(() => weekdayLabels(t), [t]);
    const now = new Date();
    const [anchorMonth, setAnchorMonth] = useState(() => startOfMonth(now));
    const [selected, setSelected] = useState(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    const [detailEvent, setDetailEvent] = useState(null);
    const [agendaForDay, setAgendaForDay] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [calendarId, setCalendarId] = useState('default');
    const [calendars, setCalendars] = useState([]);
    const [calendarsLoading, setCalendarsLoading] = useState(true);
    const [calendarsError, setCalendarsError] = useState(null);
    const [mailbox, setMailbox] = useState(null);
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [eventsError, setEventsError] = useState(null);
    const [retryKey, setRetryKey] = useState(0);
    const [fileCounts, setFileCounts] = useState({});
    const [fileCountsTick, setFileCountsTick] = useState(0);
    const applyKostaAsPrimaryOnceRef = useRef(true);
    const viewY = anchorMonth.getFullYear();
    const viewM = anchorMonth.getMonth();
    const weeks = useMemo(() => buildMonthWeeks(anchorMonth), [anchorMonth]);
    useEffect(() => {
        let live = true;
        const controller = new AbortController();
        setCalendarsLoading(true);
        (async () => {
            try {
                const c = await getCallScheduleCalendars(controller.signal);
                if (!live)
                    return;
                setMailbox(c.mailbox);
                const mapped = c.calendars.map((cal) => ({
                    id: String(cal.id),
                    name: (cal.name && String(cal.name).trim()) || String(cal.id),
                }));
                setCalendars(mapped);
                if (applyKostaAsPrimaryOnceRef.current) {
                    applyKostaAsPrimaryOnceRef.current = false;
                    const kosta = mapped.find((cal) => isKostaCalendarName(cal.name));
                    if (kosta)
                        setCalendarId(kosta.id);
                }
                setCalendarsError(null);
            }
            catch (e) {
                if (!live)
                    return;
                const msg = e instanceof CallScheduleApiError ? e.message : t('callSchedulePage.errLoadCalendars');
                setCalendarsError(msg);
            }
            finally {
                if (live)
                    setCalendarsLoading(false);
            }
        })();
        return () => {
            live = false;
            controller.abort();
        };
    }, [retryKey, t]);
    useEffect(() => {
        if (calendarsLoading || calendarsError)
            return;
        let live = true;
        const controller = new AbortController();
        (async () => {
            setEventsLoading(true);
            setEventsError(null);
            const start = new Date(viewY, viewM, 1, 0, 0, 0, 0);
            const end = new Date(viewY, viewM + 1, 1, 0, 0, 0, 0);
            try {
                const list = await getCallScheduleEvents({
                    start: start.toISOString(),
                    end: end.toISOString(),
                    calendarId,
                }, controller.signal);
                if (!live)
                    return;
                setEvents(list);
            }
            catch (e) {
                if (!live)
                    return;
                const msg = e instanceof CallScheduleApiError ? e.message : t('callSchedulePage.errLoadEvents');
                setEvents([]);
                setEventsError(msg);
            }
            finally {
                if (live)
                    setEventsLoading(false);
            }
        })();
        return () => {
            live = false;
            controller.abort();
        };
    }, [viewY, viewM, calendarId, retryKey, calendarsLoading, calendarsError, t]);
    useEffect(() => {
        let live = true;
        const controller = new AbortController();
        const flat = weeks.flat();
        if (flat.length === 0)
            return;
        const from = toIso(flat[0].d);
        const to = toIso(flat[flat.length - 1].d);
        (async () => {
            try {
                const counts = await fetchCallScheduleDayFileCounts(from, to, controller.signal);
                if (!live)
                    return;
                setFileCounts(counts);
            }
            catch {
                if (!live)
                    return;
                setFileCounts({});
            }
        })();
        return () => {
            live = false;
            controller.abort();
        };
    }, [weeks, fileCountsTick, retryKey]);
    const eventsByDate = useMemo(() => {
        const m = new Map();
        for (const e of events) {
            const list = m.get(e.date) ?? [];
            list.push(e);
            m.set(e.date, list);
        }
        for (const list of m.values()) {
            list.sort((a, b) => a.startMs - b.startMs);
        }
        return m;
    }, [events]);
    const goPrevMonth = useCallback(() => {
        setAnchorMonth((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1));
    }, []);
    const goNextMonth = useCallback(() => {
        setAnchorMonth((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1));
    }, []);
    const goToday = useCallback(() => {
        const t = new Date();
        setAnchorMonth(startOfMonth(t));
        setSelected(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
    }, []);
    const miniWeeks = weeks;
    return (_jsxs("div", { className: "csched-page", children: [_jsxs("main", { className: "csched-page__main", children: [_jsxs("header", { className: "csched-page__header", children: [_jsxs("div", { className: "csched-page__header-start", children: [_jsx(AppBackButton, { className: "app-back-btn" }), _jsx(AppHomeLogo, { withSeparator: true }), _jsxs("div", { className: "csched-page__header-text", children: [_jsx("h1", { className: "csched-page__title", children: t('callSchedulePage.title') }), _jsx("p", { className: "csched-page__subtitle", children: mailbox
                                                    ? (_jsxs(_Fragment, { children: [t('callSchedulePage.subtitleMailboxPrefix'), " ", _jsx("span", { className: "csched-page__mono", children: mailbox })] }))
                                                    : t('callSchedulePage.subtitleDefault') })] })] }), _jsx(AppPageSettings, {})] }), eventsError || calendarsError ? (_jsxs("div", { className: "csched-page__alert", role: "status", children: [calendarsError ? (_jsxs("p", { children: [_jsx("strong", { children: t('callSchedulePage.alertCalendars') }), " ", calendarsError] })) : null, eventsError ? (_jsxs("p", { children: [_jsx("strong", { children: t('callSchedulePage.alertEvents') }), " ", eventsError] })) : null, _jsx("button", { type: "button", className: "csched-page__alert-btn", onClick: () => setRetryKey((k) => k + 1), children: t('callSchedulePage.retry') })] })) : null, _jsxs("div", { className: `csched-page__workspace${eventsLoading ? ' csched-page__workspace--loading' : ''}`, children: [_jsxs("aside", { className: "csched-page__rail", "aria-label": t('callSchedulePage.railNavAria'), children: [_jsxs("div", { className: "csched-rail__block", children: [_jsxs("div", { className: "csched-rail__mini-head", children: [_jsx("button", { type: "button", className: "csched-rail__icon-btn", onClick: goPrevMonth, "aria-label": t('callSchedulePage.prevMonth'), children: "\u2039" }), _jsx("span", { className: "csched-rail__mini-title", children: monthTitle(anchorMonth, locale) }), _jsx("button", { type: "button", className: "csched-rail__icon-btn", onClick: goNextMonth, "aria-label": t('callSchedulePage.nextMonth'), children: "\u203A" })] }), _jsxs("div", { className: "csched-mini-cal", role: "grid", "aria-label": t('callSchedulePage.miniCalendarAria'), children: [_jsx("div", { className: "csched-mini-cal__dow", role: "row", children: weekdays.map((d) => (_jsx("span", { className: "csched-mini-cal__dow-cell", role: "columnheader", children: d }, d))) }), miniWeeks.map((row, wi) => (_jsx("div", { className: "csched-mini-cal__row", role: "row", children: row.map(({ d, inMonth }, di) => {
                                                            const sel = sameYmd(d, selected);
                                                            const today = isToday(d);
                                                            return (_jsx("button", { type: "button", role: "gridcell", className: `csched-mini-cal__cell${!inMonth ? ' csched-mini-cal__cell--muted' : ''}${today ? ' csched-mini-cal__cell--today' : ''}${sel ? ' csched-mini-cal__cell--selected' : ''}`, onClick: () => {
                                                                    setSelected(new Date(d));
                                                                    setAnchorMonth(startOfMonth(d));
                                                                }, children: d.getDate() }, `${wi}-${di}`));
                                                        }) }, wi)))] })] }), calendarsLoading && !calendarsError ? (_jsx(CschedCalendarBlockSkeleton, {})) : (_jsxs("div", { className: "csched-rail__block csched-rail__block--muted", children: [_jsx("p", { className: "csched-rail__section-title", children: t('callSchedulePage.calendarSection') }), _jsx(CallScheduleCalendarSelect, { value: calendarId, onChange: setCalendarId, calendars: calendars, disabled: !!calendarsError }), _jsxs("p", { className: "csched-rail__hint", children: [t('callSchedulePage.dataHint'), " ", _jsx("code", { className: "csched-rail__code", children: "/api/v1/call-schedule" })] })] }))] }), _jsxs("section", { className: "csched-page__calendar", "aria-label": t('callSchedulePage.mainCalendarAria'), children: [_jsxs("div", { className: "csched-cal__toolbar", children: [_jsx("button", { type: "button", className: "csched-cal__btn csched-cal__btn--primary", onClick: goToday, children: t('callSchedulePage.today') }), _jsx("button", { type: "button", className: "csched-cal__btn", onClick: () => setCreateOpen(true), children: t('callSchedulePage.newSlot') }), _jsxs("div", { className: "csched-cal__nav", children: [_jsx("button", { type: "button", className: "csched-cal__icon-btn", onClick: goPrevMonth, "aria-label": t('callSchedulePage.prevMonth'), children: "\u2039" }), _jsx("button", { type: "button", className: "csched-cal__icon-btn", onClick: goNextMonth, "aria-label": t('callSchedulePage.nextMonth'), children: "\u203A" })] }), _jsx("h2", { className: "csched-cal__month-label", children: monthTitle(anchorMonth, locale) }), _jsx("div", { className: "csched-cal__toolbar-spacer" }), eventsLoading ? (_jsx("span", { className: "csched-cal__view-badge", "aria-live": "polite", children: t('callSchedulePage.loading') })) : null, _jsx("span", { className: "csched-cal__view-badge", children: t('callSchedulePage.monthView') })] }), _jsxs("div", { className: "csched-cal__grid-wrap", children: [_jsx("div", { className: "csched-cal__dow-row", role: "row", children: weekdays.map((d) => (_jsx("div", { className: "csched-cal__dow-cell", role: "columnheader", children: d }, d))) }), _jsx("div", { className: "csched-cal__grid", role: "grid", children: weeks.flatMap((row, wi) => row.map(({ d, inMonth }, di) => {
                                                    const iso = toIso(d);
                                                    const dayEvents = eventsByDate.get(iso) ?? [];
                                                    const visibleDayEvents = dayEvents.slice(0, MONTH_CELL_EVENT_CAP);
                                                    const moreCount = dayEvents.length > MONTH_CELL_EVENT_CAP
                                                        ? dayEvents.length - MONTH_CELL_EVENT_CAP
                                                        : 0;
                                                    const filesCount = fileCounts[iso] ?? 0;
                                                    const sel = sameYmd(d, selected);
                                                    const today = isToday(d);
                                                    const openDay = () => {
                                                        setSelected(new Date(d));
                                                        setAgendaForDay({ dateIso: iso, events: dayEvents });
                                                    };
                                                    return (_jsxs("div", { role: "gridcell", tabIndex: 0, className: `csched-cal__cell${!inMonth ? ' csched-cal__cell--muted' : ''}${today ? ' csched-cal__cell--today' : ''}${sel ? ' csched-cal__cell--selected' : ''}`, onClick: () => setSelected(new Date(d)), onKeyDown: (e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                setSelected(new Date(d));
                                                            }
                                                        }, children: [_jsxs("div", { className: "csched-cal__cell-head", children: [_jsx("button", { type: "button", className: "csched-cal__cell-num csched-cal__date-open", title: t('callSchedulePage.allDayEventsTitle'), "aria-label": `${t('callSchedulePage.dayFiles.openDayAria')} ${formatDateLong(iso, locale)}`, onClick: (e) => {
                                                                            e.stopPropagation();
                                                                            openDay();
                                                                        }, children: d.getDate() }), filesCount > 0 ? (_jsx("span", { className: "csched-cal__files-badge", title: `${filesCount} ${t('callSchedulePage.dayFiles.badgeAria')}`, "aria-label": `${filesCount} ${t('callSchedulePage.dayFiles.badgeAria')}`, children: filesCount })) : null, !inMonth && (_jsx("span", { className: "csched-cal__cell-month", children: d.toLocaleDateString(localeTag(locale), { month: 'short' }) }))] }), _jsxs("div", { className: "csched-cal__events", children: [visibleDayEvents.map((ev) => (_jsxs("button", { type: "button", className: "csched-cal__event", title: `${ev.time} · ${ev.title} — ${t('callSchedulePage.eventDetailsTitle')}`, onClick: (e) => {
                                                                            e.stopPropagation();
                                                                            setDetailEvent(ev);
                                                                        }, children: [_jsx("span", { className: "csched-cal__event-time", children: ev.time }), _jsx("span", { className: "csched-cal__event-title", children: ev.title })] }, ev.id))), moreCount > 0 ? (_jsxs("button", { type: "button", className: "csched-cal__more", title: `${t('callSchedulePage.moreInDayTitle')} ${dayEvents.length}. ${t('callSchedulePage.moreInDayTitleSuffix')}`, "aria-label": `${t('callSchedulePage.showHiddenAria')} ${eventCountLabel(moreCount, locale, t)}`, onClick: (e) => {
                                                                            e.stopPropagation();
                                                                            openDay();
                                                                        }, children: [t('callSchedulePage.moreCount'), " ", moreCount] })) : null] })] }, `${wi}-${di}`));
                                                })) })] })] })] })] }), agendaForDay ? (_jsx(CallDayListModal, { dateIso: agendaForDay.dateIso, events: agendaForDay.events, onClose: () => setAgendaForDay(null), onSelectEvent: (ev) => {
                    setDetailEvent(ev);
                    setAgendaForDay(null);
                }, onFilesChanged: () => setFileCountsTick((n) => n + 1) })) : null, detailEvent ? _jsx(CallEventDetailModal, { event: detailEvent, onClose: () => setDetailEvent(null) }) : null, _jsx(CreateCallEventModal, { open: createOpen, onClose: () => setCreateOpen(false), onCreated: () => setRetryKey((k) => k + 1), initialDateIso: toIso(selected), calendarId: calendarId })] }));
}
