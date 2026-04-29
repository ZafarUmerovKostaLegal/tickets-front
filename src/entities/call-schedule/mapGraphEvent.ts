
export type CallMeetingLinkItem = {
    url: string;
    kind: string;
};

export type CallEvent = {
    id: string;
    title: string;
    date: string;
    time: string;
    
    startMs: number;
    durationMin: number;
    client?: string;
    participants?: string[];
    description?: string;
    
    meetingJoinUrl?: string;
    
    meetingLinks?: CallMeetingLinkItem[];
    
    meetingUrl?: string;
    zoomUrl?: string;
    teamsUrl?: string;
    
    googleMeetUrl?: string;
    
    webexUrl?: string;
    dialIn?: string;
};

function asRecord(x: unknown): Record<string, unknown> | null {
    return x && typeof x === 'object' ? (x as Record<string, unknown>) : null;
}

function pickStr(x: unknown): string | undefined {
    return typeof x === 'string' && x.trim() ? x.trim() : undefined;
}

function parseGraphEventDateTime(dateTime: string): Date | null {
    const t = (dateTime || '').trim();
    if (!t)
        return null;
    const noFrac = t.replace(/(\.\d{3})\d+/, '$1');
    const d = new Date(/[zZ]|[+\-]\d{2}:\d{2}$/.test(noFrac) ? noFrac : noFrac);
    return Number.isNaN(d.getTime()) ? null : d;
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function findMeetingLinks(text: string): { zoom?: string; teams?: string; meet?: string; webex?: string } {
    const zoom = text.match(/https?:\/\/(?:[\w-]+\.)?zoom\.us\/[^\s<"']+/i)?.[0];
    const teams = text.match(/https?:\/\/(?:[\w-]+\.)?(?:teams\.microsoft\.com|teams\.live\.com)(?:\/[^\s<"']*)?/i)?.[0];
    const meet = text.match(/https?:\/\/meet\.google\.com\/[^\s<"']+/i)?.[0];
    const webex = text.match(/https?:\/\/(?:[\w-]+\.)?webex\.com\/[^\s<"']+/i)?.[0];
    return { zoom, teams, meet, webex };
}

function classifyJoinUrl(joinUrl: string): Pick<CallEvent, 'zoomUrl' | 'teamsUrl' | 'googleMeetUrl' | 'webexUrl'> {
    const u = joinUrl.trim();
    if (!u)
        return {};
    if (/zoom\./i.test(u))
        return { zoomUrl: u };
    if (/teams\.microsoft\.com|teams\.live\.com/i.test(u))
        return { teamsUrl: u };
    if (/meet\.google\.com/i.test(u))
        return { googleMeetUrl: u };
    if (/webex\.com/i.test(u))
        return { webexUrl: u };
    return {};
}

function parseMeetingLinkItems(raw: unknown): CallMeetingLinkItem[] | undefined {
    if (!Array.isArray(raw) || raw.length === 0)
        return undefined;
    const out: CallMeetingLinkItem[] = [];
    for (const x of raw) {
        const r = asRecord(x);
        if (!r)
            continue;
        const url = pickStr(r.url);
        if (!url)
            continue;
        const kind = typeof r.kind === 'string' && r.kind.trim() ? r.kind.trim() : 'other';
        out.push({ url, kind });
    }
    return out.length > 0 ? out : undefined;
}

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}
function toLocalYmd(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function formatTimeLocal(d: Date): string {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function mapGraphEventToCallEvent(raw: unknown): CallEvent | null {
    const o = asRecord(raw);
    if (!o)
        return null;
    const id = pickStr(o.id);
    if (!id)
        return null;
    const subject = pickStr(o.subject) ?? 'Без темы';
    const startObj = asRecord(o.start);
    const endObj = asRecord(o.end);
    const startDt = startObj
        ? parseGraphEventDateTime(String(startObj.dateTime || ''))
        : null;
    const endDt = endObj
        ? parseGraphEventDateTime(String(endObj.dateTime || ''))
        : null;
    if (!startDt) {
        return {
            id,
            title: subject,
            date: '1970-01-01',
            time: '—',
            startMs: 0,
            durationMin: 0,
        };
    }
    const durationMin = endDt
        ? Math.max(0, Math.round((endDt.getTime() - startDt.getTime()) / 60000))
        : 0;

    const bodyBlock = asRecord(o.body);
    const bodyText = bodyBlock && typeof bodyBlock.content === 'string' ? stripHtml(bodyBlock.content) : '';
    const webLink = pickStr(o.webLink);
    const enrichedJoin = pickStr(o.meetingJoinUrl);
    const enrichedLinks = parseMeetingLinkItems((o as Record<string, unknown>).meetingLinks);
    const fromBody = findMeetingLinks([bodyText, webLink, subject].filter(Boolean).join(' '));
    const loc = asRecord(o.location);
    const locName = loc ? pickStr(loc.displayName) : undefined;
    const onlineMeeting = asRecord((o as Record<string, unknown>).onlineMeeting);
    const joinUrl =
        onlineMeeting && typeof (onlineMeeting as { joinUrl?: string }).joinUrl === 'string'
            ? (onlineMeeting as { joinUrl: string }).joinUrl.trim()
            : undefined;
    let teamsUrl: string | undefined;
    let zoomUrl: string | undefined;
    let googleMeetUrl: string | undefined;
    let webexUrl: string | undefined;
    if (!enrichedLinks?.length) {
        if (joinUrl) {
            const cls = classifyJoinUrl(joinUrl);
            zoomUrl = cls.zoomUrl;
            teamsUrl = cls.teamsUrl;
            googleMeetUrl = cls.googleMeetUrl;
            webexUrl = cls.webexUrl;
        }
        if (!zoomUrl)
            zoomUrl = fromBody.zoom;
        if (!teamsUrl)
            teamsUrl = fromBody.teams;
        if (!googleMeetUrl)
            googleMeetUrl = fromBody.meet;
        if (!webexUrl)
            webexUrl = fromBody.webex;
    }
    const meetingForModal = webLink;
    const participants: string[] = [];
    if (Array.isArray(o.attendees)) {
        for (const a of o.attendees) {
            const ar = asRecord(a);
            const em = ar ? asRecord(ar.emailAddress) : null;
            const name = em ? pickStr(em.name) : undefined;
            const addr = em ? pickStr(em.address) : undefined;
            if (name && addr)
                participants.push(`${name} (${addr})`);
            else if (addr)
                participants.push(addr);
            else if (name)
                participants.push(name);
        }
    }
    return {
        id,
        title: subject,
        date: toLocalYmd(startDt),
        time: formatTimeLocal(startDt),
        startMs: startDt.getTime(),
        durationMin,
        client: locName,
        participants: participants.length > 0 ? participants : undefined,
        description: bodyText || undefined,
        meetingJoinUrl: enrichedJoin,
        meetingLinks: enrichedLinks,
        meetingUrl: meetingForModal,
        teamsUrl,
        zoomUrl,
        googleMeetUrl,
        webexUrl,
    };
}
