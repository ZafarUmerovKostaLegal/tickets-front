export type DroppedFile = { file: File; path: string };

type Entry = {
    isFile: boolean;
    isDirectory: boolean;
    name: string;
    fullPath: string;
    file?: (ok: (file: File) => void, fail: (error: unknown) => void) => void;
    createReader?: () => { readEntries: (ok: (entries: Entry[]) => void, fail: (error: unknown) => void) => void };
};

const MAX_FILES = 2000;

function readAll(entry: Entry): Promise<Entry[]> {
    const reader = entry.createReader?.();
    if (!reader)
        return Promise.resolve([]);
    const out: Entry[] = [];
    return new Promise((resolve, reject) => {
        const next = () => reader.readEntries((batch) => {
            if (!batch.length) {
                resolve(out);
                return;
            }
            out.push(...batch);
            next();
        }, reject);
        next();
    });
}

function fileOf(entry: Entry): Promise<File> {
    return new Promise((resolve, reject) => {
        if (!entry.file) {
            reject(new Error('not a file'));
            return;
        }
        entry.file(resolve, reject);
    });
}

async function walk(entry: Entry, out: DroppedFile[]): Promise<void> {
    if (out.length >= MAX_FILES)
        return;
    if (entry.isFile) {
        out.push({ file: await fileOf(entry), path: entry.fullPath.replace(/^\/+/, '') || entry.name });
        return;
    }
    if (entry.isDirectory) {
        for (const child of await readAll(entry))
            await walk(child, out);
    }
}

export async function readDroppedItems(transfer: DataTransfer): Promise<{ files: DroppedFile[]; hasFolders: boolean }> {
    const items = Array.from(transfer.items ?? []);
    const entries = items
        .filter((item) => item.kind === 'file')
        .map((item) => (item as DataTransferItem & { webkitGetAsEntry?: () => Entry | null }).webkitGetAsEntry?.() ?? null);
    if (!entries.length || entries.some((entry) => entry === null)) {
        return { files: Array.from(transfer.files).map((file) => ({ file, path: file.name })), hasFolders: false };
    }
    const out: DroppedFile[] = [];
    for (const entry of entries as Entry[])
        await walk(entry, out);
    return { files: out, hasFolders: (entries as Entry[]).some((entry) => entry.isDirectory) };
}

export function pickedFolderFiles(list: FileList): DroppedFile[] {
    return Array.from(list).map((file) => ({
        file,
        path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }));
}
