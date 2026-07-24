import { useMemo, useState } from 'react';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { IconPhone } from '@widgets/sidebar/ui/SidebarIcons';
import { INTERNAL_EXTENSION_DIRECTORY } from '../model/directory';
import './InternalCommunicationPage.css';

function normalizeSearch(value: string): string {
    return value.trim().toLocaleLowerCase('ru-RU');
}

function SearchIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
        </svg>
    );
}

export function InternalCommunicationPage() {
    const { t } = useI18n();
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const q = normalizeSearch(query);
        const rows = [...INTERNAL_EXTENSION_DIRECTORY].sort((a, b) =>
            a.extension.localeCompare(b.extension, undefined, { numeric: true }),
        );
        if (!q)
            return rows;
        return rows.filter(
            (row) =>
                normalizeSearch(row.fullName).includes(q) ||
                normalizeSearch(row.extension).includes(q),
        );
    }, [query]);

    const hasDirectory = INTERNAL_EXTENSION_DIRECTORY.length > 0;

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
                            <span className="icom-page__count-chip">
                                {t('internalCommunicationPage.count').replace('{count}', String(filtered.length))}
                            </span>
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

                        {filtered.length === 0 ? (
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
                                ) : null}
                            </div>
                        ) : (
                            <div className="icom-page__table-wrap">
                                <table className="icom-page__table">
                                    <thead>
                                        <tr>
                                            <th scope="col" className="icom-page__col icom-page__col--name">
                                                {t('internalCommunicationPage.colName')}
                                            </th>
                                            <th scope="col" className="icom-page__col icom-page__col--ext">
                                                {t('internalCommunicationPage.colExtension')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((row, index) => (
                                            <tr
                                                key={`${row.fullName}-${row.extension}`}
                                                style={{ animationDelay: `${Math.min(index, 18) * 18}ms` }}
                                            >
                                                <td
                                                    className="icom-page__col icom-page__col--name"
                                                    data-label={t('internalCommunicationPage.colName')}
                                                >
                                                    <span className="icom-page__name">{row.fullName}</span>
                                                </td>
                                                <td
                                                    className="icom-page__col icom-page__col--ext"
                                                    data-label={t('internalCommunicationPage.colExtension')}
                                                >
                                                    <span className="icom-page__ext">{row.extension}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
