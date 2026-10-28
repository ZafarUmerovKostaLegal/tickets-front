import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tauriGetFolderAcl, tauriListUncChildren } from '@entities/network-drive';
import { childUncPath, trimUnc, uncShortLabel } from '@shared/lib/uncPath';
const FOLDERS_PER_SLICE = 8;
function yieldToBrowser() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}
function principalKey(line) {
    return line.icaclsIdentity.trim().toLowerCase();
}
function loginFromIdentity(identity) {
    const i = identity.trim();
    const p = i.lastIndexOf('\\');
    return p >= 0 ? i.slice(p + 1) : i;
}
function includeAllowPrincipal(row) {
    if (row.access === 'Deny') {
        return false;
    }
    const id = row.identity.trim().toUpperCase();
    if (id.startsWith('NT AUTHORITY\\')) {
        return false;
    }
    if (id.includes('CREATOR OWNER')) {
        return false;
    }
    return true;
}
function normalizeLookup(raw) {
    return raw.trim().toLowerCase();
}
function aclLineMatchesLookup(line, lookupNorm) {
    if (!includeAllowPrincipal(line)) {
        return false;
    }
    const k = principalKey(line);
    const id = line.identity.trim().toLowerCase();
    if (k === lookupNorm || id === lookupNorm) {
        return true;
    }
    if (!lookupNorm.includes('\\') && !lookupNorm.startsWith('s-1-')) {
        const ki = k.lastIndexOf('\\');
        const tailK = ki >= 0 ? k.slice(ki + 1) : k;
        if (tailK === lookupNorm) {
            return true;
        }
        const ii = id.lastIndexOf('\\');
        const tailId = ii >= 0 ? id.slice(ii + 1) : id;
        if (tailId === lookupNorm) {
            return true;
        }
    }
    return false;
}
function sortTree(node) {
    node.children.sort((a, b) => a.segment.localeCompare(b.segment, 'ru', { sensitivity: 'base' }));
    for (const c of node.children) {
        sortTree(c);
    }
}
function buildAccessTree(paths, root) {
    const normRoot = trimUnc(root);
    const rootNode = {
        segment: uncShortLabel(normRoot),
        fullPath: normRoot,
        children: [],
    };
    const pathList = [...paths].map((p) => trimUnc(p)).filter((p) => p.length > 0);
    for (const p of pathList) {
        if (!p.toLowerCase().startsWith(normRoot.toLowerCase())) {
            continue;
        }
        const rel = p.slice(normRoot.length).replace(/^[\\/]+/u, '');
        if (rel === '') {
            continue;
        }
        const parts = rel.split(/[\\/]+/u).filter(Boolean);
        let cur = rootNode;
        let acc = normRoot;
        for (const part of parts) {
            acc = childUncPath(acc, part);
            let next = cur.children.find((c) => c.segment === part);
            if (!next) {
                next = { segment: part, fullPath: acc, children: [] };
                cur.children.push(next);
            }
            cur = next;
        }
    }
    sortTree(rootNode);
    return rootNode;
}
async function loadRootAclSuggestions(root) {
    const acl = await tauriGetFolderAcl(root);
    const seen = new Set();
    const out = [];
    for (const line of acl) {
        if (!includeAllowPrincipal(line)) {
            continue;
        }
        const k = principalKey(line);
        if (seen.has(k)) {
            continue;
        }
        seen.add(k);
        out.push({ key: k, display: line.identity.trim() });
    }
    out.sort((a, b) => a.display.localeCompare(b.display, 'ru', { sensitivity: 'base' }));
    return out;
}
async function scanFoldersForPrincipal(rootUnc, lookupRaw, shouldCancel, onProgress) {
    const root = trimUnc(rootUnc);
    const lookupNorm = normalizeLookup(lookupRaw);
    if (lookupNorm === '') {
        throw new Error('Укажите учётную запись (DOMAIN\\пользователь, группу или SID).');
    }
    const paths = new Set();
    const queue = [root];
    let qi = 0;
    let visited = 0;
    let errors = 0;
    let matches = 0;
    let slice = 0;
    const report = () => onProgress({ visited, matches, errors });
    while (qi < queue.length) {
        if (shouldCancel()) {
            break;
        }
        const path = queue[qi];
        qi++;
        try {
            const acl = await tauriGetFolderAcl(path);
            let hit = false;
            for (const line of acl) {
                if (aclLineMatchesLookup(line, lookupNorm)) {
                    hit = true;
                    break;
                }
            }
            if (hit) {
                paths.add(trimUnc(path));
                matches++;
            }
        }
        catch {
            errors++;
        }
        try {
            const entries = await tauriListUncChildren(path);
            for (const e of entries) {
                if (e.isDir) {
                    queue.push(childUncPath(path, e.name));
                }
            }
        }
        catch {
            errors++;
        }
        visited++;
        slice++;
        if (slice >= FOLDERS_PER_SLICE) {
            slice = 0;
            report();
            await yieldToBrowser();
        }
    }
    report();
    return { paths, progress: { visited, matches, errors } };
}
export function NetworkDriveUserAccessPanel(p) {
    const root = trimUnc(p.rootUnc) || p.rootUnc;
    const [suggestions, setSuggestions] = useState([]);
    const [suggestionsErr, setSuggestionsErr] = useState(null);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [principalInput, setPrincipalInput] = useState('');
    const [scanning, setScanning] = useState(false);
    const [scanErr, setScanErr] = useState(null);
    const [progress, setProgress] = useState(null);
    const [resultPaths, setResultPaths] = useState(null);
    const [resultLabel, setResultLabel] = useState(null);
    const cancelRef = useRef(false);
    const refreshSuggestions = useCallback(async () => {
        if (root.trim() === '') {
            return;
        }
        setLoadingSuggestions(true);
        setSuggestionsErr(null);
        try {
            const s = await loadRootAclSuggestions(root);
            setSuggestions(s);
        }
        catch (e) {
            setSuggestionsErr(e instanceof Error ? e.message : String(e));
            setSuggestions([]);
        }
        finally {
            setLoadingSuggestions(false);
        }
    }, [root]);
    useEffect(() => {
        void refreshSuggestions();
    }, [refreshSuggestions]);
    const startScan = useCallback(async (raw) => {
        const trimmed = raw.trim();
        if (trimmed === '') {
            setScanErr('Введите или выберите учётную запись.');
            return;
        }
        cancelRef.current = false;
        setScanning(true);
        setScanErr(null);
        setProgress({ visited: 0, matches: 0, errors: 0 });
        try {
            const { paths, progress: fin } = await scanFoldersForPrincipal(root, trimmed, () => cancelRef.current, setProgress);
            if (!cancelRef.current) {
                setResultPaths(paths);
                setResultLabel(trimmed);
                setProgress(fin);
            }
        }
        catch (e) {
            setScanErr(e instanceof Error ? e.message : String(e));
            setResultPaths(null);
            setResultLabel(null);
        }
        finally {
            setScanning(false);
        }
    }, [root]);
    const cancelScan = useCallback(() => {
        cancelRef.current = true;
    }, []);
    const pickSuggestion = useCallback((s) => {
        setPrincipalInput(s.display);
        void startScan(s.display);
    }, [startScan]);
    const sugFilter = normalizeLookup(principalInput);
    const filteredSuggestions = useMemo(() => {
        if (sugFilter === '') {
            return suggestions;
        }
        return suggestions.filter((s) => s.display.toLowerCase().includes(sugFilter)
            || s.key.includes(sugFilter));
    }, [suggestions, sugFilter]);
    const hasRootAccess = Boolean(resultPaths?.has(root));
    const tree = useMemo(() => {
        if (!resultPaths || resultPaths.size === 0) {
            return null;
        }
        return buildAccessTree(resultPaths, root);
    }, [resultPaths, root]);
    return (_jsxs("div", { className: "ndrive-useracc", children: [_jsxs("div", { className: "ndrive-useracc__toolbar ndrive-useracc__toolbar--top", children: [_jsxs("div", { className: "ndrive-useracc__lookup", children: [_jsx("label", { className: "ndrive-useracc__lookup-label", htmlFor: "ndrive-principal-input", children: "\u0423\u0447\u0451\u0442\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C" }), _jsxs("div", { className: "ndrive-useracc__lookup-row", children: [_jsx("input", { id: "ndrive-principal-input", type: "text", className: "ndrive-useracc__lookup-input", value: principalInput, onChange: (e) => setPrincipalInput(e.target.value), placeholder: "DOMAIN\\\\user \u0438\u043B\u0438 SID (S-1-5-\u2026)", disabled: scanning, autoComplete: "off", list: "ndrive-principal-suggestions", onKeyDown: (e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                void startScan(principalInput);
                                            }
                                        } }), _jsx("datalist", { id: "ndrive-principal-suggestions", children: suggestions.map((s) => (_jsx("option", { value: s.display }, s.key))) }), _jsx("button", { type: "button", className: "ndrive__btn ndrive__btn--primary", disabled: scanning || root.trim() === '', onClick: () => void startScan(principalInput), children: "\u041D\u0430\u0439\u0442\u0438 \u043F\u0430\u043F\u043A\u0438" }), scanning && (_jsx("button", { type: "button", className: "ndrive__btn", onClick: cancelScan, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }))] }), _jsx("p", { className: "ndrive-useracc__lookup-hint", children: "\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u0432 \u0444\u043E\u043D\u0435 \u043F\u043E \u0432\u0441\u0435\u043C\u0443 share \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438. \u041F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438 \u0441\u043B\u0435\u0432\u0430 \u2014 \u0431\u044B\u0441\u0442\u0440\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u0438\u0437 ACL \u043A\u043E\u0440\u043D\u044F (\u043D\u0435 \u0432\u0441\u0435 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0438)." })] }), loadingSuggestions && (_jsx("span", { className: "ndrive-useracc__stat", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043E\u043A \u0438\u0437 \u043A\u043E\u0440\u043D\u044F\u2026" })), scanning && progress != null && (_jsxs("div", { className: "ndrive-useracc__progress", role: "status", children: [_jsx("span", { className: "ndrive-useracc__progress-bar", "aria-hidden": true }), _jsxs("span", { className: "ndrive-useracc__progress-text", children: ["\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E \u043F\u0430\u043F\u043E\u043A: ", _jsx("strong", { children: progress.visited }), ' · ', "\u0441 \u0434\u043E\u0441\u0442\u0443\u043F\u043E\u043C: ", _jsx("strong", { children: progress.matches }), progress.errors > 0 && (_jsxs(_Fragment, { children: [' · ', "\u043E\u0448\u0438\u0431\u043E\u043A: ", _jsx("strong", { children: progress.errors })] }))] })] }))] }), suggestionsErr && (_jsxs("div", { className: "ndrive-exp__err", role: "alert", children: ["\u041F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438: ", suggestionsErr] })), scanErr && (_jsx("div", { className: "ndrive-exp__err", role: "alert", children: scanErr })), _jsxs("div", { className: "ndrive-useracc__split", children: [_jsxs("aside", { className: "ndrive-useracc__aside", "aria-label": "\u041F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438 \u0438\u0437 ACL \u043A\u043E\u0440\u043D\u044F", children: [_jsxs("div", { className: "ndrive-useracc__aside-head", children: [_jsx("span", { className: "ndrive-useracc__aside-title", children: "\u041A\u0442\u043E \u0432 ACL \u043A\u043E\u0440\u043D\u044F" }), _jsx("button", { type: "button", className: "ndrive-useracc__aside-refresh ndrive__btn ndrive__btn--ghost", disabled: loadingSuggestions || scanning, onClick: () => void refreshSuggestions(), children: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C" })] }), _jsx("p", { className: "ndrive-useracc__aside-note", children: "\u041A\u043B\u0438\u043A \u043F\u043E \u0441\u0442\u0440\u043E\u043A\u0435 \u2014 \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u0438\u0441\u043A \u043F\u0430\u043F\u043E\u043A \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438." }), _jsx("ul", { className: "ndrive-useracc__user-list", role: "list", children: filteredSuggestions.map((s) => {
                                    const login = loginFromIdentity(s.display);
                                    const showLogin = login !== s.display.trim();
                                    return (_jsx("li", { children: _jsxs("button", { type: "button", className: "ndrive-useracc__user-btn", disabled: scanning, onClick: () => pickSuggestion(s), children: [_jsx("span", { className: "ndrive-useracc__user-name", children: s.display }), showLogin && (_jsxs("span", { className: "ndrive-useracc__user-login", children: ["(", login, ")"] }))] }) }, s.key));
                                }) }), filteredSuggestions.length === 0 && !loadingSuggestions && (_jsx("p", { className: "ndrive-useracc__empty-aside", children: "\u041D\u0435\u0442 \u0437\u0430\u043F\u0438\u0441\u0435\u0439 \u0438\u043B\u0438 \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0441 \u0432\u0432\u043E\u0434\u043E\u043C." }))] }), _jsxs("section", { className: "ndrive-useracc__main", "aria-label": "\u041F\u0430\u043F\u043A\u0438 \u0441 \u0434\u043E\u0441\u0442\u0443\u043F\u043E\u043C", children: [resultLabel != null && resultPaths != null && (_jsxs("h2", { className: "ndrive-useracc__result-heading", children: ["\u0414\u043E\u0441\u0442\u0443\u043F \u0434\u043B\u044F: ", _jsx("span", { className: "ndrive-useracc__result-name", children: resultLabel })] })), resultPaths != null && resultPaths.size > 0 && (_jsxs("div", { className: "ndrive-useracc__tree-wrap", children: [_jsx("h3", { className: "ndrive-useracc__tree-title", children: "\u041F\u0430\u043F\u043A\u0438 \u0441 \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0438\u0435\u043C Allow" }), hasRootAccess && (_jsxs("p", { className: "ndrive-useracc__root-note", children: ["\u0412 \u0442\u043E\u043C \u0447\u0438\u0441\u043B\u0435 \u043D\u0430 \u043A\u043E\u0440\u0435\u043D\u044C share:", ' ', _jsx("code", { className: "ndrive-useracc__root-code", children: root })] })), tree != null && tree.children.length > 0 && (_jsx("ul", { className: "ndrive-useracc__tree-root", children: tree.children.map((c) => (_jsx(TreeBranch, { node: c, depth: 0 }, c.fullPath))) })), tree != null && tree.children.length === 0 && hasRootAccess && (_jsx("p", { className: "ndrive-useracc__only-root", children: "\u041E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0445 \u0432\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0445 \u043F\u0430\u043F\u043E\u043A \u0441 ACE \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438 \u043D\u0435\u0442 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u0440\u0435\u043D\u044C." }))] })), resultPaths != null && resultPaths.size === 0 && !scanning && (_jsxs("div", { className: "ndrive-useracc__placeholder", children: ["\u041F\u0430\u043F\u043E\u043A \u0441 \u044F\u0432\u043D\u044B\u043C Allow \u0434\u043B\u044F \u00AB", resultLabel, "\u00BB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E (\u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u0438\u0435, SID \u0438\u043B\u0438 \u0433\u0440\u0443\u043F\u043F\u044B)."] })), resultPaths == null && !scanning && (_jsx("div", { className: "ndrive-useracc__placeholder", children: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0443\u0447\u0451\u0442\u043D\u0443\u044E \u0437\u0430\u043F\u0438\u0441\u044C \u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \u00AB\u041D\u0430\u0439\u0442\u0438 \u043F\u0430\u043F\u043A\u0438\u00BB, \u043B\u0438\u0431\u043E \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0442\u0440\u043E\u043A\u0443 \u0441\u043B\u0435\u0432\u0430." }))] })] })] }));
}
function TreeBranch({ node, depth }) {
    const [open, setOpen] = useState(true);
    const hasKids = node.children.length > 0;
    return (_jsxs("li", { className: "ndrive-useracc__tree-li", children: [_jsxs("div", { className: "ndrive-useracc__tree-row", style: { paddingLeft: 8 + depth * 18 }, children: [hasKids ? (_jsx("button", { type: "button", className: "ndrive-useracc__tree-toggle", "aria-expanded": open, onClick: () => setOpen((v) => !v), children: open ? '▼' : '▶' })) : (_jsx("span", { className: "ndrive-useracc__tree-toggle-spacer" })), _jsx("span", { className: "ndrive-useracc__tree-folder", "aria-hidden": true }), _jsxs("div", { className: "ndrive-useracc__tree-label", children: [_jsx("span", { className: "ndrive-useracc__tree-seg", title: node.fullPath, children: node.segment }), _jsx("code", { className: "ndrive-useracc__tree-unc", children: node.fullPath })] })] }), hasKids && open && (_jsx("ul", { className: "ndrive-useracc__tree-children", children: node.children.map((c) => (_jsx(TreeBranch, { node: c, depth: depth + 1 }, c.fullPath))) }))] }));
}
