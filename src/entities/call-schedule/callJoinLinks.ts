import type { CallEvent } from './mapGraphEvent';

export type CallJoinRow = {
    key: string;
    label: string;
    className: string;
    url: string;
};


const PRIMARY: {
    field: keyof Pick<CallEvent, 'teamsUrl' | 'zoomUrl' | 'googleMeetUrl' | 'webexUrl'>;
    key: string;
    label: string;
    className: string;
}[] = [
    { field: 'teamsUrl', key: 'teams', label: 'Открыть в Microsoft Teams', className: 'csched-modal__join--teams' },
    { field: 'zoomUrl', key: 'zoom', label: 'Открыть в Zoom', className: 'csched-modal__join--zoom' },
    { field: 'googleMeetUrl', key: 'meet', label: 'Открыть в Google Meet', className: 'csched-modal__join--meet' },
    { field: 'webexUrl', key: 'webex', label: 'Открыть в Webex', className: 'csched-modal__join--webex' },
];

function isOutlookishWebUrl(url: string): boolean {
    return /outlook\.(office|live)\.com|\.office\.com\/|office365\.com|microsoft365\.com\/(outlook|mail|calendar)/i.test(url);
}

function kindToLabel(kind: string, url: string): string {
    const k = (kind || 'other').toLowerCase();
    if (k === 'zoom')
        return 'Открыть в Zoom';
    if (k === 'teams')
        return 'Открыть в Microsoft Teams';
    if (k === 'meet')
        return 'Открыть в Google Meet';
    if (k === 'webex')
        return 'Открыть в Webex';
    if (k === 'goto')
        return 'Открыть в GoTo Meeting';
    if (k === 'webrtc')
        return 'Открыть встречу (браузер)';
    if (k === 'other' && isOutlookishWebUrl(url))
        return 'Открыть в Outlook (веб)';
    if (k === 'other')
        return 'Ссылка на встречу';
    return 'Ссылка на встречу';
}

function kindToClass(kind: string, url: string): string {
    const k = (kind || 'other').toLowerCase();
    if (k === 'zoom')
        return 'csched-modal__join--zoom';
    if (k === 'teams')
        return 'csched-modal__join--teams';
    if (k === 'meet')
        return 'csched-modal__join--meet';
    if (k === 'webex')
        return 'csched-modal__join--webex';
    if (k === 'other' && isOutlookishWebUrl(url))
        return 'csched-modal__join--outlook';
    return 'csched-modal__join--generic';
}


function buildFromEnriched(e: CallEvent): CallJoinRow[] {
    const out: CallJoinRow[] = [];
    const seen = new Set<string>();
    const add = (url: string, kind: string, i: number) => {
        const u = url.trim();
        if (!u || seen.has(u))
            return;
        seen.add(u);
        out.push({
            key: `ml-${i}-${u.slice(0, 32)}`,
            label: kindToLabel(kind, u),
            className: kindToClass(kind, u),
            url: u,
        });
    };
    const primary = e.meetingJoinUrl?.trim();
    const list = e.meetingLinks ?? [];
    if (primary) {
        const match = list.find((x) => x.url === primary);
        add(primary, match?.kind ?? 'other', 0);
    }
    list.forEach((m, i) => add(m.url, m.kind, i + 1));
    return out;
}


function buildFromLegacy(e: CallEvent): CallJoinRow[] {
    const out: CallJoinRow[] = [];
    const seen = new Set<string>();
    const norm = (u: string) => u.trim();
    const add = (row: CallJoinRow) => {
        const u = norm(row.url);
        if (!u || seen.has(u))
            return;
        seen.add(u);
        out.push({ ...row, url: u });
    };
    for (const p of PRIMARY) {
        const raw = e[p.field];
        if (typeof raw === 'string' && raw.trim()) {
            add({
                key: p.key,
                label: p.label,
                className: p.className,
                url: raw,
            });
        }
    }
    const m = e.meetingUrl;
    if (typeof m === 'string' && m.trim()) {
        const u = norm(m);
        if (!seen.has(u)) {
            if (isOutlookishWebUrl(u)) {
                add({
                    key: 'outlook',
                    label: 'Открыть в Outlook (веб)',
                    className: 'csched-modal__join--outlook',
                    url: u,
                });
            }
            else {
                add({
                    key: 'web',
                    label: 'Открыть ссылку встречи в браузере',
                    className: 'csched-modal__join--generic',
                    url: u,
                });
            }
        }
    }
    return out;
}

export function buildCallJoinLinkList(e: CallEvent): CallJoinRow[] {
    if (e.meetingLinks && e.meetingLinks.length > 0)
        return buildFromEnriched(e);
    return buildFromLegacy(e);
}

export function hasAnyJoinLink(e: CallEvent): boolean {
    if (e.meetingJoinUrl || (e.meetingLinks && e.meetingLinks.length > 0))
        return true;
    if (e.teamsUrl || e.zoomUrl || e.googleMeetUrl || e.webexUrl || e.meetingUrl)
        return true;
    return false;
}
