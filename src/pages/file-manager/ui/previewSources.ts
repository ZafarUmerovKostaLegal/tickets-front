import { diskApi, type DiskFile } from '../api/diskApi';
import { filesApi, type DocumentRow } from '../api/filesApi';
import type { SavedAttachment } from '../lib/previewKinds';
import type { PreviewSource } from './FilePreview';

export type AttachmentActions = {
    canSave: boolean;
    onSaved?: () => void;
    onOpen?: (saved: SavedAttachment) => void;
};

export function documentSource(
    doc: Pick<DocumentRow, 'id' | 'name' | 'sizeBytes' | 'contentType' | 'version'>,
    version?: number,
    attachments?: AttachmentActions,
): PreviewSource {
    const v = version && version !== doc.version ? version : undefined;
    const entry = (index: number, name: string, size: number): PreviewSource => ({
        key: `${doc.id}:${v ?? doc.version}:#${index}`,
        name,
        sizeBytes: size,
        contentType: '',
        link: ({ inline }) => filesApi.link(doc.id, { version: v, inline, entry: index }),
        blob: () => filesApi.archiveEntryBlob(doc.id, index, v),
        head: async (bytes) => (await filesApi.archiveEntryBlob(doc.id, index, v)).slice(0, bytes),
    });
    return {
        key: `${doc.id}:${v ?? doc.version}`,
        name: doc.name,
        sizeBytes: doc.sizeBytes,
        contentType: doc.contentType,
        link: ({ inline }) => filesApi.link(doc.id, { version: v, inline }),
        blob: () => filesApi.contentBlob(doc.id, { version: v, inline: true }),
        head: (bytes) => filesApi.headBlob(doc.id, bytes, v),
        archive: () => filesApi.archive(doc.id, v),
        entry,
        email: () => filesApi.email(doc.id, v),
        emailAttachment: (index) => filesApi.emailAttachmentBlob(doc.id, index, v),
        ...(attachments?.canSave ? {
            saveAttachment: async (index: number) => {
                const result = await filesApi.saveEmailAttachment(doc.id, index);
                attachments.onSaved?.();
                return {
                    documentId: result.document.id,
                    name: result.document.name,
                    folderId: result.folderId,
                    folderPath: result.folderPath ?? '',
                    savedBy: result.savedBy ?? '',
                    savedAt: result.document.createdAt,
                    visible: result.visible ?? true,
                } satisfies SavedAttachment;
            },
        } : {}),
        ...(attachments?.onOpen ? { openSaved: attachments.onOpen } : {}),
    };
}

export function diskSource(file: Pick<DiskFile, 'id' | 'name' | 'sizeBytes' | 'updatedAt'>): PreviewSource {
    const entry = (index: number, name: string, size: number): PreviewSource => ({
        key: `${file.id}:#${index}`,
        name,
        sizeBytes: size,
        contentType: '',
        link: ({ inline }) => diskApi.link(file.id, { inline, entry: index }),
        blob: () => diskApi.archiveEntryBlob(file.id, index),
        head: async (bytes) => (await diskApi.archiveEntryBlob(file.id, index)).slice(0, bytes),
    });
    return {
        key: `${file.id}:${file.updatedAt ?? ''}`,
        name: file.name,
        sizeBytes: file.sizeBytes ?? 0,
        contentType: '',
        link: ({ inline }) => diskApi.link(file.id, { inline }),
        blob: () => diskApi.downloadBlob(file.id),
        head: (bytes) => diskApi.headBlob(file.id, bytes),
        archive: () => diskApi.archive(file.id),
        entry,
        email: () => diskApi.email(file.id),
        emailAttachment: (index) => diskApi.emailAttachmentBlob(file.id, index),
    };
}
