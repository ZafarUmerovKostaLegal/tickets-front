import { jsx as _jsx } from "react/jsx-runtime";
export function highlightSearchText(text, query) {
    const q = query.trim();
    if (!q)
        return text;
    const lower = text.toLowerCase();
    const qLower = q.toLowerCase();
    const nodes = [];
    let pos = 0;
    let matchStart = lower.indexOf(qLower, pos);
    let key = 0;
    while (matchStart !== -1) {
        if (matchStart > pos)
            nodes.push(text.slice(pos, matchStart));
        nodes.push(_jsx("mark", { className: "kd-tg__search-mark", children: text.slice(matchStart, matchStart + q.length) }, key++));
        pos = matchStart + q.length;
        matchStart = lower.indexOf(qLower, pos);
    }
    if (pos < text.length)
        nodes.push(text.slice(pos));
    return nodes.length > 0 ? nodes : text;
}
export function messageMatchesSearch(text, authorName, query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return false;
    return text.toLowerCase().includes(q) || authorName.toLowerCase().includes(q);
}
export function dailyMessageMatchesSearch(msg, query) {
    return messageMatchesSearch(msg.text, msg.authorName, query);
}
