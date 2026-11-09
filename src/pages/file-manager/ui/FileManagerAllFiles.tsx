import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { useI18n } from '@shared/i18n';
import { LegalHubFilePreview } from '@pages/legal-hub/ui/LegalHubFilePreview';
import {
    createDriveFolder,
    deleteDriveFile,
    deleteDriveFolder,
    fetchDriveFileBlob,
    listDrive,
    uploadDriveFiles,
    type DriveFile,
    type DriveFolder,
    type DriveListing,
} from './fileManagerApi';

export type FileManagerAllFilesHandle = {
    openUpload: () => void;
    openCreateFolder: () => void;
};

type Props = {
    canManage: boolean;
};

export const FileManagerAllFiles = forwardRef<FileManagerAllFilesHandle, Props>(function FileManagerAllFiles({ canManage }, ref) {
    const { t } = useI18n();
    const formId = useId();
    const fileRef = useRef<HTMLInputElement>(null);
    const [folderId, setFolderId] = useState<string | null>(null);
    const [listing, setListing] = useState<DriveListing>({ path: [], folders: [], files: [] });
    const [folderName, setFolderName] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<DriveFile | null>(null);

    const loadPreview = useCallback(() => {
        if (preview == null)
            return Promise.resolve(null);
        return fetchDriveFileBlob(preview.id);
    }, [preview]);

    const apply = useCallback((next: DriveListing | null) => {
        if (next == null) {
            setError(t('fileManager.error'));
            return;
        }
        setError('');
        setListing(next);
    }, [t]);

    useEffect(() => {
        let cancelled = false;
        void listDrive(folderId).then((next) => {
            if (!cancelled)
                apply(next);
        });
        return () => {
            cancelled = true;
        };
    }, [apply, folderId]);

    useImperativeHandle(ref, () => ({
        openUpload: () => fileRef.current?.click(),
        openCreateFolder: () => {
            if (canManage)
                setCreating(true);
            else
                fileRef.current?.click();
        },
    }), [canManage]);

    const createFolder = () => {
        const name = folderName.trim();
        if (!name || !canManage)
            return;
        void createDriveFolder(name, folderId).then((next) => {
            apply(next);
            if (next)
                setFolderName('');
            setCreating(false);
        });
    };

    return (
        <div className="fm-all">
            <div className="fm-all__head">
                <h2 className="fm__panel-title">{t('fileManager.all')}</h2>
                {!canManage ? (
                    <p className="fm__panel-hint">{t('fileManager.availableProjects')}</p>
                ) : null}
            </div>
            <div className="fm-all__bar">
                <nav className="fm-all__crumbs" aria-label={t('fileManager.all')}>
                    <button type="button" onClick={() => setFolderId(null)}>{t('fileManager.root')}</button>
                    {listing.path.map((folder) => (
                        <span key={folder.id}>
                            <span aria-hidden>/</span>
                            <button type="button" onClick={() => setFolderId(folder.id)}>{folder.name}</button>
                        </span>
                    ))}
                </nav>
                <div className="fm-all__actions">
                    {canManage ? (
                        creating ? (
                            <form
                                className="fm-all__new"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    createFolder();
                                }}
                            >
                                <input
                                    autoFocus
                                    id={formId}
                                    value={folderName}
                                    placeholder={t('fileManager.folderPh')}
                                    aria-label={t('fileManager.folderPh')}
                                    onChange={(event) => setFolderName(event.target.value)}
                                />
                                <button type="submit" disabled={!folderName.trim()}>{t('fileManager.create')}</button>
                            </form>
                        ) : (
                            <button type="button" onClick={() => setCreating(true)}>{t('fileManager.newFolder')}</button>
                        )
                    ) : null}
                    <button type="button" className="fm-all__upload" onClick={() => fileRef.current?.click()}>
                        {t('fileManager.upload')}
                    </button>
                    <input
                        ref={fileRef}
                        className="fm-all__file"
                        type="file"
                        multiple
                        onChange={(event) => {
                            const picked = [...(event.target.files ?? [])];
                            event.target.value = '';
                            if (picked.length === 0)
                                return;
                            void uploadDriveFiles(picked, folderId).then(apply);
                        }}
                    />
                </div>
            </div>
            {error ? <p className="fm-all__error" role="alert">{error}</p> : null}
            {listing.folders.length === 0 && listing.files.length === 0 ? (
                <p className="fm-all__empty">{t('fileManager.empty')}</p>
            ) : (
                <ul className="fm-all__grid">
                    {listing.folders.map((folder) => (
                        <FolderCard
                            key={folder.id}
                            folder={folder}
                            canRemove={canManage}
                            removeLabel={t('fileManager.remove')}
                            onOpen={() => setFolderId(folder.id)}
                            onRemove={() => void deleteDriveFolder(folder.id).then(apply)}
                        />
                    ))}
                    {listing.files.map((file) => (
                        <li key={file.id} className="fm-all__item">
                            <button type="button" className="fm-all__open" onClick={() => setPreview(file)}>
                                <span className={`fm-all__mark fm-all__mark--${file.kind}`} aria-hidden>
                                    {file.kind === 'pdf' ? 'PDF' : file.kind === 'image' ? 'IMG' : file.kind === 'doc' ? 'DOC' : file.kind === 'sheet' ? 'XLS' : 'FILE'}
                                </span>
                                <strong>{file.name}</strong>
                                <small>{file.size}</small>
                            </button>
                            {canManage ? (
                                <button
                                    type="button"
                                    className="fm-all__remove"
                                    aria-label={t('fileManager.remove')}
                                    onClick={() => void deleteDriveFile(file.id).then(apply)}
                                >
                                    ×
                                </button>
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}
            {preview ? (
                <LegalHubFilePreview
                    name={preview.name}
                    loadBlob={loadPreview}
                    onClose={() => setPreview(null)}
                />
            ) : null}
        </div>
    );
});

function FolderCard({ folder, canRemove, removeLabel, onOpen, onRemove }: {
    folder: DriveFolder;
    canRemove: boolean;
    removeLabel: string;
    onOpen: () => void;
    onRemove: () => void;
}) {
    return (
        <li className="fm-all__item">
            <button type="button" className="fm-all__open" onClick={onOpen}>
                <span className="fm-all__folder" aria-hidden />
                <strong>{folder.name}</strong>
            </button>
            {canRemove ? (
                <button type="button" className="fm-all__remove" aria-label={removeLabel} onClick={onRemove}>×</button>
            ) : null}
        </li>
    );
}
