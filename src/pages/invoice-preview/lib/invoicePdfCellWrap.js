/**
 * Shared PDF cell wrap used by invoice time-report tables.
 * Prefer breaks at spaces; split long tokens so text cannot overflow the column.
 */
export function wrapPdfCellLines(text, maxW, measure) {
    const normalized = text.replace(/\r\n/g, '\n');
    if (!normalized.includes('\n'))
        return wrapPdfCellParagraph(normalized, maxW, measure);
    const lines = [];
    for (const part of normalized.split('\n')) {
        const wrapped = wrapPdfCellParagraph(part, maxW, measure);
        if (wrapped.length === 0)
            lines.push('');
        else
            lines.push(...wrapped);
    }
    return lines;
}
function wrapPdfCellParagraph(text, maxW, measure) {
    const trailing = text.match(/[ \t]+$/)?.[0] ?? '';
    const body = trailing ? text.slice(0, -trailing.length) : text;
    const lines = wrapPdfCellWords(body, maxW, measure);
    return appendTrailingSpaces(lines, trailing, maxW, measure);
}
function appendTrailingSpaces(lines, trailing, maxW, measure) {
    if (!trailing)
        return lines;
    const out = lines.length ? [...lines] : [''];
    let rest = trailing;
    while (rest) {
        const last = out[out.length - 1] ?? '';
        let fit = '';
        for (const ch of rest) {
            if (measure(`${last}${fit}${ch}`) <= maxW)
                fit += ch;
            else
                break;
        }
        if (!fit) {
            if (!last)
                break;
            out.push('');
            continue;
        }
        out[out.length - 1] = `${last}${fit}`;
        rest = rest.slice(fit.length);
    }
    return out;
}
function wrapPdfCellWords(text, maxW, measure) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (!words.length)
        return [];
    const lines = [];
    let line = '';
    const flush = () => {
        if (line) {
            lines.push(line);
            line = '';
        }
    };
    const takeFittingPrefix = (token) => {
        if (measure(token) <= maxW)
            return { head: token, rest: '' };
        const chars = [...token];
        let lo = 1;
        let hi = chars.length;
        let fit = 1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const slice = chars.slice(0, mid).join('');
            if (measure(slice) <= maxW) {
                fit = mid;
                lo = mid + 1;
            }
            else {
                hi = mid - 1;
            }
        }
        fit = Math.max(1, Math.min(fit, chars.length));
        return {
            head: chars.slice(0, fit).join(''),
            rest: chars.slice(fit).join(''),
        };
    };
    for (const word of words) {
        const trial = line ? `${line} ${word}` : word;
        if (measure(trial) <= maxW) {
            line = trial;
            continue;
        }
        flush();
        let rest = word;
        while (rest) {
            const { head, rest: next } = takeFittingPrefix(rest);
            if (!next) {
                line = head;
                break;
            }
            lines.push(head);
            rest = next;
        }
    }
    flush();
    return lines;
}
