import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createInternalExtension, deleteInternalExtension, fetchInternalExtensions, patchInternalExtension, } from '@entities/internal-communication';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { showConfirm } from '@shared/ui/app-dialog/appDialogGate';
import { showToast } from '@shared/ui/app-toast';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { IconPhone } from '@widgets/sidebar/ui/SidebarIcons';
import { canManageInternalExtensions } from '../model/permissions';
import { applyCreatedInternalExtension, applyDeletedInternalExtension, applyUpdatedInternalExtension, editingInternalExtension, filterInternalExtensions, internalExtensionInitials, } from '../model/directoryList';
import { InternalExtensionModal } from './InternalExtensionModal';
import './InternalCommunicationPage.css';
function SearchIcon() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("circle", { cx: "11", cy: "11", r: "7" }), _jsx("path", { d: "M20 20l-3.5-3.5" })] }));
}
function avatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1)
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 28% 42%)`;
}
export function InternalCommunicationPage() {
    const { t } = useI18n();
    const { user } = useCurrentUser();
    const canManage = canManageInternalExtensions(user?.role);
    const [query, setQuery] = useState('');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [modal, setModal] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const load = useCallback(async (signal) => {
        setLoadError(null);
        try {
            const data = await fetchInternalExtensions(signal);
            if (!signal?.aborted)
                setRows(data);
        }
        catch (e) {
            if (signal?.aborted)
                return;
            setRows([]);
            setLoadError(e instanceof Error ? e.message : t('internalCommunicationPage.loadError'));
        }
        finally {
            if (!signal?.aborted)
                setLoading(false);
        }
    }, [t]);
    useEffect(() => {
        const ac = new AbortController();
        setLoading(true);
        void load(ac.signal);
        return () => ac.abort();
    }, [load]);
    const filtered = useMemo(() => filterInternalExtensions(rows, query), [query, rows]);
    const handleSave = async (body) => {
        setSaving(true);
        setSaveError(null);
        try {
            if (modal === 'new') {
                const created = await createInternalExtension(body);
                setRows((prev) => applyCreatedInternalExtension(prev, created));
                showToast({ message: t('internalCommunicationPage.created'), variant: 'success' });
            }
            else {
                const current = editingInternalExtension(modal);
                if (current) {
                    const updated = await patchInternalExtension(current.id, body);
                    setRows((prev) => applyUpdatedInternalExtension(prev, updated));
                    showToast({ message: t('internalCommunicationPage.updated'), variant: 'success' });
                }
            }
            setModal(null);
        }
        catch (e) {
            setSaveError(e instanceof Error ? e.message : t('internalCommunicationPage.saveError'));
        }
        finally {
            setSaving(false);
        }
    };
    const handleDelete = async (row) => {
        const ok = await showConfirm({
            title: t('internalCommunicationPage.deleteTitle'),
            message: t('internalCommunicationPage.deleteConfirm').replace('{name}', row.fullName),
            confirmLabel: t('internalCommunicationPage.delete'),
            cancelLabel: t('common.cancel'),
            variant: 'danger',
        });
        if (!ok)
            return;
        try {
            await deleteInternalExtension(row.id);
            setRows((prev) => applyDeletedInternalExtension(prev, row.id));
            showToast({ message: t('internalCommunicationPage.deleted'), variant: 'success' });
        }
        catch (e) {
            showToast({
                message: e instanceof Error ? e.message : t('internalCommunicationPage.deleteError'),
                variant: 'error',
            });
        }
    };
    const copyExtension = async (extension) => {
        try {
            await navigator.clipboard.writeText(extension);
            showToast({ message: t('internalCommunicationPage.copied'), variant: 'success' });
        }
        catch {
            showToast({ message: extension, variant: 'info' });
        }
    };
    const hasDirectory = rows.length > 0;
    return (_jsxs("div", { className: "icom-page", children: [_jsxs("main", { className: "icom-page__main", children: [_jsx("header", { className: "icom-page__header", children: _jsxs("div", { className: "icom-page__header-inner", children: [_jsxs("div", { className: "icom-page__header-start", children: [_jsx(AppBackButton, { className: "app-back-btn" }), _jsx(AppHomeLogo, { withSeparator: true }), _jsxs("div", { children: [_jsx("h1", { className: "icom-page__title", children: t('internalCommunicationPage.title') }), _jsx("p", { className: "icom-page__subtitle", children: t('internalCommunicationPage.subtitle') })] })] }), _jsx(AppPageSettings, {})] }) }), _jsx("div", { className: "icom-page__content", children: _jsxs("section", { className: "icom-page__panel", "aria-label": t('internalCommunicationPage.title'), children: [_jsxs("div", { className: "icom-page__panel-head", children: [_jsxs("div", { className: "icom-page__panel-brand", children: [_jsx("span", { className: "icom-page__panel-icon", "aria-hidden": true, children: _jsx(IconPhone, {}) }), _jsxs("div", { className: "icom-page__panel-copy", children: [_jsx("h2", { className: "icom-page__panel-title", children: t('internalCommunicationPage.title') }), _jsx("p", { className: "icom-page__panel-text", children: t('internalCommunicationPage.subtitle') })] })] }), _jsxs("div", { className: "icom-page__panel-meta", children: [_jsx("span", { className: "icom-page__count-chip", children: t('internalCommunicationPage.count').replace('{count}', String(filtered.length)) }), canManage ? (_jsx("button", { type: "button", className: "icom-page__add-btn", onClick: () => {
                                                        setSaveError(null);
                                                        setModal('new');
                                                    }, children: t('internalCommunicationPage.addContact') })) : null] })] }), _jsx("div", { className: "icom-page__toolbar", children: _jsxs("label", { className: "icom-page__search", children: [_jsx("span", { className: "icom-page__search-icon", children: _jsx(SearchIcon, {}) }), _jsx("span", { className: "visually-hidden", children: t('internalCommunicationPage.searchPlaceholder') }), _jsx("input", { type: "search", className: "icom-page__search-input", value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('internalCommunicationPage.searchPlaceholder'), autoComplete: "off" })] }) }), loading ? (_jsx("div", { className: "icom-page__empty", role: "status", children: _jsx("p", { className: "icom-page__empty-title", children: t('internalCommunicationPage.loading') }) })) : loadError ? (_jsxs("div", { className: "icom-page__empty", role: "alert", children: [_jsx("p", { className: "icom-page__empty-title", children: loadError }), _jsx("button", { type: "button", className: "icom-page__retry", onClick: () => void load(), children: t('internalCommunicationPage.retry') })] })) : filtered.length === 0 ? (_jsxs("div", { className: "icom-page__empty", role: "status", children: [_jsx("span", { className: "icom-page__empty-icon", "aria-hidden": true, children: _jsx(IconPhone, {}) }), _jsx("p", { className: "icom-page__empty-title", children: hasDirectory
                                                ? t('internalCommunicationPage.empty')
                                                : t('internalCommunicationPage.emptyDirectory') }), hasDirectory ? (_jsx("p", { className: "icom-page__empty-hint", children: t('internalCommunicationPage.emptyHint') })) : canManage ? (_jsx("p", { className: "icom-page__empty-hint", children: t('internalCommunicationPage.emptyManageHint') })) : null] })) : (_jsx("div", { className: "icom-page__table-wrap", children: _jsxs("table", { className: "icom-page__table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "icom-page__col--name", scope: "col", children: t('internalCommunicationPage.colName') }), _jsx("th", { className: "icom-page__col--ext", scope: "col", children: t('internalCommunicationPage.colExtension') }), canManage ? (_jsx("th", { className: "icom-page__col--actions", scope: "col", children: t('internalCommunicationPage.colActions') })) : null] }) }), _jsx("tbody", { children: filtered.map((row, index) => (_jsxs("tr", { style: { animationDelay: `${Math.min(index, 24) * 16}ms` }, children: [_jsx("td", { className: "icom-page__col--name", children: _jsxs("div", { className: "icom-page__person", children: [_jsx("span", { className: "icom-page__avatar", style: { background: avatarColor(row.fullName) }, "aria-hidden": true, children: internalExtensionInitials(row.fullName) }), _jsx("span", { className: "icom-page__name", children: row.fullName })] }) }), _jsx("td", { className: "icom-page__col--ext", children: _jsx("button", { type: "button", className: "icom-page__ext", title: t('internalCommunicationPage.copyExtension'), onClick: () => void copyExtension(row.extension), children: row.extension }) }), canManage ? (_jsx("td", { className: "icom-page__col--actions", children: _jsxs("div", { className: "icom-page__row-actions", children: [_jsx("button", { type: "button", className: "icom-page__row-action", onClick: () => {
                                                                            setSaveError(null);
                                                                            setModal(row);
                                                                        }, children: t('internalCommunicationPage.edit') }), _jsx("button", { type: "button", className: "icom-page__row-action icom-page__row-action--danger", onClick: () => void handleDelete(row), children: t('internalCommunicationPage.delete') })] }) })) : null] }, row.id))) })] }) }))] }) })] }), modal != null ? (_jsx(InternalExtensionModal, { initial: modal === 'new' ? null : modal, submitting: saving, error: saveError, onClose: () => !saving && setModal(null), onSubmit: (body) => void handleSave(body) })) : null] }));
}
