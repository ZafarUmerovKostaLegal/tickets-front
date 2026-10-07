import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { deleteCashAttachment, deleteCashMovement, fetchCashAttachmentBlob, fetchCashState, isManualCashMovement, openCashAttachment, postCashAction, updateCashMovement, uploadCashAttachment } from '@entities/expenses/model/cashApi';
import { ExpenseAttachmentPreviewModal } from './ExpenseAttachmentPreviewModal';
import { showToast } from '@shared/ui/app-toast';
import { ExpensesShell } from './ExpensesShell';
import './ExpensesPage.css';
import './ExpensesCashPage.css';
const FILE_ACCEPT = 'image/*,application/pdf,video/*,audio/*';
function CashFileDrop({ files, disabled, onFiles, }) {
    const [over, setOver] = useState(false);
    return (_jsxs("label", { className: `exp-cash__drop${over ? ' exp-cash__drop--over' : ''}`, onDragEnter: (e) => { e.preventDefault(); setOver(true); }, onDragOver: (e) => { e.preventDefault(); setOver(true); }, onDragLeave: (e) => {
            if (!e.currentTarget.contains(e.relatedTarget))
                setOver(false);
        }, onDrop: (e) => {
            e.preventDefault();
            setOver(false);
            if (!disabled)
                onFiles([...(e.dataTransfer.files ?? [])]);
        }, children: [_jsx("input", { type: "file", multiple: true, accept: FILE_ACCEPT, disabled: disabled, onChange: (e) => {
                    onFiles([...(e.target.files ?? [])]);
                    e.target.value = '';
                } }), _jsx("strong", { children: over ? 'Отпустите, чтобы вложить' : 'Перетащите файлы сюда' }), _jsx("span", { children: "\u0438\u043B\u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \u0438 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043A\u0440\u0438\u043D, \u0441\u043A\u0430\u043D, \u0444\u043E\u0442\u043E, \u0432\u0438\u0434\u0435\u043E \u0438\u043B\u0438 \u0430\u0443\u0434\u0438\u043E" }), files.length > 0 ? (_jsx("ul", { children: files.map((file) => _jsx("li", { children: file.name }, `${file.name}-${file.size}`)) })) : null] }));
}
function IconClip() {
    return (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "M8 12.5l6.2-6.2a3 3 0 0 1 4.2 4.2l-7.8 7.8a4.2 4.2 0 0 1-6-6L12 5" }) }));
}
function CashHistoryItem({ row, onFiles, children, }) {
    const [over, setOver] = useState(false);
    return (_jsxs("li", { className: `exp-cash__event exp-cash__event--${row.kind}${over ? ' exp-cash__event--drop' : ''}`, onDragEnter: (e) => { e.preventDefault(); setOver(true); }, onDragOver: (e) => { e.preventDefault(); setOver(true); }, onDragLeave: (e) => {
            if (!e.currentTarget.contains(e.relatedTarget))
                setOver(false);
        }, onDrop: (e) => {
            e.preventDefault();
            setOver(false);
            const picked = [...(e.dataTransfer.files ?? [])];
            if (picked.length > 0)
                onFiles(picked);
        }, children: [children, over ? _jsx("span", { className: "exp-cash__event-overlay", children: "\u041E\u0442\u043F\u0443\u0441\u0442\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u0432\u043B\u043E\u0436\u0438\u0442\u044C" }) : null] }));
}
const KIND_LABEL = {
    set: 'Остаток установлен',
    expense: 'Потрачено',
    topup: 'Пополнение',
};
function moneyNumber(raw) {
    if (raw == null || raw === '')
        return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}
function formatCash(raw, withCurrency = true) {
    const n = moneyNumber(raw ?? null);
    if (n == null)
        return '—';
    const text = n.toLocaleString('ru-RU', {
        minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        maximumFractionDigits: 2,
    });
    return withCurrency ? `${text} UZS` : text;
}
function dayKey(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return iso;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}
function formatClock(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '';
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
function movementNotice(row) {
    const amount = formatCash(row.amount);
    const after = formatCash(row.balanceAfter);
    const before = row.balanceBefore ? formatCash(row.balanceBefore) : null;
    const note = row.note.trim();
    if (row.kind === 'set') {
        return [
            before ? `Остаток в кассе: ${before}` : null,
            `Остаток установлен: ${amount}`,
            '',
            `Остаток на текущий момент: ${after}`,
        ].filter((line) => line !== null).join('\n');
    }
    const label = row.kind === 'expense' ? 'Потрачено' : 'Пополнение';
    const middle = note ? `${label}: ${amount} (${note})` : `${label}: ${amount}`;
    return [
        `Остаток в кассе: ${before ?? '—'}`,
        middle,
        '',
        `Остаток на текущий момент: ${after}`,
    ].join('\n');
}
function friendlyLoadError(message) {
    if (message.includes('Заявка не найдена') || message.includes('HTTP 404'))
        return 'Касса ещё не подключена на сервере. Нужно обновить сервис расходов.';
    return message;
}
function IconWallet() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", "aria-hidden": true, children: [_jsx("rect", { x: "3", y: "6", width: "18", height: "14", rx: "3" }), _jsx("path", { d: "M3 10h18" }), _jsx("circle", { cx: "16.5", cy: "14.5", r: "1", fill: "currentColor", stroke: "none" })] }));
}
function IconMinus() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "8" }), _jsx("path", { d: "M8 12h8", strokeLinecap: "round" })] }));
}
function IconPlus() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "8" }), _jsx("path", { d: "M12 8v8M8 12h8", strokeLinecap: "round" })] }));
}
function IconPencil() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M12 20h9" }), _jsx("path", { d: "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" })] }));
}
function IconTrash() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M4 7h16" }), _jsx("path", { d: "M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" }), _jsx("path", { d: "M7 7l1 13h8l1-13" }), _jsx("path", { d: "M10 11v6M14 11v6" })] }));
}
export function ExpensesCashPage() {
    const { user, loading } = useCurrentUser();
    const allowed = isPartnerOrgRole(user?.role, user?.position);
    const [state, setState] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState(null);
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [filter, setFilter] = useState('all');
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [searchHits, setSearchHits] = useState(null);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [files, setFiles] = useState([]);
    const [formError, setFormError] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const previewUrlRef = useRef(null);
    const closeFilePreview = useCallback(() => {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = null;
        }
        setFilePreview(null);
    }, []);
    const openFilePreview = useCallback(async (movementId, attachmentId, fileName) => {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = null;
        }
        setFilePreview({
            fileName,
            loading: true,
            error: null,
            model: null,
            movementId,
            attachmentId,
        });
        try {
            const { blob, contentType } = await fetchCashAttachmentBlob(movementId, attachmentId);
            const { buildAttachmentPreview } = await import('@entities/expenses/lib/buildAttachmentPreview');
            const { model, objectUrl } = await buildAttachmentPreview(blob, fileName, contentType);
            previewUrlRef.current = objectUrl;
            setFilePreview((prev) => (prev?.attachmentId === attachmentId && prev.movementId === movementId
                ? { ...prev, loading: false, model, error: null }
                : prev));
        }
        catch (err) {
            setFilePreview((prev) => (prev?.attachmentId === attachmentId && prev.movementId === movementId
                ? { ...prev, loading: false, model: null, error: err instanceof Error ? err.message : 'Не удалось открыть файл' }
                : prev));
        }
    }, []);
    const reload = useCallback(async () => {
        const next = await fetchCashState();
        setState(next);
        setLoadError(null);
        if (debouncedQuery) {
            const found = await fetchCashState(debouncedQuery);
            setSearchHits(found.history);
        }
    }, [debouncedQuery]);
    useEffect(() => {
        if (!allowed)
            return;
        let cancelled = false;
        void fetchCashState()
            .then((next) => {
            if (!cancelled)
                setState(next);
        })
            .catch((err) => {
            if (!cancelled)
                setLoadError(friendlyLoadError(err instanceof Error ? err.message : 'Не удалось загрузить кассу'));
        });
        return () => {
            cancelled = true;
        };
    }, [allowed]);
    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
        return () => window.clearTimeout(timer);
    }, [query]);
    useEffect(() => {
        if (!allowed)
            return;
        if (!debouncedQuery) {
            setSearchHits(null);
            return;
        }
        let cancelled = false;
        void fetchCashState(debouncedQuery)
            .then((next) => {
            if (!cancelled)
                setSearchHits(next.history);
        })
            .catch(() => {
            if (!cancelled)
                setSearchHits([]);
        });
        return () => {
            cancelled = true;
        };
    }, [allowed, debouncedQuery]);
    useEffect(() => {
        if (!filePreview)
            return;
        const onKey = (event) => {
            if (event.key === 'Escape')
                closeFilePreview();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [filePreview, closeFilePreview]);
    const dialogOpen = form !== null || editing !== null || deleting !== null;
    useEffect(() => {
        if (!dialogOpen)
            return;
        const onKey = (event) => {
            if (event.key !== 'Escape' || busy)
                return;
            setForm(null);
            setEditing(null);
            setDeleting(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dialogOpen, busy]);
    const stats = useMemo(() => {
        const rows = state?.history ?? [];
        let spent = 0;
        let topped = 0;
        for (const row of rows) {
            const n = moneyNumber(row.amount) ?? 0;
            if (row.kind === 'expense')
                spent += n;
            if (row.kind === 'topup')
                topped += n;
        }
        return { spent, topped, count: rows.length };
    }, [state]);
    const groups = useMemo(() => {
        const source = debouncedQuery ? (searchHits ?? []) : (state?.history ?? []);
        const needle = debouncedQuery.toLowerCase();
        const rows = source.filter((row) => {
            if (filter !== 'all' && row.kind !== filter)
                return false;
            if (!needle)
                return true;
            const hay = `${row.note} ${row.expenseId ?? ''} ${KIND_LABEL[row.kind]}`.toLowerCase();
            return hay.includes(needle);
        });
        const map = new Map();
        for (const row of rows) {
            const key = dayKey(row.createdAt);
            const list = map.get(key) ?? [];
            list.push(row);
            map.set(key, list);
        }
        return [...map.entries()];
    }, [state, filter, debouncedQuery, searchHits]);
    if (loading)
        return (_jsx(ExpensesShell, { title: "\u041A\u0430\u0441\u0441\u0430", backTo: routes.expenses, children: _jsxs("div", { className: "exp-cash exp-cash--loading", "aria-busy": "true", children: [_jsx("div", { className: "exp-cash__hero exp-cash__skel" }), _jsxs("div", { className: "exp-cash__stats", children: [_jsx("div", { className: "exp-cash__stat exp-cash__skel" }), _jsx("div", { className: "exp-cash__stat exp-cash__skel" }), _jsx("div", { className: "exp-cash__stat exp-cash__skel" })] })] }) }));
    if (!allowed)
        return _jsx(Navigate, { to: routes.expenses, replace: true });
    const closeDialogs = () => {
        if (busy)
            return;
        setForm(null);
        setEditing(null);
        setDeleting(null);
        setFormError(null);
    };
    const openForm = (kind) => {
        setEditing(null);
        setDeleting(null);
        setForm((current) => (current === kind ? null : kind));
        setFormError(null);
        setAmount('');
        setNote('');
        setFiles([]);
    };
    const openEdit = (row) => {
        setForm(null);
        setDeleting(null);
        setEditing(row);
        setFormError(null);
        setAmount(formatCash(row.amount, false));
        setNote(row.note);
    };
    const submit = async () => {
        if (!form)
            return;
        setBusy(true);
        setFormError(null);
        try {
            const result = await postCashAction(form, amount.trim(), note.trim());
            for (const file of files)
                await uploadCashAttachment(result.movement.id, file);
            showToast({ message: movementNotice(result.movement), variant: 'success', durationMs: 8000 });
            setAmount('');
            setNote('');
            setFiles([]);
            setForm(null);
            await reload();
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : 'Не удалось сохранить операцию');
        }
        finally {
            setBusy(false);
        }
    };
    const submitEdit = async () => {
        if (!editing)
            return;
        setBusy(true);
        setFormError(null);
        try {
            const result = await updateCashMovement(editing.id, amount.trim(), note.trim());
            showToast({ message: movementNotice(result.movement), variant: 'success', durationMs: 8000 });
            setEditing(null);
            await reload();
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : 'Не удалось сохранить запись');
        }
        finally {
            setBusy(false);
        }
    };
    const submitDelete = async () => {
        if (!deleting)
            return;
        setBusy(true);
        setFormError(null);
        try {
            const result = await deleteCashMovement(deleting.id);
            const label = deleting.kind === 'expense' ? 'Потрачено' : 'Пополнение';
            const detail = deleting.note.trim();
            const middle = detail
                ? `${label}: ${formatCash(deleting.amount)} (${detail})`
                : `${label}: ${formatCash(deleting.amount)}`;
            showToast({
                message: `Запись удалена\n${middle}\n\nОстаток на текущий момент: ${formatCash(result.balance)}`,
                variant: 'success',
                durationMs: 8000,
            });
            setDeleting(null);
            await reload();
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : 'Не удалось удалить запись');
        }
        finally {
            setBusy(false);
        }
    };
    const formCopy = form === 'balance'
        ? { title: 'Задать остаток', submit: 'Установить' }
        : form === 'expense'
            ? { title: 'Списать расход', submit: 'Списать' }
            : { title: 'Пополнить кассу', submit: 'Пополнить' };
    const filters = [
        { id: 'all', label: 'Все' },
        { id: 'topup', label: 'Пополнения' },
        { id: 'expense', label: 'Расходы' },
        { id: 'set', label: 'Остаток' },
    ];
    return (_jsxs(ExpensesShell, { title: "\u041A\u0430\u0441\u0441\u0430", backTo: routes.expenses, children: [_jsxs("div", { className: "exp-cash", children: [loadError && _jsx("p", { className: "exp-cash__banner exp-cash__banner--error", role: "alert", children: loadError }), _jsxs("section", { className: "exp-cash__hero", children: [_jsxs("div", { children: [_jsx("p", { className: "exp-cash__eyebrow", children: "\u041E\u0441\u0442\u0430\u0442\u043E\u043A \u0432 \u043A\u0430\u0441\u0441\u0435" }), _jsx("p", { className: "exp-cash__balance", children: state ? formatCash(state.balance) : '…' })] }), _jsxs("div", { className: "exp-cash__hero-side", children: [state?.balanceSet ? (_jsx("button", { type: "button", className: `exp-cash__rare${form === 'balance' ? ' exp-cash__rare--on' : ''}`, onClick: () => openForm('balance'), children: "\u0417\u0430\u0434\u0430\u0442\u044C \u043E\u0441\u0442\u0430\u0442\u043E\u043A \u0437\u0430\u043D\u043E\u0432\u043E" })) : null, _jsx("div", { className: "exp-cash__hero-mark", "aria-hidden": true, children: _jsx(IconWallet, {}) })] })] }), _jsxs("div", { className: "exp-cash__stats", children: [_jsxs("article", { className: "exp-cash__stat", children: [_jsx("span", { className: "exp-cash__stat-label", children: "\u041F\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u043E" }), _jsx("strong", { className: "exp-cash__stat-value exp-cash__stat-value--in", children: formatCash(String(stats.topped)) })] }), _jsxs("article", { className: "exp-cash__stat", children: [_jsx("span", { className: "exp-cash__stat-label", children: "\u041F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E" }), _jsx("strong", { className: "exp-cash__stat-value exp-cash__stat-value--out", children: formatCash(String(stats.spent)) })] }), _jsxs("article", { className: "exp-cash__stat", children: [_jsx("span", { className: "exp-cash__stat-label", children: "\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u0439" }), _jsx("strong", { className: "exp-cash__stat-value", children: stats.count })] })] }), _jsxs("div", { className: "exp-cash__actions", role: "tablist", "aria-label": "\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u043A\u0430\u0441\u0441\u044B", children: [_jsxs("button", { type: "button", className: `exp-cash__action${form === 'topup' ? ' exp-cash__action--on' : ''}`, onClick: () => openForm('topup'), disabled: !state?.balanceSet, children: [_jsx("span", { className: "exp-cash__action-icon exp-cash__action-icon--in", children: _jsx(IconPlus, {}) }), _jsx("span", { children: "\u041F\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u044C" })] }), _jsxs("button", { type: "button", className: `exp-cash__action${form === 'expense' ? ' exp-cash__action--on' : ''}`, onClick: () => openForm('expense'), disabled: !state?.balanceSet, children: [_jsx("span", { className: "exp-cash__action-icon exp-cash__action-icon--out", children: _jsx(IconMinus, {}) }), _jsx("span", { children: "\u0412\u043D\u0435\u0441\u0442\u0438 \u0440\u0430\u0441\u0445\u043E\u0434" })] }), !state?.balanceSet ? (_jsxs("button", { type: "button", className: `exp-cash__action${form === 'balance' ? ' exp-cash__action--on' : ''}`, onClick: () => openForm('balance'), children: [_jsx("span", { className: "exp-cash__action-icon", children: _jsx(IconWallet, {}) }), _jsx("span", { children: "\u0417\u0430\u0434\u0430\u0442\u044C \u043E\u0441\u0442\u0430\u0442\u043E\u043A" })] })) : null] }), form && createPortal(_jsx("div", { className: "exp-mod-backdrop", role: "presentation", onClick: () => {
                            if (!busy)
                                setForm(null);
                        }, children: _jsxs("form", { className: "exp-mod-dialog", role: "dialog", "aria-modal": true, "aria-labelledby": "exp-cash-form-title", onClick: (e) => e.stopPropagation(), onSubmit: (e) => { e.preventDefault(); void submit(); }, children: [_jsx("h3", { id: "exp-cash-form-title", className: "exp-mod-dialog__title", children: formCopy.title }), _jsxs("label", { className: "exp-cash__field", children: [_jsx("span", { children: "\u0421\u0443\u043C\u043C\u0430, UZS" }), _jsx("input", { inputMode: "decimal", value: amount, onChange: (e) => setAmount(e.target.value), required: true, autoFocus: true, disabled: busy })] }), form !== 'balance' && (_jsxs("label", { className: "exp-cash__field", children: [_jsx("span", { children: form === 'expense' ? 'На что потрачено' : 'Комментарий' }), _jsx("input", { value: note, onChange: (e) => setNote(e.target.value), disabled: busy })] })), _jsx(CashFileDrop, { files: files, disabled: busy, onFiles: setFiles }), formError && _jsx("p", { className: "exp-mod-err", role: "alert", children: formError }), _jsxs("div", { className: "exp-mod-dialog__ft", children: [_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--ghost", onClick: () => setForm(null), disabled: busy, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "submit", className: "exp-panel-btn exp-panel-btn--primary", disabled: busy, children: busy ? 'Сохранение…' : formCopy.submit })] })] }) }), document.body), editing && createPortal(_jsx("div", { className: "exp-mod-backdrop", role: "presentation", onClick: closeDialogs, children: _jsxs("form", { className: "exp-mod-dialog", role: "dialog", "aria-modal": true, "aria-labelledby": "exp-cash-edit-title", onClick: (e) => e.stopPropagation(), onSubmit: (e) => { e.preventDefault(); void submitEdit(); }, children: [_jsx("h3", { id: "exp-cash-edit-title", className: "exp-mod-dialog__title", children: editing.kind === 'expense' ? 'Изменить расход' : 'Изменить пополнение' }), _jsxs("label", { className: "exp-cash__field", children: [_jsx("span", { children: "\u0421\u0443\u043C\u043C\u0430, UZS" }), _jsx("input", { inputMode: "decimal", value: amount, onChange: (e) => setAmount(e.target.value), required: true, autoFocus: true, disabled: busy })] }), _jsxs("label", { className: "exp-cash__field", children: [_jsx("span", { children: editing.kind === 'expense' ? 'На что потрачено' : 'Комментарий' }), _jsx("input", { value: note, onChange: (e) => setNote(e.target.value), disabled: busy })] }), formError && _jsx("p", { className: "exp-mod-err", role: "alert", children: formError }), _jsxs("div", { className: "exp-mod-dialog__ft", children: [_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--ghost", onClick: closeDialogs, disabled: busy, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "submit", className: "exp-panel-btn exp-panel-btn--primary", disabled: busy, children: busy ? 'Сохранение…' : 'Сохранить' })] })] }) }), document.body), deleting && createPortal(_jsx("div", { className: "exp-mod-backdrop", role: "presentation", onClick: closeDialogs, children: _jsxs("div", { className: "exp-mod-dialog", role: "dialog", "aria-modal": true, "aria-labelledby": "exp-cash-delete-title", onClick: (e) => e.stopPropagation(), children: [_jsx("h3", { id: "exp-cash-delete-title", className: "exp-mod-dialog__title", children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0437\u0430\u043F\u0438\u0441\u044C" }), _jsxs("p", { className: "exp-mod-dialog__sub", children: [KIND_LABEL[deleting.kind], deleting.note.trim() ? ` — ${deleting.note.trim()}` : '', ', ', formatCash(deleting.amount)] }), formError && _jsx("p", { className: "exp-mod-err", role: "alert", children: formError }), _jsxs("div", { className: "exp-mod-dialog__ft", children: [_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--ghost", onClick: closeDialogs, disabled: busy, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--primary exp-panel-btn--danger", onClick: () => void submitDelete(), disabled: busy, children: busy ? 'Удаление…' : 'Удалить' })] })] }) }), document.body), _jsxs("section", { className: "exp-cash__ledger", children: [_jsxs("div", { className: "exp-cash__ledger-head", children: [_jsx("h2", { children: "\u0418\u0441\u0442\u043E\u0440\u0438\u044F" }), _jsxs("label", { className: "exp-cash__search", children: [_jsxs("svg", { viewBox: "0 0 24 24", "aria-hidden": true, children: [_jsx("circle", { cx: "11", cy: "11", r: "6.5" }), _jsx("path", { d: "M16 16l4 4" })] }), _jsx("input", { type: "search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0441\u043B\u043E\u0432\u0443", "aria-label": "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0441\u043B\u043E\u0432\u0443 \u043F\u043E \u0432\u0441\u0435\u043C \u0440\u0430\u0441\u0445\u043E\u0434\u0430\u043C" })] }), _jsx("div", { className: "exp-cash__filters", role: "tablist", "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440 \u0438\u0441\u0442\u043E\u0440\u0438\u0438", children: filters.map((item) => (_jsx("button", { type: "button", role: "tab", "aria-selected": filter === item.id, className: `exp-cash__filter${filter === item.id ? ' exp-cash__filter--on' : ''}`, onClick: () => setFilter(item.id), children: item.label }, item.id))) })] }), groups.length === 0 ? (_jsx("p", { className: "exp-cash__empty", children: debouncedQuery ? 'Ничего не найдено' : 'Операций нет' })) : groups.map(([day, rows]) => (_jsxs("div", { className: "exp-cash__day", children: [_jsx("h3", { children: day }), _jsx("ol", { className: "exp-cash__timeline", children: rows.map((row) => (_jsxs(CashHistoryItem, { row: row, onFiles: (picked) => {
                                                void (async () => {
                                                    try {
                                                        for (const file of picked)
                                                            await uploadCashAttachment(row.id, file);
                                                        await reload();
                                                    }
                                                    catch (err) {
                                                        showToast({ message: err instanceof Error ? err.message : 'Не удалось вложить файл', variant: 'error' });
                                                    }
                                                })();
                                            }, children: [_jsxs("div", { className: "exp-cash__event-body", children: [_jsxs("div", { className: "exp-cash__event-top", children: [_jsx("span", { className: "exp-cash__kind", children: KIND_LABEL[row.kind] }), _jsx("time", { dateTime: row.createdAt, children: formatClock(row.createdAt) })] }), (row.expenseId || row.note) ? (_jsxs("p", { className: "exp-cash__event-note", children: [row.expenseId ? (_jsx(Link, { to: `${routes.expenses}/${encodeURIComponent(row.expenseId)}`, className: "exp-cash__event-id", children: row.expenseId })) : null, row.note ? _jsx("span", { children: row.note }) : null] })) : null, (row.attachments ?? []).length > 0 ? (_jsx("ul", { className: "exp-cash__files", children: (row.attachments ?? []).map((file) => (_jsxs("li", { children: [_jsx("button", { type: "button", onClick: () => void openFilePreview(row.id, file.id, file.fileName), children: file.fileName }), _jsx("button", { type: "button", "aria-label": `Убрать ${file.fileName}`, onClick: () => void deleteCashAttachment(row.id, file.id).then(() => reload()).catch((err) => showToast({ message: err instanceof Error ? err.message : 'Не удалось убрать файл', variant: 'error' })), children: "\u00D7" })] }, file.id))) })) : null, _jsxs("p", { className: "exp-cash__event-after", children: ["\u041E\u0441\u0442\u0430\u0442\u043E\u043A ", formatCash(row.balanceAfter)] })] }), _jsxs("div", { className: "exp-cash__event-side", children: [_jsxs("div", { className: "exp-cash__event-tools", children: [_jsxs("label", { className: "exp-cash__event-tool", title: "\u0412\u043B\u043E\u0436\u0438\u0442\u044C \u0444\u0430\u0439\u043B", children: [_jsx(IconClip, {}), _jsx("span", { className: "exp-cash__sr", children: "\u0412\u043B\u043E\u0436\u0438\u0442\u044C \u0444\u0430\u0439\u043B" }), _jsx("input", { type: "file", multiple: true, accept: FILE_ACCEPT, onChange: (e) => {
                                                                                const picked = [...(e.target.files ?? [])];
                                                                                e.target.value = '';
                                                                                if (picked.length === 0)
                                                                                    return;
                                                                                void (async () => {
                                                                                    try {
                                                                                        for (const file of picked)
                                                                                            await uploadCashAttachment(row.id, file);
                                                                                        await reload();
                                                                                    }
                                                                                    catch (err) {
                                                                                        showToast({ message: err instanceof Error ? err.message : 'Не удалось вложить файл', variant: 'error' });
                                                                                    }
                                                                                })();
                                                                            } })] }), isManualCashMovement(row) ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "exp-cash__event-tool", "aria-label": "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C", onClick: () => openEdit(row), children: _jsx(IconPencil, {}) }), _jsx("button", { type: "button", className: "exp-cash__event-tool exp-cash__event-tool--danger", "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", onClick: () => { setForm(null); setEditing(null); setFormError(null); setDeleting(row); }, children: _jsx(IconTrash, {}) })] })) : null] }), _jsxs("span", { className: `exp-cash__event-sum exp-cash__event-sum--${row.kind}`, children: [row.kind === 'expense' ? '−' : row.kind === 'topup' ? '+' : '', formatCash(row.amount, false)] })] })] }, row.id))) })] }, day)))] })] }), _jsx(ExpenseAttachmentPreviewModal, { isOpen: filePreview != null, fileName: filePreview?.fileName ?? '', loading: filePreview?.loading ?? false, error: filePreview?.error ?? null, model: filePreview?.model ?? null, canOpenExternal: filePreview != null && !filePreview.loading && !filePreview.error, onClose: closeFilePreview, onOpenExternal: () => {
                    if (!filePreview)
                        return;
                    void openCashAttachment(filePreview.movementId, filePreview.attachmentId).catch((err) => {
                        showToast({ message: err instanceof Error ? err.message : 'Не удалось открыть файл', variant: 'error' });
                    });
                } })] }));
}
