import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type TauriAclLine, tauriGetFolderAcl, tauriListUncChildren } from '@entities/network-drive';
import { childUncPath, trimUnc, uncShortLabel } from '@shared/lib/uncPath';

type Props = {
    rootUnc: string;
};

type AccessNode = {
    segment: string;
    fullPath: string;
    children: AccessNode[];
};

type Suggestion = { key: string; display: string };


const FOLDERS_PER_SLICE = 8;

function yieldToBrowser(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

function principalKey(line: TauriAclLine): string {
    return line.icaclsIdentity.trim().toLowerCase();
}

function loginFromIdentity(identity: string): string {
    const i = identity.trim();
    const p = i.lastIndexOf('\\');
    return p >= 0 ? i.slice(p + 1) : i;
}

function includeAllowPrincipal(row: TauriAclLine): boolean {
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


function normalizeLookup(raw: string): string {
    return raw.trim().toLowerCase();
}


function aclLineMatchesLookup(line: TauriAclLine, lookupNorm: string): boolean {
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

function sortTree(node: AccessNode): void {
    node.children.sort((a, b) => a.segment.localeCompare(b.segment, 'ru', { sensitivity: 'base' }));
    for (const c of node.children) {
        sortTree(c);
    }
}

function buildAccessTree(paths: Iterable<string>, root: string): AccessNode {
    const normRoot = trimUnc(root);
    const rootNode: AccessNode = {
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

async function loadRootAclSuggestions(root: string): Promise<Suggestion[]> {
    const acl = await tauriGetFolderAcl(root);
    const seen = new Set<string>();
    const out: Suggestion[] = [];
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

type ScanProgress = {
    visited: number;
    matches: number;
    errors: number;
};


async function scanFoldersForPrincipal(
    rootUnc: string,
    lookupRaw: string,
    shouldCancel: () => boolean,
    onProgress: (p: ScanProgress) => void,
): Promise<{ paths: Set<string>; progress: ScanProgress }> {
    const root = trimUnc(rootUnc);
    const lookupNorm = normalizeLookup(lookupRaw);
    if (lookupNorm === '') {
        throw new Error('Укажите учётную запись (DOMAIN\\пользователь, группу или SID).');
    }

    const paths = new Set<string>();
    const queue: string[] = [root];
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

        const path = queue[qi]!;
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

export function NetworkDriveUserAccessPanel(p: Props) {
    const root = trimUnc(p.rootUnc) || p.rootUnc;
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [suggestionsErr, setSuggestionsErr] = useState<string | null>(null);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    const [principalInput, setPrincipalInput] = useState('');
    const [scanning, setScanning] = useState(false);
    const [scanErr, setScanErr] = useState<string | null>(null);
    const [progress, setProgress] = useState<ScanProgress | null>(null);
    const [resultPaths, setResultPaths] = useState<Set<string> | null>(null);
    const [resultLabel, setResultLabel] = useState<string | null>(null);

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

    const startScan = useCallback(
        async (raw: string) => {
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
                const { paths, progress: fin } = await scanFoldersForPrincipal(
                    root,
                    trimmed,
                    () => cancelRef.current,
                    setProgress,
                );
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
        },
        [root],
    );

    const cancelScan = useCallback(() => {
        cancelRef.current = true;
    }, []);

    const pickSuggestion = useCallback(
        (s: Suggestion) => {
            setPrincipalInput(s.display);
            void startScan(s.display);
        },
        [startScan],
    );

    const sugFilter = normalizeLookup(principalInput);
    const filteredSuggestions = useMemo(() => {
        if (sugFilter === '') {
            return suggestions;
        }
        return suggestions.filter(
            (s) =>
                s.display.toLowerCase().includes(sugFilter)
                || s.key.includes(sugFilter),
        );
    }, [suggestions, sugFilter]);

    const hasRootAccess = Boolean(resultPaths?.has(root));

    const tree = useMemo(() => {
        if (!resultPaths || resultPaths.size === 0) {
            return null;
        }
        return buildAccessTree(resultPaths, root);
    }, [resultPaths, root]);

    return (
        <div className="ndrive-useracc">
            <div className="ndrive-useracc__toolbar ndrive-useracc__toolbar--top">
                <div className="ndrive-useracc__lookup">
                    <label className="ndrive-useracc__lookup-label" htmlFor="ndrive-principal-input">
                        Учётная запись
                    </label>
                    <div className="ndrive-useracc__lookup-row">
                        <input
                            id="ndrive-principal-input"
                            type="text"
                            className="ndrive-useracc__lookup-input"
                            value={principalInput}
                            onChange={(e) => setPrincipalInput(e.target.value)}
                            placeholder="DOMAIN\\user или SID (S-1-5-…)"
                            disabled={scanning}
                            autoComplete="off"
                            list="ndrive-principal-suggestions"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void startScan(principalInput);
                                }
                            }}
                        />
                        <datalist id="ndrive-principal-suggestions">
                            {suggestions.map((s) => (
                                <option key={s.key} value={s.display} />
                            ))}
                        </datalist>
                        <button
                            type="button"
                            className="ndrive__btn ndrive__btn--primary"
                            disabled={scanning || root.trim() === ''}
                            onClick={() => void startScan(principalInput)}
                        >
                            Найти папки
                        </button>
                        {scanning && (
                            <button type="button" className="ndrive__btn" onClick={cancelScan}>
                                Отмена
                            </button>
                        )}
                    </div>
                    <p className="ndrive-useracc__lookup-hint">
                        Сканирование выполняется в фоне по всему share только для этой записи. Подсказки слева —
                        быстрый список из ACL корня (не все пользователи).
                    </p>
                </div>
                {loadingSuggestions && (
                    <span className="ndrive-useracc__stat">Загрузка подсказок из корня…</span>
                )}
                {scanning && progress != null && (
                    <div className="ndrive-useracc__progress" role="status">
                        <span className="ndrive-useracc__progress-bar" aria-hidden />
                        <span className="ndrive-useracc__progress-text">
                            Проверено папок: <strong>{progress.visited}</strong>
                            {' · '}
                            с доступом: <strong>{progress.matches}</strong>
                            {progress.errors > 0 && (
                                <>
                                    {' · '}
                                    ошибок: <strong>{progress.errors}</strong>
                                </>
                            )}
                        </span>
                    </div>
                )}
            </div>

            {suggestionsErr && (
                <div className="ndrive-exp__err" role="alert">
                    Подсказки: {suggestionsErr}
                </div>
            )}
            {scanErr && (
                <div className="ndrive-exp__err" role="alert">
                    {scanErr}
                </div>
            )}

            <div className="ndrive-useracc__split">
                <aside className="ndrive-useracc__aside" aria-label="Подсказки из ACL корня">
                    <div className="ndrive-useracc__aside-head">
                        <span className="ndrive-useracc__aside-title">Кто в ACL корня</span>
                        <button
                            type="button"
                            className="ndrive-useracc__aside-refresh ndrive__btn ndrive__btn--ghost"
                            disabled={loadingSuggestions || scanning}
                            onClick={() => void refreshSuggestions()}
                        >
                            Обновить
                        </button>
                    </div>
                    <p className="ndrive-useracc__aside-note">
                        Клик по строке — сразу поиск папок для этой записи.
                    </p>
                    <ul className="ndrive-useracc__user-list" role="list">
                        {filteredSuggestions.map((s) => {
                            const login = loginFromIdentity(s.display);
                            const showLogin = login !== s.display.trim();
                            return (
                                <li key={s.key}>
                                    <button
                                        type="button"
                                        className="ndrive-useracc__user-btn"
                                        disabled={scanning}
                                        onClick={() => pickSuggestion(s)}
                                    >
                                        <span className="ndrive-useracc__user-name">{s.display}</span>
                                        {showLogin && (
                                            <span className="ndrive-useracc__user-login">({login})</span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    {filteredSuggestions.length === 0 && !loadingSuggestions && (
                        <p className="ndrive-useracc__empty-aside">Нет записей или не совпадает с вводом.</p>
                    )}
                </aside>

                <section className="ndrive-useracc__main" aria-label="Папки с доступом">
                    {resultLabel != null && resultPaths != null && (
                        <h2 className="ndrive-useracc__result-heading">
                            Доступ для: <span className="ndrive-useracc__result-name">{resultLabel}</span>
                        </h2>
                    )}
                    {resultPaths != null && resultPaths.size > 0 && (
                        <div className="ndrive-useracc__tree-wrap">
                            <h3 className="ndrive-useracc__tree-title">Папки с разрешением Allow</h3>
                            {hasRootAccess && (
                                <p className="ndrive-useracc__root-note">
                                    В том числе на корень share:{' '}
                                    <code className="ndrive-useracc__root-code">{root}</code>
                                </p>
                            )}
                            {tree != null && tree.children.length > 0 && (
                                <ul className="ndrive-useracc__tree-root">
                                    {tree.children.map((c) => (
                                        <TreeBranch key={c.fullPath} node={c} depth={0} />
                                    ))}
                                </ul>
                            )}
                            {tree != null && tree.children.length === 0 && hasRootAccess && (
                                <p className="ndrive-useracc__only-root">
                                    Отдельных вложенных папок с ACE для этой записи нет — только корень.
                                </p>
                            )}
                        </div>
                    )}
                    {resultPaths != null && resultPaths.size === 0 && !scanning && (
                        <div className="ndrive-useracc__placeholder">
                            Папок с явным Allow для «{resultLabel}» не найдено (проверьте написание, SID или
                            группы).
                        </div>
                    )}
                    {resultPaths == null && !scanning && (
                        <div className="ndrive-useracc__placeholder">
                            Введите учётную запись и нажмите «Найти папки», либо выберите строку слева.
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

function TreeBranch({ node, depth }: { node: AccessNode; depth: number }) {
    const [open, setOpen] = useState(true);
    const hasKids = node.children.length > 0;
    return (
        <li className="ndrive-useracc__tree-li">
            <div className="ndrive-useracc__tree-row" style={{ paddingLeft: 8 + depth * 18 }}>
                {hasKids ? (
                    <button
                        type="button"
                        className="ndrive-useracc__tree-toggle"
                        aria-expanded={open}
                        onClick={() => setOpen((v) => !v)}
                    >
                        {open ? '▼' : '▶'}
                    </button>
                ) : (
                    <span className="ndrive-useracc__tree-toggle-spacer" />
                )}
                <span className="ndrive-useracc__tree-folder" aria-hidden />
                <div className="ndrive-useracc__tree-label">
                    <span className="ndrive-useracc__tree-seg" title={node.fullPath}>
                        {node.segment}
                    </span>
                    <code className="ndrive-useracc__tree-unc">{node.fullPath}</code>
                </div>
            </div>
            {hasKids && open && (
                <ul className="ndrive-useracc__tree-children">
                    {node.children.map((c) => (
                        <TreeBranch key={c.fullPath} node={c} depth={depth + 1} />
                    ))}
                </ul>
            )}
        </li>
    );
}
