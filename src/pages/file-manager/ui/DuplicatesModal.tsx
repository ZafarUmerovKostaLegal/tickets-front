import { useState } from 'react';
import { filesApi, type DuplicateGroup } from '../api/filesApi';
import { formatBytes, formatDateTime } from '../lib/filesFormat';
import { FileBadge, Modal, StateBlock, useAction, useFm, useLoad } from './fmShared';

type Props = {
    matterId: string;
    editable: boolean;
    onClose: () => void;
    onOpen: (doc: { folderId: string | null; id: string }) => void;
    onChanged: () => void;
};

/**
 * Copies inside the matter. The oldest document of each group is the original; the others can go
 * to the recycle bin (restorable), one by one or all at once.
 */
export function DuplicatesModal({ matterId, editable, onClose, onOpen, onChanged }: Props) {
    const { tr, locale } = useFm();
    const act = useAction();
    const report = useLoad(() => filesApi.duplicates(matterId), [matterId]);
    const [busy, setBusy] = useState(false);

    const remove = async (ids: string[]) => {
        setBusy(true);
        let removed = 0;
        for (const id of ids) {
            if (await act(() => filesApi.deleteDocument(id)))
                removed += 1;
        }
        setBusy(false);
        if (removed) {
            report.reload();
            onChanged();
        }
    };

    const groups: DuplicateGroup[] = report.data?.groups ?? [];

    return (
        <Modal title={tr('browser.duplicatesTitle')} wide onClose={onClose}>
            <StateBlock loading={report.loading && !report.data} error={report.error} onRetry={report.reload}>
                {groups.length === 0 ? (
                    <p className="fm-dups__empty">{tr('browser.duplicatesNone')}</p>
                ) : (
                    <>
                        <p className="fm-dups__hint">{tr('browser.duplicatesHint')}</p>
                        <ul className="fm-dups">
                            {groups.map((group) => (
                                <li key={`${group.reason}:${group.key}`} className="fm-dups__group">
                                    <header className="fm-dups__head">
                                        <span className={`fm-dups__reason is-${group.reason}`}>
                                            {group.reason === 'content' ? tr('browser.duplicatesSameFile') : tr('browser.duplicatesSameLetter')}
                                        </span>
                                        {editable ? (
                                            <button type="button" className="fm-btn" disabled={busy}
                                                onClick={() => void remove(group.documents.slice(1).map((doc) => doc.id))}>
                                                {tr('browser.duplicatesKeepOriginal')}
                                            </button>
                                        ) : null}
                                    </header>
                                    <ol className="fm-dups__docs">
                                        {group.documents.map((doc, index) => (
                                            <li key={doc.id} className={index === 0 ? 'fm-dups__doc is-original' : 'fm-dups__doc'}>
                                                <FileBadge kind={doc.kind} />
                                                <button type="button" className="fm-dups__name" title={doc.name}
                                                    onClick={() => onOpen({ folderId: doc.folderId, id: doc.id })}>
                                                    <strong>{doc.name}</strong>
                                                    <small>
                                                        {doc.folderPath.length ? doc.folderPath.map((crumb) => crumb.name).join(' / ') : tr('browser.home')}
                                                        {' · '}{formatDateTime(doc.createdAt, locale)} · {doc.createdBy}
                                                        {' · '}{formatBytes(doc.sizeBytes, locale)}
                                                        {doc.version > 1 ? ` · v${doc.version}` : ''}
                                                    </small>
                                                </button>
                                                {index === 0 ? (
                                                    <span className="fm-dups__tag">{tr('browser.duplicatesOriginal')}</span>
                                                ) : editable ? (
                                                    <button type="button" className="fm-link is-danger" disabled={busy}
                                                        onClick={() => void remove([doc.id])}>
                                                        {tr('browser.duplicatesRemove')}
                                                    </button>
                                                ) : null}
                                            </li>
                                        ))}
                                    </ol>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </StateBlock>
        </Modal>
    );
}
