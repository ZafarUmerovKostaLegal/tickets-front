import { useState, type ReactNode } from 'react';
import type { DocumentRow, FolderRow } from '../api/filesApi';
import { formatBytes, formatDateTime } from '../lib/filesFormat';
import { FileBadge, Icon, useFm } from './fmShared';

export const DOC_DRAG_TYPE = 'application/x-fm-document';

type Props = {
    documents: readonly DocumentRow[];
    folders?: readonly FolderRow[];
    selectedId: string | null;
    viewerId: number;
    showMatter?: boolean;
    draggable?: boolean;
    empty?: ReactNode;
    onSelect: (doc: DocumentRow) => void;
    onOpen?: (doc: DocumentRow) => void;
    onOpenFolder?: (folder: FolderRow) => void;
    onDropOnFolder?: (folder: FolderRow, documentId: string) => void;
    onToggleFavorite?: (doc: DocumentRow) => void;
};

export function DocumentTable({
    documents,
    folders = [],
    selectedId,
    viewerId,
    showMatter,
    draggable,
    empty,
    onSelect,
    onOpen,
    onOpenFolder,
    onDropOnFolder,
    onToggleFavorite,
}: Props) {
    const { tr, locale } = useFm();
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    if (documents.length === 0 && folders.length === 0)
        return <div className="fm-state">{empty ?? tr('table.noResults')}</div>;
    return (
        <div className="fm-table-wrap">
            <table className="fm-table">
                <thead>
                    <tr>
                        <th className="fm-table__star" aria-label={tr('pane.favoriteAdd')} />
                        <th>{tr('table.name')}</th>
                        {showMatter ? <th>{tr('common.clientMatter')}</th> : null}
                        <th className="fm-table__num">{tr('table.version')}</th>
                        <th>{tr('table.modified')}</th>
                        <th>{tr('table.modifiedBy')}</th>
                        <th className="fm-table__num">{tr('table.size')}</th>
                        <th>{tr('table.status')}</th>
                    </tr>
                </thead>
                <tbody>
                    {folders.map((folder) => (
                        <tr key={`f:${folder.id}`} className={dropTarget === folder.id ? 'fm-table__folder is-drop' : 'fm-table__folder'}
                            onClick={() => onOpenFolder?.(folder)}
                            onDragOver={onDropOnFolder ? (event) => {
                                if (event.dataTransfer.types.includes(DOC_DRAG_TYPE)) {
                                    event.preventDefault();
                                    setDropTarget(folder.id);
                                }
                            } : undefined}
                            onDragLeave={() => setDropTarget(null)}
                            onDrop={onDropOnFolder ? (event) => {
                                setDropTarget(null);
                                const id = event.dataTransfer.getData(DOC_DRAG_TYPE);
                                if (id) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onDropOnFolder(folder, id);
                                }
                            } : undefined}>
                            <td />
                            <td colSpan={showMatter ? 2 : 1}>
                                <span className="fm-table__name">
                                    <Icon name="folder" className="fm-ico--folder" />
                                    <strong>{folder.name}</strong>
                                </span>
                            </td>
                            <td />
                            <td>{formatDateTime(folder.createdAt, locale)}</td>
                            <td />
                            <td className="fm-table__num fm-muted">{folder.documents}</td>
                            <td />
                        </tr>
                    ))}
                    {documents.map((doc) => {
                        const lockedByOther = doc.checkedOutById !== null && doc.checkedOutById !== viewerId;
                        return (
                            <tr
                                key={doc.id}
                                className={doc.id === selectedId ? 'is-selected' : undefined}
                                aria-selected={doc.id === selectedId}
                                draggable={draggable}
                                onDragStart={draggable ? (event) => {
                                    event.dataTransfer.setData(DOC_DRAG_TYPE, doc.id);
                                    event.dataTransfer.effectAllowed = 'move';
                                } : undefined}
                                onClick={() => onSelect(doc)}
                                onDoubleClick={() => onOpen?.(doc)}
                            >
                                <td className="fm-table__star">
                                    <button type="button" className={doc.favorite ? 'fm-star is-on' : 'fm-star'}
                                        aria-label={tr(doc.favorite ? 'pane.favoriteRemove' : 'pane.favoriteAdd')}
                                        aria-pressed={doc.favorite}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onToggleFavorite?.(doc);
                                        }}>
                                        <Icon name="star" />
                                    </button>
                                </td>
                                <td>
                                    <span className="fm-table__name">
                                        <FileBadge kind={doc.kind} />
                                        <span>
                                            <strong title={doc.name}>{doc.name}</strong>
                                            <small>{doc.docNumber}{doc.docType ? ` · ${tr(`docTypes.${doc.docType}`)}` : ''}</small>
                                        </span>
                                    </span>
                                </td>
                                {showMatter ? (
                                    <td>
                                        <span className="fm-table__matter">
                                            <small>{doc.clientName}</small>
                                            <span>{doc.matterCode ? `${doc.matterCode} · ` : ''}{doc.matterName}</span>
                                        </span>
                                    </td>
                                ) : null}
                                <td className="fm-table__num">v{doc.version}</td>
                                <td>{formatDateTime(doc.lastActivityAt ?? doc.updatedAt, locale)}</td>
                                <td>{doc.updatedBy || doc.createdBy}</td>
                                <td className="fm-table__num">{formatBytes(doc.sizeBytes, locale)}</td>
                                <td>
                                    {doc.checkedOutById !== null ? (
                                        <span className={lockedByOther ? 'fm-lock is-other' : 'fm-lock'}>
                                            <Icon name="lock" />
                                            {lockedByOther ? tr('table.checkedOutBy', { name: doc.checkedOutBy ?? '' }) : tr('table.checkedOutMe')}
                                        </span>
                                    ) : null}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
