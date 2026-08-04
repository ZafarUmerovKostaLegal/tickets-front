import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
    'p', 'br', 'div', 'span',
    'b', 'strong', 'i', 'em', 'u', 's', 'strike',
    'ul', 'ol', 'li',
    'blockquote', 'a',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'style', 'class'];

/** Keep layout styles only — font family/size are locked to Calibri Light in CSS. */
function scrubLockedFontStyles(html: string): string {
    if (typeof document === 'undefined')
        return html;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    wrap.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
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
    // Drop heading tags that imply different type size — keep content as paragraphs.
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

/** Convert legacy plain-text body into minimal HTML. */
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

/** Non-empty seed so contentEditable can create paragraphs with Enter. */
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
