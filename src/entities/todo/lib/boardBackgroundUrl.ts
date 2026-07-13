import { getApiBaseUrl } from '@shared/config';

const MEDIA_API_PREFIX = '/api/v1/media/';

export function toTodoBoardBackgroundMediaApiPath(pathOrUrl: string | null | undefined): string | null {
    const raw = (pathOrUrl ?? '').trim();
    if (!raw)
        return null;

    let path = raw;
    if (/^https?:\/\//i.test(raw)) {
        try {
            path = new URL(raw).pathname;
        }
        catch {
            return null;
        }
    }

    if (!path.startsWith('/'))
        path = `/${path.replace(/^\/+/, '')}`;

    while (path.includes(`${MEDIA_API_PREFIX}api/v1/media/`))
        path = path.replace(`${MEDIA_API_PREFIX}api/v1/media/`, MEDIA_API_PREFIX);

    const mediaIdx = path.indexOf(MEDIA_API_PREFIX);
    if (mediaIdx >= 0)
        return path.slice(mediaIdx);

    const stripped = path.replace(/^\/+/, '');
    if (stripped.startsWith('api/v1/media/'))
        return `/${stripped}`;
    if (stripped.startsWith('todo_board_backgrounds/') || stripped.startsWith('desktop_backgrounds/'))
        return `${MEDIA_API_PREFIX}${stripped}`;
    if (path.startsWith('/todo_board_backgrounds/'))
        return `${MEDIA_API_PREFIX}${stripped}`;
    if (path.startsWith('/desktop_backgrounds/'))
        return `/api/v1/media${path}`;

    return null;
}

export const normalizeBoardBackgroundMediaPath = toTodoBoardBackgroundMediaApiPath;

export function pickBoardBackgroundApiPath(
    board: { id: number; background_url?: string | null },
    summaries: ReadonlyArray<{ id: number; background_url?: string | null }>,
): string | null {
    const fromBoard = toTodoBoardBackgroundMediaApiPath(board.background_url);
    if (fromBoard)
        return fromBoard;
    const summary = summaries.find((s) => s.id === board.id);
    return toTodoBoardBackgroundMediaApiPath(summary?.background_url);
}

export function resolveBoardBackgroundDisplayUrl(pathOrUrl: string | null | undefined): string | null {
    const mediaPath = toTodoBoardBackgroundMediaApiPath(pathOrUrl);
    if (!mediaPath)
        return null;
    if (typeof window !== 'undefined')
        return mediaPath;
    const base = getApiBaseUrl().replace(/\/+$/, '');
    return base ? `${base}${mediaPath}` : mediaPath;
}

export function boardBackgroundStorageKey(mediaApiPath: string): string | null {
    const normalized = toTodoBoardBackgroundMediaApiPath(mediaApiPath);
    if (!normalized?.startsWith(MEDIA_API_PREFIX))
        return null;
    return normalized.slice(MEDIA_API_PREFIX.length);
}
