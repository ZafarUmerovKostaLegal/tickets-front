import DOMPurify from 'dompurify';
const PROFILES = {
    rich: {
        USE_PROFILES: { html: true },
    },
    textOnly: {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
    },
    twemoji: {
        ALLOWED_TAGS: ['img', 'span'],
        ALLOWED_ATTR: ['src', 'alt', 'class', 'loading', 'decoding', 'draggable'],
    },
};
/** Sanitize untrusted HTML before injecting into the DOM / React. */
export function sanitizeHtml(html, profile = 'rich') {
    return DOMPurify.sanitize(html, PROFILES[profile]);
}
/** Strip all tags; returns plain text (entities decoded by DOMPurify). */
export function stripHtmlToText(html) {
    return sanitizeHtml(html, 'textOnly');
}
