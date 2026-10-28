import { journalDayLabel, journalEventKey, journalMonthKey, journalMonthLabel, } from './journalDemo';
export const JOURNAL_UI_INITIAL = {
    view: 'events',
    sel: '',
    status: 'all',
    channel: 'all',
    q: '',
    uq: '',
    user: 'all',
    open: {},
    daysOpen: {},
    monthsOpen: {},
    remote: [],
    remoteUsers: [],
    extra: [],
};
const KIND_LABEL = {
    send: 'Отправка',
    clip: 'Буфер обмена',
    copy: 'Копирование',
    edit: 'Документ изменён',
    new: 'Создан',
    open: 'Подключение',
    access: 'Доступ',
};
export const JOURNAL_CHANNELS = [
    { id: 'all', label: 'Все каналы' },
    { id: 'telegram', label: 'Telegram' },
    { id: 'browser', label: 'Браузер' },
    { id: 'clip', label: 'Буфер обмена' },
    { id: 'net', label: 'Сеть и RDP' },
    { id: 'fs', label: 'Файловая система' },
];
const STATUS_FILTERS = [
    { id: 'all', label: 'Все' },
    { id: 'blocked', label: 'Заблокировано' },
    { id: 'allowed', label: 'Разрешено' },
    { id: 'logged', label: 'Действия с файлами' },
];
function isBlockedSend(row) {
    return row.kind === 'send' && row.status === 'blocked';
}
function includesQuery(value, query) {
    return value.toLowerCase().includes(query);
}
function rankTop(counts) {
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
function actionTitle(row) {
    if (row.kind === 'access')
        return row.note;
    if (row.kind === 'send')
        return row.status === 'blocked' ? 'Отправка заблокирована' : 'Отправка разрешена';
    if (row.kind === 'clip')
        return 'Буфер обмена заблокирован';
    if (row.kind === 'copy')
        return 'Файл скопирован';
    if (row.kind === 'edit')
        return 'Документ изменён';
    if (row.kind === 'new')
        return 'Создан';
    return 'Подключение';
}
function actionDetail(row) {
    if (row.kind === 'access')
        return 'Правило для этого файла изменено вручную';
    if (row.note)
        return row.note;
    if (row.kind === 'new' || row.kind === 'edit' || row.kind === 'copy' || row.kind === 'open')
        return row.dir || row.proc;
    if (row.res)
        return `→ ${row.res}`;
    return 'Получатель не определён';
}
function todayKey(now = new Date()) {
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${now.getFullYear()}`;
}
function currentMonthKey(now = new Date()) {
    return journalMonthKey(todayKey(now));
}
function monthExpanded(month, monthsOpen) {
    if (monthsOpen && Object.prototype.hasOwnProperty.call(monthsOpen, month))
        return Boolean(monthsOpen[month]);
    return month === currentMonthKey();
}
function dayExpanded(day, daysOpen) {
    if (daysOpen && Object.prototype.hasOwnProperty.call(daysOpen, day))
        return Boolean(daysOpen[day]);
    return day === todayKey();
}
function barHeight(value, max, peak, empty) {
    if (!value)
        return empty;
    return empty + Math.round((value / max) * peak);
}
export function buildJournalView(state) {
    const users = state.remoteUsers;
    const byId = new Map(users.map((user) => [user.id, user]));
    const fullName = (id) => {
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
    const matchesStatus = (row) => state.status === 'all' || row.status === state.status;
    const matchesChannel = (row) => state.channel === 'all' || row.ch === state.channel;
    const matchesUser = (row) => state.user === 'all' || row.u === state.user;
    const matchesQuery = (row) => {
        if (!query)
            return true;
        const haystack = `${row.name} ${row.dir} ${row.res} ${row.proc} ${fullName(row.u)}`;
        return includesQuery(haystack, query);
    };
    const userBase = events.filter((row) => matchesStatus(row) && matchesChannel(row));
    const list = userBase.filter((row) => matchesUser(row) && matchesQuery(row));
    const selected = events.find((row) => row.id === state.sel) ?? list[0] ?? events[0];
    const showUserColumn = state.user === 'all';
    const sideUsers = [
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
    const channels = JOURNAL_CHANNELS.map((channel) => ({
        id: channel.id,
        label: channel.label,
        count: channel.id === 'all'
            ? channelBase.length
            : channelBase.filter((row) => row.ch === channel.id).length,
        active: state.channel === channel.id,
    }));
    const statusBase = events.filter((row) => matchesChannel(row) && matchesUser(row) && matchesQuery(row));
    const statuses = STATUS_FILTERS.map((status) => ({
        id: status.id,
        label: status.label,
        count: status.id === 'all'
            ? statusBase.length
            : statusBase.filter((row) => row.status === status.id).length,
        active: state.status === status.id,
    }));
    const scope = state.view === 'users' ? userBase : list;
    const fileKeys = new Set(scope.filter((row) => row.kind !== 'clip').map((row) => `${row.u}|${row.name}`));
    const tiles = [
        { label: 'Событий', value: scope.length, tone: 'default' },
        { label: 'Заблокировано', value: scope.filter((row) => row.status === 'blocked').length, tone: 'danger' },
        { label: 'Действий с файлами', value: scope.filter((row) => row.status === 'logged').length, tone: 'info' },
        { label: 'Затронуто файлов', value: fileKeys.size, tone: 'default' },
    ];
    const rows = [];
    let lastMonth = '';
    let lastDay = '';
    list.forEach((row) => {
        const month = journalMonthKey(row.d);
        const monthIsOpen = monthExpanded(month, state.monthsOpen);
        if (month !== lastMonth) {
            lastMonth = month;
            lastDay = '';
            const group = list.filter((item) => journalMonthKey(item.d) === month);
            rows.push({
                kind: 'month',
                id: `month-${month}`,
                month,
                label: journalMonthLabel(row.d),
                summary: `Событий: ${group.length} · Заблокировано: ${group.filter((item) => item.status === 'blocked').length}`,
                open: monthIsOpen,
            });
        }
        if (!monthIsOpen)
            return;
        const expanded = dayExpanded(row.d, state.daysOpen);
        if (row.d !== lastDay) {
            lastDay = row.d;
            const group = list.filter((item) => item.d === row.d);
            rows.push({
                kind: 'head',
                id: `day-${row.d}`,
                day: row.d,
                label: journalDayLabel(row.d),
                summary: `Событий: ${group.length} · Заблокировано: ${group.filter((item) => item.status === 'blocked').length}`,
                open: expanded,
            });
        }
        if (!expanded)
            return;
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
    const files = new Map();
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
    const fileRows = [...files.values()].map((file) => {
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
    const userMatches = (user) => {
        const haystack = `${user.login} ${user.host} ${user.dept}`;
        if (userQuery && !includesQuery(haystack, userQuery))
            return false;
        if (query && !includesQuery(haystack, query))
            return false;
        return true;
    };
    const userRows = users
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
    let report = null;
    if (state.user !== 'all') {
        const own = userBase.filter(matchesUser);
        const perDay = days.map((day) => own.filter((row) => row.d === day && isBlockedSend(row)).length);
        const maxDay = Math.max(...perDay, 1);
        const destCounts = new Map();
        const fileCounts = new Map();
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
                height: barHeight(perDay[index] ?? 0, maxDay, 68, 4),
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
    const destCounts = new Map();
    history.filter(isBlockedSend).forEach((row) => {
        const key = row.res || 'получатель не определён';
        destCounts.set(key, (destCounts.get(key) ?? 0) + 1);
    });
    const accessKey = selected ? `${selected.u}|${selected.name}` : '';
    const detail = {
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
    const isEmpty = view !== 'storage' && ((view === 'events' && list.length === 0)
        || (view === 'files' && fileRows.length === 0)
        || (view === 'users' && userRows.length === 0));
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
        showReport: state.user !== 'all' && view !== 'users' && view !== 'storage',
        showDetail: view !== 'users' && view !== 'storage' && selected != null,
        isEmpty,
        shownText: view === 'users'
            ? `Пользователей: ${userRows.length} из ${users.length}`
            : `Показано ${list.length} из ${events.length}`,
        searchHint: view === 'storage'
            ? 'Имя файла, сотрудник или компьютер'
            : view === 'users' ? 'Логин, компьютер или отдел' : 'Файл, процесс, сайт или папка',
        exportLabel: state.user === 'all' ? 'Экспорт' : 'Экспорт отчёта',
        periodLabel: days.length === 0 ? '' : days.length === 1 ? days[0] : `${days[0]} – ${days[days.length - 1]}`,
        totalEvents: events.length,
    };
}
export function toggleFileAccess(state, selected) {
    const key = `${selected.u}|${selected.name}`;
    const nextOpen = !state.open[key];
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    const accessEvent = {
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
export function selectedJournalEvent(state) {
    const events = state.extra.concat(state.remote);
    return events.find((row) => row.id === state.sel) ?? events[0] ?? null;
}
function eventDays(events) {
    const unique = [...new Set(events.map((row) => row.d).filter(Boolean))];
    unique.sort((a, b) => (dayKey(a) < dayKey(b) ? -1 : dayKey(a) > dayKey(b) ? 1 : 0));
    return unique;
}
function dayKey(day) {
    return day.slice(6, 10) + day.slice(3, 5) + day.slice(0, 2);
}
