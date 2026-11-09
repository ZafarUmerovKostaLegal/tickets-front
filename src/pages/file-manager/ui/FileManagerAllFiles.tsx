import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { useI18n } from '@shared/i18n';
import {
    ACCESS_REQUESTS,
    ATTENTION,
    practicesForUser,
    recentForUser,
    type AccessTone,
    type PracticeTone,
    type RecentFile,
} from './fileManagerAllMock';

export type FileManagerAllFilesHandle = {
    openUpload: () => void;
    openCreateFolder: () => void;
};

type Props = {
    canManage: boolean;
};

function KindIcon({ kind }: { kind: RecentFile['kind'] }) {
    const label = kind === 'doc' ? 'W' : kind === 'pdf' ? 'PDF' : kind === 'sheet' ? 'X' : 'Z';
    return <span className={`fm-all__kind fm-all__kind--${kind}`} aria-hidden>{label}</span>;
}

function PracticeIcon() {
    return (
        <span className="fm-all__practice-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 8.5h7l1.5-2H20v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
            </svg>
        </span>
    );
}

export const FileManagerAllFiles = forwardRef<FileManagerAllFilesHandle, Props>(function FileManagerAllFiles({ canManage }, ref) {
    const { t } = useI18n();
    const fileRef = useRef<HTMLInputElement>(null);
    const practices = useMemo(() => practicesForUser(canManage), [canManage]);
    const recent = useMemo(() => recentForUser(canManage), [canManage]);
    const projectCount = practices.reduce((sum, item) => sum + item.projects, 0);

    useImperativeHandle(ref, () => ({
        openUpload: () => fileRef.current?.click(),
        openCreateFolder: () => fileRef.current?.click(),
    }), []);

    const meta = canManage
        ? t('fileManager.allMetaAdmin')
            .replace('{practices}', String(practices.length))
            .replace('{projects}', String(projectCount))
        : t('fileManager.allMetaEmployee')
            .replace('{practice}', practices[0]?.name ?? '')
            .replace('{projects}', String(projectCount));

    return (
        <div className={`fm-all${canManage ? ' fm-all--manage' : ''}`}>
            <div className="fm-all__top">
                <div className="fm-all__intro">
                    <h2 className="fm-all__title">{t('fileManager.all')}</h2>
                    <p className="fm-all__meta">{meta}</p>
                </div>
                <div className="fm-all__actions">
                    {canManage ? (
                        <button type="button" className="fm-all__btn" onClick={() => fileRef.current?.click()}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                                <path d="M4 8.5h7l1.5-2H20v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
                            </svg>
                            {t('fileManager.newFolder')}
                        </button>
                    ) : null}
                    <button type="button" className="fm-all__btn fm-all__btn--primary" onClick={() => fileRef.current?.click()}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                            <path d="M12 16V5" /><path d="m8 8 4-4 4 4" /><path d="M5 19h14" />
                        </svg>
                        {t('fileManager.uploadFiles')}
                    </button>
                    <input ref={fileRef} className="fm-all__file" type="file" multiple />
                </div>
            </div>

            {canManage ? (
                <section className="fm-all__stats" aria-label={t('fileManager.statsAria')}>
                    <article className="fm-all__stat">
                        <span>{t('fileManager.statFiles')}</span>
                        <strong>48 213</strong>
                        <small className="is-up">+312 {t('fileManager.statWeek')}</small>
                    </article>
                    <article className="fm-all__stat">
                        <span>{t('fileManager.statLinks')}</span>
                        <strong>126</strong>
                        <small>12 {t('fileManager.statExternal')} · 2 {t('fileManager.statNoPassword')}</small>
                    </article>
                    <article className="fm-all__stat">
                        <span>{t('fileManager.statRequests')}</span>
                        <strong>7</strong>
                        <small className="is-warn">3 {t('fileManager.statWaiting')}</small>
                    </article>
                    <article className="fm-all__stat">
                        <span>{t('fileManager.statRejected')}</span>
                        <strong>18</strong>
                        <button type="button" className="fm-all__stat-link">{t('fileManager.statLog')}</button>
                    </article>
                </section>
            ) : null}

            <div className="fm-all__layout">
                <div className="fm-all__main">
                    <section className="fm-all__section">
                        <div className="fm-all__section-head">
                            <h3>{t('fileManager.practices')}</h3>
                            {canManage ? <button type="button" className="fm-all__text-btn">{t('fileManager.openTree')}</button> : null}
                        </div>
                        <div className={`fm-all__practices${practices.length === 1 ? ' is-single' : ''}`}>
                            {practices.map((practice) => (
                                <button key={practice.id} type="button" className="fm-all__practice">
                                    <div className="fm-all__practice-top">
                                        <PracticeIcon />
                                        <em className={`fm-all__badge is-${practice.tone as PracticeTone}`}>{practice.badge}</em>
                                    </div>
                                    <strong>{practice.code}</strong>
                                    <span>{practice.name}</span>
                                    <small>{practice.projects} {t('fileManager.projects')} · {practice.size}</small>
                                    <small className="fm-all__lead">{practice.lead}</small>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="fm-all__section">
                        <div className="fm-all__section-head">
                            <h3>{t('fileManager.recentSection')}</h3>
                            <button type="button" className="fm-all__text-btn">{t('fileManager.openAll')}</button>
                        </div>
                        <div className="fm-all__table-wrap">
                            <table className="fm-all__table">
                                <thead>
                                    <tr>
                                        <th>{t('fileManager.colName')}</th>
                                        <th>{t('fileManager.colChanged')}</th>
                                        <th>{t('fileManager.colChangedBy')}</th>
                                        <th>{t('fileManager.colAccess')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recent.map((file) => (
                                        <tr key={file.id}>
                                            <td>
                                                <div className="fm-all__file-cell">
                                                    <KindIcon kind={file.kind} />
                                                    <div>
                                                        <strong>{file.name}</strong>
                                                        <span>{file.path}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{file.changed}</td>
                                            <td>{file.changedBy}</td>
                                            <td>
                                                <em className={`fm-all__access is-${file.accessTone as AccessTone}`}>{file.access}</em>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                {canManage ? (
                    <aside className="fm-all__aside">
                        <section className="fm-all__card">
                            <h3>{t('fileManager.attention')}</h3>
                            <ul className="fm-all__attention">
                                {ATTENTION.map((item) => (
                                    <li key={item.id} className={`is-${item.tone}`}>
                                        <strong>{item.title}</strong>
                                        <span>{item.detail}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                        <section className="fm-all__card">
                            <h3>{t('fileManager.accessRequests')}</h3>
                            <ul className="fm-all__requests">
                                {ACCESS_REQUESTS.map((item) => (
                                    <li key={item.id}>
                                        <div className="fm-all__request-user">
                                            <span aria-hidden>{item.initials}</span>
                                            <div>
                                                <strong>{item.user}</strong>
                                                <small>{item.file}</small>
                                            </div>
                                        </div>
                                        <p>{item.reason}</p>
                                        <div className="fm-all__request-actions">
                                            <button type="button" className="fm-all__btn fm-all__btn--primary fm-all__btn--sm">{t('fileManager.approve')}</button>
                                            <button type="button" className="fm-all__btn fm-all__btn--sm">{t('fileManager.forPeriod')}</button>
                                            <button type="button" className="fm-all__btn fm-all__btn--ghost fm-all__btn--sm">{t('fileManager.decline')}</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </aside>
                ) : null}
            </div>
        </div>
    );
});
