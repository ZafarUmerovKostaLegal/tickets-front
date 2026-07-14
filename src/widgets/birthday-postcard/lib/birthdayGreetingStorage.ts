const STORAGE_KEY = 'kosta.birthday.greetings.v1';

export type BirthdayGreetingPayload = {
    id: string;
    recipientEmail: string;
    recipientUserId: number;
    recipientName: string;
    message: string;
    senderName: string;
    sentAt: string;
    consumedAt: string | null;
};

/** Demo / QA: always show postcard for this account on login. */
export const BIRTHDAY_DEMO_FORCE_EMAIL = 'zumerov@kostalegal.com';

export const DEFAULT_BIRTHDAY_MESSAGE =
    'Команда Kosta Legal поздравляет вас с днём рождения! '
    + 'Желаем здоровья, сил и удачи во всех начинаниях. '
    + 'Спасибо, что вы с нами — пусть этот год будет тёплым и успешным.';

function normEmail(email: string): string {
    return email.trim().toLowerCase();
}

function readAll(): BirthdayGreetingPayload[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed))
            return [];
        return parsed.filter((x): x is BirthdayGreetingPayload => Boolean(x && typeof x === 'object' && typeof (x as BirthdayGreetingPayload).id === 'string'));
    }
    catch {
        return [];
    }
}

function writeAll(list: BirthdayGreetingPayload[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function queueBirthdayGreeting(input: {
    recipientEmail: string;
    recipientUserId: number;
    recipientName: string;
    message?: string;
    senderName: string;
}): BirthdayGreetingPayload {
    const payload: BirthdayGreetingPayload = {
        id: `bday_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        recipientEmail: normEmail(input.recipientEmail),
        recipientUserId: input.recipientUserId,
        recipientName: input.recipientName.trim() || input.recipientEmail,
        message: (input.message?.trim() || DEFAULT_BIRTHDAY_MESSAGE),
        senderName: input.senderName.trim() || 'Команда Kosta Legal',
        sentAt: new Date().toISOString(),
        consumedAt: null,
    };
    const next = readAll().filter((g) => !(g.recipientEmail === payload.recipientEmail && g.consumedAt == null));
    next.push(payload);
    writeAll(next);
    return payload;
}

export function getPendingBirthdayGreeting(email: string): BirthdayGreetingPayload | null {
    const key = normEmail(email);
    const list = readAll();
    const pending = list
        .filter((g) => g.recipientEmail === key && g.consumedAt == null)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    return pending[0] ?? null;
}

export function consumeBirthdayGreeting(id: string): void {
    const list = readAll();
    let changed = false;
    for (const g of list) {
        if (g.id === id && g.consumedAt == null) {
            g.consumedAt = new Date().toISOString();
            changed = true;
        }
    }
    if (changed)
        writeAll(list);
}

export function isBirthdayDemoForceEmail(email: string | null | undefined): boolean {
    if (!email)
        return false;
    return normEmail(email) === BIRTHDAY_DEMO_FORCE_EMAIL;
}

export function buildDemoBirthdayGreeting(user: {
    email: string;
    id: number;
    display_name: string | null;
}): BirthdayGreetingPayload {
    return {
        id: 'bday_demo_force',
        recipientEmail: normEmail(user.email),
        recipientUserId: user.id,
        recipientName: user.display_name?.trim() || user.email,
        message: DEFAULT_BIRTHDAY_MESSAGE,
        senderName: 'команда Kosta Legal',
        sentAt: new Date().toISOString(),
        consumedAt: null,
    };
}
