import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useEffect, useCallback, useId, useRef, useLayoutEffect, } from 'react';
import { createPortal } from 'react-dom';
import { listWeeklySubmissions, isTimeTrackingHttpError, isWorkDateInClosedReportingPeriod, isWorkDateInSubmittedWeek, isWorkDateInCurrentReportingWeek, isClosedReportingWeekEditingBlockedForSubject, getActiveTimeEntryEditUnlockExpiresAtIso, setUserSubmittedWeeks, reportingWeekBounds, } from '@entities/time-tracking';
import {} from './timesheetProjectLoader';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { DatePicker } from '@shared/ui/DatePicker';
import { formatHoursClockFromDecimalHours, isValidDurationSeconds, MIN_ENTRY_SECONDS, MAX_ENTRY_SECONDS, sanitizeColonHoursInput, parseStrictDurationInputToDecimalHours, } from '@shared/lib/formatTrackingHours';
import { formatBillableMoney, isCbuFxUnavailable } from '@shared/lib/formatBillableMoney';
import { showAlert } from '@shared/ui/app-dialog';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { matchTelephoneCallsTask } from '@entities/todo/lib/calendarEventHelpers';
function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function fmtHours(h) {
    return formatHoursClockFromDecimalHours(h);
}
const MAX_MODAL_ENTRY_HOURS = 8;
function parseHoursStrict(s) {
    const h = parseStrictDurationInputToDecimalHours(s);
    return h === null ? Number.NaN : h;
}
const TIME_ENTRY_NOTE_REMINDER_MS = 5 * 60 * 1000;
function scheduleTimeEntryNoteMissedReminder(contextLabel, t) {
    const label = contextLabel.trim();
    window.setTimeout(() => {
        const title = t('timeTrackingPage.notification.title');
        const body = label
            ? t('timeTrackingPage.notification.noteMissedWithLabel').replace('{label}', label)
            : t('timeTrackingPage.notification.noteMissed');
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                new Notification(title, { body });
            }
            catch {
                void showAlert({ title, message: body });
            }
        }
        else {
            void showAlert({ title, message: body });
        }
    }, TIME_ENTRY_NOTE_REMINDER_MS);
}
function groupProjectsByClient(list) {
    const m = new Map();
    for (const p of list) {
        const c = (p.client || '').trim() || '—';
        if (!m.has(c))
            m.set(c, []);
        m.get(c).push(p);
    }
    return [...m.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'ru', { sensitivity: 'base' }))
        .map(([client, projs]) => ({
        client,
        projects: [...projs].sort((x, y) => x.name.localeCompare(y.name, 'ru', { sensitivity: 'base' })),
    }));
}
function resolveInitialForm(entry, defaultDate, projects, tasksByProjectId, preferEmptyHours = false, preferredTaskName) {
    let projectId = '';
    if (entry?.projectId && projects.some((p) => p.id === entry.projectId)) {
        projectId = entry.projectId;
    }
    else if (entry) {
        const m = projects.find((p) => p.name === entry.project && (!entry.client || p.client === entry.client));
        projectId = m?.id ?? projects[0]?.id ?? '';
    }
    else {
        projectId = projects[0]?.id ?? '';
    }
    const p = projects.find((x) => x.id === projectId);
    const projectTasks = p ? (tasksByProjectId[p.id] ?? []) : [];
    let taskId = entry?.taskId ?? '';
    let task = entry?.task ?? '';
    let billable = entry?.billable ?? true;
    if (projectTasks.length > 0) {
        const telPreferred = preferredTaskName ? matchTelephoneCallsTask(projectTasks) : undefined;
        const matched = telPreferred
            ?? (taskId ? projectTasks.find((t) => t.id === taskId) : undefined)
            ?? (task ? projectTasks.find((t) => t.name === task) : undefined);
        if (matched) {
            taskId = matched.id;
            task = matched.name;
            billable = matched.billableByDefault;
        }
        else {
            const first = projectTasks[0];
            taskId = first.id;
            task = first.name;
            billable = first.billableByDefault;
        }
    }
    return {
        projectId,
        taskId,
        task,
        date: entry?.date ?? defaultDate,
        hours: entry && !preferEmptyHours ? fmtHours(entry.hours) : '',
        notes: entry?.notes ?? '',
        billable,
    };
}
const ENTRY_MODAL_ENTER_ANIM = 'tsp-m-in';
const ENTRY_MODAL_ENTER_FALLBACK_MS = 300;
export function EntryModal({ entry, clone, defaultDate, projects, projectsLoading, projectsLoadError, tasksByProjectId, loadingProjectTaskIds, onRequestProjectTasks, entriesSubjectAuthUserId, viewerCanOverrideWeeklyLock, preferredTaskName, preserveCloneHours, onClose, onSave, }) {
    const { t, locale } = useI18n();
    const dateTag = localeTag(locale);
    const uid = useId();
    const modalRef = useRef(null);
    const notesRef = useRef(null);
    const projSelectRef = useRef(null);
    const taskSelectRef = useRef(null);
    const pendingTaskFocusRef = useRef(false);
    const hoursHelpRef = useRef(null);
    const handleSaveRef = useRef(async () => { });
    const [saving, setSaving] = useState(false);
    const [hoursHintOpen, setHoursHintOpen] = useState(false);
    const seed = entry ?? clone;
    const isNewFromClone = !entry && !!clone;
    const stripCloneHours = isNewFromClone && !preserveCloneHours;
    const [form, setForm] = useState(() => projects.length > 0 ? resolveInitialForm(seed, defaultDate, projects, tasksByProjectId, stripCloneHours, preferredTaskName) : {
        projectId: '',
        taskId: '',
        task: '',
        date: defaultDate,
        hours: seed && !stripCloneHours ? fmtHours(seed.hours) : '',
        notes: seed?.notes ?? '',
        billable: seed?.billable ?? true,
    });
    const [error, setError] = useState(null);
    const [weeklyLockHint, setWeeklyLockHint] = useState(false);
    const [modalEnterReady, setModalEnterReady] = useState(false);
    const entryFormReady = !projectsLoading && projects.length > 0;
    useEffect(() => {
        const h = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', h);
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', h); document.body.style.overflow = ''; };
    }, [onClose]);
    useEffect(() => {
        setModalEnterReady(false);
    }, [uid, entryFormReady]);
    useEffect(() => {
        if (!entryFormReady)
            return;
        const el = modalRef.current;
        if (!el)
            return;
        let done = false;
        const markReady = () => {
            if (done)
                return;
            done = true;
            setModalEnterReady(true);
        };
        const onAnimEnd = (e) => {
            if (e.target === el && e.animationName === ENTRY_MODAL_ENTER_ANIM)
                markReady();
        };
        el.addEventListener('animationend', onAnimEnd);
        const fallback = window.setTimeout(markReady, ENTRY_MODAL_ENTER_FALLBACK_MS);
        if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
            markReady();
        return () => {
            el.removeEventListener('animationend', onAnimEnd);
            clearTimeout(fallback);
        };
    }, [uid, entryFormReady]);
    useLayoutEffect(() => {
        if (!modalEnterReady)
            return;
        const t = window.setTimeout(() => {
            if (entry?.isVoided)
                return;
            if (entry) {
                notesRef.current?.focus();
                return;
            }
            projSelectRef.current?.focusAndOpen();
        }, 0);
        return () => clearTimeout(t);
    }, [modalEnterReady, entry, uid]);
    function shouldSubmitEntryModalOnEnter(target) {
        const el = target;
        if (!el)
            return false;
        if (el.tagName === 'TEXTAREA')
            return false;
        if (el.closest('.tsp-m__btn--cancel, .tsp-m__x'))
            return false;
        if (el.closest('.tsp-srch--open, .tsp-srch__dropdown, .ttp-pop'))
            return false;
        const srchBtn = el.closest('.tsp-srch__btn');
        if (srchBtn && srchBtn.getAttribute('aria-expanded') !== 'true')
            return false;
        return true;
    }
    function handleEntryModalEnterSubmit(e) {
        if (e.key !== 'Enter' || e.nativeEvent.isComposing)
            return;
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)
            return;
        if (!shouldSubmitEntryModalOnEnter(e.target))
            return;
        e.preventDefault();
        if (!saving && !formDateLocked && !entry?.isVoided)
            void handleSaveRef.current();
    }
    function handleNotesKeyDown(e) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            const el = e.currentTarget;
            const start = el.selectionStart ?? form.notes.length;
            const end = el.selectionEnd ?? form.notes.length;
            const next = `${form.notes.slice(0, start)}\n${form.notes.slice(end)}`;
            setForm((f) => ({ ...f, notes: next }));
            requestAnimationFrame(() => {
                el.selectionStart = start + 1;
                el.selectionEnd = start + 1;
            });
            return;
        }
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (!saving && !formDateLocked && !entry?.isVoided)
                void handleSaveRef.current();
        }
    }
    useEffect(() => {
        if (!hoursHintOpen)
            return;
        const onDocClick = (e) => {
            if (hoursHelpRef.current && !hoursHelpRef.current.contains(e.target))
                setHoursHintOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [hoursHintOpen]);
    useLayoutEffect(() => {
        const el = notesRef.current;
        if (!el)
            return;
        el.style.height = '0px';
        el.style.height = `${el.scrollHeight}px`;
    }, [form.notes]);
    const proj = projects.find((p) => p.id === form.projectId) ?? projects[0];
    const projRecordsLanguageLabel = proj?.recordsLanguage === 'RU'
        ? t('timeTrackingPage.projects.modal.recordsLanguages.ru')
        : t('timeTrackingPage.projects.modal.recordsLanguages.eng');
    const projectTasks = proj ? (tasksByProjectId[proj.id] ?? []) : [];
    const projectTasksListReady = !proj || (!loadingProjectTaskIds.has(proj.id) && tasksByProjectId[proj.id] !== undefined);
    useEffect(() => {
        if (form.projectId)
            onRequestProjectTasks(form.projectId);
    }, [form.projectId, onRequestProjectTasks]);
    const projectsByClient = useMemo(() => groupProjectsByClient(projects), [projects]);
    const flatProjects = useMemo(() => projectsByClient.flatMap(({ projects: grp }) => grp), [projectsByClient]);
    useEffect(() => {
        if (!proj)
            return;
        const tasks = tasksByProjectId[proj.id] ?? [];
        if (tasks.length === 0)
            return;
        setForm((f) => {
            const tel = preferredTaskName ? matchTelephoneCallsTask(tasks) : undefined;
            const match = tel
                ?? tasks.find((t) => t.id === f.taskId)
                ?? tasks.find((t) => t.name === f.task);
            if (match) {
                return {
                    ...f,
                    taskId: match.id,
                    task: match.name,
                    billable: match.billableByDefault,
                };
            }
            const first = tasks[0];
            return { ...f, taskId: first.id, task: first.name, billable: first.billableByDefault };
        });
    }, [proj, tasksByProjectId, preferredTaskName]);
    const hoursForTimerHint = useMemo(() => {
        const t = form.hours.trim();
        if (!t)
            return 0;
        const h = parseHoursStrict(form.hours);
        if (Number.isNaN(h) || h < 0)
            return null;
        return h;
    }, [form.hours]);
    const hoursExceedsLimit = hoursForTimerHint != null && hoursForTimerHint > MAX_MODAL_ENTRY_HOURS;
    const isOtherDayThanToday = useMemo(() => form.date !== formatDate(new Date()), [form.date]);
    const formDateInClosedPeriod = useMemo(() => isWorkDateInClosedReportingPeriod(form.date), [form.date]);
    const formDateInSubmittedWeek = useMemo(() => isWorkDateInSubmittedWeek(entriesSubjectAuthUserId, form.date), [entriesSubjectAuthUserId, form.date]);
    const formDateInSubmittedPastWeek = useMemo(() => formDateInSubmittedWeek && !isWorkDateInCurrentReportingWeek(form.date), [formDateInSubmittedWeek, form.date]);
    const reportingDayBlocked = useMemo(() => isClosedReportingWeekEditingBlockedForSubject(entriesSubjectAuthUserId, form.date, viewerCanOverrideWeeklyLock), [entriesSubjectAuthUserId, form.date, viewerCanOverrideWeeklyLock]);
    const unlockUntilIso = formDateInClosedPeriod && !reportingDayBlocked && !viewerCanOverrideWeeklyLock
        ? getActiveTimeEntryEditUnlockExpiresAtIso(entriesSubjectAuthUserId, form.date)
        : null;
    const entryVoided = Boolean(entry?.isVoided);
    const formDateLocked = reportingDayBlocked || entryVoided;
    const getEntryModalTabStops = useCallback(() => {
        const modal = modalRef.current;
        if (!modal)
            return [];
        const taskBtn = document.getElementById(`${uid}-task-btn`);
        const taskFocusable = Boolean(taskBtn && !taskBtn.hasAttribute('disabled'));
        const stops = [
            document.getElementById(`${uid}-proj-btn`),
            taskFocusable ? taskBtn : null,
            notesRef.current,
            document.getElementById(`${uid}-h`),
            modal.querySelector('.tsp-m__btn--ok:not([disabled])'),
            modal.querySelector('.tsp-m__btn--cancel:not([disabled])'),
            document.getElementById(`${uid}-d`),
        ];
        return stops.filter((el) => !!el && !el.hasAttribute('disabled'));
    }, [uid]);
    const moveEntryModalTabStop = useCallback((from, forward) => {
        const stops = getEntryModalTabStops();
        if (stops.length === 0)
            return;
        const idx = stops.indexOf(from);
        const nextIdx = idx === -1
            ? (forward ? 0 : stops.length - 1)
            : forward
                ? (idx + 1) % stops.length
                : (idx - 1 + stops.length) % stops.length;
        stops[nextIdx]?.focus();
    }, [getEntryModalTabStops]);
    const handleSelectTabFromDropdown = useCallback((sourceButtonId, direction) => {
        const btn = document.getElementById(sourceButtonId);
        if (!btn)
            return;
        moveEntryModalTabStop(btn, direction === 'forward');
    }, [moveEntryModalTabStop]);
    function handleEntryModalTabTrap(e) {
        if (e.key !== 'Tab')
            return;
        const modal = modalRef.current;
        if (!modal)
            return;
        const active = document.activeElement;
        if (active?.closest('.tsp-srch__dropdown--portal') || active?.closest('.ttp-pop--portal'))
            return;
        const stops = getEntryModalTabStops();
        if (stops.length === 0)
            return;
        if (!active || (!modal.contains(active) && !stops.includes(active))) {
            e.preventDefault();
            (e.shiftKey ? stops[stops.length - 1] : stops[0]).focus();
            return;
        }
        const first = stops[0];
        const last = stops[stops.length - 1];
        if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
        else if (e.shiftKey && active === first) {
            e.preventDefault();
            last.focus();
        }
    }
    useLayoutEffect(() => {
        if (!modalEnterReady)
            return;
        if (!pendingTaskFocusRef.current)
            return;
        if (!form.projectId || formDateLocked || !projectTasksListReady || projectTasks.length === 0)
            return;
        pendingTaskFocusRef.current = false;
        taskSelectRef.current?.focusAndOpen();
    }, [modalEnterReady, form.projectId, formDateLocked, projectTasksListReady, projectTasks.length]);
    async function handleSave() {
        if (!proj) {
            setError(t('timeTrackingPage.errors.noProjects'));
            return;
        }
        if (entry?.isVoided) {
            setError(t('timeTrackingPage.errors.voidedByManager'));
            return;
        }
        if (reportingDayBlocked) {
            setError(t('timeTrackingPage.errors.periodClosed'));
            return;
        }
        if (proj && loadingProjectTaskIds.has(proj.id)) {
            setError(t('timeTrackingPage.errors.tasksLoading'));
            return;
        }
        if (projectTasks.length === 0) {
            setError(t('timeTrackingPage.errors.noTasksForProject'));
            return;
        }
        if (!form.taskId.trim()) {
            setError(t('timeTrackingPage.errors.pickTask'));
            return;
        }
        if (form.notes.trim().length < 5) {
            setError(t('timeTrackingPage.errors.noteTooShort'));
            return;
        }
        const h = parseHoursStrict(form.hours);
        if (form.hours && (isNaN(h) || h < 0)) {
            setError(t('timeTrackingPage.errors.timeInvalid'));
            return;
        }
        if (form.hours && h > MAX_MODAL_ENTRY_HOURS) {
            setError(t('timeTrackingPage.errors.maxHoursExceeded'));
            return;
        }
        const rawHours = form.hours ? h : 0;
        const durationSeconds = rawHours > 0 ? Math.max(1, Math.round(rawHours * 3600)) : 0;
        if (form.hours && durationSeconds > 0 && !isValidDurationSeconds(durationSeconds)) {
            if (durationSeconds < MIN_ENTRY_SECONDS) {
                setError(t('timeTrackingPage.errors.minOneMinute'));
            }
            else if (durationSeconds > MAX_ENTRY_SECONDS) {
                setError(t('timeTrackingPage.errors.maxDuration'));
            }
            else {
                setError(t('timeTrackingPage.errors.badDuration'));
            }
            return;
        }
        const payload = {
            id: entry?.id ?? `te_${Date.now()}`,
            date: form.date,
            project: proj.name,
            client: proj.client,
            projectId: proj.id,
            projectCurrency: proj.currency,
            taskId: form.taskId || undefined,
            task: form.task,
            notes: form.notes,
            hours: rawHours,
            durationSeconds,
            billable: form.billable,
            color: proj.color,
            billableAmount: entry?.billableAmount ?? null,
            billableCurrency: entry?.billableCurrency ?? null,
            billableFxAsOf: undefined,
            rateSourceAmount: entry?.rateSourceAmount ?? null,
            rateSourceCurrency: entry?.rateSourceCurrency ?? null,
            fxRateDate: entry?.fxRateDate ?? null,
            fxRateSource: entry?.fxRateSource ?? null,
        };
        setSaving(true);
        setError(null);
        setWeeklyLockHint(false);
        try {
            await Promise.resolve(onSave(payload));
            if (!entry && !form.notes.trim()) {
                if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                    void Notification.requestPermission();
                }
                scheduleTimeEntryNoteMissedReminder(`${proj.client} — ${proj.name}`, t);
            }
            onClose();
        }
        catch (e) {
            const m = e instanceof Error ? e.message : t('timeTrackingPage.errors.saveFailed');
            const is409 = isTimeTrackingHttpError(e, 409);
            if (is409) {
                const { weekStart, weekEnd } = reportingWeekBounds(form.date);
                void listWeeklySubmissions(entriesSubjectAuthUserId, weekStart, weekEnd)
                    .then((rows) => {
                    setUserSubmittedWeeks(entriesSubjectAuthUserId, rows.map((r) => ({
                        weekStart: r.weekStart,
                        weekEnd: r.weekEnd,
                    })));
                })
                    .catch(() => { });
            }
            setWeeklyLockHint(is409);
            setError(/\b503\b|Service Unavailable|недоступен.*курс|FX|ЦБ/i.test(m)
                ? `${m}${t('timeTrackingPage.modal.fxErrorSuffix')}`
                : m);
        }
        finally {
            setSaving(false);
        }
    }
    handleSaveRef.current = handleSave;
    if (projectsLoading) {
        return createPortal(_jsx("div", { className: "tsp-ov", children: _jsxs("div", { className: "tsp-m", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "tsp-m__head", children: [_jsx("h3", { className: "tsp-m__title", children: entry ? t('timeTrackingPage.modal.editEntry') : t('timeTrackingPage.modal.addTime') }), _jsx("button", { type: "button", className: "tsp-m__x", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsx("div", { className: "tsp-m__body", children: _jsx("p", { className: "tsp-m__hint", role: "status", children: t('timeTrackingPage.modal.loadingProjects') }) }), _jsx("div", { className: "tsp-m__foot", children: _jsx("button", { type: "button", className: "tsp-m__btn tsp-m__btn--cancel", onClick: onClose, children: t('timeTrackingPage.close') }) })] }) }), document.body);
    }
    if (!proj) {
        return createPortal(_jsx("div", { className: "tsp-ov", children: _jsxs("div", { className: "tsp-m", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "tsp-m__head", children: [_jsx("h3", { className: "tsp-m__title", children: t('timeTrackingPage.modal.addTime') }), _jsx("button", { type: "button", className: "tsp-m__x", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tsp-m__body", children: [projectsLoadError && _jsx("p", { className: "tsp-m__err", role: "alert", children: projectsLoadError }), _jsx("p", { className: "tsp-m__err", children: t('timeTrackingPage.modal.noAssignedProjects') })] }), _jsx("div", { className: "tsp-m__foot", children: _jsx("button", { type: "button", className: "tsp-m__btn tsp-m__btn--cancel", onClick: onClose, children: t('timeTrackingPage.close') }) })] }) }), document.body);
    }
    return createPortal(_jsx("div", { className: "tsp-ov tsp-ov--entry", children: _jsxs("div", { ref: modalRef, className: `tsp-m tsp-m--time-entry${isOtherDayThanToday ? ' tsp-m--other-day' : ''}${modalEnterReady ? '' : ' tsp-m--entering'}`, style: { '--tsp-m-stripe': isOtherDayThanToday ? '#ef4444' : proj.color }, role: "dialog", "aria-modal": "true", onClick: (e) => e.stopPropagation(), onKeyDownCapture: (e) => {
                handleEntryModalTabTrap(e);
                handleEntryModalEnterSubmit(e);
            }, children: [_jsxs("div", { className: "tsp-m__head tsp-m__head--time-entry", children: [_jsx("button", { type: "button", className: "tsp-m__x", tabIndex: -1, onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) }), _jsx("h3", { className: "tsp-m__title tsp-m__title--time-entry", children: entry?.isVoided ? t('timeTrackingPage.modal.viewEntry') : entry ? t('timeTrackingPage.modal.editing') : t('timeTrackingPage.modal.addTime') })] }), _jsxs("div", { className: "tsp-m__body tsp-m__body--time-entry", children: [_jsx("p", { className: "tsp-m__lbl tsp-m__lbl--section", children: t('timeTrackingPage.modal.projectTaskSection') }), _jsxs("div", { className: "tsp-m__te-field", children: [_jsx(SearchableSelect, { ref: projSelectRef, portalDropdown: true, portalZIndex: 12000, portalMinWidth: 300, portalDropdownClassName: "tsp-srch__dropdown--tall", buttonId: `${uid}-proj-btn`, value: form.projectId, items: flatProjects, getOptionValue: (p) => p.id, getOptionLabel: (p) => `${p.name} — (${p.client})`, getSearchText: (p) => `${p.name} ${p.client}`.replace(/\s+/g, ' ').trim(), getGroupLabel: (p) => p.client, groupItemSort: (a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }), disabled: formDateLocked, onTabFromDropdown: (direction) => handleSelectTabFromDropdown(`${uid}-proj-btn`, direction), renderButtonContent: (p) => (_jsxs("span", { className: "tsp-srch__btn-pick", children: [_jsx("span", { className: "tsp-srch__btn-pick-client", children: p.client }), _jsx("span", { className: "tsp-srch__btn-pick-proj", children: p.name })] })), placeholder: t('timeTrackingPage.modal.projectPlaceholder'), emptyListText: t('timeTrackingPage.modal.noProjects'), noMatchText: t('timeTrackingPage.notFound'), onSelect: (p) => {
                                        const tasks = tasksByProjectId[p.id] ?? [];
                                        if (tasks.length > 0) {
                                            const tel = preferredTaskName ? matchTelephoneCallsTask(tasks) : null;
                                            const match = tel
                                                ?? tasks.find((t) => t.name === form.task)
                                                ?? tasks[0];
                                            setForm((f) => ({
                                                ...f,
                                                projectId: p.id,
                                                taskId: match.id,
                                                task: match.name,
                                                billable: match.billableByDefault,
                                            }));
                                        }
                                        else {
                                            setForm((f) => ({ ...f, projectId: p.id, taskId: '', task: '' }));
                                        }
                                        pendingTaskFocusRef.current = true;
                                    }, renderOption: (p) => (_jsx("span", { className: "tsp-srch__opt-name", children: p.name })), buttonClassName: "tsp-srch__btn--stacked" }), proj && (_jsxs("div", { className: "tsp-m__te-project-meta", children: [_jsxs("p", { className: "tsp-m__te-meta-line", title: t('timeTrackingPage.modal.projectCurrencyTitle'), children: [t('timeTrackingPage.modal.projectCurrency'), " ", proj.currency] }), _jsxs("p", { className: "tsp-m__te-meta-line", title: t('timeTrackingPage.modal.projectRecordsLanguageTitle'), children: [t('timeTrackingPage.modal.projectRecordsLanguage'), " ", projRecordsLanguageLabel] })] }))] }), _jsxs("div", { className: "tsp-m__te-field", children: [_jsx(SearchableSelect, { ref: taskSelectRef, portalDropdown: true, portalZIndex: 12000, portalMinWidth: 260, portalDropdownClassName: "tsp-srch__dropdown--tall", buttonId: `${uid}-task-btn`, value: form.taskId, items: projectTasks, getOptionValue: (task) => task.id, getOptionLabel: (task) => task.name, getSearchText: (task) => task.name, placeholder: t('timeTrackingPage.modal.taskPlaceholder'), emptyListText: t('timeTrackingPage.modal.noTasks'), noMatchText: t('timeTrackingPage.notFound'), disabled: !form.projectId || formDateLocked || !projectTasksListReady || projectTasks.length === 0, onTabFromDropdown: (direction) => handleSelectTabFromDropdown(`${uid}-task-btn`, direction), onSelect: (task) => {
                                        setForm((f) => ({
                                            ...f,
                                            taskId: task.id,
                                            task: task.name,
                                            billable: task.billableByDefault,
                                        }));
                                        requestAnimationFrame(() => notesRef.current?.focus());
                                    }, renderOption: (task) => (_jsxs("span", { className: "tsp-srch__opt-rich", children: [_jsx("span", { className: "tsp-srch__opt-name", children: task.name }), _jsx("span", { className: "tsp-srch__opt-meta", children: task.billableByDefault ? t('timeTrackingPage.modal.billable') : t('timeTrackingPage.modal.nonBillable') })] })) }), proj && !projectTasksListReady && (_jsx("p", { className: "tsp-m__field-note tsp-m__field-note--tight", children: t('timeTrackingPage.modal.tasksIndexLoading') })), proj && projectTasksListReady && projectTasks.length === 0 && (_jsx("p", { className: "tsp-m__field-note tsp-m__field-note--tight", children: t('timeTrackingPage.modal.noTasksInDirectoryHint') }))] }), _jsxs("div", { className: "tsp-m__row tsp-m__row--notes-time", children: [_jsx("div", { className: "tsp-m__f tsp-m__te-notes", children: _jsx("textarea", { ref: notesRef, id: `${uid}-n`, className: "tsp-m__inp tsp-m__inp--textarea tsp-m__inp--te-notes", placeholder: t('timeTrackingPage.modal.notesPlaceholder'), rows: 1, value: form.notes, onChange: e => setForm(f => ({ ...f, notes: e.target.value })), onKeyDown: handleNotesKeyDown, disabled: formDateLocked }) }), _jsxs("div", { className: "tsp-m__f tsp-m__f--te-hours", children: [_jsxs("div", { className: "tsp-m__te-hours-head", ref: hoursHelpRef, children: [_jsx("label", { className: "tsp-m__te-hours-lbl", htmlFor: `${uid}-h`, children: t('timeTrackingPage.modal.hoursLabel') }), _jsx("button", { type: "button", className: "tsp-m__te-hours-help", tabIndex: -1, "aria-label": t('timeTrackingPage.modal.hoursHintTitle'), "aria-expanded": hoursHintOpen, onClick: () => setHoursHintOpen((open) => !open), disabled: formDateLocked, children: "?" }), hoursHintOpen && (_jsxs("div", { className: "tsp-m__te-hours-popover", role: "tooltip", children: [_jsx("p", { className: "tsp-m__te-hours-popover-title", children: t('timeTrackingPage.modal.hoursHintTitle') }), _jsx("p", { className: "tsp-m__te-hours-popover-body", children: t('timeTrackingPage.modal.hoursHintBody') })] }))] }), _jsx("input", { id: `${uid}-h`, type: "text", className: `tsp-m__inp tsp-m__inp--h${hoursExceedsLimit ? ' tsp-m__inp--invalid' : ''}`, placeholder: "0:00", autoComplete: "off", spellCheck: false, inputMode: "numeric", value: form.hours, onChange: e => setForm(f => ({ ...f, hours: sanitizeColonHoursInput(e.target.value) })), onKeyDown: handleEntryModalEnterSubmit, disabled: formDateLocked, "aria-invalid": hoursExceedsLimit || undefined }), hoursExceedsLimit && (_jsx("p", { className: "tsp-m__err tsp-m__err--inline", role: "alert", children: t('timeTrackingPage.errors.maxHoursExceeded') }))] })] }), hoursForTimerHint === 0 && (_jsx("p", { className: "tsp-m__field-note tsp-m__field-note--timer tsp-m__field-note--tight", children: t('timeTrackingPage.modal.timerZeroHint') })), entry && entry.billableAmount != null && Number.isFinite(entry.billableAmount) && (_jsx("div", { className: "tsp-m__f", children: _jsxs("p", { className: "tsp-m__field-note tsp-m__field-note--tight", children: ["API: ", _jsx("strong", { children: formatBillableMoney(entry.billableAmount, entry.billableCurrency ?? proj.currency) })] }) })), entry && isCbuFxUnavailable(entry.fxRateSource) && (entry.billableAmount == null || entry.billableAmount === 0) && (_jsx("div", { className: "tsp-m__f", children: _jsx("p", { className: "tsp-m__err", role: "alert", children: t('timeTrackingPage.modal.fxUnavailable') }) })), entryVoided && !formDateInClosedPeriod && (_jsxs("p", { className: "tsp-m__hint tsp-m__hint--void", role: "status", children: [t('timeTrackingPage.modal.voidViewOnlyPrefix'), entry?.voidKind === 'reallocated' ? t('timeTrackingPage.modal.voidReallocParen') : t('timeTrackingPage.modal.voidRejectParen'), t('timeTrackingPage.modal.voidViewOnlySuffix')] })), reportingDayBlocked && !unlockUntilIso && (_jsx("p", { className: "tsp-m__hint tsp-m__hint--weekly-lock", role: "status", children: formDateInSubmittedPastWeek
                                ? t('timeTrackingPage.modal.weekSubmittedHint')
                                : (_jsxs(_Fragment, { children: [t('timeTrackingPage.modal.weekClosedHint'), " ", _jsx("strong", { children: t('timeTrackingPage.modal.weekClosedHintDeadline') }), ". ", t('timeTrackingPage.modal.weekClosedHintBody')] })) })), unlockUntilIso && (_jsxs("p", { className: "tsp-m__hint tsp-m__hint--unlock-active", role: "status", children: [t('timeTrackingPage.modal.unlockActivePrefix'), ' ', _jsx("strong", { children: new Date(unlockUntilIso).toLocaleString(dateTag, { dateStyle: 'short', timeStyle: 'short' }) }), "."] })), error && !reportingDayBlocked && _jsx("p", { className: "tsp-m__err", children: error }), error && reportingDayBlocked && !weeklyLockHint && _jsx("p", { className: "tsp-m__err", children: error }), weeklyLockHint && reportingDayBlocked && (_jsx("p", { className: "tsp-m__hint tsp-m__hint--weekly-lock", role: "note", children: t('timeTrackingPage.modal.weekClosed409') }))] }), _jsxs("div", { className: "tsp-m__foot tsp-m__foot--time-entry", children: [_jsxs("div", { className: "tsp-m__foot-actions", children: [_jsx("button", { type: "button", className: "tsp-m__btn tsp-m__btn--ok", disabled: !entry?.isVoided && (saving || formDateLocked || hoursExceedsLimit || !projectTasksListReady || projectTasks.length === 0 || !form.taskId.trim()), onClick: () => (entry?.isVoided ? onClose() : void handleSave()), children: entry?.isVoided ? t('timeTrackingPage.close') : saving ? t('timeTrackingPage.saving') : entry ? t('timeTrackingPage.save') : t('timeTrackingPage.modal.add') }), _jsx("button", { type: "button", className: "tsp-m__btn tsp-m__btn--cancel", disabled: saving, onClick: onClose, children: t('timeTrackingPage.cancel') })] }), _jsxs("div", { className: `tsp-m__foot-date${isOtherDayThanToday ? ' tsp-m__foot-date--other-day' : ''}`, children: [_jsx("label", { className: "tsp-m__foot-date-lbl", htmlFor: `${uid}-d`, children: t('timeTrackingPage.timesheet.date') }), _jsx(DatePicker, { id: `${uid}-d`, className: `tsp-m__date-ttp${isOtherDayThanToday ? ' tsp-m__date-ttp--other-day' : ''}`, buttonClassName: `tsp-m__date-ttp-btn${isOtherDayThanToday ? ' tsp-m__date-ttp-btn--other-day' : ''}`, value: form.date, onChange: (iso) => setForm((f) => ({ ...f, date: iso })), disabled: formDateLocked, isDateDisabled: (iso) => isClosedReportingWeekEditingBlockedForSubject(entriesSubjectAuthUserId, iso, viewerCanOverrideWeeklyLock), portal: true, portalZIndex: 12500, title: t('timeTrackingPage.timesheet.workDate'), iconAfterLabel: true, showChevron: false })] })] })] }) }), document.body);
}
