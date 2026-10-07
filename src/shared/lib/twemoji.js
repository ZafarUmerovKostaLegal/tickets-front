import twemoji from 'twemoji';
import { sanitizeHtml } from './sanitizeHtml';
const TWEMOJI_BASE = `${import.meta.env.BASE_URL}twemoji/`;
const PARSE_OPTIONS = {
    folder: 'svg',
    ext: '.svg',
    base: TWEMOJI_BASE,
    attributes: () => ({
        loading: 'lazy',
        decoding: 'async',
        class: 'twemoji',
    }),
};
export function twemojiHtml(text) {
    const raw = twemoji.parse(text, PARSE_OPTIONS);
    return sanitizeHtml(raw, 'twemoji');
}
export function twemojiSingleHtml(emoji) {
    return twemojiHtml(emoji);
}
