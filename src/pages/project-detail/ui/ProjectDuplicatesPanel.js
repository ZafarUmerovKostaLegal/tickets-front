import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from 'react';
import { archiveProjectDuplicateEntries, fetchProjectDuplicateTimeEntries, listProjectArchivedTimeEntries, restoreProjectArchivedTimeEntry, } from '@entities/time-tracking/api/projectDuplicateEntries';
import { formatIsoDateLabel } from '@entities/time-tracking/lib/reportsPeriodRange';
import { buildDefaultArchiveSelection, duplicateEntryKey, pickKeeperEntryKey, splitDuplicateGroupsByWorkDate, summarizeDuplicateGroups, } from '@pages/project-detail/lib/projectDuplicateGroups';
import { useAppDialog } from '@shared/ui';
import { formatDecimalHoursRu } from '@shared/lib/formatTrackingHours';
function fmtCreatedAt(iso) {
    if (!iso?.trim())
        return '—';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime()))
            return iso;
        return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' });
    }
    catch {
        return iso;
    }
}
function fmtWorkDate(iso) {
    const value = (iso ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return value || '—';
    return formatIsoDateLabel(value);
}
export function ProjectDuplicatesPanel({ clientId, projectId, dateFrom, dateTo, onChanged }) {
    const { showAlert, showConfirm } = useAppDialog();
    const [scanning, setScanning] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [result, setResult] = useState(null);
    const [displayGroups, setDisplayGroups] = useState([]);
    const [archived, setArchived] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [error, setError] = useState(null);
    const loadArchive = useCallback(async () => {
        const items = await listProjectArchivedTimeEntries(clientId, projectId, false);
        setArchived(items);
    }, [clientId, projectId]);
    const applyScanResult = useCallback((data) => {
        const groups = splitDuplicateGroupsByWorkDate(data.groups);
        setResult(data);
        setDisplayGroups(groups);
        setSelected(buildDefaultArchiveSelection(groups));
    }, []);
    const runScan = useCallback(async () => {
        setScanning(true);
        setError(null);
        try {
            const data = await fetchProjectDuplicateTimeEntries(clientId, projectId, {
                dateFrom,
                dateTo,
            });
            applyScanResult(data);
            await loadArchive();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка проверки');
            setResult(null);
            setDisplayGroups([]);
            setSelected(new Set());
        }
        finally {
            setScanning(false);
        }
    }, [clientId, projectId, dateFrom, dateTo, loadArchive, applyScanResult]);
    const toggleEntry = useCallback((key) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key))
                next.delete(key);
            else
                next.add(key);
            return next;
        });
    }, []);
    const toggleGroup = useCallback((group, checked) => {
        setSelected((prev) => {
            const next = new Set(prev);
            for (const e of group.entries) {
                const k = duplicateEntryKey(e);
                if (checked)
                    next.add(k);
                else
                    next.delete(k);
            }
            return next;
        });
    }, []);
    const resetArchiveSelection = useCallback(() => {
        setSelected(buildDefaultArchiveSelection(displayGroups));
    }, [displayGroups]);
    const clearSelection = useCallback(() => {
        setSelected(new Set());
    }, []);
    const displaySummary = useMemo(() => summarizeDuplicateGroups(displayGroups), [displayGroups]);
    const selectedPayload = useMemo(() => {
        if (displayGroups.length === 0)
            return [];
        const out = [];
        for (const g of displayGroups) {
            for (const e of g.entries) {
                if (!selected.has(duplicateEntryKey(e)))
                    continue;
                out.push({
                    authUserId: e.auth_user_id,
                    entryId: e.entry_id,
                    duplicateGroupId: g.group_id,
                    userName: e.user_name,
                    taskName: e.task_name,
                });
            }
        }
        return out;
    }, [displayGroups, selected]);
    const handleArchive = useCallback(async () => {
        if (selectedPayload.length === 0) {
            await showAlert({ message: 'Выберите записи для архивации' });
            return;
        }
        const ok = await showConfirm({
            title: 'Архивировать дубликаты?',
            message: `Архивировать ${selectedPayload.length} записей? В каждой группе останется минимум одна запись. Восстановить можно из архива.`,
            confirmLabel: 'Архивировать',
            variant: 'danger',
        });
        if (!ok)
            return;
        setArchiving(true);
        setError(null);
        try {
            const res = await archiveProjectDuplicateEntries(clientId, projectId, selectedPayload);
            await showAlert({
                message: `Архивировано: ${res.archived_count}. Пропущено: ${res.skipped_count}.`,
            });
            await runScan();
            onChanged?.();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка архивации');
        }
        finally {
            setArchiving(false);
        }
    }, [selectedPayload, showAlert, showConfirm, clientId, projectId, runScan, onChanged]);
    const handleRestore = useCallback(async (archiveId) => {
        const ok = await showConfirm({
            title: 'Восстановить запись?',
            message: 'Запись снова появится в учёте времени.',
            confirmLabel: 'Восстановить',
        });
        if (!ok)
            return;
        try {
            await restoreProjectArchivedTimeEntry(clientId, projectId, archiveId);
            await runScan();
            onChanged?.();
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : 'Не удалось восстановить',
            });
        }
    }, [showConfirm, showAlert, clientId, projectId, runScan, onChanged]);
    return (_jsxs("div", { className: "pdp-dup", children: [_jsxs("div", { className: "pdp-dup__intro", children: [_jsxs("div", { className: "pdp-dup__callout", children: ["\u0414\u0443\u0431\u043B\u0438\u043A\u0430\u0442 \u2014 \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u044B\u0435 ", _jsx("strong", { children: "\u0434\u0435\u043D\u044C \u0443\u0447\u0451\u0442\u0430" }), " (\u0432 \u0448\u0430\u043F\u043A\u0435 \u0433\u0440\u0443\u043F\u043F\u044B), ", _jsx("strong", { children: "\u0434\u0430\u0442\u0430 \u0432 \u043A\u043E\u043B\u043E\u043D\u043A\u0435 \u00AB\u0421\u043E\u0437\u0434\u0430\u043D\u0430\u00BB" }), ", \u0437\u0430\u0434\u0430\u0447\u0430, \u0437\u0430\u043C\u0435\u0442\u043A\u0430, \u0447\u0430\u0441\u044B \u0438 \u0441\u0443\u043C\u043C\u0430. \u0417\u0430\u043F\u0438\u0441\u044C \u043E\u0442 09.06 \u0438 \u043E\u0442 19.06 \u043F\u0440\u0438 \u043E\u0434\u043D\u043E\u043C \u0434\u043D\u0435 \u0443\u0447\u0451\u0442\u0430 \u2014 \u044D\u0442\u043E \u0440\u0430\u0437\u043D\u044B\u0435 \u0438\u043C\u043F\u043E\u0440\u0442\u044B, \u043D\u0435 \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u044B. \u041A \u0430\u0440\u0445\u0438\u0432\u0430\u0446\u0438\u0438 \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u044B \u043F\u043E\u0432\u0442\u043E\u0440\u044B \u0432\u043D\u0443\u0442\u0440\u0438 \u043E\u0434\u043D\u043E\u0439 \u043F\u0430\u0440\u044B \u0434\u0435\u043D\u044C \u0443\u0447\u0451\u0442\u0430 + \u0434\u0435\u043D\u044C \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F."] }), _jsxs("div", { className: "pdp-dup__actions", children: [_jsx("button", { type: "button", className: "pdp__edit-btn", disabled: scanning || archiving, onClick: () => void runScan(), children: scanning ? 'Проверка…' : 'Проверить дубликаты' }), _jsx("button", { type: "button", className: "pdp__edit-btn pdp__edit-btn--danger", disabled: scanning || archiving || selectedPayload.length === 0, onClick: () => void handleArchive(), children: archiving ? 'Архивация…' : `Архивировать выбранные (${selectedPayload.length})` }), displayGroups.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "pdp__edit-btn pdp__edit-btn--ghost", disabled: scanning || archiving, onClick: resetArchiveSelection, children: "\u041E\u0442\u043C\u0435\u0442\u0438\u0442\u044C \u043F\u043E\u0432\u0442\u043E\u0440\u044B" }), _jsx("button", { type: "button", className: "pdp__edit-btn pdp__edit-btn--ghost", disabled: scanning || archiving, onClick: clearSelection, children: "\u0421\u043D\u044F\u0442\u044C \u043E\u0442\u043C\u0435\u0442\u043A\u0438" })] })) : null] })] }), error ? _jsx("p", { className: "pdp-dup__error", role: "alert", children: error }) : null, result ? (_jsxs("div", { className: "pdp-dup__stats-panel", children: [_jsxs("div", { className: "pdp-dup__stats", role: "status", children: [_jsxs("div", { className: "pdp-dup__stat", children: [_jsx("span", { className: "pdp-dup__stat-value", children: displaySummary.group_count }), _jsx("span", { className: "pdp-dup__stat-label", children: "\u0433\u0440\u0443\u043F\u043F" })] }), _jsxs("div", { className: "pdp-dup__stat", children: [_jsx("span", { className: "pdp-dup__stat-value", children: displaySummary.entry_count }), _jsx("span", { className: "pdp-dup__stat-label", children: "\u0437\u0430\u043F\u0438\u0441\u0435\u0439" })] }), _jsxs("div", { className: "pdp-dup__stat", children: [_jsx("span", { className: "pdp-dup__stat-value", children: displaySummary.user_count }), _jsx("span", { className: "pdp-dup__stat-label", children: "\u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432" })] })] }), displaySummary.group_count !== result.summary.group_count ? (_jsxs("p", { className: "pdp-dup__stats-note", children: ["\u041F\u043E\u0441\u043B\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u043F\u043E \u0434\u043D\u044E \u0443\u0447\u0451\u0442\u0430: \u0431\u044B\u043B\u043E ", result.summary.group_count, " \u0433\u0440\u0443\u043F\u043F \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u0430"] })) : null] })) : null, result && displayGroups.length === 0 && !scanning ? (_jsx("div", { className: "pdp-dup__empty-card", children: _jsx("p", { className: "pdp-dup__empty", children: "\u0414\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B." }) })) : null, _jsx("div", { className: "pdp-dup__groups", children: displayGroups.map((group) => {
                    const keeperKey = pickKeeperEntryKey(group);
                    const groupFullySelected = group.entries.every((e) => selected.has(duplicateEntryKey(e)));
                    const entryWord = group.entries.length === 1
                        ? 'запись'
                        : group.entries.length < 5
                            ? 'записи'
                            : 'записей';
                    return (_jsxs("section", { className: "pdp-dup__group", children: [_jsxs("header", { className: "pdp-dup__group-head", children: [_jsxs("div", { className: "pdp-dup__group-top", children: [_jsx("span", { className: "pdp-dup__group-badge", children: group.group_label }), _jsx("span", { className: "pdp-dup__group-user", children: group.user_name }), _jsx("span", { className: "pdp-dup__group-sep", "aria-hidden": true, children: "\u00B7" }), _jsx("span", { className: "pdp-dup__group-date", children: fmtWorkDate(group.work_date) }), _jsxs("span", { className: "pdp-dup__group-count", children: [group.entries.length, " ", entryWord] })] }), group.task_name ? (_jsx("p", { className: "pdp-dup__group-task", children: group.task_name })) : null] }), _jsx("div", { className: "pdp-dup__table-wrap", children: _jsxs("table", { className: "pdp-dup__table", children: [_jsxs("colgroup", { children: [_jsx("col", { className: "pdp-dup__col-check" }), _jsx("col", { className: "pdp-dup__col-status" }), _jsx("col", { className: "pdp-dup__col-created" }), _jsx("col", { className: "pdp-dup__col-note" }), _jsx("col", { className: "pdp-dup__col-hours" }), _jsx("col", { className: "pdp-dup__col-sum" })] }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", className: "pdp-dup__th-check", children: _jsx("input", { type: "checkbox", "aria-label": "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0433\u0440\u0443\u043F\u043F\u0443", checked: groupFullySelected, onChange: (ev) => toggleGroup(group, ev.target.checked) }) }), _jsx("th", { scope: "col", children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx("th", { scope: "col", children: "\u0421\u043E\u0437\u0434\u0430\u043D\u0430" }), _jsx("th", { scope: "col", children: "\u0417\u0430\u043C\u0435\u0442\u043A\u0430" }), _jsx("th", { scope: "col", className: "pdp-dup__th-num", children: "\u0427\u0430\u0441\u044B" }), _jsx("th", { scope: "col", className: "pdp-dup__th-num", children: "\u0421\u0443\u043C\u043C\u0430" })] }) }), _jsx("tbody", { children: group.entries.map((e) => {
                                                const k = duplicateEntryKey(e);
                                                const isSelected = selected.has(k);
                                                const isKeeper = k === keeperKey && !isSelected;
                                                const rowClass = [
                                                    isKeeper ? 'pdp-dup__row--keeper' : '',
                                                    isSelected ? 'pdp-dup__row--marked' : '',
                                                ].filter(Boolean).join(' ') || undefined;
                                                return (_jsxs("tr", { className: rowClass, children: [_jsx("td", { className: "pdp-dup__td-check", children: _jsx("input", { type: "checkbox", checked: isSelected, onChange: () => toggleEntry(k), "aria-label": `Выбрать ${e.entry_id}` }) }), _jsx("td", { className: "pdp-dup__td-status", children: isKeeper ? (_jsx("span", { className: "pdp-dup__pill pdp-dup__pill--keeper", children: "\u041E\u0441\u0442\u0430\u0432\u0438\u0442\u044C" })) : isSelected ? (_jsx("span", { className: "pdp-dup__pill pdp-dup__pill--archive", children: "\u041A \u0430\u0440\u0445\u0438\u0432\u0443" })) : (_jsx("span", { className: "pdp-dup__pill pdp-dup__pill--neutral", children: "\u2014" })) }), _jsxs("td", { className: "pdp-dup__created", children: [_jsx("span", { className: "pdp-dup__created-at", children: fmtCreatedAt(e.created_at) }), _jsxs("span", { className: "pdp-dup__entry-id", title: e.entry_id, children: ["\u2026", e.entry_id.slice(-8)] })] }), _jsx("td", { className: "pdp-dup__note", children: e.description || '—' }), _jsx("td", { className: "pdp-dup__num", children: formatDecimalHoursRu(e.rounded_hours) }), _jsxs("td", { className: "pdp-dup__num", children: [e.billable_amount.toLocaleString('ru-RU'), " ", e.currency] })] }, k));
                                            }) })] }) })] }, group.group_id));
                }) }), archived.length > 0 ? (_jsx("section", { className: "pdp-dup__archive", children: _jsxs("div", { className: "pdp-dup__archive-card", children: [_jsx("h3", { className: "pdp-dup__archive-title", children: "\u0410\u0440\u0445\u0438\u0432 (\u043C\u043E\u0436\u043D\u043E \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C)" }), _jsx("div", { className: "pdp-dup__table-wrap pdp-dup__table-wrap--archive", children: _jsxs("table", { className: "pdp-dup__table pdp-dup__table--archive", children: [_jsxs("colgroup", { children: [_jsx("col", { className: "pdp-dup__col-work-date" }), _jsx("col", { className: "pdp-dup__col-user" }), _jsx("col", { className: "pdp-dup__col-task" }), _jsx("col", { className: "pdp-dup__col-note" }), _jsx("col", { className: "pdp-dup__col-archived" }), _jsx("col", { className: "pdp-dup__col-act" })] }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: "\u0414\u0435\u043D\u044C \u0443\u0447\u0451\u0442\u0430" }), _jsx("th", { scope: "col", children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A" }), _jsx("th", { scope: "col", children: "\u0417\u0430\u0434\u0430\u0447\u0430" }), _jsx("th", { scope: "col", children: "\u0417\u0430\u043C\u0435\u0442\u043A\u0430" }), _jsx("th", { scope: "col", children: "\u0410\u0440\u0445\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D\u043E" }), _jsx("th", { scope: "col", className: "pdp-dup__th-act", children: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435" })] }) }), _jsx("tbody", { children: archived.map((row) => (_jsxs("tr", { children: [_jsx("td", { className: "pdp-dup__work-date", children: fmtWorkDate(row.work_date) }), _jsx("td", { className: "pdp-dup__user", children: row.user_name || row.auth_user_id }), _jsx("td", { className: "pdp-dup__task", children: row.task_name || '—' }), _jsx("td", { className: "pdp-dup__note", children: row.description || '—' }), _jsx("td", { className: "pdp-dup__created-at-only", children: fmtCreatedAt(row.archived_at) }), _jsx("td", { className: "pdp-dup__archive-act", children: _jsx("button", { type: "button", className: "pdp__edit-btn pdp__edit-btn--ghost pdp-dup__restore-btn", onClick: () => void handleRestore(row.archive_id), children: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C" }) })] }, row.archive_id))) })] }) })] }) })) : null] }));
}
