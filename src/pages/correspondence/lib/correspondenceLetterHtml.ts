import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
    'p', 'br', 'div', 'span',
    'b', 'strong', 'i', 'em', 'u', 's', 'strike',
    'ul', 'ol', 'li',
    'h1', 'h2', 'h3',
    'blockquote', 'a',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'style', 'class'];

export function sanitizeLetterHtml(html: string): string {
    if (typeof window === 'undefined')
        return (html || '').trim();
    return DOMPurify.sanitize(html || '', {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
    }).trim();
}

/** Convert legacy plain-text body into minimal HTML. */
export function plainTextToLetterHtml(text: string): string {
    const raw = (text ?? '').replace(/\r\n/g, '\n').trim();
    if (!raw)
        return '';
    if (/<[a-z][\s\S]*>/i.test(raw))
        return sanitizeLetterHtml(raw);
    return raw
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

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
