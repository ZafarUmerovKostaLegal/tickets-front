export type DmsClipboardItem =
    | { kind: 'document'; documentId: string; name: string; matterId: string; folderId: string | null }
    | { kind: 'folder'; folderId: string; name: string; matterId: string; parentId: string | null };

export type DmsClipboard = {
    mode: 'cut' | 'copy';
    items: DmsClipboardItem[];
};

let clipboard: DmsClipboard | null = null;
const listeners = new Set<() => void>();

export function getDmsClipboard(): DmsClipboard | null {
    return clipboard;
}

export function setDmsClipboard(next: DmsClipboard | null): void {
    clipboard = next;
    listeners.forEach((listener) => listener());
}

export function subscribeDmsClipboard(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
