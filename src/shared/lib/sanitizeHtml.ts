import DOMPurify from 'dompurify';
import type { Config as DomPurifyConfig } from 'dompurify';

export type SanitizeHtmlProfile = 'rich' | 'textOnly' | 'twemoji';

const PROFILES: Record<SanitizeHtmlProfile, DomPurifyConfig> = {
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

export function sanitizeHtml(html: string, profile: SanitizeHtmlProfile = 'rich'): string {
    return DOMPurify.sanitize(html, PROFILES[profile]);
}

export function stripHtmlToText(html: string): string {
    return sanitizeHtml(html, 'textOnly');
}
