const STORAGE_KEY = 'kosta.birthday.greetings.v1';
/** Demo / QA: set an email to force postcard on login. Empty = disabled. */
export const BIRTHDAY_DEMO_FORCE_EMAIL = '';
export const DEFAULT_BIRTHDAY_MESSAGE = 'Сегодня ваш день — и пусть он будет таким же ярким, как вы в работе: '
    + 'смелым в решениях, тёплым с людьми и щедрым на удачные моменты. '
    + 'Мы рядом, болеем за вас и рады, что Kosta Legal — это и вы. '
    + 'Пусть впереди будет больше поводов улыбнуться.';
function normEmail(email) {
    return email.trim().toLowerCase();
}
function readAll() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed.filter((x) => Boolean(x && typeof x === 'object' && typeof x.id === 'string'));
    }
    catch {
        return [];
    }
}
function writeAll(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
export function queueBirthdayGreeting(input) {
    const payload = {
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
export function getPendingBirthdayGreeting(email) {
    const key = normEmail(email);
    const list = readAll();
    const pending = list
        .filter((g) => g.recipientEmail === key && g.consumedAt == null)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    return pending[0] ?? null;
}
export function consumeBirthdayGreeting(id) {
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
export function isBirthdayDemoForceEmail(email) {
    if (!email || !BIRTHDAY_DEMO_FORCE_EMAIL)
        return false;
    return normEmail(email) === normEmail(BIRTHDAY_DEMO_FORCE_EMAIL);
}
export function buildDemoBirthdayGreeting(user) {
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
