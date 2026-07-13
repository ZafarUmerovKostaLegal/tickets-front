
import twemoji from 'twemoji';
import DOMPurify from 'dompurify';

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
    return DOMPurify.sanitize(raw, {
        ALLOWED_TAGS: ['img', 'span'],
        ALLOWED_ATTR: ['src', 'alt', 'class', 'loading', 'decoding', 'draggable'],
    });
}

export function twemojiSingleHtml(emoji: string): string {
    return twemojiHtml(emoji);
}
