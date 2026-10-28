import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { deleteFileGuardStorage } from '../model/fileGuardApi';
import { filterStorageFiles, formatFileSize, formatStorageWhen, groupStorageByMonth, storagePersonLabel, } from '../model/fileGuardStorage';
export function FileGuardStorage({ items, totalBytes, query, userId, loadError, onPreview, onDownload, onChanged, }) {
    const [monthsOpen, setMonthsOpen] = useState({});
    const [pending, setPending] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const visible = useMemo(() => filterStorageFiles(items, query, userId), [items, query, userId]);
    const months = useMemo(() => groupStorageByMonth(visible), [visible]);
    const visibleBytes = visible.reduce((sum, file) => sum + file.fileSize, 0);
    useEffect(() => {
        if (!pending)
            return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape' && !busy)
                setPending(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pending, busy]);
    const ask = (next) => {
        setError('');
        setPending(next);
    };
    const confirm = () => {
        if (!pending || busy)
            return;
        setBusy(true);
        setError('');
        void deleteFileGuardStorage(pending.ids)
            .then(() => {
            setPending(null);
            onChanged();
        })
            .catch((reason) => {
            setError(reason instanceof Error ? reason.message : 'Файл не удалось удалить');
        })
            .finally(() => setBusy(false));
    };
    return (_jsxs("div", { className: "its-j__storage", children: [_jsxs("div", { className: "its-j__storage-note", children: [_jsx("span", { children: "\u041A\u043E\u043F\u0438\u0438 \u0444\u0430\u0439\u043B\u043E\u0432, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u043B\u0430. \u0423\u0434\u0430\u043B\u0435\u043D\u0438\u0435 \u043E\u0441\u0432\u043E\u0431\u043E\u0436\u0434\u0430\u0435\u0442 \u0434\u0438\u0441\u043A, \u0437\u0430\u043F\u0438\u0441\u044C \u0432 \u0436\u0443\u0440\u043D\u0430\u043B\u0435 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F." }), _jsxs("span", { className: "its-j__mono", children: [formatFileSize(query || userId !== 'all' ? visibleBytes : totalBytes), " \u00B7 ", visible.length] })] }), loadError ? _jsx("p", { className: "its-j__bad", role: "alert", children: loadError }) : null, months.length === 0 ? (_jsx("div", { className: "its-j__empty", children: loadError ? 'Хранилище не загрузилось' : 'В хранилище пока нет файлов' })) : months.map((month) => {
                const open = Object.prototype.hasOwnProperty.call(monthsOpen, month.key) ? monthsOpen[month.key] : month.openByDefault;
                return (_jsxs("section", { className: "its-j__storage-month", children: [_jsxs("button", { type: "button", className: `its-j__day its-j__month${open ? ' is-open' : ''}`, "aria-expanded": open, onClick: () => setMonthsOpen((current) => ({ ...current, [month.key]: !open })), children: [_jsxs("span", { className: "its-j__day-title", children: [_jsx("span", { className: "its-j__day-mark", "aria-hidden": true }), month.label] }), _jsxs("span", { children: [month.files.length, " \u00B7 ", formatFileSize(month.bytes)] })] }), open ? (_jsxs("div", { className: "its-j__storage-body", children: [_jsx("div", { className: "its-j__storage-tools", children: _jsx("button", { type: "button", className: "its-j__btn its-j__btn--danger", onClick: () => ask({
                                            ids: month.files.map((file) => file.id),
                                            title: `Удалить файлы за ${month.label}?`,
                                            text: `С диска будут удалены ${month.files.length} файлов, освободится ${formatFileSize(month.bytes)}. Записи журнала останутся, но открыть эти файлы будет нельзя.`,
                                        }), children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0444\u0430\u0439\u043B\u044B \u043C\u0435\u0441\u044F\u0446\u0430" }) }), _jsxs("div", { className: "its-j__table its-j__store", children: [_jsxs("div", { className: "its-j__thead", children: [_jsx("span", { children: "\u0424\u0430\u0439\u043B" }), _jsx("span", { children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A" }), _jsx("span", { children: "\u041A\u043E\u0433\u0434\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D" }), _jsx("span", { children: "\u0420\u0430\u0437\u043C\u0435\u0440" }), _jsx("span", { children: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F" })] }), month.files.map((file) => {
                                            const person = storagePersonLabel(file.windowsUser, file.host);
                                            const extra = file.users.length > 1 ? ` · ещё ${file.users.length - 1}` : '';
                                            return (_jsxs("div", { className: "its-j__trow its-j__store-row", children: [_jsxs("span", { className: "its-j__stack", children: [_jsx("span", { className: "its-j__strong", children: file.fileName }), file.copies > 1 ? (_jsxs("span", { className: "its-j__mono its-j__meta", children: ["\u0412 \u0436\u0443\u0440\u043D\u0430\u043B\u0435 ", file.copies, " \u0440\u0430\u0437, \u043D\u0430 \u0434\u0438\u0441\u043A\u0435 \u043E\u0434\u043D\u0430 \u043A\u043E\u043F\u0438\u044F"] })) : null] }), _jsxs("span", { children: [person, extra] }), _jsx("span", { className: "its-j__mono its-j__meta", children: formatStorageWhen(file.occurredAt) }), _jsx("span", { className: "its-j__mono", children: formatFileSize(file.fileSize) }), _jsxs("span", { className: "its-j__store-actions", children: [_jsx("button", { type: "button", className: "its-j__btn its-j__btn--accent", onClick: () => onPreview(file.id, file.fileName), children: "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440" }), _jsx("button", { type: "button", className: "its-j__btn", onClick: () => onDownload(file.id, file.fileName), children: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C" }), _jsx("button", { type: "button", className: "its-j__btn its-j__btn--danger", onClick: () => ask({
                                                                    ids: [file.id],
                                                                    title: 'Удалить файл с диска?',
                                                                    text: file.copies > 1
                                                                        ? `«${file.fileName}» хранится одной копией и встречается в журнале ${file.copies} раз. Копия будет удалена, освободится ${formatFileSize(file.fileSize)}. Записи журнала останутся.`
                                                                        : `«${file.fileName}» будет удалён из хранилища. Освободится ${formatFileSize(file.fileSize)}. Запись в журнале останется.`,
                                                                }), children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] })] }, file.id));
                                        })] })] })) : null] }, month.key));
            }), pending ? createPortal(_jsx("div", { className: "its-preview", role: "presentation", onClick: () => { if (!busy)
                    setPending(null); }, children: _jsxs("div", { className: "its-preview__dialog its-store-confirm", role: "dialog", "aria-modal": "true", "aria-labelledby": "its-store-confirm-title", onClick: (event) => event.stopPropagation(), children: [_jsx("h2", { id: "its-store-confirm-title", className: "its-preview__title", children: pending.title }), _jsx("p", { className: "its-store-confirm__text", children: pending.text }), error ? _jsx("p", { className: "its-j__bad", role: "alert", children: error }) : null, _jsxs("div", { className: "its-store-confirm__actions", children: [_jsx("button", { type: "button", className: "its-j__btn", disabled: busy, onClick: () => setPending(null), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "its-j__btn its-j__btn--danger-solid", disabled: busy, onClick: confirm, children: busy ? 'Удаляем…' : 'Удалить' })] })] }) }), document.body) : null] }));
}
