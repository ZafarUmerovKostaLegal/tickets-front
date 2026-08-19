import type { BirthdayGreetingPayload } from './birthdayGreetingStorage';

const STORAGE_KEY = 'kosta.firm.anniversary.seen.v1';
export const FIRM_FOUNDING_YEAR = 2015;
export const FIRM_ANNIVERSARY_MONTH = 8;
export const FIRM_ANNIVERSARY_DAY = 19;

const FIRM_LETTER_PARAGRAPHS = [
    'От всей команды Kosta Legal искренне поздравляем вас с годовщиной нашей фирмы! 🎉',
    'В этот особенный день хотим поблагодарить вас за лидерство, поддержку, внимание и веру в каждого из нас. Ваше умение вдохновлять и направлять помогает нам развиваться, раскрывать свой потенциал и вместе достигать новых высот. 🙏',
    'Мы гордимся тем, что являемся частью Kosta Legal, и ценим каждый наш общий успех. Желаем фирме дальнейшего роста, новых побед, ярких проектов и процветания! ❤️',
    'Пусть этот день станет праздником нашей команды, нашего единства и всего того, что мы создаём вместе. 😊',
    'С уважением, благодарностью и самыми тёплыми пожеланиями, вся команда Kosta Legal ❤️',
] as const;

type SeenMap = Record<string, number>;

function normEmail(email: string): string {
    return email.trim().toLowerCase();
}

function readSeen(): SeenMap {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return {};
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            return {};
        const out: SeenMap = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof value === 'number' && Number.isFinite(value))
                out[key] = value;
        }
        return out;
    }
    catch {
        return {};
    }
}

function writeSeen(map: SeenMap): void {
    if (typeof localStorage === 'undefined')
        return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function firmAnniversaryYears(year: number): number {
    return Math.max(1, year - FIRM_FOUNDING_YEAR);
}

export function isFirmAnniversaryDate(now: Date = new Date()): boolean {
    return now.getMonth() === FIRM_ANNIVERSARY_MONTH - 1 && now.getDate() === FIRM_ANNIVERSARY_DAY;
}

export function hasSeenFirmAnniversary(email: string, year: number): boolean {
    if (!email.trim())
        return true;
    return readSeen()[normEmail(email)] === year;
}

export function markFirmAnniversarySeen(email: string, year: number): void {
    if (!email.trim())
        return;
    const next = readSeen();
    next[normEmail(email)] = year;
    writeSeen(next);
}

export function firmAnniversaryGreetingId(year: number): string {
    return `firm_anniversary_${year}`;
}

export function buildFirmAnniversaryGreeting(user: {
    email: string;
    id: number;
    display_name: string | null;
}, now: Date = new Date()): BirthdayGreetingPayload {
    const year = now.getFullYear();
    const years = firmAnniversaryYears(year);
    const yearsLabel = `${years}-й`;
    const paragraphs = [
        `От всей команды Kosta Legal искренне поздравляем вас с ${yearsLabel} годовщиной нашей фирмы! 🎉`,
        ...FIRM_LETTER_PARAGRAPHS.slice(1),
    ];
    return {
        id: firmAnniversaryGreetingId(year),
        kind: 'firm',
        recipientEmail: normEmail(user.email),
        recipientUserId: user.id,
        recipientName: user.display_name?.trim() || 'коллеги',
        message: paragraphs.join('\n\n'),
        paragraphs,
        senderName: 'вся команда Kosta Legal',
        sentAt: now.toISOString(),
        consumedAt: null,
        coverTitle: `${years} лет`,
        coverBadge: '19 августа',
        insideEyebrow: `${years}-я годовщина`,
        insideTitle: 'Уважаемые партнёры, коллеги!',
    };
}
