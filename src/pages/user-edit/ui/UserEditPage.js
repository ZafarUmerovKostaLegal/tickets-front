import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useId, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getUser, setUserInitials, listPartners, } from '@entities/user';
import { upsertTimeTrackingUser, getTimeTrackingUser, patchTimeTrackingUserWeeklyCapacity, patchTimeTrackingUserTransferWithoutProjectAccess, listHourlyRates, createHourlyRate, patchHourlyRate, deleteHourlyRate, changeHourlyRateFrom, getUserProjectAccess, putUserProjectAccess, listAllClientProjectsMerged, listAllTimeManagerClientsMerged, isForbiddenError, userFacingProjectAccessError, TIME_TRACKING_PROJECT_CURRENCIES, fetchAllTimeReportProjectRows, } from '@entities/time-tracking';
import { formatPeriodLabel, isoDateLocal, periodToDates } from '@entities/time-tracking/lib/reportsPeriodRange';
import { fmtH } from '@entities/time-tracking/lib/reportsFormatUtils';
import { writeReportPreviewTransfer } from '@entities/time-tracking/model/reportPreviewTransfer';
import { PERIOD_OPTIONS } from '@entities/time-tracking/model/reportsPanelConfig';
import { canAccessAdminPanel } from '@shared/lib/orgRoles';
import { isManualTtAuthUserId, isWithoutAuthRegistration, timeTrackingRowToUser } from '@entities/time-tracking/model/manualUsers';
import { useCurrentUser } from '@shared/hooks';
import { getUserEditUrl, routes } from '@shared/config';
import { AppBackButton, AppHomeLogo, AppPageSettings, SearchableSelect } from '@shared/ui';
import { showConfirm } from '@shared/ui/app-dialog/appDialogGate';
import { collectActivePartnerProjectIds } from '@entities/time-tracking/lib/partnerReportProjectScope';
import { canManageUserProjectAccess } from '@entities/time-tracking/model/timeManagerClientsAccess';
import { canManageHourlyRates } from '@entities/time-tracking/model/timeTrackingAccess';
import { isActiveTimeManagerProjectRow } from '@entities/time-tracking/lib/projectTimeEntry';
import '@pages/time-tracking/ui/TimePageShell.css';
import './UserEditPage.css';
const TAB_IDS = ['basic', 'rates', 'projects'];
function tabFromSearchParam(raw) {
    if (raw === 'basic' || raw === 'rates' || raw === 'projects')
        return raw;
    return 'basic';
}
function shiftPeriodDate(date, granularity, direction) {
    const next = new Date(date);
    if (granularity === 'week')
        next.setDate(next.getDate() + 7 * direction);
    else if (granularity === 'month')
        next.setMonth(next.getMonth() + direction);
    else if (granularity === 'quarter')
        next.setMonth(next.getMonth() + 3 * direction);
    else if (granularity === 'year')
        next.setFullYear(next.getFullYear() + direction);
    return next;
}
function hourlyRowToRate(row) {
    const type = row.rate_kind === 'cost' ? 'cost' : 'billable';
    const amt = typeof row.amount === 'number' ? row.amount : parseFloat(String(row.amount));
    return {
        id: row.id,
        type,
        amount: Number.isFinite(amt) ? amt : 0,
        currency: row.currency,
        startDate: row.valid_from,
        endDate: row.valid_to,
        projectId: row.applies_to_project_id ?? row.project_id ?? null,
    };
}
const UEP_PROJECT_PICKER_CAP = 200;
function hashToColor(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++)
        h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue} 52% 40%)`;
}
function buildProjectCatalog(rows, clientNameById) {
    return rows.map((p) => ({
        id: p.id,
        name: p.name,
        client: clientNameById.get(p.client_id) ?? '',
        color: hashToColor(p.id),
        archived: !isActiveTimeManagerProjectRow(p),
    }));
}
function projectListSortKey(client) {
    const trimmed = client.trim();
    return trimmed || '\uffff';
}
const CAPACITY_DEFAULT = 35;
const CAPACITY_OPTIONS = [20, 25, 30, 35, 40, 45, 50];
function capacityStateFromUser(u) {
    const raw = u.weekly_capacity_hours;
    const n = raw != null && Number.isFinite(Number(raw))
        ? Number(raw)
        : CAPACITY_DEFAULT;
    const capCustom = !CAPACITY_OPTIONS.includes(n);
    return {
        capacity: n,
        capCustom,
        capCustomVal: capCustom ? String(n) : '',
    };
}
function getInitials(name, email) {
    const src = name ?? email ?? '';
    const parts = src.trim().split(/\s+/);
    if (parts.length >= 2)
        return (parts[0][0] + parts[1][0]).toUpperCase();
    return src.charAt(0).toUpperCase() || '?';
}
function displayUserInitials(user) {
    const custom = (user.initials ?? '').trim().toUpperCase();
    if (custom.length >= 3 && custom.length <= 8)
        return custom;
    return getInitials(user.display_name, user.email);
}
function normalizeInitialsInput(raw) {
    return raw
        .toUpperCase()
        .replace(/Ё/g, 'Е')
        .replace(/[^A-ZА-Я]/g, '')
        .slice(0, 8);
}
function splitName(displayName) {
    if (!displayName)
        return { first: '', last: '' };
    const parts = displayName.trim().split(/\s+/);
    return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}
function fmtDate(d) {
    if (!d)
        return '';
    return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
const RATE_PROJECT_PICKER_CAP = 200;
function rateProjectDisplayName(opt) {
    return opt.archived ? `${opt.name} (архив)` : opt.name;
}
function rateProjectOptionLabel(opt) {
    const client = opt.client.trim();
    const name = rateProjectDisplayName(opt);
    return client ? `${name} · ${client}` : name;
}
function RateProjectLevelPicker({ inputId, value, options, disabled, onChange }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const wrapRef = useRef(null);
    const listId = useId();
    const selected = value ? options.find((o) => o.id === value) : null;
    const selectedLabel = selected
        ? rateProjectOptionLabel(selected)
        : 'Общая (во всех проектах)';
    const q = query.trim().toLowerCase();
    const filtered = q
        ? options.filter((o) => o.name.toLowerCase().includes(q) || o.client.toLowerCase().includes(q))
        : options;
    const displayResults = q ? filtered : filtered.slice(0, RATE_PROJECT_PICKER_CAP);
    const listTruncated = !q && options.length > RATE_PROJECT_PICKER_CAP;
    useEffect(() => {
        if (!open)
            return;
        const onDoc = (e) => {
            if (!wrapRef.current?.contains(e.target))
                setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);
    const pick = (projectId) => {
        onChange(projectId);
        setQuery('');
        setOpen(false);
    };
    if (disabled) {
        return (_jsx("input", { id: inputId, className: "uep__input", value: selectedLabel, disabled: true, readOnly: true }));
    }
    return (_jsxs("div", { className: "uep__rate-proj-pick", ref: wrapRef, children: [_jsxs("button", { id: inputId, type: "button", className: `uep__rate-proj-pick-trigger${open ? ' uep__rate-proj-pick-trigger--open' : ''}`, "aria-haspopup": "listbox", "aria-expanded": open, "aria-controls": open ? listId : undefined, onClick: () => setOpen((v) => !v), children: [_jsx("span", { className: "uep__rate-proj-pick-value", children: selectedLabel }), _jsx("svg", { className: "uep__rate-proj-pick-chevron", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("polyline", { points: "6 9 12 15 18 9" }) })] }), open && createPortal((() => {
                const rect = wrapRef.current?.getBoundingClientRect();
                if (!rect)
                    return null;
                return (_jsxs("div", { id: listId, role: "listbox", "aria-label": "\u041F\u0440\u043E\u0435\u043A\u0442\u044B \u0434\u043B\u044F \u0441\u0442\u0430\u0432\u043A\u0438", className: "uep__rate-proj-pick-drop", style: { top: rect.bottom + 4, left: rect.left, width: rect.width }, children: [_jsxs("div", { className: "uep__rate-proj-pick-search", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })] }), _jsx("input", { type: "search", value: query, placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0443 \u0438\u043B\u0438 \u043A\u043B\u0438\u0435\u043D\u0442\u0443", autoFocus: true, onChange: (e) => setQuery(e.target.value), onKeyDown: (e) => {
                                        if (e.key === 'Escape') {
                                            e.preventDefault();
                                            setOpen(false);
                                        }
                                    } }), query && (_jsx("button", { type: "button", "aria-label": "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C", onMouseDown: (e) => {
                                        e.preventDefault();
                                        setQuery('');
                                    }, children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) }))] }), _jsx("button", { type: "button", role: "option", "aria-selected": !value, className: `uep__proj-dropdown-item uep__rate-proj-pick-option${!value ? ' uep__rate-proj-pick-option--active' : ''}`, onMouseDown: () => pick(''), children: _jsxs("span", { className: "uep__proj-dd-body", children: [_jsx("span", { className: "uep__proj-dd-name", children: "\u041E\u0431\u0449\u0430\u044F (\u0432\u043E \u0432\u0441\u0435\u0445 \u043F\u0440\u043E\u0435\u043A\u0442\u0430\u0445)" }), _jsx("span", { className: "uep__proj-dd-client", children: "\u0411\u0435\u0437 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0438 \u043A \u043F\u0440\u043E\u0435\u043A\u0442\u0443" })] }) }), displayResults.length === 0
                            ? (_jsx("p", { className: "uep__proj-dropdown-empty", children: "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u2014 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441" }))
                            : displayResults.map((p) => (_jsxs("button", { type: "button", role: "option", "aria-selected": value === p.id, className: `uep__proj-dropdown-item uep__rate-proj-pick-option${value === p.id ? ' uep__rate-proj-pick-option--active' : ''}`, onMouseDown: () => pick(p.id), children: [_jsx("span", { className: "uep__proj-dd-dot", style: { background: p.color } }), _jsxs("span", { className: "uep__proj-dd-body", children: [_jsx("span", { className: "uep__proj-dd-name", children: rateProjectDisplayName(p) }), p.client
                                                ? _jsx("span", { className: "uep__proj-dd-client", children: p.client })
                                                : p.archived
                                                    ? _jsx("span", { className: "uep__proj-dd-client", children: "\u0410\u0440\u0445\u0438\u0432\u043D\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442" })
                                                    : null] })] }, p.id))), listTruncated && (_jsxs("p", { className: "uep__proj-drop-hint", role: "note", children: ["\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u043F\u0435\u0440\u0432\u044B\u0435 ", RATE_PROJECT_PICKER_CAP, " \u0438\u0437 ", options.length, ". \u0423\u0442\u043E\u0447\u043D\u0438\u0442\u0435 \u043F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E \u0438\u043B\u0438 \u043A\u043B\u0438\u0435\u043D\u0442\u0443."] }))] }));
            })(), document.body)] }));
}
function isoDateMinusOneDay(iso) {
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime()))
        return null;
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}
function ratePeriodsOverlap(aFrom, aTo, bFrom, bTo) {
    const af = aFrom ?? '0000-01-01';
    const at = aTo ?? '9999-12-31';
    const bf = bFrom ?? '0000-01-01';
    const bt = bTo ?? '9999-12-31';
    return af <= bt && bf <= at;
}
function RateFormModal({ rate, type, existingRates, projects, onSave, onClose }) {
    const [amount, setAmount] = useState(rate ? String(rate.amount) : '');
    const [currency, setCurrency] = useState(rate?.currency ?? 'USD');
    const [startDate, setStartDate] = useState(rate?.startDate ?? '');
    const [endDate, setEndDate] = useState(rate?.endDate ?? '');
    const [projectId, setProjectId] = useState(rate?.projectId ?? '');
    const [autoClosePrev, setAutoClosePrev] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const uid = useId();
    const levelId = projectId || null;
    const sameScopeRates = useMemo(() => existingRates.filter((r) => r.currency === currency && (r.projectId ?? null) === levelId), [existingRates, currency, levelId]);
    const autoCloseCandidate = useMemo(() => {
        if (rate || !startDate)
            return null;
        const closeTo = isoDateMinusOneDay(startDate);
        if (!closeTo)
            return null;
        const open = sameScopeRates
            .filter((r) => (r.startDate ?? '0000-01-01') < startDate && (r.endDate == null || r.endDate >= startDate))
            .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
        const prev = open[open.length - 1];
        return prev ? { rate: prev, closeTo } : null;
    }, [rate, startDate, sameScopeRates]);
    const overlapWarning = useMemo(() => {
        const conflict = sameScopeRates.find((r) => {
            if (autoClosePrev && autoCloseCandidate && r.id === autoCloseCandidate.rate.id)
                return false;
            return ratePeriodsOverlap(startDate || null, endDate || null, r.startDate, r.endDate);
        });
        return conflict ?? null;
    }, [sameScopeRates, startDate, endDate, autoClosePrev, autoCloseCandidate]);
    const handleSubmit = async () => {
        const amt = parseFloat(amount);
        if (!amount || isNaN(amt) || amt <= 0) {
            setError('Введите корректную сумму');
            return;
        }
        if (startDate && endDate && startDate > endDate) {
            setError('Дата начала позже даты окончания');
            return;
        }
        if (overlapWarning) {
            setError('Период пересекается с другой ставкой того же типа и валюты. Скорректируйте даты или включите авто-закрытие предыдущей ставки.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const payload = { type, amount: amt, currency, startDate: startDate || null, endDate: endDate || null, projectId: levelId };
            if (autoClosePrev && autoCloseCandidate) {
                payload.autoClosePrevRateId = autoCloseCandidate.rate.id;
                payload.autoClosePrevValidTo = autoCloseCandidate.closeTo;
            }
            await Promise.resolve(onSave(payload));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось сохранить');
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsx("div", { className: "uep__modal-overlay", children: _jsxs("div", { className: "uep__modal", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "uep__modal-head", children: [_jsx("h3", { className: "uep__modal-title", children: rate ? 'Редактировать ставку' : `Новая ${type === 'billable' ? 'оплачиваемая' : 'себестоимость'} ставка` }), _jsx("button", { type: "button", className: "uep__modal-close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "uep__modal-body", children: [_jsxs("div", { className: "uep__field", children: [_jsx("label", { className: "uep__label", htmlFor: `${uid}-level`, children: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u0441\u0442\u0430\u0432\u043A\u0438" }), _jsx(RateProjectLevelPicker, { inputId: `${uid}-level`, value: projectId, options: projects, disabled: !!rate, onChange: setProjectId }), _jsx("p", { className: "uep__hint", children: rate
                                        ? 'Уровень нельзя изменить: удалите ставку и создайте заново, чтобы перенести между проектами.'
                                        : 'Проектная ставка действует только в выбранном проекте и имеет приоритет над общей.' })] }), _jsxs("div", { className: "uep__field", children: [_jsx("label", { className: "uep__label", htmlFor: `${uid}-amount`, children: "\u0421\u0442\u0430\u0432\u043A\u0430 \u0432 \u0447\u0430\u0441" }), _jsxs("div", { className: "uep__rate-amount-row", children: [_jsx("input", { id: `${uid}-amount`, type: "number", min: "0", step: "0.01", className: "uep__input", placeholder: "0.00", value: amount, onChange: (e) => setAmount(e.target.value) }), _jsx("select", { className: "uep__select uep__select--currency", value: currency, onChange: (e) => setCurrency(e.target.value), children: TIME_TRACKING_PROJECT_CURRENCIES.map((c) => (_jsx("option", { value: c, children: c }, c))) })] }), error && _jsx("p", { className: "uep__field-error", children: error })] }), _jsxs("div", { className: "uep__field-row", children: [_jsxs("div", { className: "uep__field", children: [_jsx("label", { className: "uep__label", htmlFor: `${uid}-start`, children: "\u0414\u0430\u0442\u0430 \u043D\u0430\u0447\u0430\u043B\u0430" }), _jsx("input", { id: `${uid}-start`, type: "date", className: "uep__input", value: startDate, onChange: (e) => setStartDate(e.target.value) }), _jsx("p", { className: "uep__hint", children: "\u041F\u0443\u0441\u0442\u043E \u2014 \u00AB\u0441 \u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u0440\u0435\u043C\u0451\u043D\u00BB" })] }), _jsxs("div", { className: "uep__field", children: [_jsx("label", { className: "uep__label", htmlFor: `${uid}-end`, children: "\u0414\u0430\u0442\u0430 \u043E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u044F" }), _jsx("input", { id: `${uid}-end`, type: "date", className: "uep__input", value: endDate, onChange: (e) => setEndDate(e.target.value) }), _jsx("p", { className: "uep__hint", children: "\u041F\u0443\u0441\u0442\u043E \u2014 \u00AB\u0431\u0435\u0437 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0439\u00BB" })] })] }), autoCloseCandidate && (_jsxs("label", { className: "uep__rate-autoclose", children: [_jsx("input", { type: "checkbox", checked: autoClosePrev, onChange: (e) => setAutoClosePrev(e.target.checked) }), _jsxs("span", { children: ["\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0443\u044E \u0441\u0442\u0430\u0432\u043A\u0443 (", autoCloseCandidate.rate.amount, " ", autoCloseCandidate.rate.currency, ") \u0434\u0430\u0442\u043E\u0439 ", fmtDate(autoCloseCandidate.closeTo)] })] })), overlapWarning && (_jsxs("p", { className: "uep__field-error", role: "alert", children: ["\u041F\u0435\u0440\u0438\u043E\u0434 \u043F\u0435\u0440\u0435\u0441\u0435\u043A\u0430\u0435\u0442\u0441\u044F \u0441\u043E \u0441\u0442\u0430\u0432\u043A\u043E\u0439 ", overlapWarning.amount, " ", overlapWarning.currency, ' ', "(", overlapWarning.startDate ? fmtDate(overlapWarning.startDate) : '—', " \u2013 ", overlapWarning.endDate ? fmtDate(overlapWarning.endDate) : 'по наст. время', ")."] }))] }), _jsxs("div", { className: "uep__modal-foot", children: [_jsx("button", { type: "button", className: "uep__btn uep__btn--primary", disabled: saving, onClick: () => void handleSubmit(), children: saving ? 'Сохранение…' : rate ? 'Сохранить' : 'Добавить' }), _jsx("button", { type: "button", className: "uep__btn uep__btn--ghost", disabled: saving, onClick: onClose, children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }) }));
}
function RateChangeFromModal({ type, projectLabel, currency, currentAmount, onSave, onClose }) {
    const [effectiveFrom, setEffectiveFrom] = useState('');
    const [amount, setAmount] = useState('');
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const uid = useId();
    const previewBefore = effectiveFrom ? isoDateMinusOneDay(effectiveFrom) : null;
    const amtNum = parseFloat(amount);
    const handleSubmit = async () => {
        if (!effectiveFrom) {
            setError('Укажите дату начала действия новой ставки');
            return;
        }
        if (!amount || isNaN(amtNum) || amtNum <= 0) {
            setError('Введите корректную сумму (> 0)');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await Promise.resolve(onSave({ effectiveFrom, amount: amtNum, currency }));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось сменить ставку');
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsx("div", { className: "uep__modal-overlay", children: _jsxs("div", { className: "uep__modal", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "uep__modal-head", children: [_jsxs("h3", { className: "uep__modal-title", children: ["\u0421\u043C\u0435\u043D\u0438\u0442\u044C ", type === 'billable' ? 'оплачиваемую' : 'себестоимость', " \u0441\u0442\u0430\u0432\u043A\u0443 \u0441 \u0434\u0430\u0442\u044B"] }), _jsx("button", { type: "button", className: "uep__modal-close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "uep__modal-body", children: [_jsxs("div", { className: "uep__field", children: [_jsx("label", { className: "uep__label", children: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u0441\u0442\u0430\u0432\u043A\u0438" }), _jsx("input", { className: "uep__input", value: projectLabel ?? 'Общая (во всех проектах)', disabled: true, readOnly: true }), _jsx("p", { className: "uep__hint", children: projectLabel
                                        ? 'Новая ставка применится только в этом проекте, начиная с выбранного дня.'
                                        : 'Новая общая ставка применится во всех проектах без собственной проектной ставки на эту дату.' })] }), _jsxs("div", { className: "uep__field-row", children: [_jsxs("div", { className: "uep__field", children: [_jsx("label", { className: "uep__label", htmlFor: `${uid}-eff`, children: "\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0441 \u0434\u0430\u0442\u044B" }), _jsx("input", { id: `${uid}-eff`, type: "date", className: "uep__input", value: effectiveFrom, onChange: (e) => setEffectiveFrom(e.target.value) })] }), _jsxs("div", { className: "uep__field", children: [_jsx("label", { className: "uep__label", htmlFor: `${uid}-amt`, children: "\u041D\u043E\u0432\u0430\u044F \u0441\u0442\u0430\u0432\u043A\u0430 \u0432 \u0447\u0430\u0441" }), _jsxs("div", { className: "uep__rate-amount-row", children: [_jsx("input", { id: `${uid}-amt`, type: "number", min: "0", step: "0.01", className: "uep__input", placeholder: "0.00", value: amount, onChange: (e) => setAmount(e.target.value) }), _jsx("input", { className: "uep__select uep__select--currency", value: currency, disabled: true, readOnly: true, "aria-label": "\u0412\u0430\u043B\u044E\u0442\u0430" })] })] })] }), effectiveFrom && !isNaN(amtNum) && amtNum > 0 && (_jsx("p", { className: "uep__hint", role: "status", children: previewBefore
                                ? `До ${fmtDate(previewBefore)} — ${currentAmount != null ? `${currentAmount.toFixed(2)} ${currency}` : 'старая ставка'}, с ${fmtDate(effectiveFrom)} — ${amtNum.toFixed(2)} ${currency}.`
                                : `С ${fmtDate(effectiveFrom)} — ${amtNum.toFixed(2)} ${currency}.` })), error && _jsx("p", { className: "uep__field-error", role: "alert", children: error })] }), _jsxs("div", { className: "uep__modal-foot", children: [_jsx("button", { type: "button", className: "uep__btn uep__btn--primary", disabled: saving, onClick: () => void handleSubmit(), children: saving ? 'Сохранение…' : 'Сменить ставку' }), _jsx("button", { type: "button", className: "uep__btn uep__btn--ghost", disabled: saving, onClick: onClose, children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }) }));
}
export function UserEditPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user: currentEditor } = useCurrentUser();
    const canEditTTProjectAccess = canManageUserProjectAccess(currentEditor?.role, currentEditor?.time_tracking_role ?? null);
    const canChangeCostRateFromDate = canAccessAdminPanel(currentEditor?.role, currentEditor?.position);
    const canChangeBillableRateFromDate = canChangeCostRateFromDate || canManageHourlyRates(currentEditor);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const activeTab = tabFromSearchParam(searchParams.get('tab'));
    const selectTab = (tab) => {
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            if (tab === 'basic')
                p.delete('tab');
            else
                p.set('tab', tab);
            return p;
        }, { replace: true });
    };
    const [rates, setRates] = useState([]);
    const [rateModal, setRateModal] = useState(null);
    const [rateChangeFromModal, setRateChangeFromModal] = useState(null);
    const [ratesLoading, setRatesLoading] = useState(false);
    const [ratesError, setRatesError] = useState(null);
    const [costRatesForbidden, setCostRatesForbidden] = useState(false);
    const [projectCatalog, setProjectCatalog] = useState([]);
    const [catalogProjectRows, setCatalogProjectRows] = useState([]);
    const [assignedProjectIds, setAssignedProjectIds] = useState([]);
    const [projectsTabLoading, setProjectsTabLoading] = useState(false);
    const [projectsTabError, setProjectsTabError] = useState(null);
    const [projectsTabSaving, setProjectsTabSaving] = useState(false);
    const [transferWithoutProjectAccess, setTransferWithoutProjectAccess] = useState(false);
    const [transferFlagSaving, setTransferFlagSaving] = useState(false);
    const [projectSearch, setProjectSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [partnerAssignId, setPartnerAssignId] = useState('');
    const [partnerOptions, setPartnerOptions] = useState([]);
    const [partnerBulkNotice, setPartnerBulkNotice] = useState(null);
    const partnerAssignSelectId = useId();
    const [assignedProjectsStatus, setAssignedProjectsStatus] = useState('active');
    const [projPeriodDate, setProjPeriodDate] = useState(() => new Date());
    const [projPeriodGranularity, setProjPeriodGranularity] = useState('month');
    const [projPeriodDropdown, setProjPeriodDropdown] = useState(false);
    const [projectHoursById, setProjectHoursById] = useState({});
    const [projectActivityLoading, setProjectActivityLoading] = useState(false);
    const [projectActivityError, setProjectActivityError] = useState(null);
    const projPeriodDropdownRef = useRef(null);
    const searchBoxRef = useRef(null);
    const projPickListId = useId();
    const [capacity, setCapacity] = useState(CAPACITY_DEFAULT);
    const [capCustom, setCapCustom] = useState(false);
    const [capCustomVal, setCapCustomVal] = useState('');
    const [capSaved, setCapSaved] = useState(false);
    const [capSaving, setCapSaving] = useState(false);
    const [capError, setCapError] = useState(null);
    const [initialsInput, setInitialsInput] = useState('');
    const [initialsSaving, setInitialsSaving] = useState(false);
    const [initialsSaved, setInitialsSaved] = useState(false);
    const [initialsError, setInitialsError] = useState(null);
    const [isManualUser, setIsManualUser] = useState(false);
    useEffect(() => {
        if (!id)
            return;
        const authId = Number(id);
        if (!Number.isFinite(authId))
            return;
        setLoading(true);
        setFetchError(null);
        const applyUser = (u, manual) => {
            setUser(u);
            setIsManualUser(manual);
            setRates([]);
            setRatesError(null);
            setCostRatesForbidden(false);
            setAssignedProjectIds([]);
            setProjectCatalog([]);
            setCatalogProjectRows([]);
            setPartnerAssignId('');
            setPartnerBulkNotice(null);
            setProjectsTabError(null);
            setTransferWithoutProjectAccess(false);
            const capSt = capacityStateFromUser(u);
            setCapacity(capSt.capacity);
            setCapCustom(capSt.capCustom);
            setCapCustomVal(capSt.capCustomVal);
            setCapError(null);
            setInitialsInput((u.initials ?? '').trim().toUpperCase());
            setInitialsError(null);
        };
        const loadFromTt = () => getTimeTrackingUser(authId)
            .then((row) => applyUser(timeTrackingRowToUser(row), isWithoutAuthRegistration(row)))
            .catch((e) => setFetchError(e.message ?? 'Ошибка загрузки'));
        if (isManualTtAuthUserId(authId)) {
            void loadFromTt().finally(() => setLoading(false));
            return;
        }
        getUser(authId)
            .then((u) => applyUser(u, false))
            .catch(() => loadFromTt())
            .finally(() => setLoading(false));
    }, [id]);
    useEffect(() => {
        const raw = searchParams.get('tab');
        if (raw != null && !TAB_IDS.includes(raw)) {
            setSearchParams((prev) => {
                const p = new URLSearchParams(prev);
                p.delete('tab');
                return p;
            }, { replace: true });
        }
    }, [searchParams, setSearchParams]);
    const refreshRates = useCallback(async () => {
        if (!user)
            return;
        setRatesLoading(true);
        setRatesError(null);
        try {
            if (!isManualUser)
                await upsertTimeTrackingUser(user);
            const billableRows = await listHourlyRates(user.id, 'billable');
            let costRows = [];
            let costForbidden = false;
            try {
                costRows = await listHourlyRates(user.id, 'cost');
            }
            catch (e) {
                if (isForbiddenError(e))
                    costForbidden = true;
                else
                    throw e;
            }
            setCostRatesForbidden(costForbidden);
            setRates([...billableRows.map(hourlyRowToRate), ...costRows.map(hourlyRowToRate)]);
        }
        catch (e) {
            setRates([]);
            setRatesError(e instanceof Error ? e.message : 'Не удалось загрузить ставки');
        }
        finally {
            setRatesLoading(false);
        }
    }, [user, isManualUser]);
    const persistCapacityHours = useCallback(async (hours) => {
        if (!user)
            return;
        if (hours <= 0 || hours > 168)
            return;
        setCapError(null);
        setCapSaving(true);
        try {
            if (isManualUser) {
                const row = await patchTimeTrackingUserWeeklyCapacity(user.id, hours);
                setUser(timeTrackingRowToUser(row));
            }
            else {
                await upsertTimeTrackingUser(user, { weeklyCapacityHours: hours });
                setUser((prev) => (prev ? { ...prev, weekly_capacity_hours: hours } : null));
            }
            setCapSaved(true);
            setTimeout(() => setCapSaved(false), 2000);
        }
        catch (e) {
            setCapError(e instanceof Error ? e.message : 'Не удалось сохранить');
        }
        finally {
            setCapSaving(false);
        }
    }, [user, isManualUser]);
    const persistInitials = useCallback(async () => {
        if (!user || isManualUser)
            return;
        const normalized = normalizeInitialsInput(initialsInput);
        const current = (user.initials ?? '').trim().toUpperCase();
        if (normalized === current)
            return;
        if (normalized.length > 0 && (normalized.length < 3 || normalized.length > 8)) {
            setInitialsError('Введите от 3 до 8 букв или оставьте поле пустым');
            return;
        }
        setInitialsError(null);
        setInitialsSaving(true);
        try {
            const updated = await setUserInitials(user.id, normalized || null);
            setUser(updated);
            setInitialsInput((updated.initials ?? '').trim().toUpperCase());
            setInitialsSaved(true);
            setTimeout(() => setInitialsSaved(false), 2000);
        }
        catch (e) {
            setInitialsError(e instanceof Error ? e.message : 'Не удалось сохранить инициалы');
        }
        finally {
            setInitialsSaving(false);
        }
    }, [user, isManualUser, initialsInput]);
    useEffect(() => {
        if (!user || activeTab !== 'rates')
            return;
        void refreshRates();
    }, [user, activeTab, refreshRates]);
    useEffect(() => {
        if (!user || (activeTab !== 'projects' && activeTab !== 'rates'))
            return;
        let cancelled = false;
        setProjectsTabLoading(true);
        setProjectsTabError(null);
        (async () => {
            try {
                if (!isManualUser)
                    await upsertTimeTrackingUser(user);
                const [clients, access, catalogRows, ttUser] = await Promise.all([
                    listAllTimeManagerClientsMerged(),
                    getUserProjectAccess(user.id),
                    listAllClientProjectsMerged(true),
                    getTimeTrackingUser(user.id).catch(() => null),
                ]);
                if (cancelled)
                    return;
                const nameById = new Map(clients.map((c) => [c.id, c.name]));
                setCatalogProjectRows(catalogRows);
                setProjectCatalog(buildProjectCatalog(catalogRows, nameById));
                setAssignedProjectIds(access.projectIds);
                setTransferWithoutProjectAccess(ttUser?.can_transfer_time_without_project_access === true);
            }
            catch (e) {
                if (!cancelled) {
                    setProjectsTabError(e instanceof Error ? e.message : 'Не удалось загрузить проекты и доступ');
                    setProjectCatalog([]);
                    setCatalogProjectRows([]);
                    setAssignedProjectIds([]);
                }
            }
            finally {
                if (!cancelled)
                    setProjectsTabLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user, activeTab, isManualUser]);
    useEffect(() => {
        if (activeTab !== 'projects' || !canEditTTProjectAccess)
            return;
        let cancelled = false;
        void listPartners()
            .then((items) => {
            if (cancelled)
                return;
            setPartnerOptions(items
                .map((p) => ({
                id: String(p.id),
                label: (p.display_name?.trim() || p.email?.trim() || `ID ${p.id}`).trim(),
            }))
                .sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' })));
        })
            .catch(() => {
            if (!cancelled)
                setPartnerOptions([]);
        });
        return () => {
            cancelled = true;
        };
    }, [activeTab, canEditTTProjectAccess]);
    const projPeriodRange = useMemo(() => periodToDates(projPeriodDate, projPeriodGranularity), [projPeriodDate, projPeriodGranularity]);
    const projPeriodTitle = useMemo(() => {
        if (projPeriodGranularity === 'all')
            return 'За всё время';
        return formatPeriodLabel(projPeriodDate, projPeriodGranularity);
    }, [projPeriodDate, projPeriodGranularity]);
    useEffect(() => {
        if (!user || activeTab !== 'projects')
            return;
        let cancelled = false;
        setProjectActivityLoading(true);
        setProjectActivityError(null);
        fetchAllTimeReportProjectRows({
            dateFrom: projPeriodRange.dateFrom,
            dateTo: projPeriodRange.dateTo,
            user_id: String(user.id),
        })
            .then((rows) => {
            if (cancelled)
                return;
            const next = {};
            for (const row of rows) {
                const pid = String(row.project_id ?? '').trim();
                if (!pid)
                    continue;
                const hours = Number(row.total_hours);
                if (!Number.isFinite(hours) || hours <= 0)
                    continue;
                next[pid] = (next[pid] ?? 0) + hours;
            }
            setProjectHoursById(next);
        })
            .catch((e) => {
            if (cancelled)
                return;
            setProjectHoursById({});
            setProjectActivityError(e instanceof Error ? e.message : 'Не удалось загрузить активность по проектам');
        })
            .finally(() => {
            if (!cancelled)
                setProjectActivityLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [user, activeTab, projPeriodRange.dateFrom, projPeriodRange.dateTo]);
    useEffect(() => {
        if (!projPeriodDropdown)
            return;
        const onDoc = (e) => {
            if (projPeriodDropdownRef.current && !projPeriodDropdownRef.current.contains(e.target))
                setProjPeriodDropdown(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [projPeriodDropdown]);
    const openProjectReportPreview = useCallback((projectId) => {
        if (!user)
            return;
        const trimmed = projectId.trim();
        if (!trimmed)
            return;
        writeReportPreviewTransfer({
            v: 2,
            reportType: 'time',
            groupBy: 'projects',
            filters: {
                dateFrom: projPeriodRange.dateFrom,
                dateTo: projPeriodRange.dateTo,
                user_id: String(user.id),
                project_id: trimmed,
                page: 1,
                per_page: 500,
            },
            period: {
                periodGranularity: projPeriodGranularity,
                periodAnchorIso: isoDateLocal(projPeriodDate),
                customRangeActive: false,
            },
            returnTo: `${getUserEditUrl(user.id)}?tab=projects`,
        });
        navigate(routes.timeTrackingReportPreview);
    }, [user, projPeriodRange.dateFrom, projPeriodRange.dateTo, projPeriodGranularity, projPeriodDate, navigate]);
    async function persistTransferWithoutProjectAccess(enabled) {
        if (!user || !canEditTTProjectAccess)
            return;
        setTransferFlagSaving(true);
        setProjectsTabError(null);
        const prev = transferWithoutProjectAccess;
        setTransferWithoutProjectAccess(enabled);
        try {
            await patchTimeTrackingUserTransferWithoutProjectAccess(user.id, enabled);
        }
        catch (e) {
            setTransferWithoutProjectAccess(prev);
            setProjectsTabError(e instanceof Error ? e.message : 'Не удалось сохранить право на перенос');
        }
        finally {
            setTransferFlagSaving(false);
        }
    }
    async function persistProjectAccess(nextIds) {
        if (!user || !canEditTTProjectAccess)
            return false;
        setProjectsTabSaving(true);
        setProjectsTabError(null);
        try {
            await putUserProjectAccess(user.id, nextIds);
            setAssignedProjectIds(nextIds);
            return true;
        }
        catch (e) {
            const raw = e instanceof Error ? e.message : 'Не удалось сохранить доступ';
            setProjectsTabError(userFacingProjectAccessError(raw));
            try {
                const a = await getUserProjectAccess(user.id);
                setAssignedProjectIds(a.projectIds);
            }
            catch {
            }
            return false;
        }
        finally {
            setProjectsTabSaving(false);
        }
    }
    async function handleCapacityChange(val) {
        if (val === '__custom__') {
            setCapCustom(true);
            setCapCustomVal('');
            return;
        }
        setCapCustom(false);
        const n = parseInt(val, 10);
        if (isNaN(n) || n <= 0 || n > 168)
            return;
        setCapacity(n);
        await persistCapacityHours(n);
    }
    async function handleCapCustomSave() {
        const n = parseInt(capCustomVal, 10);
        if (isNaN(n) || n <= 0 || n > 168)
            return;
        setCapacity(n);
        await persistCapacityHours(n);
    }
    const handleSaveRate = async (data) => {
        if (!user)
            return;
        const rateKind = data.type === 'cost' ? 'cost' : 'billable';
        if (data.autoClosePrevRateId && data.autoClosePrevValidTo) {
            await patchHourlyRate(user.id, data.autoClosePrevRateId, {
                validTo: data.autoClosePrevValidTo,
            });
        }
        const editing = rateModal?.rate;
        const newStart = data.startDate?.trim() || null;
        const oldStart = editing?.startDate?.trim() || null;
        const amountChanged = editing != null && data.amount !== editing.amount;
        const startChanged = editing != null && newStart !== oldStart;
        if (editing && newStart && (amountChanged || startChanged)) {
            await changeHourlyRateFrom(user.id, {
                rateKind,
                appliesToProjectId: editing.projectId,
                effectiveFrom: newStart,
                amount: data.amount,
                currency: data.currency,
                sourceRateId: editing.id,
            });
            setRateModal(null);
            await refreshRates();
            return;
        }
        if (editing) {
            await patchHourlyRate(user.id, editing.id, {
                amount: String(data.amount),
                currency: data.currency,
                validFrom: newStart,
                validTo: data.endDate?.trim() || null,
            });
        }
        else {
            await createHourlyRate(user.id, {
                rateKind,
                amount: String(data.amount),
                currency: data.currency,
                validFrom: newStart,
                validTo: data.endDate?.trim() || null,
                appliesToProjectId: data.projectId,
            });
        }
        setRateModal(null);
        await refreshRates();
    };
    const handleDeleteRate = async (rateId) => {
        if (!user)
            return;
        setRatesError(null);
        try {
            await deleteHourlyRate(user.id, rateId);
            await refreshRates();
        }
        catch (e) {
            setRatesError(e instanceof Error ? e.message : 'Не удалось удалить ставку');
        }
    };
    const handleChangeRateFrom = async (data) => {
        if (!user || !rateChangeFromModal)
            return;
        await changeHourlyRateFrom(user.id, {
            rateKind: rateChangeFromModal.type,
            appliesToProjectId: rateChangeFromModal.projectId,
            effectiveFrom: data.effectiveFrom,
            amount: data.amount,
            currency: data.currency,
            sourceRateId: rateChangeFromModal.sourceRateId,
        });
        setRateChangeFromModal(null);
        await refreshRates();
    };
    const assignProject = (projId) => {
        if (!user || !canEditTTProjectAccess || assignedProjectIds.includes(projId))
            return;
        void persistProjectAccess([...assignedProjectIds, projId]);
        setProjectSearch('');
        setSearchOpen(false);
    };
    const removeProject = (projId) => {
        if (!user || !canEditTTProjectAccess)
            return;
        void persistProjectAccess(assignedProjectIds.filter((x) => x !== projId));
    };
    const clearAllProjects = () => {
        if (!user || !canEditTTProjectAccess)
            return;
        void persistProjectAccess([]);
    };
    const assignAllActiveProjectsOfPartner = async () => {
        if (!user || !canEditTTProjectAccess || !partnerAssignId)
            return;
        const partnerId = Number(partnerAssignId);
        if (!Number.isFinite(partnerId) || partnerId <= 0)
            return;
        const partnerLabel = partnerOptions.find((p) => p.id === partnerAssignId)?.label ?? partnerAssignId;
        const activeIds = collectActivePartnerProjectIds(catalogProjectRows, partnerId);
        if (activeIds.length === 0) {
            setPartnerBulkNotice(`У партнёра «${partnerLabel}» нет активных проектов`);
            return;
        }
        const assigned = new Set(assignedProjectIds);
        const newIds = activeIds.filter((id) => !assigned.has(id));
        if (newIds.length === 0) {
            setPartnerBulkNotice(`Все активные проекты партнёра «${partnerLabel}» уже назначены (${activeIds.length})`);
            return;
        }
        const ok = await showConfirm({
            title: 'Назначить проекты партнёра',
            message: `Подключить ${user.display_name?.trim() || user.email} ко всем активным проектам партнёра «${partnerLabel}»? Будет добавлено ${newIds.length} из ${activeIds.length}.`,
            confirmLabel: 'Подключить',
            cancelLabel: 'Отмена',
        });
        if (!ok)
            return;
        const next = [...assignedProjectIds];
        for (const id of newIds)
            next.push(id);
        const saved = await persistProjectAccess(next);
        if (saved)
            setPartnerBulkNotice(`Добавлен доступ к ${newIds.length} активным проектам партнёра «${partnerLabel}»`);
    };
    const projectById = useMemo(() => new Map(projectCatalog.map((p) => [p.id, p])), [projectCatalog]);
    const rateProjectLabel = useCallback((r) => {
        if (!r.projectId)
            return 'Общая';
        const p = projectById.get(r.projectId);
        if (!p)
            return `Проект ${r.projectId}`;
        return rateProjectOptionLabel(p);
    }, [projectById]);
    const sortRatesForDisplay = useCallback((list) => {
        return [...list].sort((a, b) => {
            if (!a.projectId && b.projectId)
                return -1;
            if (a.projectId && !b.projectId)
                return 1;
            const an = a.projectId ? rateProjectLabel(a) : '';
            const bn = b.projectId ? rateProjectLabel(b) : '';
            const c = an.localeCompare(bn, 'ru', { sensitivity: 'base' });
            if (c !== 0)
                return c;
            return (a.startDate ?? '').localeCompare(b.startDate ?? '');
        });
    }, [rateProjectLabel]);
    const billableRates = useMemo(() => sortRatesForDisplay(rates.filter((r) => r.type === 'billable')), [rates, sortRatesForDisplay]);
    const costRates = useMemo(() => sortRatesForDisplay(rates.filter((r) => r.type === 'cost')), [rates, sortRatesForDisplay]);
    const rateProjectOptions = useMemo(() => {
        const seen = new Set();
        const out = [];
        for (const p of projectCatalog) {
            seen.add(p.id);
            out.push({
                id: p.id,
                name: p.name,
                client: p.client,
                color: p.color,
                archived: p.archived,
            });
        }
        const extraIds = [
            ...assignedProjectIds,
            ...rates.map((r) => r.projectId).filter((pid) => Boolean(pid)),
        ];
        for (const pid of extraIds) {
            if (seen.has(pid))
                continue;
            seen.add(pid);
            out.push({
                id: pid,
                name: 'Неизвестный проект',
                client: 'Не найден в каталоге',
                color: hashToColor(pid),
                archived: false,
            });
        }
        out.sort((a, b) => {
            if (a.archived !== b.archived)
                return a.archived ? 1 : -1;
            const byClient = projectListSortKey(a.client).localeCompare(projectListSortKey(b.client), 'ru', { sensitivity: 'base' });
            if (byClient !== 0)
                return byClient;
            return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
        });
        return out;
    }, [projectCatalog, assignedProjectIds, rates]);
    if (loading) {
        return (_jsx("div", { className: "time-page time-page--enter uep", "aria-busy": "true", "aria-live": "polite", children: _jsxs("main", { className: "time-page__main", children: [_jsxs("div", { className: "time-page__navbar", "aria-hidden": true, children: [_jsx("span", { className: "uep__skel uep__skel--back" }), _jsx("div", { className: "time-page__navbar-sep" }), _jsx("div", { className: "time-page__navbar-tabs time-page__navbar-tabs--skel", style: { height: 56, alignItems: 'center' }, children: [64, 52, 58].map((w, i) => (_jsx("span", { className: "time-page__navbar-tab-skel", style: { width: w } }, i))) }), _jsx("div", { className: "time-page__navbar-spacer" }), _jsx("span", { className: "uep__skel", style: { width: 72, height: 28, borderRadius: 20 } }), _jsx("div", { className: "time-page__navbar-settings", children: _jsx("span", { className: "uep__skel", style: { width: 32, height: 32, borderRadius: 8 } }) })] }), _jsx("div", { className: "time-page__content", children: _jsxs("div", { className: "uep-profile uep-profile--skel", children: [_jsxs("div", { className: "uep-profile__hero uep-profile__hero--skel", children: [_jsxs("div", { className: "uep-profile__identity", children: [_jsx("div", { className: "uep__skel uep__skel--avatar", style: { width: 56, height: 56 } }), _jsxs("div", { children: [_jsx("span", { className: "uep__skel uep__skel--line", style: { maxWidth: 200 } }), _jsx("span", { className: "uep__skel uep__skel--line uep__skel--md", style: { marginTop: 8, maxWidth: 240 } })] })] }), _jsxs("div", { className: "uep-profile__meta uep-profile__meta--skel", children: [_jsx("span", { className: "uep__skel", style: { width: 80, height: 12 } }), _jsx("span", { className: "uep__skel", style: { width: 100, height: 12 } })] })] }), _jsxs("div", { className: "uep__section", style: { marginTop: 8 }, children: [_jsxs("div", { className: "uep__section-head", children: [_jsx("span", { className: "uep__skel uep__skel--icon" }), _jsxs("div", { children: [_jsx("span", { className: "uep__skel uep__skel--title" }), _jsx("span", { className: "uep__skel uep__skel--desc", style: { display: 'block', marginTop: 8 } })] })] }), _jsxs("div", { className: "uep__form", children: [_jsx("span", { className: "uep__skel uep__skel--field" }), _jsx("span", { className: "uep__skel uep__skel--field" })] })] })] }) })] }) }));
    }
    if (fetchError || !user) {
        return (_jsx("div", { className: "time-page time-page--enter uep", children: _jsx("main", { className: "time-page__main", children: _jsxs("div", { className: "uep__fetch-error", style: { flex: 1, minHeight: '50vh' }, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("line", { x1: "12", y1: "8", x2: "12", y2: "12" }), _jsx("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })] }), _jsx("p", { children: fetchError ?? 'Пользователь не найден' }), _jsx(AppBackButton, { historyBack: true })] }) }) }));
    }
    const { first, last } = splitName(user.display_name);
    const initials = displayUserInitials(user);
    const statusKey = user.is_archived ? 'archived' : user.is_blocked ? 'blocked' : 'active';
    const statusLabel = user.is_archived ? 'В архиве' : user.is_blocked ? 'Заблокирован' : 'Активен';
    const TABS = [
        {
            id: 'basic', label: 'Основная информация',
            icon: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }), _jsx("circle", { cx: "12", cy: "7", r: "4" })] }),
        },
        {
            id: 'rates', label: 'Ставки',
            icon: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "12", y1: "1", x2: "12", y2: "23" }), _jsx("path", { d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" })] }),
        },
        {
            id: 'projects', label: 'Проекты',
            icon: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "2", y: "7", width: "20", height: "14", rx: "2" }), _jsx("path", { d: "M16 7V5a2 2 0 0 0-4 0v2" }), _jsx("path", { d: "M8 7V5a2 2 0 0 0-4 0v2" })] }),
        },
    ];
    return (_jsxs("div", { className: "time-page time-page--enter uep", children: [_jsxs("main", { className: "time-page__main", children: [_jsxs("nav", { className: "time-page__navbar", "aria-label": "\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430", children: [_jsx(AppBackButton, { historyBack: true, hideLabelOnMobile: true }), _jsx(AppHomeLogo, { withSeparator: true }), _jsx("div", { className: "time-page__navbar-sep", "aria-hidden": true }), _jsx("span", { className: "time-page__navbar-title", children: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C" }), _jsx("div", { className: "time-page__navbar-sep", "aria-hidden": true }), _jsx("div", { className: "time-page__navbar-tabs", role: "tablist", "aria-label": "\u0420\u0430\u0437\u0434\u0435\u043B\u044B \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438", children: TABS.map((t) => (_jsxs("button", { type: "button", role: "tab", id: `uep-tab-${t.id}`, "aria-selected": activeTab === t.id, "aria-controls": `uep-panel-${t.id}`, className: `time-page__navbar-tab${activeTab === t.id ? ' time-page__navbar-tab--active' : ''}`, onClick: () => selectTab(t.id), children: [t.id === 'basic' && 'Основное', t.id === 'rates' && 'Ставки', t.id === 'projects' && 'Проекты'] }, t.id))) }), _jsx("div", { className: "time-page__navbar-spacer" }), _jsx("span", { className: `uep__navbar-status uep__navbar-status--${statusKey}`, children: statusLabel }), _jsx("div", { className: "time-page__navbar-settings", children: _jsx(AppPageSettings, {}) })] }), _jsx("div", { className: "time-page__content time-page__content--enter", children: _jsxs("div", { className: "uep-profile", children: [_jsxs("section", { className: "uep-profile__hero", "aria-label": "\u0421\u0432\u043E\u0434\u043A\u0430", children: [_jsxs("div", { className: "uep-profile__identity", children: [_jsxs("div", { className: "uep-profile__avatar-wrap", children: [user.picture
                                                            ? _jsx("img", { src: user.picture, alt: "", className: "uep-profile__avatar-img" })
                                                            : _jsx("span", { className: "uep-profile__avatar-initials", "aria-hidden": true, children: initials }), _jsx("span", { className: `uep-profile__status-dot uep-profile__status-dot--${statusKey}`, title: statusLabel })] }), _jsxs("div", { className: "uep-profile__id-block", children: [_jsxs("h1", { className: "uep-profile__name", children: [user.display_name ?? user.email, isManualUser ? (_jsx("span", { className: "uep-profile__manual-badge", children: "\u0411\u0435\u0437 \u0432\u0445\u043E\u0434\u0430 \u0432 \u0441\u0438\u0441\u0442\u0435\u043C\u0443" })) : null] }), _jsx("p", { className: `uep-profile__position${user.position?.trim() ? '' : ' uep-profile__position--empty'}`, children: user.position?.trim() || 'Должность не указана' }), _jsx("p", { className: "uep-profile__email", children: user.email })] })] }), _jsxs("dl", { className: "uep-profile__meta", children: [_jsxs("div", { className: "uep-profile__meta-item", children: [_jsx("dt", { children: "ID" }), _jsx("dd", { children: _jsxs("span", { className: "uep-profile__meta-mono", children: ["#", user.id] }) })] }), _jsxs("div", { className: "uep-profile__meta-item", children: [_jsx("dt", { children: "\u0421\u043E\u0437\u0434\u0430\u043D" }), _jsx("dd", { children: new Date(user.created_at).toLocaleDateString('ru-RU') })] }), user.updated_at && (_jsxs("div", { className: "uep-profile__meta-item", children: [_jsx("dt", { children: "\u041E\u0431\u043D\u043E\u0432\u043B\u0451\u043D" }), _jsx("dd", { children: new Date(user.updated_at).toLocaleDateString('ru-RU') })] })), _jsxs("div", { className: "uep-profile__meta-item", children: [_jsx("dt", { children: "\u041F\u0440\u043E\u0435\u043A\u0442\u043E\u0432" }), _jsx("dd", { children: assignedProjectIds.length })] })] })] }), activeTab === 'basic' && (_jsx("div", { id: "uep-panel-basic", role: "tabpanel", "aria-labelledby": "uep-tab-basic", className: "uep__tab-panel", children: _jsxs("div", { className: "uep__section", children: [_jsxs("div", { className: "uep__section-head", children: [_jsx("div", { className: "uep__section-head-icon", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }), _jsx("circle", { cx: "12", cy: "7", r: "4" })] }) }), _jsxs("div", { className: "uep__section-head-text", children: [_jsx("h2", { className: "uep__section-title", children: "\u041E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435" }), _jsx("p", { className: "uep__section-desc", children: isManualUser
                                                                    ? 'Сотрудник создан в учёте времени без регистрации в Microsoft. Имя и email редактируются только при создании записи.'
                                                                    : 'Данные аккаунта синхронизируются из Microsoft Azure AD.' })] })] }), _jsxs("div", { className: "uep__form", children: [_jsxs("div", { className: "uep__field-row", children: [_jsxs("div", { className: "uep__field", children: [_jsx("label", { className: "uep__label", children: "\u0418\u043C\u044F" }), _jsx("input", { type: "text", className: "uep__input uep__input--readonly", value: first, readOnly: true })] }), _jsxs("div", { className: "uep__field", children: [_jsx("label", { className: "uep__label", children: "\u0424\u0430\u043C\u0438\u043B\u0438\u044F" }), _jsx("input", { type: "text", className: "uep__input uep__input--readonly", value: last, readOnly: true })] })] }), !isManualUser ? (_jsxs("div", { className: "uep__field", children: [_jsx("label", { className: "uep__label", htmlFor: "uep-initials", children: "\u0418\u043D\u0438\u0446\u0438\u0430\u043B\u044B" }), _jsxs("div", { className: "uep__initials-row", children: [_jsx("input", { id: "uep-initials", type: "text", className: "uep__input uep__input--initials", value: initialsInput, maxLength: 8, placeholder: "\u041D\u0430\u043F\u0440. ZUM", disabled: initialsSaving, onChange: (e) => {
                                                                            setInitialsInput(normalizeInitialsInput(e.target.value));
                                                                            setInitialsError(null);
                                                                        }, onKeyDown: (e) => {
                                                                            if (e.key === 'Enter')
                                                                                void persistInitials();
                                                                        }, onBlur: () => void persistInitials() }), _jsx("button", { type: "button", className: "uep__cap-save-btn", disabled: initialsSaving, onClick: () => void persistInitials(), children: initialsSaving ? 'Сохранение…' : initialsSaved ? 'Сохранено' : 'Сохранить' })] }), _jsx("p", { className: "uep__hint", children: "\u0422\u0440\u0438 \u0431\u0443\u043A\u0432\u044B \u0434\u043B\u044F \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0435 (\u043B\u0430\u0442\u0438\u043D\u0438\u0446\u0430 \u0438\u043B\u0438 \u043A\u0438\u0440\u0438\u043B\u043B\u0438\u0446\u0430). \u041D\u0435 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u0441 Azure AD." }), initialsError ? (_jsx("p", { className: "uep__field-error", role: "alert", children: initialsError })) : null] })) : null, _jsxs("div", { className: "uep__field", children: [_jsx("label", { className: "uep__label", children: "\u0420\u0430\u0431\u043E\u0447\u0438\u0439 email" }), _jsx("input", { type: "email", className: "uep__input uep__input--readonly", value: user.email, readOnly: true }), _jsx("p", { className: "uep__hint", children: isManualUser
                                                                    ? 'Служебный email для справочника TT; в интерфейсе ориентируйтесь на ФИО.'
                                                                    : 'Email привязан к корпоративному аккаунту Microsoft и не может быть изменён здесь.' })] }), _jsxs("div", { className: "uep__cap-block", children: [_jsx("div", { className: "uep__cap-label-wrap", children: _jsx("span", { className: "uep__cap-label", children: "\u041D\u0430\u0433\u0440\u0443\u0437\u043A\u0430" }) }), _jsxs("div", { className: "uep__cap-control", children: [_jsxs("div", { className: "uep__cap-select-wrap", children: [_jsxs("select", { className: "uep__cap-select", value: capCustom ? '__custom__' : String(capacity), disabled: capSaving, onChange: (e) => void handleCapacityChange(e.target.value), children: [CAPACITY_OPTIONS.map(h => (_jsxs("option", { value: String(h), children: [h, h === CAPACITY_DEFAULT ? ' (по умолчанию)' : ''] }, h))), _jsx("option", { value: "__custom__", children: "\u0421\u0432\u043E\u0451 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435\u2026" })] }), _jsx("svg", { className: "uep__cap-chevron", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("polyline", { points: "6 9 12 15 18 9" }) })] }), capCustom && (_jsxs("div", { className: "uep__cap-custom-wrap", children: [_jsx("input", { type: "number", min: "1", max: "168", className: "uep__cap-custom-inp", placeholder: "\u043D\u0430\u043F\u0440. 32", value: capCustomVal, onChange: e => setCapCustomVal(e.target.value), onKeyDown: (e) => e.key === 'Enter' && void handleCapCustomSave() }), _jsx("button", { type: "button", className: "uep__cap-save-btn", disabled: capSaving, onClick: () => void handleCapCustomSave(), children: capSaving ? 'Сохранение…' : 'Сохранить' })] })), _jsx("span", { className: "uep__cap-unit", children: "\u0447\u0430\u0441\u043E\u0432 \u0432 \u043D\u0435\u0434\u0435\u043B\u044E" }), capSaved && (_jsxs("span", { className: "uep__cap-saved", children: [_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: _jsx("polyline", { points: "20 6 9 17 4 12" }) }), "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E"] }))] }), _jsx("p", { className: "uep__cap-hint", children: "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0447\u0430\u0441\u043E\u0432 \u0432 \u043D\u0435\u0434\u0435\u043B\u044E, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0434\u043B\u044F \u0440\u0430\u0431\u043E\u0442\u044B." }), user.weekly_capacity_hours == null && (_jsxs("p", { className: "uep__hint", style: { marginTop: '0.35rem' }, children: ["\u0412 \u0441\u0435\u0440\u0432\u0438\u0441\u0435 \u0443\u0447\u0451\u0442\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u043D\u043E\u0440\u043C\u0430 \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u0434\u0430\u043D\u0430; \u0434\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u043E \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E (", CAPACITY_DEFAULT, " \u0447)."] })), capError && (_jsx("p", { className: "uep__field-error", role: "alert", style: { marginTop: '0.5rem' }, children: capError }))] })] })] }) })), activeTab === 'rates' && (_jsx("div", { id: "uep-panel-rates", role: "tabpanel", "aria-labelledby": "uep-tab-rates", className: "uep__tab-panel", children: _jsxs("div", { className: "uep__section", children: [_jsxs("div", { className: "uep__section-head", children: [_jsx("div", { className: "uep__section-head-icon", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "12", y1: "1", x2: "12", y2: "23" }), _jsx("path", { d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" })] }) }), _jsxs("div", { className: "uep__section-head-text", children: [_jsx("h2", { className: "uep__section-title", children: "\u0421\u0442\u0430\u0432\u043A\u0438 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E" }), _jsxs("p", { className: "uep__rates-desc", style: { marginTop: '0.35rem' }, children: ["\u0414\u043B\u044F \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u043D\u0430 \u043F\u0440\u043E\u0435\u043A\u0442 \u0432 \u0432\u0430\u043B\u044E\u0442\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u043D\u0443\u0436\u043D\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0430\u044F ", _jsx("strong", { children: "\u043E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u0430\u044F" }), " \u0441\u0442\u0430\u0432\u043A\u0430 \u0432 \u044D\u0442\u043E\u0439 \u0432\u0430\u043B\u044E\u0442\u0435.", ' ', _jsx("strong", { children: "\u0421\u0435\u0431\u0435\u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C" }), " \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043A \u043F\u0440\u043E\u0435\u043A\u0442\u0443 \u043D\u0430 \u0441\u0442\u043E\u0440\u043E\u043D\u0435 \u0441\u0435\u0440\u0432\u0438\u0441\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F; \u0435\u0451 \u043C\u043E\u0436\u043D\u043E \u0432\u0435\u0441\u0442\u0438 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E."] })] })] }), _jsxs("div", { className: "uep__form", children: [ratesError && (_jsx("p", { className: "uep__field-error", role: "alert", style: { marginBottom: '1rem' }, children: ratesError })), ratesLoading && (_jsx("p", { className: "uep__rates-desc", role: "status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0441\u0442\u0430\u0432\u043E\u043A\u2026" })), _jsxs("div", { className: "uep__rates-block", children: [_jsxs("div", { className: "uep__rates-header", children: [_jsxs("div", { children: [_jsx("h2", { className: "uep__rates-title", children: "\u041E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0435 \u0441\u0442\u0430\u0432\u043A\u0438" }), _jsx("p", { className: "uep__rates-desc", children: "\u0421\u0442\u0430\u0432\u043A\u0430, \u043F\u043E \u043A\u043E\u0442\u043E\u0440\u043E\u0439 \u043A\u043B\u0438\u0435\u043D\u0442 \u043E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u0442 \u0432\u0440\u0435\u043C\u044F \u044D\u0442\u043E\u0433\u043E \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430. \u0422\u043E\u043B\u044C\u043A\u043E \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u044B \u0438 \u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440\u044B \u0432\u0438\u0434\u044F\u0442 \u0441\u0443\u043C\u043C\u044B." })] }), _jsxs("button", { type: "button", className: "uep__btn uep__btn--add", disabled: ratesLoading, onClick: () => setRateModal({ type: 'billable' }), children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }), "\u041D\u043E\u0432\u0430\u044F \u0441\u0442\u0430\u0432\u043A\u0430"] })] }), billableRates.length > 0 ? (_jsx("div", { className: "uep__rates-table-wrap", children: _jsxs("table", { className: "uep__rates-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u0421\u0442\u0430\u0432\u043A\u0430 \u0432 \u0447\u0430\u0441" }), _jsx("th", { children: "\u041F\u0440\u043E\u0435\u043A\u0442" }), _jsx("th", { children: "\u041D\u0430\u0447\u0430\u043B\u043E" }), _jsx("th", { children: "\u041E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u0435" }), _jsx("th", {})] }) }), _jsx("tbody", { children: billableRates.map((r) => (_jsxs("tr", { children: [_jsxs("td", { className: "uep__rate-amount", children: [r.amount.toFixed(2), " ", _jsx("span", { className: "uep__rate-currency", children: r.currency })] }), _jsx("td", { className: "uep__rate-project", children: r.projectId
                                                                                            ? _jsx("span", { className: "uep__rate-project-tag", children: rateProjectLabel(r) })
                                                                                            : _jsx("span", { className: "uep__rate-all", children: "\u041E\u0431\u0449\u0430\u044F" }) }), _jsx("td", { className: "uep__rate-date", children: r.startDate ? fmtDate(r.startDate) : _jsx("span", { className: "uep__rate-all", children: "\u0421 \u043D\u0430\u0447\u0430\u043B\u0430" }) }), _jsx("td", { className: "uep__rate-date", children: r.endDate ? fmtDate(r.endDate) : _jsx("span", { className: "uep__rate-all", children: "\u0411\u0435\u0437 \u043A\u043E\u043D\u0446\u0430" }) }), _jsxs("td", { className: "uep__rate-actions", children: [canChangeBillableRateFromDate && (_jsx("button", { type: "button", className: "uep__rate-btn", onClick: () => setRateChangeFromModal({ type: 'billable', projectId: r.projectId ?? null, projectLabel: r.projectId ? rateProjectLabel(r) : null, currency: r.currency, currentAmount: r.amount, sourceRateId: r.id }), children: "\u0421\u043C\u0435\u043D\u0438\u0442\u044C \u0441 \u0434\u0430\u0442\u044B" })), _jsx("button", { type: "button", className: "uep__rate-btn", onClick: () => setRateModal({ type: 'billable', rate: r }), children: "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C" }), _jsx("button", { type: "button", className: "uep__rate-btn uep__rate-btn--del", onClick: () => void handleDeleteRate(r.id), children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] })] }, r.id))) })] }) })) : (_jsx("div", { className: "uep__rates-empty", children: "\u041D\u0435\u0442 \u043E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0445 \u0441\u0442\u0430\u0432\u043E\u043A" })), _jsx("p", { className: "uep__hint", style: { marginTop: '0.5rem' }, children: "\u00AB\u041E\u0431\u0449\u0430\u044F\u00BB \u0441\u0442\u0430\u0432\u043A\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0432\u043E \u0432\u0441\u0435\u0445 \u043F\u0440\u043E\u0435\u043A\u0442\u0430\u0445; \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u0430\u044F \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u0441\u0432\u043E\u0451\u043C \u043F\u0440\u043E\u0435\u043A\u0442\u0435 \u0438 \u0438\u043C\u0435\u0435\u0442 \u043F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442. \u0414\u043B\u044F \u043E\u0434\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u043C\u043E\u0436\u043D\u043E \u0437\u0430\u0434\u0430\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u043E\u0432." })] }), _jsx("div", { className: "uep__divider" }), costRatesForbidden ? (_jsxs("div", { className: "uep__rates-block", children: [_jsx("h2", { className: "uep__rates-title", children: "\u0421\u0442\u0430\u0432\u043A\u0438 \u0441\u0435\u0431\u0435\u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u0438" }), _jsx("p", { className: "uep__rates-empty", style: { marginTop: '0.5rem' }, children: "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0438 \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0441\u0442\u0430\u0432\u043E\u043A \u0441\u0435\u0431\u0435\u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0442\u043E\u043B\u044C\u043A\u043E \u0433\u043B\u0430\u0432\u043D\u043E\u043C\u0443 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0443 \u0438 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0443." })] })) : (_jsxs("div", { className: "uep__rates-block", children: [_jsxs("div", { className: "uep__rates-header", children: [_jsxs("div", { children: [_jsx("h2", { className: "uep__rates-title", children: "\u0421\u0442\u0430\u0432\u043A\u0438 \u0441\u0435\u0431\u0435\u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u0438" }), _jsx("p", { className: "uep__rates-desc", children: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u0437\u0430\u0442\u0440\u0430\u0442\u044B \u043D\u0430 \u044D\u0442\u043E\u0433\u043E \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430. \u041E\u0431\u0449\u0430\u044F \u0441\u0442\u0430\u0432\u043A\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0432\u043E \u0432\u0441\u0435\u0445 \u043F\u0440\u043E\u0435\u043A\u0442\u0430\u0445, \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u0430\u044F \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u0441\u0432\u043E\u0451\u043C. \u0412\u0438\u0434\u043D\u044B \u0442\u043E\u043B\u044C\u043A\u043E \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430\u043C." })] }), _jsxs("button", { type: "button", className: "uep__btn uep__btn--add", disabled: ratesLoading, onClick: () => setRateModal({ type: 'cost' }), children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }), "\u041D\u043E\u0432\u0430\u044F \u0441\u0442\u0430\u0432\u043A\u0430"] })] }), costRates.length > 0 ? (_jsx("div", { className: "uep__rates-table-wrap", children: _jsxs("table", { className: "uep__rates-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u0421\u0442\u0430\u0432\u043A\u0430 \u0432 \u0447\u0430\u0441" }), _jsx("th", { children: "\u041F\u0440\u043E\u0435\u043A\u0442" }), _jsx("th", { children: "\u041D\u0430\u0447\u0430\u043B\u043E" }), _jsx("th", { children: "\u041E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u0435" }), _jsx("th", {})] }) }), _jsx("tbody", { children: costRates.map((r) => (_jsxs("tr", { children: [_jsxs("td", { className: "uep__rate-amount", children: [r.amount.toFixed(2), " ", _jsx("span", { className: "uep__rate-currency", children: r.currency })] }), _jsx("td", { className: "uep__rate-project", children: r.projectId
                                                                                            ? _jsx("span", { className: "uep__rate-project-tag", children: rateProjectLabel(r) })
                                                                                            : _jsx("span", { className: "uep__rate-all", children: "\u041E\u0431\u0449\u0430\u044F" }) }), _jsx("td", { className: "uep__rate-date", children: r.startDate ? fmtDate(r.startDate) : _jsx("span", { className: "uep__rate-all", children: "\u0421 \u043D\u0430\u0447\u0430\u043B\u0430" }) }), _jsx("td", { className: "uep__rate-date", children: r.endDate ? fmtDate(r.endDate) : _jsx("span", { className: "uep__rate-all", children: "\u0411\u0435\u0437 \u043A\u043E\u043D\u0446\u0430" }) }), _jsxs("td", { className: "uep__rate-actions", children: [canChangeCostRateFromDate && (_jsx("button", { type: "button", className: "uep__rate-btn", onClick: () => setRateChangeFromModal({ type: 'cost', projectId: r.projectId ?? null, projectLabel: r.projectId ? rateProjectLabel(r) : null, currency: r.currency, currentAmount: r.amount, sourceRateId: r.id }), children: "\u0421\u043C\u0435\u043D\u0438\u0442\u044C \u0441 \u0434\u0430\u0442\u044B" })), _jsx("button", { type: "button", className: "uep__rate-btn", onClick: () => setRateModal({ type: 'cost', rate: r }), children: "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C" }), _jsx("button", { type: "button", className: "uep__rate-btn uep__rate-btn--del", onClick: () => void handleDeleteRate(r.id), children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] })] }, r.id))) })] }) })) : (_jsx("div", { className: "uep__rates-empty", children: "\u041D\u0435\u0442 \u0441\u0442\u0430\u0432\u043E\u043A \u0441\u0435\u0431\u0435\u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u0438" }))] }))] })] }) })), activeTab === 'projects' && (() => {
                                    const catalogById = new Map(projectCatalog.map((p) => [p.id, p]));
                                    const assignedRows = assignedProjectIds.map((pid) => {
                                        const p = catalogById.get(pid);
                                        return p ?? { id: pid, name: 'Неизвестный проект', client: 'Не найден в каталоге', color: hashToColor(pid), archived: false };
                                    });
                                    const assignedActiveCount = assignedRows.filter((p) => !p.archived).length;
                                    const assignedArchivedCount = assignedRows.filter((p) => p.archived).length;
                                    const unassigned = projectCatalog.filter((p) => !assignedProjectIds.includes(p.id) && !p.archived);
                                    const q = projectSearch.trim().toLowerCase();
                                    const searchResults = q
                                        ? unassigned.filter((p) => p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q))
                                        : unassigned;
                                    const displayResults = q ? searchResults : unassigned.slice(0, UEP_PROJECT_PICKER_CAP);
                                    const listTruncated = !q && unassigned.length > UEP_PROJECT_PICKER_CAP;
                                    const pickDisabled = !canEditTTProjectAccess || projectsTabSaving || projectsTabLoading;
                                    const assignedVisible = assignedRows.filter((p) => {
                                        if (assignedProjectsStatus === 'active' && p.archived)
                                            return false;
                                        if (assignedProjectsStatus === 'archived' && !p.archived)
                                            return false;
                                        if (!q)
                                            return true;
                                        return p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q);
                                    });
                                    return (_jsx("div", { id: "uep-panel-projects", role: "tabpanel", "aria-labelledby": "uep-tab-projects", className: "uep__tab-panel uep__tab-panel--flush", children: _jsxs("div", { className: "uep__proj-page", children: [_jsxs("div", { className: "uep__proj-header", children: [_jsxs("div", { className: "uep__proj-header-text", children: [_jsx("h2", { className: "uep__proj-heading", children: "\u041D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044B\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u044B" }), !canEditTTProjectAccess && (_jsx("p", { className: "uep__proj-subheading", style: { marginTop: '0.35rem', opacity: 0.85 }, children: "\u0423 \u0432\u0430\u0441 \u043D\u0435\u0442 \u043F\u0440\u0430\u0432 \u043D\u0430 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043A \u043F\u0440\u043E\u0435\u043A\u0442\u0430\u043C \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F." }))] }), assignedProjectIds.length > 0 && canEditTTProjectAccess && (_jsx("button", { type: "button", className: "uep__proj-clear-btn", disabled: projectsTabSaving || projectsTabLoading, onClick: clearAllProjects, children: "\u0423\u0431\u0440\u0430\u0442\u044C \u0438\u0437 \u0432\u0441\u0435\u0445" }))] }), projectsTabError && (_jsx("p", { className: "uep__field-error uep__proj-status-line", role: "alert", children: projectsTabError })), projectsTabLoading && (_jsx("p", { className: "uep__proj-subheading uep__proj-status-line", role: "status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0441\u043F\u0438\u0441\u043A\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432\u2026" })), projectsTabSaving && (_jsx("p", { className: "uep__proj-subheading uep__proj-status-line", role: "status", children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435\u2026" })), _jsxs("div", { className: "uep__proj-body", children: [canEditTTProjectAccess && !projectsTabLoading ? (_jsxs("div", { className: "uep__proj-tools", children: [_jsxs("div", { className: "uep__proj-transfer-flag-wrap", children: [_jsxs("label", { className: "uep__proj-cb-label uep__proj-transfer-flag", children: [_jsx("input", { type: "checkbox", checked: transferWithoutProjectAccess, disabled: pickDisabled || transferFlagSaving, onChange: (e) => void persistTransferWithoutProjectAccess(e.target.checked) }), _jsx("span", { className: "uep__proj-check-box", "aria-hidden": "true" }), _jsx("span", { className: "uep__proj-transfer-flag-text", children: "\u041C\u043E\u0436\u0435\u0442 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438\u0442\u044C \u0437\u0430\u043F\u0438\u0441\u0438 \u043C\u0435\u0436\u0434\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u0430\u043C\u0438 \u0431\u0435\u0437 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430 \u043A \u0446\u0435\u043B\u0435\u0432\u043E\u043C\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u0443" })] }), _jsx("p", { className: "uep__proj-subheading uep__proj-transfer-flag-hint", role: "note", children: "\u0414\u043B\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u0439 \u0441 \u044D\u0442\u0438\u043C \u043F\u0440\u0430\u0432\u043E\u043C \u0432 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0435 \u0437\u0430\u043F\u0438\u0441\u0435\u0439 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0432\u0441\u0435 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u044B, \u0434\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u0443 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430 \u0437\u0430\u043F\u0438\u0441\u0438 \u043D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043A \u0446\u0435\u043B\u0435\u0432\u043E\u043C\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u0443." })] }), _jsxs("div", { className: "uep__proj-partner-bulk", children: [_jsxs("div", { className: "uep__proj-partner-bulk-field", children: [_jsx("span", { className: "uep__proj-partner-bulk-label", id: `${partnerAssignSelectId}-lbl`, children: "\u041F\u0430\u0440\u0442\u043D\u0451\u0440" }), _jsx(SearchableSelect, { className: "tsp-srch", buttonClassName: "tsp-srch__btn", buttonId: partnerAssignSelectId, value: partnerAssignId, items: partnerOptions, getOptionValue: (p) => p.id, getOptionLabel: (p) => p.label, getSearchText: (p) => p.label.toLowerCase(), onSelect: (p) => {
                                                                                        setPartnerAssignId(p.id);
                                                                                        setPartnerBulkNotice(null);
                                                                                    }, placeholder: partnerOptions.length === 0 ? 'Список партнёров пуст' : 'Выберите партнёра', emptyListText: "\u041F\u0430\u0440\u0442\u043D\u0451\u0440\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B", noMatchText: "\u041D\u0438\u043A\u043E\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", disabled: pickDisabled || partnerOptions.length === 0, portalDropdown: true, portalZIndex: 11020, portalMinWidth: 280, portalDropdownClassName: "tsp-srch__dropdown--tall", "aria-labelledby": `${partnerAssignSelectId}-lbl` })] }), _jsx("button", { type: "button", className: "uep__btn uep__btn--primary uep__proj-partner-bulk-btn", disabled: pickDisabled || !partnerAssignId, onClick: () => void assignAllActiveProjectsOfPartner(), children: "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043A\u043E \u0432\u0441\u0435\u043C \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u043C \u043F\u0440\u043E\u0435\u043A\u0442\u0430\u043C" }), _jsx("p", { className: "uep__proj-partner-bulk-hint", children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0443 \u0434\u043E\u0441\u0442\u0443\u043F \u043A\u043E \u0432\u0441\u0435\u043C \u043D\u0435\u0437\u0430\u043A\u0440\u044B\u0442\u044B\u043C \u043F\u0440\u043E\u0435\u043A\u0442\u0430\u043C \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430. \u0423\u0436\u0435 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044B\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u044B \u043D\u0435 \u0434\u0443\u0431\u043B\u0438\u0440\u0443\u044E\u0442\u0441\u044F." }), partnerBulkNotice ? (_jsx("p", { className: "uep__proj-partner-bulk-status", role: "status", children: partnerBulkNotice })) : null] })] })) : null, _jsxs("div", { className: "uep__proj-search-wrap", ref: searchBoxRef, children: [_jsxs("div", { className: "uep__proj-search-field", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })] }), _jsx("input", { type: "text", placeholder: "\u0421\u043F\u0438\u0441\u043E\u043A \u043D\u0438\u0436\u0435 \u2014 \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u0435\u043A\u0441\u0442, \u0447\u0442\u043E\u0431\u044B \u0441\u0443\u0437\u0438\u0442\u044C \u043F\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0443 \u0438\u043B\u0438 \u043A\u043B\u0438\u0435\u043D\u0442\u0443", value: projectSearch, disabled: projectsTabLoading, "aria-expanded": searchOpen, "aria-controls": searchOpen ? `${projPickListId}-listbox` : undefined, "aria-autocomplete": "list", onChange: (e) => {
                                                                                setProjectSearch(e.target.value);
                                                                                if (canEditTTProjectAccess)
                                                                                    setSearchOpen(true);
                                                                            }, onFocus: () => {
                                                                                if (canEditTTProjectAccess)
                                                                                    setSearchOpen(true);
                                                                            }, onKeyDown: (e) => {
                                                                                if (e.key === 'Escape') {
                                                                                    e.preventDefault();
                                                                                    setSearchOpen(false);
                                                                                }
                                                                            }, onBlur: () => setTimeout(() => setSearchOpen(false), 160) }), projectSearch && (_jsx("button", { type: "button", onMouseDown: (e) => {
                                                                                e.preventDefault();
                                                                                setProjectSearch('');
                                                                                setSearchOpen(false);
                                                                            }, "aria-label": "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) }))] }), searchOpen &&
                                                                    !projectsTabLoading &&
                                                                    canEditTTProjectAccess &&
                                                                    createPortal((() => {
                                                                        const rect = searchBoxRef.current?.getBoundingClientRect();
                                                                        if (!rect)
                                                                            return null;
                                                                        return (_jsx("div", { id: `${projPickListId}-listbox`, role: "listbox", "aria-label": "\u041F\u0440\u043E\u0435\u043A\u0442\u044B \u0434\u043B\u044F \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F", className: "uep__proj-drop", style: { top: rect.bottom + 4, left: rect.left, width: rect.width }, children: unassigned.length === 0 ? (_jsx("p", { className: "uep__proj-drop-empty", children: "\u0412\u0441\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u044B \u0438\u0437 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430 \u0443\u0436\u0435 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u044B \u044D\u0442\u043E\u043C\u0443 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0443." })) : displayResults.length === 0 ? (_jsx("p", { className: "uep__proj-drop-empty", children: "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u2014 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441" })) : (_jsxs(_Fragment, { children: [displayResults.map((p) => (_jsxs("button", { type: "button", role: "option", className: "uep__proj-drop-item", disabled: pickDisabled, onMouseDown: () => {
                                                                                            if (pickDisabled)
                                                                                                return;
                                                                                            assignProject(p.id);
                                                                                            setSearchOpen(false);
                                                                                        }, children: [_jsx("span", { className: "uep__proj-color-dot", style: { background: p.color } }), _jsxs("span", { className: "uep__proj-drop-info", children: [_jsx("span", { className: "uep__proj-drop-name", children: p.name }), _jsx("span", { className: "uep__proj-drop-client", children: p.client })] }), _jsxs("svg", { className: "uep__proj-drop-plus", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] })] }, p.id))), listTruncated && (_jsxs("p", { className: "uep__proj-drop-hint", role: "note", children: ["\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u043F\u0435\u0440\u0432\u044B\u0435 ", UEP_PROJECT_PICKER_CAP, " \u0438\u0437 ", unassigned.length, ". \u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0447\u0430\u0441\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0438\u043B\u0438 \u043A\u043B\u0438\u0435\u043D\u0442\u0430, \u0447\u0442\u043E\u0431\u044B \u0441\u0443\u0437\u0438\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A."] }))] })) }));
                                                                    })(), document.body)] }), _jsxs("div", { className: "uep__proj-results", children: [_jsxs("div", { className: "uep__proj-status-block", children: [_jsx("p", { className: "uep__proj-status-title", id: "uep-proj-status-heading", children: "\u0421\u0442\u0430\u0442\u0443\u0441 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432" }), _jsxs("nav", { className: "uep__proj-status-nav", role: "tablist", "aria-labelledby": "uep-proj-status-heading", children: [_jsxs("button", { type: "button", role: "tab", "aria-selected": assignedProjectsStatus === 'active', className: `uep__proj-status-tab${assignedProjectsStatus === 'active' ? ' uep__proj-status-tab--active' : ''}`, onClick: () => setAssignedProjectsStatus('active'), children: ["\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0435", _jsx("span", { className: "uep__proj-status-count", children: assignedActiveCount })] }), _jsxs("button", { type: "button", role: "tab", "aria-selected": assignedProjectsStatus === 'archived', className: `uep__proj-status-tab${assignedProjectsStatus === 'archived' ? ' uep__proj-status-tab--active' : ''}`, onClick: () => setAssignedProjectsStatus('archived'), children: ["\u0410\u0440\u0445\u0438\u0432\u043D\u044B\u0435", _jsx("span", { className: "uep__proj-status-count", children: assignedArchivedCount })] }), _jsxs("button", { type: "button", role: "tab", "aria-selected": assignedProjectsStatus === 'all', className: `uep__proj-status-tab${assignedProjectsStatus === 'all' ? ' uep__proj-status-tab--active' : ''}`, onClick: () => setAssignedProjectsStatus('all'), children: ["\u0412\u0441\u0435", _jsx("span", { className: "uep__proj-status-count", children: assignedRows.length })] })] })] }), _jsxs("div", { className: "uep__proj-period", children: [_jsxs("div", { className: "uep__proj-period-left", children: [_jsx("button", { type: "button", className: "uep__proj-period-nav", onClick: () => setProjPeriodDate((d) => shiftPeriodDate(d, projPeriodGranularity, -1)), disabled: projPeriodGranularity === 'all', "aria-label": "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439 \u043F\u0435\u0440\u0438\u043E\u0434", children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M15 18l-6-6 6-6" }) }) }), _jsx("h3", { className: "uep__proj-period-title", children: projPeriodTitle }), _jsx("button", { type: "button", className: "uep__proj-period-nav", onClick: () => setProjPeriodDate((d) => shiftPeriodDate(d, projPeriodGranularity, 1)), disabled: projPeriodGranularity === 'all', "aria-label": "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u043F\u0435\u0440\u0438\u043E\u0434", children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M9 18l6-6-6-6" }) }) })] }), _jsxs("div", { className: "uep__proj-period-dropdown-wrap", ref: projPeriodDropdownRef, children: [_jsxs("button", { type: "button", className: "uep__proj-period-dropdown-btn", onClick: () => setProjPeriodDropdown((v) => !v), "aria-expanded": projPeriodDropdown, children: [PERIOD_OPTIONS.find((o) => o.id === projPeriodGranularity)?.label ?? 'Месяц', _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), projPeriodDropdown ? (_jsx("div", { className: "uep__proj-period-dropdown", role: "listbox", children: PERIOD_OPTIONS.map((opt) => (_jsx("button", { type: "button", role: "option", "aria-selected": projPeriodGranularity === opt.id, className: `uep__proj-period-opt${projPeriodGranularity === opt.id ? ' uep__proj-period-opt--active' : ''}`, onClick: () => {
                                                                                            setProjPeriodGranularity(opt.id);
                                                                                            setProjPeriodDropdown(false);
                                                                                        }, children: opt.label }, opt.id))) })) : null] })] }), projectActivityLoading && (_jsx("p", { className: "uep__proj-subheading uep__proj-status-line", role: "status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0438 \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434\u2026" })), projectActivityError && (_jsx("p", { className: "uep__field-error uep__proj-status-line", role: "alert", children: projectActivityError })), assignedRows.length === 0 ? (_jsxs("div", { className: "uep__proj-empty", children: [_jsx("div", { className: "uep__proj-empty-icon", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "2", y: "7", width: "20", height: "14", rx: "2" }), _jsx("path", { d: "M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2" })] }) }), _jsx("p", { className: "uep__proj-empty-title", children: "\u041F\u0440\u043E\u0435\u043A\u0442\u044B \u043D\u0435 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u044B" }), _jsx("p", { className: "uep__proj-empty-hint", children: "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A \u0432\u044B\u0448\u0435 (\u0444\u043E\u043A\u0443\u0441 \u0432 \u043F\u043E\u043B\u0435) \u0438 \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043F\u0440\u043E\u0435\u043A\u0442 \u0438\u043B\u0438 \u0441\u0443\u0437\u044C\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A \u043F\u043E\u0438\u0441\u043A\u043E\u043C" })] })) : assignedVisible.length === 0 ? (_jsxs("div", { className: "uep__proj-empty uep__proj-empty--filter", children: [_jsx("p", { className: "uep__proj-empty-title", children: assignedProjectsStatus === 'active'
                                                                                ? 'Нет активных назначенных проектов'
                                                                                : assignedProjectsStatus === 'archived'
                                                                                    ? 'Нет архивных назначенных проектов'
                                                                                    : 'Ничего не найдено' }), _jsx("p", { className: "uep__proj-empty-hint", children: q
                                                                                ? 'Измените поисковый запрос или переключите фильтр статуса'
                                                                                : 'Переключите фильтр статуса или назначьте проекты через поле выше' })] })) : (_jsxs("div", { className: "uep__proj-list", children: [_jsxs("div", { className: "uep__proj-list-head", children: [_jsxs("span", { children: ["\u041F\u0440\u043E\u0435\u043A\u0442", _jsx("span", { className: "uep__proj-list-head-meta", children: assignedVisible.length })] }), _jsx("span", { className: "uep__proj-list-head-hours", children: "\u0412\u0440\u0435\u043C\u044F" }), _jsx("span", { className: "uep__proj-list-head-action", children: "\u041E\u0442\u0447\u0451\u0442" })] }), assignedVisible.map((p) => {
                                                                            const hours = projectHoursById[p.id] ?? 0;
                                                                            return (_jsxs("div", { className: `uep__proj-item${p.archived ? ' uep__proj-item--archived' : ''}`, children: [_jsx("button", { type: "button", className: "uep__proj-item-remove", disabled: pickDisabled, onClick: () => removeProject(p.id), title: `Убрать из ${p.name}`, children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) }), _jsx("span", { className: "uep__proj-color-dot", style: { background: p.color } }), _jsxs("span", { className: "uep__proj-item-info", children: [_jsxs("span", { className: "uep__proj-item-name", children: [p.name, p.archived ? _jsx("span", { className: "uep__proj-arch-badge", children: "\u0410\u0440\u0445\u0438\u0432" }) : null] }), _jsx("span", { className: "uep__proj-item-client", children: p.client })] }), _jsx("span", { className: "uep__proj-item-hours", title: `Время за период: ${fmtH(hours)}`, children: projectActivityLoading ? '…' : fmtH(hours) }), _jsx("button", { type: "button", className: "uep__proj-item-preview", onClick: () => openProjectReportPreview(p.id), title: `Предпросмотр отчёта: ${p.name}`, children: "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440" })] }, p.id));
                                                                        })] }))] })] })] }) }));
                                })()] }) })] }), rateModal && (_jsx(RateFormModal, { type: rateModal.type, rate: rateModal.rate, existingRates: rates.filter((r) => r.type === rateModal.type && r.id !== rateModal.rate?.id), projects: rateProjectOptions, onSave: handleSaveRate, onClose: () => setRateModal(null) })), rateChangeFromModal && (_jsx(RateChangeFromModal, { type: rateChangeFromModal.type, projectLabel: rateChangeFromModal.projectLabel, currency: rateChangeFromModal.currency, currentAmount: rateChangeFromModal.currentAmount, onSave: handleChangeRateFrom, onClose: () => setRateChangeFromModal(null) }))] }));
}
