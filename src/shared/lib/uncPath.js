export function trimUnc(s) {
    return s.replace(/[\\/\s]+$/u, '');
}
export function parentUncPath(full) {
    const t = trimUnc(full);
    if (t.length < 3)
        return null;
    const segs = t.split(/\\+/u).filter(Boolean);
    if (segs.length <= 2)
        return null;
    segs.pop();
    return `\\\\${segs[0]}\\${segs.slice(1).join('\\')}`;
}
export function childUncPath(root, name) {
    const a = trimUnc(root);
    return `${a}\\${name.replace(/^[\\]+/u, '')}`;
}
export function uncShortLabel(full) {
    const t = trimUnc(full);
    const segs = t.split(/\\+/u).filter(Boolean);
    if (segs.length >= 2) {
        return `\\\\${segs[0]}\\${segs[1]}`;
    }
    return t;
}
export function pathSegmentsFromRoot(root, current) {
    const r = trimUnc(root);
    const c = trimUnc(current);
    if (c.toLowerCase() === r.toLowerCase()) {
        return [{ label: uncShortLabel(r), path: r }];
    }
    if (!c.toLowerCase().startsWith(r.toLowerCase()) && c !== r) {
        return [{ label: uncShortLabel(c), path: c }];
    }
    const after = c.slice(r.length).replace(/^[\\/]+/u, '');
    const parts = after.split(/[\\/]+/u).filter(Boolean);
    const out = [{ label: uncShortLabel(r), path: r }];
    let acc = r;
    for (const p of parts) {
        acc = childUncPath(acc, p);
        out.push({ label: p, path: acc });
    }
    return out;
}
