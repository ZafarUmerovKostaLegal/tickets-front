import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TimeTrackingUserRow } from '@entities/time-tracking';
import { SearchableSelect } from '@shared/ui';
import { filesApi, type AclLevel, type ClientsResponse, type MatrixResponse } from '../api/filesApi';
import { endOfDay, todayPlus } from '../lib/accessDates';
import { usePeopleNames } from '../lib/usePeopleNames';
import { MatterAccessMatrix } from './MatterAccessMatrix';
import { Icon, Modal, StateBlock, useAction, useFm, useLoad, type IconName } from './fmShared';
import './SecurityWorkspace.css';
import './MatrixWorkspace.css';

const LEVELS: AclLevel[] = ['read', 'edit', 'manage', 'deny'];
const LEVEL_ICON: Record<AclLevel, IconName> = { read: 'eye', edit: 'edit', manage: 'key', deny: 'shield' };

type Matter = MatrixResponse['matters'][number];
type Popover = { userId: number; userName: string; matter: Matter; level: AclLevel | null; explicit: boolean; x: number; y: number };

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function matterLabel(matter: { code: string; name: string }): string {
    return matter.code ? `${matter.code} · ${matter.name}` : matter.name;
}

const MODE_KEY = 'fm.matrix.mode';

function readMode(): 'matters' | 'folders' {
    try {
        return localStorage.getItem(MODE_KEY) === 'matters' ? 'matters' : 'folders';
    } catch {
        return 'folders';
    }
}

export function MatrixWorkspace({ clients, onOpenSecurity }: { clients: ClientsResponse; onOpenSecurity: (matterId: string) => void }) {
    const { tr } = useFm();
    const [mode, setMode] = useState(readMode);
    const pickMode = (next: 'matters' | 'folders') => {
        setMode(next);
        try {
            localStorage.setItem(MODE_KEY, next);
        } catch {
            /* storage is optional */
        }
    };
    const modes = (
        <div className="fm-mx__modes" role="tablist" aria-label={tr('matrix.title')}>
            {(['folders', 'matters'] as const).map((item) => (
                <button key={item} type="button" role="tab" aria-selected={mode === item}
                    className={mode === item ? 'is-on' : undefined} onClick={() => pickMode(item)}>
                    <Icon name={item === 'folders' ? 'folder' : 'briefcase'} />
                    {tr(item === 'folders' ? 'matrixF.modeFolders' : 'matrixF.modeMatters')}
                </button>
            ))}
        </div>
    );
    if (mode === 'folders') {
        return (
            <section className="fm-mx">
                {modes}
                <MatterAccessMatrix clients={clients} onOpenSecurity={onOpenSecurity} />
            </section>
        );
    }
    return <ClientMatrix clients={clients} onOpenSecurity={onOpenSecurity} modes={modes} />;
}

function ClientMatrix({ clients, onOpenSecurity, modes }: { clients: ClientsResponse; onOpenSecurity: (matterId: string) => void; modes: ReactNode }) {
    const { tr } = useFm();
    const act = useAction();
    const [clientId, setClientId] = useState(clients.clients[0]?.id ?? '');
    const matrix = useLoad(clientId ? () => filesApi.matrix(clientId) : null, [clientId]);
    const { users: catalogUsers, nameOf, positionOf } = usePeopleNames(tr('security.userFallback', { id: '{id}' }));
    const [query, setQuery] = useState('');
    const [hideClosed, setHideClosed] = useState(true);
    const [onlyExplicit, setOnlyExplicit] = useState(false);
    const [hover, setHover] = useState<{ row: number | null; col: string | null }>({ row: null, col: null });
    const [popover, setPopover] = useState<Popover | null>(null);
    const [grantOpen, setGrantOpen] = useState(false);
    const [grantUser, setGrantUser] = useState('');
    const [grantMatter, setGrantMatter] = useState('');
    const [grantLevel, setGrantLevel] = useState<AclLevel>('edit');
    const [grantNote, setGrantNote] = useState('');
    const popRef = useRef<HTMLDivElement>(null);
    const [popNote, setPopNote] = useState('');
    const [popUntil, setPopUntil] = useState('');
    const [popMore, setPopMore] = useState(false);

    const data = matrix.data && matrix.data.client.id === clientId ? matrix.data : null;
    const explicit = useMemo(() => new Set(data?.explicit ?? []), [data]);
    const activeUsers = useMemo(() => catalogUsers.filter((user) => !user.is_blocked && !user.is_archived), [catalogUsers]);

    const matters = useMemo(
        () => (data ? (hideClosed ? data.matters.filter((matter) => !matter.closed) : data.matters) : []),
        [data, hideClosed],
    );

    const rows = useMemo(() => {
        if (!data)
            return [];
        const text = query.trim().toLowerCase();
        return data.users
            .map((user) => {
                const name = nameOf(user.userId, user.name);
                const position = positionOf(user.userId, user.position);
                const access = matters.filter((matter) => {
                    const level = data.cells[`${user.userId}:${matter.id}`];
                    return level && level !== 'deny';
                }).length;
                return { ...user, name, position, access };
            })
            .filter((user) => {
                if (text && !`${user.name} ${user.position}`.toLowerCase().includes(text))
                    return false;
                if (onlyExplicit && !matters.some((matter) => explicit.has(`${user.userId}:${matter.id}`)))
                    return false;
                return true;
            })
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [data, matters, nameOf, positionOf, query, onlyExplicit, explicit]);

    const columnCount = useMemo(() => {
        const out = new Map<string, number>();
        if (!data)
            return out;
        for (const matter of matters) {
            out.set(matter.id, rows.filter((row) => {
                const level = data.cells[`${row.userId}:${matter.id}`];
                return level && level !== 'deny';
            }).length);
        }
        return out;
    }, [data, matters, rows]);

    useLayoutEffect(() => {
        const node = popRef.current;
        if (!node || !popover)
            return;
        const rect = node.getBoundingClientRect();
        const limit = window.innerHeight - 8;
        if (rect.bottom > limit) {
            const y = Math.max(8, limit - rect.height);
            if (Math.abs(y - popover.y) > 1)
                setPopover((prev) => (prev ? { ...prev, y } : prev));
        }
    }, [popover, popMore]);

    useEffect(() => {
        if (!popover)
            return;
        const close = (event: MouseEvent) => {
            if (popRef.current && !popRef.current.contains(event.target as Node))
                setPopover(null);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setPopover(null);
                return;
            }
            const target = event.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'))
                return;
            const index = ['1', '2', '3', '4'].indexOf(event.key);
            if (index >= 0)
                popRef.current?.querySelectorAll<HTMLButtonElement>('.fm-mx-pop__level')[index]?.click();
        };
        const onScroll = () => setPopover(null);
        window.addEventListener('mousedown', close);
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('mousedown', close);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', onScroll);
        };
    }, [popover]);

    const apply = async (matterId: string, userId: number, name: string, level: AclLevel, note = '', until: string | null = null) => {
        const ok = await act(() => filesApi.setAcl(matterId, { userId, userName: name, level, note, until }), tr('security.changed'));
        if (ok)
            matrix.reload();
        return Boolean(ok);
    };

    const remove = async (matterId: string, userId: number) => {
        const ok = await act(() => filesApi.removeAcl(matterId, userId), tr('security.changed'));
        if (ok)
            matrix.reload();
        return Boolean(ok);
    };

    const closeGrant = () => {
        setGrantOpen(false);
        setGrantUser('');
        setGrantMatter('');
        setGrantNote('');
        setGrantLevel('edit');
    };

    const openCell = (target: HTMLElement, userId: number, userName: string, matter: Matter, level: AclLevel | null, isExplicit: boolean) => {
        const rect = target.getBoundingClientRect();
        const width = Math.min(320, window.innerWidth - 16);
        const height = 430;
        const x = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));
        const below = rect.bottom + 8;
        const y = below + height > window.innerHeight ? Math.max(8, Math.min(rect.top - height - 8, window.innerHeight - height - 8)) : below;
        setPopNote('');
        setPopUntil('');
        setPopMore(false);
        setPopover({ userId, userName, matter, level, explicit: isExplicit, x, y });
    };

    return (
        <section className="fm-mx">
            {modes}
            <div className="fm-mx__bar">
                <div className="fm-mx__client">
                    <SearchableSelect
                        value={clientId}
                        items={clients.clients}
                        getOptionValue={(client) => client.id}
                        getOptionLabel={(client) => client.name}
                        getSearchText={(client) => client.name}
                        onSelect={(client) => {
                            setClientId(client.id);
                            setPopover(null);
                        }}
                        placeholder={tr('matrix.pickClient')}
                    />
                </div>
                <label className="fm-sx-search fm-mx__search">
                    <Icon name="search" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)}
                        placeholder={tr('matrix.searchUser')} aria-label={tr('matrix.searchUser')} />
                </label>
                <div className="fm-mx__toggles">
                    <button type="button" className={hideClosed ? 'fm-sx-chip is-on' : 'fm-sx-chip'} aria-pressed={hideClosed}
                        onClick={() => setHideClosed((on) => !on)}>
                        {tr('matrix.hideClosed')}
                    </button>
                    <button type="button" className={onlyExplicit ? 'fm-sx-chip is-on' : 'fm-sx-chip'} aria-pressed={onlyExplicit}
                        onClick={() => setOnlyExplicit((on) => !on)}>
                        {tr('matrix.onlyExplicit')}
                    </button>
                </div>
                <button type="button" className="fm-btn fm-btn--primary fm-mx__grant" disabled={!data} onClick={() => setGrantOpen(true)}>
                    <Icon name="plus" />{tr('matrix.grant')}
                </button>
            </div>

            <div className="fm-mx__legend" aria-label={tr('matrix.title')}>
                {LEVELS.map((level) => (
                    <span key={level}><i className={`fm-mx-cell is-${level}`} aria-hidden><Icon name={LEVEL_ICON[level]} /></i>{tr(`levels.${level}`)}</span>
                ))}
                <span><i className="fm-mx-cell is-explicit is-edit" aria-hidden><Icon name="edit" /></i>{tr('matrix.explicit')}</span>
                <span className="fm-mx__legend-hint">{tr('matrixX.hint')}</span>
            </div>

            <StateBlock loading={matrix.loading && !data} error={matrix.error} onRetry={matrix.reload}
                empty={data && data.users.length === 0 ? tr('matrix.empty') : undefined}>
                {data ? (
                    rows.length === 0 || matters.length === 0 ? (
                        <div className="fm-sx-empty"><Icon name="search" /><p>{tr('matrix.noFilterMatches')}</p></div>
                    ) : (
                        <div className="fm-mx__wrap" onScroll={() => setPopover(null)} onMouseLeave={() => setHover({ row: null, col: null })}>
                            <table className="fm-mx__table">
                                <thead>
                                    <tr>
                                        <th className="fm-mx__corner">
                                            {tr('matrixX.people', { n: rows.length })}
                                            <small>{tr('matrixX.matters', { n: matters.length })}</small>
                                        </th>
                                        {matters.map((matter) => (
                                            <th key={matter.id} className={`fm-mx__col${hover.col === matter.id ? ' is-hover' : ''}${matter.closed ? ' is-closed' : ''}`}
                                                title={matterLabel(matter)}>
                                                <button type="button" onClick={() => onOpenSecurity(matter.id)}>
                                                    {matter.code ? <code>{matter.code}</code> : null}
                                                    <span>{matter.name}</span>
                                                    <em>{tr('matrixX.withAccess', { n: columnCount.get(matter.id) ?? 0 })}</em>
                                                </button>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row.userId} className={hover.row === row.userId ? 'is-hover' : undefined}>
                                            <th className="fm-mx__who">
                                                <strong>{row.name}</strong>
                                                <small>
                                                    {row.position || tr('security.noPosition')}
                                                    {' · '}
                                                    {tr('matrixX.rowAccess', { n: row.access, total: matters.length })}
                                                </small>
                                            </th>
                                            {matters.map((matter) => {
                                                const key = `${row.userId}:${matter.id}`;
                                                const level = data.cells[key] ?? null;
                                                const isExplicit = explicit.has(key);
                                                const active = popover?.userId === row.userId && popover.matter.id === matter.id;
                                                return (
                                                    <td key={matter.id} className={hover.col === matter.id ? 'is-hover' : undefined}
                                                        onMouseEnter={() => setHover({ row: row.userId, col: matter.id })}>
                                                        <button
                                                            type="button"
                                                            className={[
                                                                'fm-mx-cell',
                                                                level ? `is-${level}` : 'is-none',
                                                                isExplicit ? 'is-explicit' : '',
                                                                active ? 'is-active' : '',
                                                            ].filter(Boolean).join(' ')}
                                                            title={`${row.name} · ${matterLabel(matter)}: ${level ? tr(`levels.${level}`) : tr('levels.none')}${level ? ` · ${isExplicit ? tr('matrix.explicit') : tr('matrix.inherited')}` : ''}`}
                                                            aria-label={`${row.name}, ${matterLabel(matter)}: ${level ? tr(`levels.${level}`) : tr('levels.none')}`}
                                                            onClick={(event) => openCell(event.currentTarget, row.userId, row.name, matter, level, isExplicit)}
                                                        >
                                                            {level ? <Icon name={LEVEL_ICON[level]} /> : <span aria-hidden>+</span>}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : null}
            </StateBlock>

            {popover ? (
                <div ref={popRef} className="fm-mx-pop" style={{ left: popover.x, top: popover.y }} role="dialog" aria-label={popover.userName}>
                    <header className="fm-mx-pop__head">
                        <span className="fm-mx-pop__avatar" aria-hidden>{initialsOf(popover.userName)}</span>
                        <span className="fm-mx-pop__who">
                            <strong>{popover.userName}</strong>
                            <small title={matterLabel(popover.matter)}>{matterLabel(popover.matter)}</small>
                        </span>
                        <button type="button" className="fm-mx-pop__close" aria-label={tr('common.close')} onClick={() => setPopover(null)}>
                            <Icon name="close" />
                        </button>
                    </header>
                    <p className={`fm-mx-pop__now is-${popover.level ?? 'none'}`}>
                        <span>{tr('matrix.current')}</span>
                        <strong>{popover.level ? tr(`levels.${popover.level}`) : tr('levels.none')}</strong>
                        {popover.level ? <em>{popover.explicit ? tr('matrix.explicit') : tr('matrix.inherited')}</em> : null}
                    </p>
                    <div className="fm-mx-pop__levels" role="radiogroup" aria-label={tr('security.addLevel')}>
                        {LEVELS.map((level, index) => {
                            const on = popover.level === level;
                            return (
                                <button key={level} type="button" role="radio" aria-checked={on}
                                    className={`fm-mx-pop__level is-${level}${on ? ' is-on' : ''}`}
                                    onClick={async () => {
                                        const current = popover;
                                        if (on && current.explicit && !popNote && !popUntil) {
                                            setPopover(null);
                                            return;
                                        }
                                        setPopover(null);
                                        await apply(current.matter.id, current.userId, current.userName, level, popNote, endOfDay(popUntil));
                                    }}>
                                    <span className="fm-mx-pop__ico"><Icon name={LEVEL_ICON[level]} /></span>
                                    <span className="fm-mx-pop__text">
                                        <strong>{tr(`securityX.level.${level}`)}</strong>
                                        <small>{tr(`securityX.levelHint.${level}`)}</small>
                                    </span>
                                    {on ? <Icon name="check" className="fm-mx-pop__check" /> : <kbd aria-hidden>{index + 1}</kbd>}
                                </button>
                            );
                        })}
                    </div>
                    <button type="button" className="fm-mx-pop__more" aria-expanded={popMore} onClick={() => setPopMore((open) => !open)}>
                        <Icon name="clock" />{tr('matrixX.more')}
                        <Icon name="chevron" className={popMore ? 'is-open' : undefined} />
                    </button>
                    {popMore ? (
                        <div className="fm-mx-pop__extra">
                            <label>
                                <span>{tr('securityX.untilOptional')}</span>
                                <input type="date" value={popUntil} min={todayPlus(0)} onChange={(event) => setPopUntil(event.target.value)} />
                            </label>
                            <label>
                                <span>{tr('matrix.note')}</span>
                                <input value={popNote} maxLength={500} placeholder={tr('security.notePh')} onChange={(event) => setPopNote(event.target.value)} />
                            </label>
                            <small>{tr('matrixX.moreHint')}</small>
                        </div>
                    ) : null}
                    <footer>
                        {popover.explicit ? (
                            <button type="button" className="fm-mx-pop__link is-danger" onClick={async () => {
                                const current = popover;
                                setPopover(null);
                                await remove(current.matter.id, current.userId);
                            }}>{tr('matrixX.reset')}</button>
                        ) : <span className="fm-mx-pop__hint">{tr('matrixX.shortcut')}</span>}
                        <button type="button" className="fm-mx-pop__link" onClick={() => {
                            const id = popover.matter.id;
                            setPopover(null);
                            onOpenSecurity(id);
                        }}>{tr('matrixX.openMatter')} →</button>
                    </footer>
                </div>
            ) : null}

            {grantOpen && data ? (
                <Modal
                    title={tr('matrixX.grantTitle', { client: data.client.name })}
                    className="fm-sx-modal"
                    onClose={closeGrant}
                    footer={(
                        <>
                            <p className="fm-sx-modal__hint">{grantLevel === 'deny' ? tr('security.wallNote') : tr('matrix.editHint')}</p>
                            <button type="button" className="fm-btn" onClick={closeGrant}>{tr('common.cancel')}</button>
                            <button type="submit" form="fm-mx-grant-form" className="fm-btn fm-btn--primary" disabled={!grantUser || !grantMatter}>
                                <Icon name="check" />{tr('matrix.grant')}
                            </button>
                        </>
                    )}
                >
                    <form id="fm-mx-grant-form" className="fm-sx-grant" onSubmit={async (event) => {
                        event.preventDefault();
                        const user = activeUsers.find((row) => String(row.id) === grantUser);
                        const matter = data.matters.find((row) => row.id === grantMatter);
                        if (!user || !matter)
                            return;
                        if (await apply(matter.id, user.id, nameOf(user.id), grantLevel, grantNote))
                            closeGrant();
                    }}>
                        <div className="fm-sx-grant__row">
                            <div className="fm-field">
                                <span>{tr('security.addUser')}</span>
                                <SearchableSelect<TimeTrackingUserRow>
                                    value={grantUser}
                                    items={activeUsers}
                                    portalDropdown
                                    portalZIndex={2100}
                                    getOptionValue={(user) => String(user.id)}
                                    getOptionLabel={(user) => nameOf(user.id)}
                                    getSearchText={(user) => `${nameOf(user.id)} ${user.email} ${user.position ?? ''}`}
                                    onSelect={(user) => setGrantUser(String(user.id))}
                                    placeholder={tr('security.searchUser')}
                                />
                            </div>
                            <div className="fm-field">
                                <span>{tr('matrix.pickMatter')}</span>
                                <SearchableSelect<Matter>
                                    value={grantMatter}
                                    items={data.matters}
                                    portalDropdown
                                    portalZIndex={2100}
                                    getOptionValue={(matter) => matter.id}
                                    getOptionLabel={matterLabel}
                                    getSearchText={(matter) => `${matter.code} ${matter.name}`}
                                    onSelect={(matter) => setGrantMatter(matter.id)}
                                    placeholder={tr('matrix.pickMatter')}
                                />
                            </div>
                        </div>
                        <div className="fm-field">
                            <span>{tr('security.addLevel')}</span>
                            <div className="fm-sx-levels fm-sx-levels--grid" role="radiogroup" aria-label={tr('security.addLevel')}>
                                {LEVELS.map((level) => (
                                    <button key={level} type="button" role="radio" aria-checked={grantLevel === level}
                                        className={`is-${level}${grantLevel === level ? ' is-on' : ''}`} onClick={() => setGrantLevel(level)}>
                                        <Icon name={LEVEL_ICON[level]} />
                                        <span>
                                            <strong>{tr(`securityX.level.${level}`)}</strong>
                                            <small>{tr(`securityX.levelHint.${level}`)}</small>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <label className="fm-field">
                            <span>{tr('matrix.note')}</span>
                            <input value={grantNote} maxLength={500} placeholder={tr('security.notePh')} onChange={(event) => setGrantNote(event.target.value)} />
                        </label>
                    </form>
                </Modal>
            ) : null}
        </section>
    );
}
