import type { ReactNode } from 'react';

export function highlightSearchText(text: string, query: string): ReactNode {
    const q = query.trim();
    if (!q)
        return text;
    const lower = text.toLowerCase();
    const qLower = q.toLowerCase();
    const nodes: ReactNode[] = [];
    let pos = 0;
    let matchStart = lower.indexOf(qLower, pos);
    let key = 0;
    while (matchStart !== -1) {
        if (matchStart > pos)
            nodes.push(text.slice(pos, matchStart));
        nodes.push(
            <mark key={key++} className="kd-tg__search-mark">
                {text.slice(matchStart, matchStart + q.length)}
            </mark>,
        );
        pos = matchStart + q.length;
        matchStart = lower.indexOf(qLower, pos);
    }
    if (pos < text.length)
        nodes.push(text.slice(pos));
    return nodes.length > 0 ? nodes : text;
}

export function messageMatchesSearch(text: string, authorName: string, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q)
        return false;
    return text.toLowerCase().includes(q) || authorName.toLowerCase().includes(q);
}

export function dailyMessageMatchesSearch(msg: { text: string; authorName: string }, query: string): boolean {
    return messageMatchesSearch(msg.text, msg.authorName, query);
}
