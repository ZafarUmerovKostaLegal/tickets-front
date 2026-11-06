import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
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
import './FileManagerPage.css';

export function FileManagerPage() {
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

    const apply = (next: DriveListing | null) => {
        if (next == null) {
            setError(t('fileManager.error'));
            return;
        }
        setError('');
        setListing(next);
    };

    useEffect(() => {
        let cancelled = false;
        void listDrive(folderId).then((next) => {
            if (!cancelled)
                apply(next);
        });
        return () => {
            cancelled = true;
        };
    }, [folderId]);

    const createFolder = () => {
        const name = folderName.trim();
        if (!name)
            return;
        void createDriveFolder(name, folderId).then((next) => {
            apply(next);
            if (next)
                setFolderName('');
            setCreating(false);
        });
    };

    return (
        <div className="fm">
            <header className="fm__head">
                <div className="fm__head-start">
                    <AppBackButton />
                    <AppHomeLogo withSeparator />
                    <h1>{t('nav.fileManager')}</h1>
                </div>
                <AppPageSettings />
            </header>
            <div className="fm__bar">
                <nav className="fm__crumbs" aria-label={t('nav.fileManager')}>
                    <button type="button" onClick={() => setFolderId(null)}>{t('fileManager.root')}</button>
                    {listing.path.map((folder) => (
                        <span key={folder.id}>
                            <span aria-hidden>/</span>
                            <button type="button" onClick={() => setFolderId(folder.id)}>{folder.name}</button>
                        </span>
                    ))}
                </nav>
                <div className="fm__actions">
                    {creating ? (
                        <form
                            className="fm__new"
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
                    )}
                    <button type="button" className="fm__upload" onClick={() => fileRef.current?.click()}>{t('fileManager.upload')}</button>
                    <input
                        ref={fileRef}
                        className="fm__file"
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
            {error ? <p className="fm__error" role="alert">{error}</p> : null}
            {listing.folders.length === 0 && listing.files.length === 0 ? <p className="fm__empty">{t('fileManager.empty')}</p> : (
                <ul className="fm__grid">
                    {listing.folders.map((folder) => (
                        <FolderCard
                            key={folder.id}
                            folder={folder}
                            removeLabel={t('fileManager.remove')}
                            onOpen={() => setFolderId(folder.id)}
                            onRemove={() => void deleteDriveFolder(folder.id).then(apply)}
                        />
                    ))}
                    {listing.files.map((file) => (
                        <li key={file.id} className="fm__item">
                            <button type="button" className="fm__open" onClick={() => setPreview(file)}>
                                <span className={`fm__mark fm__mark--${file.kind}`} aria-hidden>{file.kind === 'pdf' ? 'PDF' : file.kind === 'image' ? 'IMG' : file.kind === 'doc' ? 'DOC' : file.kind === 'sheet' ? 'XLS' : 'FILE'}</span>
                                <strong>{file.name}</strong>
                                <small>{file.size}</small>
                            </button>
                            <button type="button" className="fm__remove" aria-label={t('fileManager.remove')} onClick={() => void deleteDriveFile(file.id).then(apply)}>×</button>
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
}

function FolderCard({ folder, removeLabel, onOpen, onRemove }: {
    folder: DriveFolder;
    removeLabel: string;
    onOpen: () => void;
    onRemove: () => void;
}) {
    return (
        <li className="fm__item">
            <button type="button" className="fm__open" onClick={onOpen}>
                <span className="fm__folder" aria-hidden />
                <strong>{folder.name}</strong>
            </button>
            <button type="button" className="fm__remove" aria-label={removeLabel} onClick={onRemove}>×</button>
        </li>
    );
}
