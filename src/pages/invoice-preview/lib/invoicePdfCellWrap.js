/**
 * Shared PDF cell wrap used by invoice time-report tables.
 * Prefer breaks at spaces; split long tokens so text cannot overflow the column.
 */
export function wrapPdfCellLines(text, maxW, measure) {
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
