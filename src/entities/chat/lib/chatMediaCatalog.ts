export type ChatStickerDef = {
    id: string;
    packId: string;
    glyph: string;
    label: string;

    animation?: 'bounce' | 'spin' | 'pulse' | 'wave' | 'shake' | 'float';
};

export type ChatStickerPack = {
    id: string;
    title: string;

    icon: string;
    stickers: ChatStickerDef[];
};

export type ChatGifDef = {
    id: string;
    label: string;
    url: string;
};

export const CHAT_EMOJI_GROUPS: { title: string; items: string[] }[] = [
    {
        title: 'Частые',
        items: ['👍', '👎', '❤️', '🔥', '😂', '🥹', '🎉', '👏', '🙏', '✅', '❌', '💯', '🫶', '✨', '😊', '💪'],
    },
    {
        title: 'Эмоции',
        items: [
            '😀', '😁', '😅', '🤣', '😍', '🥰', '😘', '😎', '🤔', '😴', '😢', '😭', '😡', '🤯', '🥳', '😇',
            '🫠', '💀', '🥲', '🤩', '😬', '🫣', '😮‍💨', '🤗', '🤭', '😤', '🙄', '😌', '🤝', '🫡',
        ],
    },
    {
        title: 'Офис',
        items: ['☕', '📎', '📁', '📅', '⏰', '💼', '📝', '📞', '💻', '🏢', '⚖️', '📊', '🎯', '📌', '✍️', '📈'],
    },
    {
        title: 'Жесты',
        items: ['👋', '🤞', '✌️', '👌', '🫡', '🫶', '💪', '🙌', '👀', '💡', '🚀', '⭐', '✨', '🤌', '🫰', '👊'],
    },
];

export const CHAT_EMOJI_KEYWORDS: Record<string, string> = {
    '👍': 'лайк плюс да класс ок',
    '👎': 'минус нет дизлайк',
    '❤️': 'любовь сердце',
    '🔥': 'огонь круто горячо',
    '😂': 'смех ржу',
    '🥹': 'трогательно слёзы радость',
    '🎉': 'праздник ура конфетти',
    '👏': 'аплодисменты браво',
    '🙏': 'спасибо пожалуйста молитва',
    '✅': 'готово да галочка',
    '❌': 'нет отмена крестик',
    '💯': 'сто процентов идеально',
    '🫶': 'любовь сердце руки',
    '✨': 'блеск искры магия',
    '😊': 'улыбка радость',
    '💪': 'сила мышцы давай',
    '🫠': 'таю плавлюсь устал',
    '💀': 'смерть скелет ржака',
    '🥲': 'улыбка слеза',
    '🤩': 'звёзды восторг',
    '😮‍💨': 'выдох облегчение',
    '🫡': 'салют принято',
    '🤌': 'итальянский жест щепотка',
    '🫰': 'деньги сердечко',
    '☕': 'кофе чай перерыв',
    '💼': 'работа офис дело',
    '⚖️': 'право юрист суд',
    '🚀': 'старт запуск рост',
    '👋': 'привет пока',
};

export const CHAT_STICKER_PACKS: ChatStickerPack[] = [
    {
        id: 'emotions',
        title: 'Эмоции',
        icon: '😄',
        stickers: [
            { id: 'love', packId: 'emotions', glyph: '🥰', label: 'Обожаю', animation: 'pulse' },
            { id: 'laugh', packId: 'emotions', glyph: '🤣', label: 'Хохочу', animation: 'bounce' },
            { id: 'cool', packId: 'emotions', glyph: '😎', label: 'Круто', animation: 'float' },
            { id: 'think', packId: 'emotions', glyph: '🤔', label: 'Думаю…', animation: 'float' },
            { id: 'wow', packId: 'emotions', glyph: '🤯', label: 'Вау!', animation: 'shake' },
            { id: 'party', packId: 'emotions', glyph: '🥳', label: 'Праздник', animation: 'bounce' },
            { id: 'cry', packId: 'emotions', glyph: '😭', label: 'Плачу', animation: 'shake' },
            { id: 'sleepy', packId: 'emotions', glyph: '😴', label: 'Сплю', animation: 'float' },
            { id: 'angry', packId: 'emotions', glyph: '😤', label: 'Злюсь', animation: 'shake' },
            { id: 'shy', packId: 'emotions', glyph: '🫣', label: 'Стесняюсь', animation: 'pulse' },
            { id: 'ok-face', packId: 'emotions', glyph: '😌', label: 'Окей', animation: 'float' },
            { id: 'sunglasses', packId: 'emotions', glyph: '🤩', label: 'В восторге', animation: 'spin' },
        ],
    },
    {
        id: 'gestures',
        title: 'Жесты',
        icon: '👋',
        stickers: [
            { id: 'thumbsup', packId: 'gestures', glyph: '👍', label: 'Класс', animation: 'bounce' },
            { id: 'thumbsdown', packId: 'gestures', glyph: '👎', label: 'Не ок', animation: 'shake' },
            { id: 'clap', packId: 'gestures', glyph: '👏', label: 'Аплодисменты', animation: 'bounce' },
            { id: 'wave', packId: 'gestures', glyph: '👋', label: 'Привет!', animation: 'wave' },
            { id: 'ok', packId: 'gestures', glyph: '👌', label: 'Ок', animation: 'pulse' },
            { id: 'point', packId: 'gestures', glyph: '👉', label: 'Вот', animation: 'bounce' },
            { id: 'muscle', packId: 'gestures', glyph: '💪', label: 'Давай!', animation: 'shake' },
            { id: 'pray', packId: 'gestures', glyph: '🙏', label: 'Пожалуйста', animation: 'pulse' },
            { id: 'salute', packId: 'gestures', glyph: '🫡', label: 'Принято', animation: 'bounce' },
            { id: 'fingers', packId: 'gestures', glyph: '🤞', label: 'Удачи', animation: 'pulse' },
            { id: 'highfive', packId: 'gestures', glyph: '🙌', label: 'Отлично', animation: 'bounce' },
            { id: 'no', packId: 'gestures', glyph: '🙅', label: 'Нет', animation: 'shake' },
        ],
    },
    {
        id: 'office',
        title: 'Офис',
        icon: '💼',
        stickers: [
            { id: 'coffee', packId: 'office', glyph: '☕', label: 'Кофе', animation: 'float' },
            { id: 'rocket', packId: 'office', glyph: '🚀', label: 'Старт!', animation: 'bounce' },
            { id: 'fire', packId: 'office', glyph: '🔥', label: 'Горим', animation: 'pulse' },
            { id: 'check', packId: 'office', glyph: '✅', label: 'Готово', animation: 'bounce' },
            { id: 'cross', packId: 'office', glyph: '❌', label: 'Нет', animation: 'shake' },
            { id: '100', packId: 'office', glyph: '💯', label: '100%', animation: 'bounce' },
            { id: 'idea', packId: 'office', glyph: '💡', label: 'Идея', animation: 'pulse' },
            { id: 'report', packId: 'office', glyph: '📊', label: 'Отчёт', animation: 'float' },
            { id: 'clock', packId: 'office', glyph: '⏰', label: 'Дедлайн', animation: 'shake' },
            { id: 'star', packId: 'office', glyph: '⭐', label: 'Отличная работа', animation: 'spin' },
            { id: 'eyes', packId: 'office', glyph: '👀', label: 'Смотрю', animation: 'float' },
            { id: 'chart', packId: 'office', glyph: '📈', label: 'Растём', animation: 'bounce' },
        ],
    },
    {
        id: 'fun',
        title: 'Весёлые',
        icon: '🎉',
        stickers: [
            { id: 'party-popper', packId: 'fun', glyph: '🎉', label: 'Ура!', animation: 'bounce' },
            { id: 'balloon', packId: 'fun', glyph: '🎈', label: 'Шарик', animation: 'float' },
            { id: 'cake', packId: 'fun', glyph: '🎂', label: 'День рождения', animation: 'bounce' },
            { id: 'trophy', packId: 'fun', glyph: '🏆', label: 'Победа', animation: 'spin' },
            { id: 'diamond', packId: 'fun', glyph: '💎', label: 'Бриллиант', animation: 'spin' },
            { id: 'rainbow', packId: 'fun', glyph: '🌈', label: 'Радуга', animation: 'float' },
            { id: 'sparkle', packId: 'fun', glyph: '✨', label: 'Блеск', animation: 'pulse' },
            { id: 'sunflower', packId: 'fun', glyph: '🌻', label: 'Цветок', animation: 'wave' },
            { id: 'unicorn', packId: 'fun', glyph: '🦄', label: 'Единорог', animation: 'bounce' },
            { id: 'tada', packId: 'fun', glyph: '🎊', label: 'Конфетти', animation: 'shake' },
            { id: 'crown', packId: 'fun', glyph: '👑', label: 'Корона', animation: 'float' },
            { id: 'music', packId: 'fun', glyph: '🎵', label: 'Музыка', animation: 'wave' },
        ],
    },
];

export const CHAT_STICKERS: ChatStickerDef[] = CHAT_STICKER_PACKS.flatMap((p) => p.stickers);

export const CHAT_GIFS: ChatGifDef[] = [
    { id: 'thumbs-up', label: 'Класс 👍', url: 'https://media.giphy.com/media/111rboy4Cq9W/giphy.gif' },
    { id: 'clap', label: 'Аплодисменты 👏', url: 'https://media.giphy.com/media/7zJzHZdaX5Wc0/giphy.gif' },
    { id: 'yes', label: 'Да ✅', url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif' },
    { id: 'no', label: 'Нет ❌', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' },
    { id: 'hello', label: 'Привет 👋', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif' },
    { id: 'thanks', label: 'Спасибо 🙏', url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVy/giphy.gif' },
    { id: 'thinking', label: 'Думаю 🤔', url: 'https://media.giphy.com/media/3o7WTL3f8YxP0R5CRG/giphy.gif' },
    { id: 'celebrate', label: 'Ура 🎉', url: 'https://media.giphy.com/media/5GoVLqeaoN6Pm/giphy.gif' },
];

export function stickerById(stickerId: string): ChatStickerDef | null {
    return CHAT_STICKERS.find((s) => s.id === stickerId) ?? null;
}

export function stickerGlyphById(stickerId: string): string | null {
    return stickerById(stickerId)?.glyph ?? null;
}

const RECENT_STICKERS_KEY = 'kd_recent_stickers';
const MAX_RECENT = 16;

export function getRecentStickerIds(): string[] {
    try {
        const raw = localStorage.getItem(RECENT_STICKERS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((x): x is string => typeof x === 'string');
    }
    catch { return []; }
}

export function pushRecentSticker(stickerId: string): void {
    try {
        const prev = getRecentStickerIds().filter((id) => id !== stickerId);
        const next = [stickerId, ...prev].slice(0, MAX_RECENT);
        localStorage.setItem(RECENT_STICKERS_KEY, JSON.stringify(next));
    }
    catch {  }
}
