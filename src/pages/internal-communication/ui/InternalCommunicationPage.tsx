import { useMemo, useState } from 'react';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { INTERNAL_EXTENSION_DIRECTORY } from '../model/directory';
import './InternalCommunicationPage.css';

function normalizeSearch(value: string): string {
    return value.trim().toLocaleLowerCase('ru-RU');
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
                    <div className="icom-page__toolbar">
                        <label className="icom-page__search">
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
                        <p className="icom-page__count">
                            {t('internalCommunicationPage.count').replace('{count}', String(filtered.length))}
                        </p>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="icom-page__empty" role="status">
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
                                    {filtered.map((row) => (
                                        <tr key={`${row.fullName}-${row.extension}`}>
                                            <td
                                                className="icom-page__col icom-page__col--name"
                                                data-label={t('internalCommunicationPage.colName')}
                                            >
                                                {row.fullName}
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
                </div>
            </main>
        </div>
    );
}
