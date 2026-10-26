import {
    journalDayLabel,
    journalEventKey,
    type JournalChannel,
    type JournalEvent,
    type JournalKind,
    type JournalStatus,
    type JournalUser,
} from './journalDemo';

export type JournalTab = 'events' | 'files' | 'users';
export type JournalStatusFilter = 'all' | JournalStatus;
export type JournalChannelFilter = 'all' | JournalChannel;

export type JournalUiState = {
    view: JournalTab;
    sel: string;
    status: JournalStatusFilter;
    channel: JournalChannelFilter;
    q: string;
    uq: string;
    user: string;
    open: Record<string, boolean>;
    remote: JournalEvent[];
    remoteUsers: JournalUser[];
    extra: JournalEvent[];
};

export const JOURNAL_UI_INITIAL: JournalUiState = {
    view: 'events',
    sel: '',
    status: 'all',
    channel: 'all',
    q: '',
    uq: '',
    user: 'all',
    open: {},
    remote: [],
    remoteUsers: [],
    extra: [],
};

const KIND_LABEL: Record<JournalKind, string> = {
    send: 'Отправка',
    clip: 'Буфер обмена',
    copy: 'Копирование',
    edit: 'Изменение',
    new: 'Создание',
    open: 'Подключение',
    access: 'Доступ',
};

export const JOURNAL_CHANNELS: Array<{ id: JournalChannelFilter; label: string }> = [
    { id: 'all', label: 'Все каналы' },
    { id: 'telegram', label: 'Telegram' },
    { id: 'browser', label: 'Браузер' },
    { id: 'clip', label: 'Буфер обмена' },
    { id: 'net', label: 'Сеть и RDP' },
    { id: 'fs', label: 'Файловая система' },
];

const STATUS_FILTERS: Array<{ id: JournalStatusFilter; label: string }> = [
    { id: 'all', label: 'Все' },
    { id: 'blocked', label: 'Заблокировано' },
    { id: 'allowed', label: 'Разрешено' },
    { id: 'logged', label: 'Действия с файлами' },
];

export type JournalSideUser = {
    id: string;
    label: string;
    sub: string;
    initial: string;
    count: number;
    active: boolean;
    selectId: string;
};

export type JournalChannelRow = {
    id: JournalChannelFilter;
    label: string;
    count: number;
    active: boolean;
};

export type JournalStatusRow = {
    id: JournalStatusFilter;
    label: string;
    count: number;
    active: boolean;
};

export type JournalTile = {
    label: string;
    value: number;
    tone: 'default' | 'danger' | 'info';
};

export type JournalEventRow =
    | { kind: 'head'; id: string; label: string; summary: string }
    | {
        kind: 'event';
        id: string;
        time: string;
        userLogin: string;
        userHost: string;
        status: JournalStatus;
        statusLabel: string;
        name: string;
        dir: string;
        action: JournalKind;
        actionLabel: string;
        res: string;
        proc: string;
        selected: boolean;
    };

export type JournalFileRow = {
    key: string;
    name: string;
    dir: string;
    userLogin: string;
    userHost: string;
    lastAction: string;
    lastWhen: string;
    open: boolean;
    blocked: number;
    copies: number;
    edits: number;
    total: number;
    selected: boolean;
    selectId: string;
};

export type JournalUserRow = {
    id: string;
    login: string;
    host: string;
    dept: string;
    initial: string;
    events: number;
    blocked: number;
    files: number;
    last: string;
    spark: number[];
    selectId: string;
};

export type JournalBar = {
    label: string;
    value: number;
    height: number;
};

export type JournalRank = {
    label: string;
    count: number;
    width: number;
};

export type JournalReport = {
    login: string;
    sub: string;
    initial: string;
    days: JournalBar[];
    dests: JournalRank[];
    files: JournalRank[];
};

export type JournalHistoryItem = {
    id: string;
    status: JournalStatus;
    action: JournalKind;
    title: string;
    when: string;
    detail: string;
    proc: string;
    selected: boolean;
};

export type JournalDetail = {
    canToggle: boolean;
    open: boolean;
    name: string;
    dir: string;
    userLine: string;
    status: JournalStatus;
    bannerTitle: string;
    bannerSub: string;
    blocked: number;
    copies: number;
    edits: number;
    dests: Array<{ label: string; count: number }>;
    history: JournalHistoryItem[];
    eventId: string;
    hasFile: boolean;
};

export type JournalViewModel = {
    users: JournalUser[];
    sideUsers: JournalSideUser[];
    channels: JournalChannelRow[];
    statuses: JournalStatusRow[];
    tiles: JournalTile[];
    rows: JournalEventRow[];
    fileRows: JournalFileRow[];
    userRows: JournalUserRow[];
    report: JournalReport | null;
    detail: JournalDetail;
    showUserColumn: boolean;
    showReport: boolean;
    showDetail: boolean;
    isEmpty: boolean;
    shownText: string;
    searchHint: string;
    exportLabel: string;
    periodLabel: string;
    totalEvents: number;
};

function isBlockedSend(row: JournalEvent): boolean {
    return row.kind === 'send' && row.status === 'blocked';
}

function includesQuery(value: string, query: string): boolean {
    return value.toLowerCase().includes(query);
}

function rankTop(counts: Map<string, number>): JournalRank[] {
    const arr = [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);
    const top = arr[0]?.count ?? 1;
    return arr.map((item) => ({
        label: item.label,
        count: item.count,
        width: Math.round((item.count / top) * 100),
    }));
}

function actionTitle(row: JournalEvent): string {
    if (row.kind === 'access')
        return row.note;
    if (row.kind === 'send')
        return row.status === 'blocked' ? 'Отправка заблокирована' : 'Отправка разрешена';
    if (row.kind === 'clip')
        return 'Буфер обмена заблокирован';
    if (row.kind === 'copy')
        return 'Файл скопирован';
    if (row.kind === 'edit')
        return 'Файл изменён';
    if (row.kind === 'new')
        return 'Файл появился на диске';
    return 'Подключение';
}

function actionDetail(row: JournalEvent): string {
    if (row.kind === 'access')
        return 'Правило для этого файла изменено вручную';
    if (row.note)
        return row.note;
    if (row.res)
        return `→ ${row.res}`;
    return 'Получатель не определён';
}

function barHeight(value: number, max: number, peak: number, empty: number): number {
    if (!value)
        return empty;
    return empty + Math.round((value / max) * peak);
}

export function buildJournalView(state: JournalUiState): JournalViewModel {
    const users = state.remoteUsers;
    const byId = new Map(users.map((user) => [user.id, user]));
    const fullName = (id: string) => {
        const user = byId.get(id);
        return user ? `${user.host}\\${user.login}` : id;
    };
    const events = state.extra.concat(state.remote).sort((a, b) => {
        const ak = journalEventKey(a);
        const bk = journalEventKey(b);
        return ak < bk ? 1 : ak > bk ? -1 : 0;
    });
    const days = eventDays(events);
    const query = state.q.trim().toLowerCase();
    const userQuery = state.uq.trim().toLowerCase();
    const matchesStatus = (row: JournalEvent) => state.status === 'all' || row.status === state.status;
    const matchesChannel = (row: JournalEvent) => state.channel === 'all' || row.ch === state.channel;
    const matchesUser = (row: JournalEvent) => state.user === 'all' || row.u === state.user;
    const matchesQuery = (row: JournalEvent) => {
        if (!query)
            return true;
        const haystack = `${row.name} ${row.dir} ${row.res} ${row.proc} ${fullName(row.u)}`;
        return includesQuery(haystack, query);
    };
    const userBase = events.filter((row) => matchesStatus(row) && matchesChannel(row));
    const list = userBase.filter((row) => matchesUser(row) && matchesQuery(row));
    const selected = events.find((row) => row.id === state.sel) ?? list[0] ?? events[0];
    const showUserColumn = state.user === 'all';

    const sideUsers: JournalSideUser[] = [
        {
            id: 'all',
            label: 'Все пользователи',
            sub: `${users.length} на контроле`,
            initial: String(users.length),
            count: userBase.length,
            active: state.user === 'all',
            selectId: '',
        },
        ...users
            .filter((user) => !userQuery || includesQuery(`${user.login} ${user.host} ${user.dept}`, userQuery))
            .map((user) => ({
                id: user.id,
                label: user.login,
                sub: user.host,
                initial: user.login.charAt(0).toUpperCase(),
                count: userBase.filter((row) => row.u === user.id).length,
                active: state.user === user.id,
                selectId: events.find((row) => row.u === user.id)?.id ?? selected?.id ?? '',
            })),
    ];

    const channelBase = events.filter((row) => matchesStatus(row) && matchesUser(row) && matchesQuery(row));
    const channels: JournalChannelRow[] = JOURNAL_CHANNELS.map((channel) => ({
        id: channel.id,
        label: channel.label,
        count: channel.id === 'all'
            ? channelBase.length
            : channelBase.filter((row) => row.ch === channel.id).length,
        active: state.channel === channel.id,
    }));

    const statusBase = events.filter((row) => matchesChannel(row) && matchesUser(row) && matchesQuery(row));
    const statuses: JournalStatusRow[] = STATUS_FILTERS.map((status) => ({
        id: status.id,
        label: status.label,
        count: status.id === 'all'
            ? statusBase.length
            : statusBase.filter((row) => row.status === status.id).length,
        active: state.status === status.id,
    }));

    const scope = state.view === 'users' ? userBase : list;
    const fileKeys = new Set(scope.filter((row) => row.kind !== 'clip').map((row) => `${row.u}|${row.name}`));
    const tiles: JournalTile[] = [
        { label: 'Событий', value: scope.length, tone: 'default' },
        { label: 'Заблокировано', value: scope.filter((row) => row.status === 'blocked').length, tone: 'danger' },
        { label: 'Действий с файлами', value: scope.filter((row) => row.status === 'logged').length, tone: 'info' },
        { label: 'Затронуто файлов', value: fileKeys.size, tone: 'default' },
    ];

    const rows: JournalEventRow[] = [];
    let lastDay = '';
    list.forEach((row) => {
        if (row.d !== lastDay) {
            lastDay = row.d;
            const group = list.filter((item) => item.d === row.d);
            rows.push({
                kind: 'head',
                id: `day-${row.d}`,
                label: journalDayLabel(row.d),
                summary: `Событий: ${group.length} · Заблокировано: ${group.filter((item) => item.status === 'blocked').length}`,
            });
        }
        const user = byId.get(row.u);
        rows.push({
            kind: 'event',
            id: row.id,
            time: row.t,
            userLogin: user?.login ?? row.u,
            userHost: user?.host ?? '',
            status: row.status,
            statusLabel: row.status === 'blocked' ? 'Заблокировано' : row.status === 'allowed' ? 'Разрешено' : 'Записано',
            name: row.name,
            dir: row.dir || 'Не сохранялся на диск',
            action: row.kind,
            actionLabel: KIND_LABEL[row.kind],
            res: row.res || '—',
            proc: row.proc,
            selected: row.id === selected?.id,
        });
    });

    const files = new Map<string, {
        key: string;
        u: string;
        name: string;
        dir: string;
        last: JournalEvent;
        blocked: number;
        copies: number;
        edits: number;
        total: number;
    }>();
    list.filter((row) => row.kind !== 'clip').forEach((row) => {
        const key = `${row.u}|${row.name}`;
        const current = files.get(key) ?? {
            key,
            u: row.u,
            name: row.name,
            dir: row.dir,
            last: row,
            blocked: 0,
            copies: 0,
            edits: 0,
            total: 0,
        };
        current.total += 1;
        if (isBlockedSend(row))
            current.blocked += 1;
        if (row.kind === 'copy')
            current.copies += 1;
        if (row.kind === 'edit')
            current.edits += 1;
        files.set(key, current);
    });
    const fileRows: JournalFileRow[] = [...files.values()].map((file) => {
        const user = byId.get(file.u);
        return {
            key: file.key,
            name: file.name,
            dir: file.dir,
            userLogin: user?.login ?? file.u,
            userHost: user?.host ?? '',
            lastAction: `${KIND_LABEL[file.last.kind]}${file.last.status === 'blocked' ? ' · блок' : ''}`,
            lastWhen: `${file.last.d.slice(0, 5)} ${file.last.t}`,
            open: Boolean(state.open[file.key]),
            blocked: file.blocked,
            copies: file.copies,
            edits: file.edits,
            total: file.total,
            selected: selected != null && selected.name === file.name && selected.u === file.u,
            selectId: file.last.id,
        };
    });

    const userMatches = (user: JournalUser) => {
        const haystack = `${user.login} ${user.host} ${user.dept}`;
        if (userQuery && !includesQuery(haystack, userQuery))
            return false;
        if (query && !includesQuery(haystack, query))
            return false;
        return true;
    };
    const userRows: JournalUserRow[] = users
        .filter(userMatches)
        .map((user) => {
            const own = userBase.filter((row) => row.u === user.id);
            const blocked = own.filter((row) => row.status === 'blocked').length;
            const spark = days.map((day) => own.filter((row) => row.d === day && row.status === 'blocked').length);
            return {
                id: user.id,
                login: user.login,
                host: user.host,
                dept: user.dept,
                initial: user.login.charAt(0).toUpperCase(),
                events: own.length,
                blocked,
                files: new Set(own.filter((row) => row.kind !== 'clip').map((row) => row.name)).size,
                last: own[0] ? `${own[0].d.slice(0, 5)} ${own[0].t}` : '—',
                spark,
                selectId: own[0]?.id ?? selected?.id ?? '',
            };
        })
        .sort((a, b) => b.blocked - a.blocked || b.events - a.events);

    let report: JournalReport | null = null;
    if (state.user !== 'all') {
        const own = userBase.filter(matchesUser);
        const perDay = days.map((day) => own.filter((row) => row.d === day && isBlockedSend(row)).length);
        const maxDay = Math.max(...perDay, 1);
        const destCounts = new Map<string, number>();
        const fileCounts = new Map<string, number>();
        own.filter(isBlockedSend).forEach((row) => {
            if (row.res)
                destCounts.set(row.res, (destCounts.get(row.res) ?? 0) + 1);
            if (row.name)
                fileCounts.set(row.name, (fileCounts.get(row.name) ?? 0) + 1);
        });
        const user = byId.get(state.user);
        report = {
            login: fullName(state.user),
            initial: user?.login.charAt(0).toUpperCase() ?? '?',
            sub: [user?.dept, user?.host].filter(Boolean).join(' · '),
            days: days.map((day, index) => ({
                label: day.slice(0, 2),
                value: perDay[index] ?? 0,
                height: barHeight(perDay[index] ?? 0, maxDay, 52, 3),
            })),
            dests: rankTop(destCounts),
            files: rankTop(fileCounts),
        };
    }

    const isClip = selected?.kind === 'clip';
    const history = !selected
        ? []
        : isClip
            ? [selected]
            : events.filter((row) => row.name === selected.name && row.u === selected.u);
    const destCounts = new Map<string, number>();
    history.filter(isBlockedSend).forEach((row) => {
        const key = row.res || 'получатель не определён';
        destCounts.set(key, (destCounts.get(key) ?? 0) + 1);
    });
    const accessKey = selected ? `${selected.u}|${selected.name}` : '';
    const detail: JournalDetail = {
        canToggle: Boolean(selected) && !isClip,
        open: Boolean(accessKey && state.open[accessKey]),
        name: selected?.name ?? '',
        dir: selected?.dir || 'Содержимое буфера обмена',
        userLine: selected ? [fullName(selected.u), byId.get(selected.u)?.dept].filter(Boolean).join(' · ') : '',
        status: selected?.status ?? 'logged',
        bannerTitle: selected ? actionTitle(selected) : '',
        bannerSub: selected
            ? `${selected.d} ${selected.t} · ${selected.proc}${selected.res ? ` → ${selected.res}` : ''}`
            : '',
        blocked: history.filter(isBlockedSend).length,
        copies: history.filter((row) => row.kind === 'copy').length,
        edits: history.filter((row) => row.kind === 'edit').length,
        dests: [...destCounts.entries()].map(([label, count]) => ({ label, count })),
        history: history.map((row) => ({
            id: row.id,
            status: row.status,
            action: row.kind,
            title: actionTitle(row),
            when: `${row.d.slice(0, 5)} ${row.t}`,
            detail: actionDetail(row),
            proc: row.proc,
            selected: row.id === selected?.id,
        })),
        eventId: selected?.id ?? '',
        hasFile: Boolean(selected?.hasFile),
    };

    const view = state.view;
    const isEmpty = (view === 'events' && list.length === 0)
        || (view === 'files' && fileRows.length === 0)
        || (view === 'users' && userRows.length === 0);

    return {
        users,
        sideUsers,
        channels,
        statuses,
        tiles,
        rows,
        fileRows,
        userRows,
        report,
        detail,
        showUserColumn,
        showReport: state.user !== 'all' && view !== 'users',
        showDetail: view !== 'users' && selected != null,
        isEmpty,
        shownText: view === 'users'
            ? `Пользователей: ${userRows.length} из ${users.length}`
            : `Показано ${list.length} из ${events.length}`,
        searchHint: view === 'users' ? 'Логин, компьютер или отдел' : 'Файл, процесс, сайт или папка',
        exportLabel: state.user === 'all' ? 'Экспорт' : 'Экспорт отчёта',
        periodLabel: days.length === 0 ? '' : days.length === 1 ? days[0] : `${days[0]} – ${days[days.length - 1]}`,
        totalEvents: events.length,
    };
}

export function toggleFileAccess(state: JournalUiState, selected: JournalEvent): JournalUiState {
    const key = `${selected.u}|${selected.name}`;
    const nextOpen = !state.open[key];
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const accessEvent: JournalEvent = {
        id: `a${state.extra.length + 1}`,
        d: `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`,
        t: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
        kind: 'access',
        status: 'logged',
        ch: 'fs',
        u: selected.u,
        name: selected.name,
        dir: selected.dir,
        proc: 'Администратор',
        res: '',
        note: nextOpen ? 'Отправка файла открыта' : 'Отправка файла закрыта',
    };
    return {
        ...state,
        open: { ...state.open, [key]: nextOpen },
        extra: [accessEvent, ...state.extra],
        sel: accessEvent.id,
    };
}

export function selectedJournalEvent(state: JournalUiState): JournalEvent | null {
    const events = state.extra.concat(state.remote);
    return events.find((row) => row.id === state.sel) ?? events[0] ?? null;
}

function eventDays(events: JournalEvent[]): string[] {
    const unique = [...new Set(events.map((row) => row.d).filter(Boolean))];
    unique.sort((a, b) => (dayKey(a) < dayKey(b) ? -1 : dayKey(a) > dayKey(b) ? 1 : 0));
    return unique;
}

function dayKey(day: string): string {
    return day.slice(6, 10) + day.slice(3, 5) + day.slice(0, 2);
}
