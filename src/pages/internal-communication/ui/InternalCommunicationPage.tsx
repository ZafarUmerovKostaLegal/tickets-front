import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    createInternalExtension,
    deleteInternalExtension,
    fetchInternalExtensions,
    patchInternalExtension,
    type InternalExtension,
} from '@entities/internal-communication';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { showConfirm } from '@shared/ui/app-dialog/appDialogGate';
import { showToast } from '@shared/ui/app-toast';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { IconPhone } from '@widgets/sidebar/ui/SidebarIcons';
import { canManageInternalExtensions } from '../model/permissions';
import {
    applyCreatedInternalExtension,
    applyDeletedInternalExtension,
    applyUpdatedInternalExtension,
    editingInternalExtension,
    filterInternalExtensions,
    internalExtensionInitials,
} from '../model/directoryList';
import { InternalExtensionModal } from './InternalExtensionModal';
import './InternalCommunicationPage.css';

function SearchIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
        </svg>
    );
}

function avatarColor(name: string): string {
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
    const [rows, setRows] = useState<InternalExtension[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [modal, setModal] = useState<InternalExtension | 'new' | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const load = useCallback(async (signal?: AbortSignal) => {
        setLoadError(null);
        try {
            const data = await fetchInternalExtensions(signal);
            if (!signal?.aborted)
                setRows(data);
        }
        catch (e: unknown) {
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

    const handleSave = async (body: { fullName: string; extension: string }) => {
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
        catch (e: unknown) {
            setSaveError(e instanceof Error ? e.message : t('internalCommunicationPage.saveError'));
        }
        finally {
            setSaving(false);
        }
    };

    const handleDelete = async (row: InternalExtension) => {
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
        catch (e: unknown) {
            showToast({
                message: e instanceof Error ? e.message : t('internalCommunicationPage.deleteError'),
                variant: 'error',
            });
        }
    };

    const copyExtension = async (extension: string) => {
        try {
            await navigator.clipboard.writeText(extension);
            showToast({ message: t('internalCommunicationPage.copied'), variant: 'success' });
        }
        catch {
            showToast({ message: extension, variant: 'info' });
        }
    };

    const hasDirectory = rows.length > 0;

    return (
        <div className="icom-page">
            <main className="icom-page__main">
                <header className="icom-page__header">
                    <div className="icom-page__header-inner">
                        <div className="icom-page__header-start">
                            <AppBackButton className="app-back-btn" />
                            <AppHomeLogo withSeparator />
                            <div>
                                <h1 className="icom-page__title">{t('internalCommunicationPage.title')}</h1>
                                <p className="icom-page__subtitle">{t('internalCommunicationPage.subtitle')}</p>
                            </div>
                        </div>
                        <AppPageSettings />
                    </div>
                </header>

                <div className="icom-page__content">
                    <section className="icom-page__panel" aria-label={t('internalCommunicationPage.title')}>
                        <div className="icom-page__panel-head">
                            <div className="icom-page__panel-brand">
                                <span className="icom-page__panel-icon" aria-hidden>
                                    <IconPhone />
                                </span>
                                <div className="icom-page__panel-copy">
                                    <h2 className="icom-page__panel-title">{t('internalCommunicationPage.title')}</h2>
                                    <p className="icom-page__panel-text">{t('internalCommunicationPage.subtitle')}</p>
                                </div>
                            </div>
                            <div className="icom-page__panel-meta">
                                <span className="icom-page__count-chip">
                                    {t('internalCommunicationPage.count').replace('{count}', String(filtered.length))}
                                </span>
                                {canManage ? (
                                    <button
                                        type="button"
                                        className="icom-page__add-btn"
                                        onClick={() => {
                                            setSaveError(null);
                                            setModal('new');
                                        }}
                                    >
                                        {t('internalCommunicationPage.addContact')}
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        <div className="icom-page__toolbar">
                            <label className="icom-page__search">
                                <span className="icom-page__search-icon">
                                    <SearchIcon />
                                </span>
                                <span className="visually-hidden">{t('internalCommunicationPage.searchPlaceholder')}</span>
                                <input
                                    type="search"
                                    className="icom-page__search-input"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={t('internalCommunicationPage.searchPlaceholder')}
                                    autoComplete="off"
                                />
                            </label>
                        </div>

                        {loading ? (
                            <div className="icom-page__empty" role="status">
                                <p className="icom-page__empty-title">{t('internalCommunicationPage.loading')}</p>
                            </div>
                        ) : loadError ? (
                            <div className="icom-page__empty" role="alert">
                                <p className="icom-page__empty-title">{loadError}</p>
                                <button type="button" className="icom-page__retry" onClick={() => void load()}>
                                    {t('internalCommunicationPage.retry')}
                                </button>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="icom-page__empty" role="status">
                                <span className="icom-page__empty-icon" aria-hidden>
                                    <IconPhone />
                                </span>
                                <p className="icom-page__empty-title">
                                    {hasDirectory
                                        ? t('internalCommunicationPage.empty')
                                        : t('internalCommunicationPage.emptyDirectory')}
                                </p>
                                {hasDirectory ? (
                                    <p className="icom-page__empty-hint">{t('internalCommunicationPage.emptyHint')}</p>
                                ) : canManage ? (
                                    <p className="icom-page__empty-hint">{t('internalCommunicationPage.emptyManageHint')}</p>
                                ) : null}
                            </div>
                        ) : (
                            <ul className="icom-page__grid">
                                {filtered.map((row, index) => (
                                    <li
                                        key={row.id}
                                        className="icom-card"
                                        style={{ animationDelay: `${Math.min(index, 18) * 18}ms` }}
                                    >
                                        <span className="icom-card__avatar" style={{ background: avatarColor(row.fullName) }} aria-hidden>
                                            {internalExtensionInitials(row.fullName)}
                                        </span>
                                        <div className="icom-card__body">
                                            <p className="icom-card__name">{row.fullName}</p>
                                            <button
                                                type="button"
                                                className="icom-card__ext"
                                                title={t('internalCommunicationPage.copyExtension')}
                                                onClick={() => void copyExtension(row.extension)}
                                            >
                                                {row.extension}
                                            </button>
                                        </div>
                                        {canManage ? (
                                            <div className="icom-card__actions">
                                                <button
                                                    type="button"
                                                    className="icom-card__action"
                                                    onClick={() => {
                                                        setSaveError(null);
                                                        setModal(row);
                                                    }}
                                                >
                                                    {t('internalCommunicationPage.edit')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="icom-card__action icom-card__action--danger"
                                                    onClick={() => void handleDelete(row)}
                                                >
                                                    {t('internalCommunicationPage.delete')}
                                                </button>
                                            </div>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </main>
            {modal != null ? (
                <InternalExtensionModal
                    initial={modal === 'new' ? null : modal}
                    submitting={saving}
                    error={saveError}
                    onClose={() => !saving && setModal(null)}
                    onSubmit={(body) => void handleSave(body)}
                />
            ) : null}
        </div>
    );
}
