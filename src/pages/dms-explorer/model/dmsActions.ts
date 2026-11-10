import { filesApi, type DocumentRow, type FolderRow } from '@pages/file-manager/api/filesApi';
import { getDmsClipboard, setDmsClipboard, type DmsClipboardItem } from './dmsClipboard';
import { canUseDmsDesktop, openBlobInDesktopApp, sendBlobViaOutlook } from '../api/dmsDesktop';

export function documentDeepLink(matterId: string, folderId: string | null, docId: string): string {
    const url = new URL('/files', window.location.origin);
    url.searchParams.set('view', 'matter');
    url.searchParams.set('matter', matterId);
    if (folderId)
        url.searchParams.set('folder', folderId);
    url.searchParams.set('doc', docId);
    return url.toString();
}

export async function copyText(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
}

export async function downloadDocument(doc: DocumentRow): Promise<void> {
    const blob = await filesApi.contentBlob(doc.id);
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = doc.name;
    anchor.click();
    URL.revokeObjectURL(href);
}

export async function openDocument(doc: DocumentRow): Promise<void> {
    const blob = await filesApi.contentBlob(doc.id);
    if (canUseDmsDesktop()) {
        await openBlobInDesktopApp(doc.name, blob);
        return;
    }
    const href = URL.createObjectURL(blob);
    window.open(href, '_blank', 'noopener,noreferrer');
}

export async function printDocument(doc: DocumentRow): Promise<void> {
    const blob = await filesApi.contentBlob(doc.id, { inline: true });
    const href = URL.createObjectURL(blob);
    const popup = window.open(href, '_blank', 'noopener,noreferrer');
    if (!popup)
        throw new Error('Не удалось открыть окно печати');
    popup.addEventListener('load', () => {
        try {
            popup.focus();
            popup.print();
        } catch {
            /* user prints manually */
        }
    });
}

export async function sendDocumentLink(doc: DocumentRow, matterId: string, folderId: string | null): Promise<void> {
    const link = documentDeepLink(matterId, folderId, doc.id);
    const mailto = `mailto:?subject=${encodeURIComponent(doc.name)}&body=${encodeURIComponent(link)}`;
    window.location.href = mailto;
}

export async function sendDocumentAttachment(doc: DocumentRow): Promise<void> {
    const blob = await filesApi.contentBlob(doc.id);
    if (!canUseDmsDesktop())
        throw new Error('Send Attachment доступен в desktop-приложении');
    await sendBlobViaOutlook(doc.name, blob, doc.name);
}

async function copyDocumentTo(matterId: string, folderId: string | null, documentId: string): Promise<void> {
    const detail = await filesApi.document(documentId);
    const blob = await filesApi.contentBlob(documentId);
    const file = new File([blob], detail.document.name, { type: blob.type || 'application/octet-stream' });
    await filesApi.upload(matterId, folderId, [file], 'DMS copy');
}

async function copyFolderRecursive(
    sourceMatterId: string,
    sourceFolderId: string,
    targetMatterId: string,
    targetParentId: string | null,
    folderName: string,
): Promise<void> {
    const created = await filesApi.createFolder(targetMatterId, folderName, targetParentId);
    const browse = await filesApi.browse(sourceMatterId, sourceFolderId);
    const children = browse.folders.filter((folder) => folder.parentId === sourceFolderId);
    for (const child of children)
        await copyFolderRecursive(sourceMatterId, child.id, targetMatterId, created.id, child.name);
    for (const doc of browse.documents)
        await copyDocumentTo(targetMatterId, created.id, doc.id);
}

export async function pasteClipboard(targetMatterId: string, targetFolderId: string | null): Promise<number> {
    const clip = getDmsClipboard();
    if (!clip?.items.length)
        return 0;
    let count = 0;
    for (const item of clip.items) {
        if (clip.mode === 'cut') {
            if (item.kind === 'document') {
                await filesApi.updateDocument(item.documentId, targetFolderId
                    ? { folderId: targetFolderId }
                    : { moveToRoot: true });
                count += 1;
            } else if (item.matterId === targetMatterId) {
                await filesApi.updateFolder(item.folderId, targetFolderId
                    ? { parentId: targetFolderId }
                    : { moveToRoot: true });
                count += 1;
            }
        } else if (item.kind === 'document') {
            await copyDocumentTo(targetMatterId, targetFolderId, item.documentId);
            count += 1;
        } else {
            await copyFolderRecursive(item.matterId, item.folderId, targetMatterId, targetFolderId, item.name);
            count += 1;
        }
    }
    if (clip.mode === 'cut')
        setDmsClipboard(null);
    return count;
}

export function clipboardFromSelection(args: {
    mode: 'cut' | 'copy';
    matterId: string;
    folderId: string | null;
    documents: DocumentRow[];
    folders: FolderRow[];
}): void {
    const items: DmsClipboardItem[] = [
        ...args.folders.map((folder) => ({
            kind: 'folder' as const,
            folderId: folder.id,
            name: folder.name,
            matterId: args.matterId,
            parentId: folder.parentId,
        })),
        ...args.documents.map((doc) => ({
            kind: 'document' as const,
            documentId: doc.id,
            name: doc.name,
            matterId: args.matterId,
            folderId: args.folderId,
        })),
    ];
    setDmsClipboard(items.length ? { mode: args.mode, items } : null);
}
