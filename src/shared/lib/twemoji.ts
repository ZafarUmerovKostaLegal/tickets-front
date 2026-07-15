import twemoji from 'twemoji';
import { sanitizeHtml } from './sanitizeHtml';

const TWEMOJI_BASE = `${import.meta.env.BASE_URL}twemoji/`;

const PARSE_OPTIONS = {
    folder: 'svg',
    ext: '.svg',
    base: TWEMOJI_BASE,
    attributes: () => ({
        loading: 'lazy' as const,
        decoding: 'async' as const,
        class: 'twemoji',
    }),
};

export function twemojiHtml(text: string): string {
    const raw = twemoji.parse(text, PARSE_OPTIONS) as string;
    return sanitizeHtml(raw, 'twemoji');
}

export function twemojiSingleHtml(emoji: string): string {
    return twemojiHtml(emoji);
}
