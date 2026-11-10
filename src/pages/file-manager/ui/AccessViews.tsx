import { useMemo, useState } from 'react';
import { listTimeTrackingUsers, type TimeTrackingUserRow } from '@entities/time-tracking';
import { SearchableSelect } from '@shared/ui';
import { filesApi, type AccessRequest, type AclLevel, type ClientsResponse, type MatterRow, type RequestableMatter } from '../api/filesApi';
import { formatDateTime } from '../lib/filesFormat';
import { Icon, LevelBadge, Modal, StateBlock, useAction, useFm, useLoad } from './fmShared';

const ACL_LEVELS: AclLevel[] = ['read', 'edit', 'manage', 'deny'];

type MatterOption = MatterRow & { clientName: string };

function matterOptions(clients: ClientsResponse, predicate: (matter: MatterRow) => boolean): MatterOption[] {
    return clients.clients.flatMap((client) => client.matters
        .filter(predicate)
        .map((matter) => ({ ...matter, clientName: client.name })));
}

function matterLabel(matter: { code: string; name: string }): string {
    return matter.code ? `${matter.code} · ${matter.name}` : matter.name;
}

export function RequestAccessModal({ requestable, onClose, onSent }: {
    requestable: readonly RequestableMatter[];
    onClose: () => void;
    onSent: () => void;
}) {
    const { tr } = useFm();
    const act = useAction();
    const [matterId, setMatterId] = useState('');
    const [level, setLevel] = useState<'read' | 'edit'>('read');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    return (
        <Modal title={tr('requests.newTitle')} onClose={onClose} footer={(
            <>
                <button type="button" className="fm-btn" onClick={onClose}>{tr('common.cancel')}</button>
                <button type="button" className="fm-btn fm-btn--primary" disabled={!matterId || busy} onClick={async () => {
                    setBusy(true);
                    const result = await act(() => filesApi.createRequest({ matterId, level, reason }), tr('requests.sent'));
                    setBusy(false);
                    if (result) {
                        onSent();
                        onClose();
                    }
                }}>{tr('requests.send')}</button>
            </>
        )}>
            {requestable.length === 0 ? <p className="fm-modal__text">{tr('requests.nothingToRequest')}</p> : (
                <>
                    <div className="fm-field">
                        <span>{tr('requests.matter')}</span>
                        <SearchableSelect<RequestableMatter>
                            value={matterId}
                            items={requestable}
                            portalDropdown
                            portalZIndex={2100}
                            getOptionValue={(item) => item.matterId}
                            getOptionLabel={(item) => matterLabel({ code: item.matterCode, name: item.matterName })}
                            getSearchText={(item) => `${item.clientName} ${item.matterCode} ${item.matterName}`}
                            getGroupLabel={(item) => item.clientName}
                            onSelect={(item) => setMatterId(item.matterId)}
                            placeholder={tr('requests.pickMatter')}
                        />
                    </div>
                    <div className="fm-field">
                        <span>{tr('requests.level')}</span>
                        <div className="fm-seg" role="radiogroup">
                            {(['read', 'edit'] as const).map((id) => (
                                <button key={id} type="button" role="radio" aria-checked={level === id} className={level === id ? 'is-on' : ''} onClick={() => setLevel(id)}>
                                    {tr(`levels.${id}`)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className="fm-field">
                        <span>{tr('requests.reason')}</span>
                        <textarea rows={3} maxLength={2000} value={reason} placeholder={tr('requests.reasonPh')} onChange={(event) => setReason(event.target.value)} />
                    </label>
                </>
            )}
        </Modal>
    );
}

function RequestStatus({ request }: { request: AccessRequest }) {
    const { tr } = useFm();
    return <span className={`fm-status fm-status--${request.status}`}>{tr(`requests.${request.status}`)}</span>;
}

export function RequestsView({ canManage, onChanged }: { canManage: boolean; onChanged: () => void }) {
    const { tr, locale } = useFm();
    const act = useAction();
    const [status, setStatus] = useState<'pending' | 'all'>(canManage ? 'pending' : 'all');
    const [grant, setGrant] = useState<Record<string, string>>({});
    const load = useLoad(() => filesApi.requests(status), [status]);
    const rows = load.data?.requests ?? [];

    const decide = async (request: AccessRequest, approve: boolean) => {
        const result = await act(() => filesApi.decideRequest(request.id, approve, grant[request.id] ?? request.level),
            tr(approve ? 'requests.approved' : 'requests.rejected'));
        if (result) {
            load.reload();
            onChanged();
        }
    };

    return (
        <section className="fm-docs fm-docs--padded">
            {canManage ? (
                <div className="fm-toolbar">
                    <div className="fm-seg" role="radiogroup">
                        {(['pending', 'all'] as const).map((id) => (
                            <button key={id} type="button" role="radio" aria-checked={status === id} className={status === id ? 'is-on' : ''} onClick={() => setStatus(id)}>
                                {tr(id === 'pending' ? 'requests.filterPending' : 'requests.filterAll')}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            <StateBlock loading={load.loading && !load.data} error={load.error} onRetry={load.reload}
                empty={load.data && rows.length === 0 ? <><Icon name="inbox" /><p>{tr('requests.empty')}</p></> : undefined}>
                <ul className="fm-requests">
                    {rows.map((request) => (
                        <li key={request.id}>
                            <div className="fm-requests__main">
                                <div className="fm-requests__who">
                                    <Icon name="user" />
                                    <strong>{request.userName}</strong>
                                    <span className="fm-muted">→</span>
                                    <span>{request.clientName} · {request.matterName}</span>
                                </div>
                                <p className="fm-muted">
                                    {tr('requests.requested')}: <LevelBadge level={request.level} /> · {formatDateTime(request.createdAt, locale)}
                                    {request.decidedBy ? ` · ${tr('requests.decidedBy', { name: request.decidedBy })}` : ''}
                                </p>
                                {request.reason ? <blockquote>{request.reason}</blockquote> : null}
                            </div>
                            <div className="fm-requests__side">
                                <RequestStatus request={request} />
                                {canManage && request.status === 'pending' ? (
                                    <div className="fm-requests__actions">
                                        <select value={grant[request.id] ?? request.level} onChange={(event) => setGrant({ ...grant, [request.id]: event.target.value })}>
                                            {(['read', 'edit', 'manage'] as const).map((level) => <option key={level} value={level}>{tr(`levels.${level}`)}</option>)}
                                        </select>
                                        <button type="button" className="fm-btn fm-btn--primary" onClick={() => decide(request, true)}><Icon name="check" />{tr('requests.approve')}</button>
                                        <button type="button" className="fm-btn" onClick={() => decide(request, false)}><Icon name="x" />{tr('requests.reject')}</button>
                                    </div>
                                ) : null}
                            </div>
                        </li>
                    ))}
                </ul>
            </StateBlock>
        </section>
    );
}

function userName(user: TimeTrackingUserRow): string {
    return (user.display_name ?? '').trim() || user.email;
}

export function SecurityView({ clients, matterId, onPickMatter }: {
    clients: ClientsResponse;
    matterId: string | null;
    onPickMatter: (matterId: string) => void;
}) {
    const { tr, locale } = useFm();
    const act = useAction();
    const options = useMemo(() => matterOptions(clients, (matter) => matter.level === 'manage'), [clients]);
    const security = useLoad(matterId ? () => filesApi.security(matterId) : null, [matterId]);
    const users = useLoad(() => listTimeTrackingUsers(), []);
    const [addUser, setAddUser] = useState('');
    const [addLevel, setAddLevel] = useState<AclLevel>('read');
    const [note, setNote] = useState('');

    const activeUsers = useMemo(() => (users.data ?? []).filter((user) => !user.is_blocked && !user.is_archived), [users.data]);
    const data = security.data && security.data.matter.id === matterId ? security.data : null;
    const aclByUser = new Map((data?.acl ?? []).map((row) => [row.userId, row]));

    const setLevel = async (userId: number, name: string, level: AclLevel, comment = '') => {
        if (!matterId)
            return false;
        const ok = await act(() => filesApi.setAcl(matterId, { userId, userName: name, level, note: comment }), tr('security.changed'));
        if (ok)
            security.reload();
        return Boolean(ok);
    };

    return (
        <section className="fm-docs fm-docs--padded">
            <div className="fm-toolbar">
                <div className="fm-field fm-field--inline">
                    <span>{tr('security.pickMatter')}</span>
                    <SearchableSelect<MatterOption>
                        value={matterId ?? ''}
                        items={options}
                        getOptionValue={(item) => item.id}
                        getOptionLabel={(item) => matterLabel(item)}
                        getSearchText={(item) => `${item.clientName} ${item.code} ${item.name}`}
                        getGroupLabel={(item) => item.clientName}
                        onSelect={(item) => onPickMatter(item.id)}
                        placeholder={tr('security.pickMatter')}
                    />
                </div>
            </div>
            <div className="fm-notes">
                <p><Icon name="key" />{tr('security.managersNote')}</p>
                <p><Icon name="shield" />{tr('security.wallNote')}</p>
            </div>
            {!matterId ? null : (
                <StateBlock loading={security.loading && !data} error={security.error} onRetry={security.reload}>
                    {data ? (
                        <>
                            <h3 className="fm-section-title">{data.matter.clientName} · {matterLabel(data.matter)}</h3>
                            <form className="fm-grant" onSubmit={async (event) => {
                                event.preventDefault();
                                const user = activeUsers.find((row) => String(row.id) === addUser);
                                if (!user)
                                    return;
                                if (await setLevel(user.id, userName(user), addLevel, note)) {
                                    setAddUser('');
                                    setNote('');
                                }
                            }}>
                                <div className="fm-field">
                                    <span>{tr('security.addUser')}</span>
                                    <SearchableSelect<TimeTrackingUserRow>
                                        value={addUser}
                                        items={activeUsers}
                                        getOptionValue={(user) => String(user.id)}
                                        getOptionLabel={userName}
                                        getSearchText={(user) => `${userName(user)} ${user.email} ${user.position ?? ''}`}
                                        onSelect={(user) => setAddUser(String(user.id))}
                                        placeholder={tr('security.searchUser')}
                                    />
                                </div>
                                <label className="fm-field">
                                    <span>{tr('security.addLevel')}</span>
                                    <select value={addLevel} onChange={(event) => setAddLevel(event.target.value as AclLevel)}>
                                        {ACL_LEVELS.map((level) => <option key={level} value={level}>{tr(`levels.${level}`)}</option>)}
                                    </select>
                                </label>
                                <label className="fm-field fm-field--grow">
                                    <span>{tr('security.note')}</span>
                                    <input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
                                </label>
                                <button type="submit" className="fm-btn fm-btn--primary" disabled={!addUser}><Icon name="plus" />{tr('security.add')}</button>
                            </form>
                            {data.effective.length === 0 ? <div className="fm-state">{tr('security.empty')}</div> : (
                                <div className="fm-table-wrap">
                                    <table className="fm-table">
                                        <thead>
                                            <tr>
                                                <th>{tr('common.user')}</th>
                                                <th>{tr('security.effective')}</th>
                                                <th>{tr('security.addLevel')}</th>
                                                <th>{tr('security.note')}</th>
                                                <th />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.effective.map((member) => {
                                                const rule = aclByUser.get(member.userId);
                                                return (
                                                    <tr key={member.userId} className={member.level === 'deny' ? 'is-denied' : undefined}>
                                                        <td>
                                                            <span className="fm-table__matter">
                                                                <span>{member.name}</span>
                                                                {member.position ? <small>{member.position}</small> : null}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={`fm-source fm-source--${member.source}`}>
                                                                {tr(member.source === 'timeTracking' ? 'security.inherited' : member.source === 'acl' ? 'security.explicit' : 'security.both')}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <select className={`fm-level-select fm-level--${member.level}`} value={member.level}
                                                                onChange={(event) => void setLevel(member.userId, member.name, event.target.value as AclLevel, rule?.note ?? '')}>
                                                                {ACL_LEVELS.map((level) => <option key={level} value={level}>{tr(`levels.${level}`)}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="fm-muted">
                                                            {rule ? `${rule.note ? `${rule.note} · ` : ''}${rule.grantedBy} · ${formatDateTime(rule.grantedAt, locale)}` : '—'}
                                                        </td>
                                                        <td className="fm-table__actions">
                                                            {rule ? (
                                                                <button type="button" className="fm-btn" onClick={async () => {
                                                                    const ok = await act(() => filesApi.removeAcl(data.matter.id, member.userId), tr('security.changed'));
                                                                    if (ok)
                                                                        security.reload();
                                                                }}>{tr('security.remove')}</button>
                                                            ) : null}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    ) : null}
                </StateBlock>
            )}
        </section>
    );
}

export function MatrixView({ clients }: { clients: ClientsResponse }) {
    const { tr } = useFm();
    const act = useAction();
    const [clientId, setClientId] = useState(clients.clients[0]?.id ?? '');
    const matrix = useLoad(clientId ? () => filesApi.matrix(clientId) : null, [clientId]);
    const usersCatalog = useLoad(() => listTimeTrackingUsers(), []);
    const [cell, setCell] = useState<{
        userId: number;
        userName: string;
        matterId: string;
        matterName: string;
        level: AclLevel | null;
        explicit: boolean;
    } | null>(null);
    const [cellNote, setCellNote] = useState('');
    const [userQuery, setUserQuery] = useState('');
    const [hideClosed, setHideClosed] = useState(true);
    const [onlyExplicit, setOnlyExplicit] = useState(false);
    const [grantUser, setGrantUser] = useState('');
    const [grantMatter, setGrantMatter] = useState('');
    const [grantLevel, setGrantLevel] = useState<AclLevel>('edit');
    const [grantNote, setGrantNote] = useState('');

    const data = matrix.data && matrix.data.client.id === clientId ? matrix.data : null;
    const explicit = useMemo(() => new Set(data?.explicit ?? []), [data]);
    const activeUsers = useMemo(
        () => (usersCatalog.data ?? []).filter((user) => !user.is_blocked && !user.is_archived),
        [usersCatalog.data],
    );

    const visibleMatters = useMemo(() => {
        if (!data)
            return [];
        return hideClosed ? data.matters.filter((matter) => !matter.closed) : data.matters;
    }, [data, hideClosed]);

    const visibleUsers = useMemo(() => {
        if (!data)
            return [];
        const q = userQuery.trim().toLowerCase();
        return data.users.filter((user) => {
            if (q) {
                const hay = `${user.name} ${user.position}`.toLowerCase();
                if (!hay.includes(q))
                    return false;
            }
            if (onlyExplicit) {
                return visibleMatters.some((matter) => explicit.has(`${user.userId}:${matter.id}`));
            }
            return true;
        });
    }, [data, userQuery, onlyExplicit, visibleMatters, explicit]);

    const cellTitle = (level: AclLevel | null, isExplicit: boolean) => {
        const levelLabel = level ? tr(`levels.${level}`) : tr('levels.none');
        const source = level
            ? (isExplicit ? tr('matrix.explicit') : tr('matrix.inherited'))
            : tr('matrix.legendNone');
        return `${levelLabel} · ${source}`;
    };

    const applyLevel = async (matterId: string, userId: number, name: string, level: AclLevel, note = '') => {
        const ok = await act(
            () => filesApi.setAcl(matterId, { userId, userName: name, level, note }),
            tr('security.changed'),
        );
        if (ok)
            matrix.reload();
        return Boolean(ok);
    };

    return (
        <section className="fm-docs fm-docs--padded">
            <div className="fm-toolbar fm-toolbar--filters fm-matrix-toolbar">
                <div className="fm-field fm-field--inline">
                    <span>{tr('matrix.pickClient')}</span>
                    <SearchableSelect
                        value={clientId}
                        items={clients.clients}
                        getOptionValue={(client) => client.id}
                        getOptionLabel={(client) => client.name}
                        getSearchText={(client) => client.name}
                        onSelect={(client) => {
                            setClientId(client.id);
                            setGrantMatter('');
                            setCell(null);
                        }}
                        placeholder={tr('matrix.pickClient')}
                    />
                </div>
                <label className="fm-search">
                    <Icon name="search" />
                    <input
                        value={userQuery}
                        onChange={(event) => setUserQuery(event.target.value)}
                        placeholder={tr('matrix.searchUser')}
                        aria-label={tr('matrix.searchUser')}
                    />
                </label>
                <label className="fm-check">
                    <input type="checkbox" checked={hideClosed} onChange={(event) => setHideClosed(event.target.checked)} />
                    {tr('matrix.hideClosed')}
                </label>
                <label className="fm-check">
                    <input type="checkbox" checked={onlyExplicit} onChange={(event) => setOnlyExplicit(event.target.checked)} />
                    {tr('matrix.onlyExplicit')}
                </label>
            </div>

            <ul className="fm-matrix-legend" aria-label={tr('matrix.title')}>
                {ACL_LEVELS.map((level) => (
                    <li key={level}>
                        <span className={`fm-cell fm-level--${level}`}>{tr(`matrix.abbr.${level}`)}</span>
                        <span>{tr(`levels.${level}`)}</span>
                    </li>
                ))}
                <li>
                    <span className="fm-cell fm-cell--none">{tr('matrix.abbr.none')}</span>
                    <span>{tr('matrix.legendNone')}</span>
                </li>
                <li className="fm-matrix-legend__explicit">
                    <span className="fm-cell fm-level--edit is-explicit">{tr('matrix.abbr.edit')}</span>
                    <span>{tr('matrix.explicit')}</span>
                </li>
            </ul>

            <p className="fm-hint">{tr('matrix.hint')}</p>

            {data ? (
                <form
                    className="fm-grant"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        const user = activeUsers.find((row) => String(row.id) === grantUser);
                        const matter = data.matters.find((row) => row.id === grantMatter);
                        if (!user || !matter)
                            return;
                        if (await applyLevel(matter.id, user.id, userName(user), grantLevel, grantNote)) {
                            setGrantUser('');
                            setGrantNote('');
                        }
                    }}
                >
                    <div className="fm-field">
                        <span>{tr('security.addUser')}</span>
                        <SearchableSelect<TimeTrackingUserRow>
                            value={grantUser}
                            items={activeUsers}
                            getOptionValue={(user) => String(user.id)}
                            getOptionLabel={userName}
                            getSearchText={(user) => `${userName(user)} ${user.email} ${user.position ?? ''}`}
                            onSelect={(user) => setGrantUser(String(user.id))}
                            placeholder={tr('security.searchUser')}
                        />
                    </div>
                    <div className="fm-field">
                        <span>{tr('matrix.pickMatter')}</span>
                        <SearchableSelect
                            value={grantMatter}
                            items={data.matters}
                            getOptionValue={(matter) => matter.id}
                            getOptionLabel={(matter) => matterLabel(matter)}
                            getSearchText={(matter) => `${matter.code} ${matter.name}`}
                            onSelect={(matter) => setGrantMatter(matter.id)}
                            placeholder={tr('matrix.pickMatter')}
                        />
                    </div>
                    <label className="fm-field">
                        <span>{tr('security.addLevel')}</span>
                        <select value={grantLevel} onChange={(event) => setGrantLevel(event.target.value as AclLevel)}>
                            {ACL_LEVELS.map((level) => (
                                <option key={level} value={level}>{tr(`levels.${level}`)}</option>
                            ))}
                        </select>
                    </label>
                    <label className="fm-field fm-field--grow">
                        <span>{tr('matrix.note')}</span>
                        <input value={grantNote} maxLength={500} onChange={(event) => setGrantNote(event.target.value)} />
                    </label>
                    <button type="submit" className="fm-btn fm-btn--primary" disabled={!grantUser || !grantMatter}>
                        <Icon name="plus" />{tr('matrix.grant')}
                    </button>
                </form>
            ) : null}

            <StateBlock
                loading={matrix.loading && !data}
                error={matrix.error}
                onRetry={matrix.reload}
                empty={data && data.users.length === 0 ? tr('matrix.empty') : undefined}
            >
                {data ? (
                    visibleUsers.length === 0 || visibleMatters.length === 0 ? (
                        <div className="fm-state">{tr('matrix.noFilterMatches')}</div>
                    ) : (
                        <div className="fm-table-wrap fm-matrix-wrap">
                            <table className="fm-matrix">
                                <thead>
                                    <tr>
                                        <th>{tr('common.user')}</th>
                                        {visibleMatters.map((matter) => (
                                            <th key={matter.id} title={matter.name} className={matter.closed ? 'is-closed' : undefined}>
                                                <span>{matterLabel(matter)}</span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleUsers.map((user) => (
                                        <tr key={user.userId}>
                                            <th>
                                                <span>{user.name}</span>
                                                {user.position ? <small>{user.position}</small> : null}
                                            </th>
                                            {visibleMatters.map((matter) => {
                                                const key = `${user.userId}:${matter.id}`;
                                                const level = data.cells[key] ?? null;
                                                const isExplicit = explicit.has(key);
                                                return (
                                                    <td key={matter.id}>
                                                        <button
                                                            type="button"
                                                            className={[
                                                                'fm-cell',
                                                                level ? `fm-level--${level}` : 'fm-cell--none',
                                                                isExplicit ? 'is-explicit' : '',
                                                            ].filter(Boolean).join(' ')}
                                                            title={cellTitle(level, isExplicit)}
                                                            onClick={() => {
                                                                setCellNote('');
                                                                setCell({
                                                                    userId: user.userId,
                                                                    userName: user.name,
                                                                    matterId: matter.id,
                                                                    matterName: matterLabel(matter),
                                                                    level,
                                                                    explicit: isExplicit,
                                                                });
                                                            }}
                                                        >
                                                            {level ? tr(`matrix.abbr.${level}`) : tr('matrix.abbr.none')}
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

            {cell ? (
                <Modal title={`${cell.userName} · ${cell.matterName}`} onClose={() => setCell(null)}>
                    <p className="fm-matrix-cell-meta">
                        <strong>{tr('matrix.current')}:</strong>{' '}
                        {cell.level ? tr(`levels.${cell.level}`) : tr('levels.none')}
                        {' · '}
                        {cell.level
                            ? (cell.explicit ? tr('matrix.explicit') : tr('matrix.inherited'))
                            : tr('matrix.legendNone')}
                    </p>
                    <p className="fm-hint">{tr('matrix.editHint')}</p>
                    <div className="fm-level-pick">
                        {ACL_LEVELS.map((level) => (
                            <button
                                key={level}
                                type="button"
                                className={cell.level === level && cell.explicit
                                    ? `fm-level-pick__btn is-on fm-level--${level}`
                                    : `fm-level-pick__btn fm-level--${level}`}
                                onClick={async () => {
                                    if (await applyLevel(cell.matterId, cell.userId, cell.userName, level, cellNote))
                                        setCell(null);
                                }}
                            >
                                <span className="fm-level-pick__abbr">{tr(`matrix.abbr.${level}`)}</span>
                                {tr(`levels.${level}`)}
                            </button>
                        ))}
                    </div>
                    <label className="fm-field">
                        <span>{tr('matrix.note')}</span>
                        <input
                            value={cellNote}
                            maxLength={500}
                            onChange={(event) => setCellNote(event.target.value)}
                            placeholder={tr('matrix.note')}
                        />
                    </label>
                    {cell.explicit ? (
                        <button
                            type="button"
                            className="fm-btn"
                            onClick={async () => {
                                const ok = await act(
                                    () => filesApi.removeAcl(cell.matterId, cell.userId),
                                    tr('security.changed'),
                                );
                                if (ok) {
                                    setCell(null);
                                    matrix.reload();
                                }
                            }}
                        >
                            {tr('security.remove')}
                        </button>
                    ) : null}
                </Modal>
            ) : null}
        </section>
    );
}
