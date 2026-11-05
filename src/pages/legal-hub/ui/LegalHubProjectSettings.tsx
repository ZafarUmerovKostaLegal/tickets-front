import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import {
    assignProjectToFolder,
    FOLDER_COLORS,
    type FolderColor,
    type ProjectDisplaySettings,
    type ProjectFolder,
} from './legalHubProjectDisplay';

type ProjectRow = { id: string; name: string };

const COLOR_LABEL: Record<FolderColor, TranslationKey> = {
    slate: 'legalHub.projectFolderColorSlate',
    ink: 'legalHub.projectFolderColorInk',
    accent: 'legalHub.projectFolderColorAccent',
    warning: 'legalHub.projectFolderColorWarning',
    success: 'legalHub.projectFolderColorSuccess',
    error: 'legalHub.projectFolderColorError',
};

export function LegalHubProjectSettings({
    open,
    settings,
    projects,
    onClose,
    onChange,
}: {
    open: boolean;
    settings: ProjectDisplaySettings;
    projects: ProjectRow[];
    onClose: () => void;
    onChange: (settings: ProjectDisplaySettings) => void;
}) {
    const { t } = useI18n();

    useEffect(() => {
        if (!open)
            return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, open]);

    if (!open)
        return null;

    const patchFolder = (id: string, patch: Partial<ProjectFolder>) => {
        onChange({
            ...settings,
            folders: settings.folders.map((folder) => folder.id === id ? { ...folder, ...patch } : folder),
        });
    };

    const addFolder = () => {
        onChange({
            ...settings,
            folders: [
                ...settings.folders,
                {
                    id: `fld-${Date.now()}`,
                    name: t('legalHub.projectFolderNew'),
                    color: 'slate',
                    projectIds: [],
                    collapsed: false,
                },
            ],
        });
    };

    return createPortal(
        <div className="lh-my__overlay" role="presentation" onMouseDown={onClose}>
            <div
                className="lh-my__dialog lh-folders"
                role="dialog"
                aria-modal="true"
                aria-labelledby="lh-project-display-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header>
                    <h2 id="lh-project-display-title">{t('legalHub.projectDisplay')}</h2>
                    <button type="button" className="lh-drawer__close" aria-label={t('legalHub.taskDrawerClose')} onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                            <path d="M6 6l12 12M18 6 6 18" />
                        </svg>
                    </button>
                </header>
                <button
                    type="button"
                    className={`lh-my__switch${settings.hideLocked ? ' is-on' : ''}`}
                    role="switch"
                    aria-checked={settings.hideLocked}
                    onClick={() => onChange({ ...settings, hideLocked: !settings.hideLocked })}
                >
                    <span>{t('legalHub.projectDisplayHideLocked')}</span>
                    <i aria-hidden />
                </button>
                <div className="lh-folders__head">
                    <h3>{t('legalHub.projectFolders')}</h3>
                    <button type="button" className="lh-folders__add" onClick={addFolder}>
                        {t('legalHub.projectFolderNew')}
                    </button>
                </div>
                {settings.folders.length === 0 ? <p className="lh-folders__note">{t('legalHub.projectFoldersEmpty')}</p> : null}
                <div className="lh-folders__list">
                    {settings.folders.map((folder) => (
                        <section key={folder.id} className="lh-folders__card">
                            <div className="lh-folders__card-head">
                                <label className="lh-folders__name">
                                    <input
                                        value={folder.name}
                                        aria-label={t('legalHub.projectFolderName')}
                                        onChange={(event) => patchFolder(folder.id, { name: event.target.value })}
                                    />
                                </label>
                                <button type="button" className="lh-folders__delete" onClick={() => onChange({
                                    ...settings,
                                    folders: settings.folders.filter((item) => item.id !== folder.id),
                                })}
                                >
                                    {t('legalHub.projectFolderDelete')}
                                </button>
                            </div>
                            <div className="lh-folders__colors" role="radiogroup" aria-label={t('legalHub.projectFolderColor')}>
                                {FOLDER_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={`lh-folders__color is-${color}${folder.color === color ? ' is-on' : ''}`}
                                        role="radio"
                                        aria-checked={folder.color === color}
                                        aria-label={t(COLOR_LABEL[color])}
                                        onClick={() => patchFolder(folder.id, { color })}
                                    />
                                ))}
                            </div>
                            <ul className="lh-folders__picks">
                                {projects.map((project) => {
                                    const checked = folder.projectIds.includes(project.id);
                                    return (
                                        <li key={project.id}>
                                            <label className="lh-folders__pick">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(event) => onChange({
                                                        ...settings,
                                                        folders: assignProjectToFolder(settings.folders, folder.id, project.id, event.target.checked),
                                                    })}
                                                />
                                                <span>{project.name}</span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </div>,
        document.body,
    );
}

export function folderSwatchClass(color: FolderColor): string {
    return `lh-side__sw lh-side__sw--${color}`;
}
