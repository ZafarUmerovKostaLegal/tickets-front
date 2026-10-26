export type JournalKind = 'send' | 'clip' | 'copy' | 'edit' | 'new' | 'open' | 'access';
export type JournalStatus = 'blocked' | 'allowed' | 'logged';
export type JournalChannel = 'telegram' | 'browser' | 'clip' | 'net' | 'fs';

export type JournalUser = {
    id: string;
    login: string;
    host: string;
    dept: string;
};

export type JournalEvent = {
    id: string;
    d: string;
    t: string;
    kind: JournalKind;
    status: JournalStatus;
    ch: JournalChannel;
    name: string;
    dir: string;
    proc: string;
    res: string;
    note: string;
    u: string;
};

export const JOURNAL_DAYS = [
    '20.10.2026',
    '21.10.2026',
    '22.10.2026',
    '23.10.2026',
    '24.10.2026',
    '25.10.2026',
    '26.10.2026',
] as const;

export const JOURNAL_PERIOD_LABEL = '20–26 октября';

const DEPT_CODE: Record<string, string> = {
    IT: 'IT',
    'Бухгалтерия': 'BUH',
    'Юристы': 'LEG',
    'Продажи': 'SAL',
    'Склад': 'LOG',
    HR: 'HR',
};

export function journalUsers(): JournalUser[] {
    const rows: Array<[string, string]> = [
        ['a.saidov', 'IT'], ['b.komilov', 'IT'], ['v.kuznetsov', 'IT'], ['r.ismailov', 'IT'],
        ['m.ivanova', 'Бухгалтерия'], ['s.rakhimov', 'Бухгалтерия'], ['n.sidorova', 'Бухгалтерия'], ['o.kim', 'Бухгалтерия'], ['b.tursunov', 'Бухгалтерия'], ['z.abdullaeva', 'Бухгалтерия'],
        ['a.yusupov', 'Юристы'], ['d.petrov', 'Юристы'], ['l.mirzaeva', 'Юристы'], ['r.nazarov', 'Юристы'], ['e.volkova', 'Юристы'], ['t.karimov', 'Юристы'],
        ['i.karimova', 'Продажи'], ['v.smirnov', 'Продажи'], ['g.aliyev', 'Продажи'], ['k.sultanova', 'Продажи'], ['o.morozov', 'Продажи'], ['f.khasanov', 'Продажи'], ['y.lee', 'Продажи'],
        ['a.orlov', 'Склад'], ['s.ergashev', 'Склад'], ['m.pak', 'Склад'], ['d.zakirov', 'Склад'], ['n.popova', 'Склад'],
        ['s.yakubova', 'HR'],
    ];
    const counts: Record<string, number> = {};
    const out: JournalUser[] = [{ id: 'u01', login: 'User', host: 'DESKTOP-BJNOVOA', dept: 'IT' }];
    rows.forEach((row, index) => {
        const dept = row[1];
        counts[dept] = (counts[dept] ?? 0) + 1;
        out.push({
            id: `u${String(index + 2).padStart(2, '0')}`,
            login: row[0],
            host: `PC-${DEPT_CODE[dept]}-${String(counts[dept]).padStart(2, '0')}`,
            dept,
        });
    });
    return out;
}

function event(
    id: string,
    d: string,
    t: string,
    kind: JournalKind,
    status: JournalStatus,
    ch: JournalChannel,
    name: string,
    dir: string,
    proc: string,
    res: string,
    note: string,
): JournalEvent {
    return { id, d, t, kind, status, ch, name, dir, proc, res, note, u: 'u01' };
}

let seedCache: JournalEvent[] | null = null;

export function journalSeedEvents(): JournalEvent[] {
    if (seedCache)
        return seedCache;
    seedCache = buildJournalSeedEvents();
    return seedCache;
}

function buildJournalSeedEvents(): JournalEvent[] {
    const users = journalUsers();
    const DL = 'C:\\Users\\User\\Downloads';
    const DT = 'C:\\Users\\User\\OneDrive\\Рабочий стол';
    const DOC = 'C:\\Users\\User\\Documents';
    const TG = `${DL}\\Telegram Desktop`;
    const TGD = `${DOC}\\TelegramGuardDemo`;
    const today = '26.10.2026';
    const yesterday = '25.10.2026';
    const older = '23.10.2026';
    const cv = 'CV (1).pdf';
    const acrylic = 'acrylic-painting-background-black-wallpaper-image';
    const main: JournalEvent[] = [
        event('e1', today, '11:24:51', 'clip', 'blocked', 'clip', 'Буфер обмена (изображение)', '', 'Telegram.exe', 'Telegram Desktop', 'Вставка изображения в чат'),
        event('e2', today, '11:16:49', 'send', 'blocked', 'telegram', 'Price of Age Computers (7).xlsx', TG, 'Telegram.exe', 'Telegram Desktop', ''),
        event('e2a', today, '11:14:02', 'new', 'logged', 'fs', 'Price of Age Computers (7).xlsx', TG, 'Telegram.exe', '', 'Скачан из чата Telegram'),
        event('e3', today, '11:02:25', 'send', 'blocked', 'browser', cv, DT, 'chrome.exe', 'ilovepdf.com/ru/compress_pdf', ''),
        event('e4', today, '11:01:14', 'send', 'blocked', 'browser', 'pc_health.py', DL, 'chrome.exe', 'drive.google.com/drive/my-drive', ''),
        event('e5', today, '11:00:30', 'send', 'blocked', 'browser', `${acrylic} (1).jpg`, DL, 'chrome.exe', 'tickets.kostalegal.com/accounting', ''),
        event('e6', today, '10:49:27', 'send', 'blocked', 'telegram', cv, DT, 'Telegram.exe', 'Telegram Desktop', ''),
        event('e7', today, '10:48:43', 'send', 'blocked', 'browser', cv, DT, 'chrome.exe', 'https://192.168.230.81:9443/#/', ''),
        event('e8', today, '10:10:32', 'open', 'allowed', 'net', 'Default.rdp', DOC, 'mstsc.exe', '192.168.230.1', 'Подключение к удалённому рабочему столу'),
        event('e9', today, '10:09:20', 'send', 'blocked', 'telegram', 'postgresql_examples.sql', DT, 'Telegram.exe', 'Telegram Desktop', ''),
        event('e10', today, '10:08:37', 'send', 'blocked', 'browser', cv, DT, 'chrome.exe', 'kostalegal20.sharepoint.com/si…', ''),
        event('e10a', today, '10:06:40', 'edit', 'logged', 'fs', cv, DT, 'AcroRd32.exe', '', 'Содержимое изменено · 214 → 198 КБ'),
        event('e10b', today, '10:03:05', 'copy', 'logged', 'fs', cv, DT, 'explorer.exe', '', 'Копия из Downloads\\CV (1).pdf'),
        event('e11', today, '09:25:35', 'send', 'blocked', 'browser', `${acrylic}.jpg`, DL, 'chrome.exe', 'tickets.kostalegal.com/accounting', ''),
        event('e12', today, '09:24:28', 'send', 'blocked', 'browser', cv, DL, 'chrome.exe', 'ilovepdf.com/ru/compress_pdf', ''),
        event('e12a', today, '09:21:12', 'new', 'logged', 'fs', cv, DL, 'chrome.exe', '', 'Скачан в браузере'),
        event('e13', yesterday, '15:58:29', 'send', 'blocked', 'browser', 'photo_2026-10-22_12-36-56.jpg', DT, 'msedgewebview2.exe', 'msedgewebview2', ''),
        event('e14', yesterday, '15:31:54', 'send', 'blocked', 'telegram', 'secret-any.txt', TGD, 'FakeTelegram.exe', 'Telegram Desktop', ''),
        event('e15', yesterday, '15:23:36', 'send', 'blocked', 'browser', '73c784e3-3b79-48db-805c-128010d0cfff', DL, 'chrome.exe', 'drive.google.com/drive/my-drive', ''),
        event('e16', yesterday, '15:08:43', 'send', 'blocked', 'browser', 'web-secret.txt', TGD, 'FakeBrowser.exe', '', ''),
        event('e17', older, '18:33:10', 'send', 'blocked', 'browser', 'CV.docx', DT, 'chrome.exe', '', ''),
        event('e18', older, '18:32:02', 'clip', 'blocked', 'clip', 'Буфер обмена (изображение)', '', 'FakeBrowser.exe', '', 'Копирование изображения'),
        event('e19', older, '18:32:01', 'clip', 'blocked', 'clip', 'Буфер обмена (изображение)', '', 'FakeTelegram.exe', 'Telegram Desktop', 'Вставка изображения в чат'),
    ];

    let seed = 42;
    const rnd = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    };
    const pick = <T,>(items: T[]): T => items[Math.floor(rnd() * items.length)]!;
    const pad = (value: number) => String(value).padStart(2, '0');
    const targets: Array<{ ch: JournalChannel; proc: string; res: string }> = [
        { ch: 'telegram', proc: 'Telegram.exe', res: 'Telegram Desktop' },
        { ch: 'browser', proc: 'chrome.exe', res: 'drive.google.com/drive/my-drive' },
        { ch: 'browser', proc: 'chrome.exe', res: 'mail.google.com' },
        { ch: 'browser', proc: 'msedge.exe', res: 'wetransfer.com' },
        { ch: 'browser', proc: 'chrome.exe', res: 'ilovepdf.com/ru/compress_pdf' },
        { ch: 'browser', proc: 'msedge.exe', res: 'disk.yandex.ru' },
    ];
    const files = ['Договор_2026.docx', 'Счёт-фактура.xlsx', 'Отчёт_Q3.pdf', 'Клиенты.xlsx', 'скриншот.png', 'backup.zip', 'Акт сверки.pdf', 'Прайс.xlsx', 'Презентация.pptx'];
    const folders = ['Documents', 'Downloads', 'Desktop'];
    const fsProcs = ['explorer.exe', 'WINWORD.EXE', 'EXCEL.EXE', 'chrome.exe'];
    const generated: JournalEvent[] = [];
    let n = 0;
    users.forEach((user, index) => {
        if (index === 0)
            return;
        let count = 3 + Math.floor(rnd() * 8);
        if (index % 7 === 0)
            count += 8;
        for (let k = 0; k < count; k += 1) {
            n += 1;
            const day = Math.floor(rnd() * rnd() * 7);
            const d = `${pad(26 - day)}.10.2026`;
            const t = `${pad(8 + Math.floor(rnd() * 10))}:${pad(Math.floor(rnd() * 60))}:${pad(Math.floor(rnd() * 60))}`;
            const roll = rnd();
            const name = pick(files);
            const dir = `C:\\Users\\${user.login}\\${pick(folders)}`;
            const base = { id: `g${n}`, d, t, u: user.id, name, dir };
            if (roll < 0.68) {
                const target = pick(targets);
                generated.push({ ...base, kind: 'send', status: 'blocked', ch: target.ch, proc: target.proc, res: target.res, note: '' });
            }
            else if (roll < 0.78) {
                generated.push({ ...base, kind: 'copy', status: 'logged', ch: 'fs', proc: pick(fsProcs), res: '', note: 'Копия в другую папку' });
            }
            else if (roll < 0.88) {
                generated.push({ ...base, kind: 'edit', status: 'logged', ch: 'fs', proc: pick(fsProcs), res: '', note: 'Содержимое изменено' });
            }
            else if (roll < 0.93) {
                generated.push({ ...base, kind: 'new', status: 'logged', ch: 'fs', proc: 'chrome.exe', res: '', note: 'Скачан в браузере' });
            }
            else if (roll < 0.97) {
                generated.push({
                    ...base,
                    kind: 'clip',
                    status: 'blocked',
                    ch: 'clip',
                    name: 'Буфер обмена (изображение)',
                    dir: '',
                    proc: 'Telegram.exe',
                    res: 'Telegram Desktop',
                    note: 'Вставка изображения в чат',
                });
            }
            else {
                generated.push({ ...base, kind: 'send', status: 'allowed', ch: 'browser', proc: 'chrome.exe', res: 'kostalegal20.sharepoint.com', note: '' });
            }
        }
    });
    return main.concat(generated);
}

export function journalEventKey(eventRow: JournalEvent): string {
    return eventRow.d.slice(6, 10) + eventRow.d.slice(3, 5) + eventRow.d.slice(0, 2) + eventRow.t;
}

export function journalDayLabel(day: string): string {
    if (day === '26.10.2026')
        return 'Сегодня, 26 октября';
    if (day === '25.10.2026')
        return 'Вчера, 25 октября';
    return `${Number(day.slice(0, 2))} октября`;
}
