import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
    'p', 'br', 'div', 'span',
    'b', 'strong', 'i', 'em', 'u', 's', 'strike',
    'ul', 'ol', 'li',
    'blockquote', 'a',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'style', 'class'];

const UNSAFE_STYLE_PROP = /^(position|inset|inset-[a-z-]+|top|left|right|bottom|z-index|behavior|-moz-binding)$/i;
const UNSAFE_STYLE_VALUE = /url\s*\(|expression\s*\(|javascript:|image-set\s*\(|@import/i;

export function safeInlineStyle(style: string): string {
    return style
        .split(';')
        .map((part) => part.trim())
        .filter((part) => {
            const colon = part.indexOf(':');
            if (colon <= 0)
                return false;
            const prop = part.slice(0, colon).trim();
            const value = part.slice(colon + 1);
            return !UNSAFE_STYLE_PROP.test(prop) && !UNSAFE_STYLE_VALUE.test(value) && !UNSAFE_STYLE_VALUE.test(prop);
        })
        .join('; ');
}

function scrubLockedFontStyles(html: string): string {
    if (typeof document === 'undefined')
        return html;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    wrap.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
        // Letters come from outside: no remote resources (tracking pixels) and no page overlays.
        el.setAttribute('style', safeInlineStyle(el.getAttribute('style') ?? ''));
        el.style.removeProperty('font-family');
        el.style.removeProperty('font-size');
        el.style.removeProperty('font-weight');
        el.style.removeProperty('line-height');
        el.style.removeProperty('letter-spacing');
        if (!el.getAttribute('style')?.trim())
            el.removeAttribute('style');
    });
    wrap.querySelectorAll('font').forEach((node) => {
        const span = document.createElement('span');
        while (node.firstChild)
            span.appendChild(node.firstChild);
        node.replaceWith(span);
    });
    wrap.querySelectorAll('a[target]').forEach((link) => {
        link.setAttribute('rel', 'noopener noreferrer');
    });
    wrap.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
        const p = document.createElement('p');
        while (h.firstChild)
            p.appendChild(h.firstChild);
        h.replaceWith(p);
    });
    return wrap.innerHTML;
}

export function sanitizeLetterHtml(html: string): string {
    if (typeof window === 'undefined')
        return (html || '').trim();
    const cleaned = DOMPurify.sanitize(html || '', {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
    });
    return scrubLockedFontStyles(cleaned).trim();
}

export function plainTextToLetterHtml(text: string): string {
    const raw = (text ?? '').replace(/\r\n/g, '\n');
    const trimmed = raw.trim();
    if (!trimmed)
        return '';
    if (/<[a-z][\s\S]*>/i.test(trimmed))
        return sanitizeLetterHtml(trimmed);
    return trimmed
        .split(/\n{2,}/)
        .map((block) => {
            const lines = block.split('\n').map((line) => escapeHtml(line)).join('<br>');
            return `<p>${lines || '<br>'}</p>`;
        })
        .join('');
}

export function letterHtmlToPlainText(html: string): string {
    const clean = sanitizeLetterHtml(html);
    if (!clean)
        return '';
    if (typeof document === 'undefined') {
        return clean
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|li|h[1-3]|blockquote)>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
    const el = document.createElement('div');
    el.innerHTML = clean;
    return (el.innerText || el.textContent || '').replace(/\u00a0/g, ' ').trim();
}

export function letterBodyIsEmpty(html: string | null | undefined): boolean {
    return letterHtmlToPlainText(html ?? '').length === 0;
}

export function normalizeLetterBodyHtml(raw: string | null | undefined): string {
    const s = (raw ?? '').trim();
    if (!s)
        return '';
    return plainTextToLetterHtml(s);
}

export function ensureLetterEditorHtml(raw: string | null | undefined): string {
    const n = normalizeLetterBodyHtml(raw);
    return n || '<p><br></p>';
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
