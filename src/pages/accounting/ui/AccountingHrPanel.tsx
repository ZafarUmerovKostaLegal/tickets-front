import { useEffect, useMemo, useState } from 'react';
import { getUsers, type User } from '@entities/user';

function personName(user: User): string {
    return (user.display_name || user.email || '').trim();
}

function initials(user: User): string {
    const source = (user.initials || personName(user) || '?').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2)
        return (parts[0][0] + parts[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
}

function PersonPhoto({ user, size }: { user: User; size: 'sm' | 'lg' }) {
    const picture = user.picture?.trim();
    return (
        <span className={`acct-hr__photo acct-hr__photo--${size}`}>
            {picture
                ? <img src={picture} alt="" />
                : <span aria-hidden>{initials(user)}</span>}
        </span>
    );
}

export function AccountingHrPanel() {
    const [people, setPeople] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [position, setPosition] = useState('');
    const [access, setAccess] = useState('');
    const [selected, setSelected] = useState<User | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        void getUsers(false)
            .then((rows) => {
                if (!cancelled)
                    setPeople(rows.filter((user) => !user.is_archived && !user.is_blocked));
            })
            .catch((e: unknown) => {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Не удалось загрузить сотрудников');
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!selected)
            return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                setSelected(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selected]);

    const positions = useMemo(() => {
        const names = new Set(people.map((user) => user.position?.trim()).filter((name): name is string => Boolean(name)));
        return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
    }, [people]);

    const accessRoles = useMemo(() => {
        const names = new Set(people.map((user) => user.role?.trim()).filter((name): name is string => Boolean(name)));
        return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
    }, [people]);

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return people.filter((user) => {
            if (position && (user.position || '').trim() !== position)
                return false;
            if (access && user.role !== access)
                return false;
            if (!q)
                return true;
            return [personName(user), user.email, user.position]
                .some((part) => String(part ?? '').toLowerCase().includes(q));
        });
    }, [people, query, position, access]);

    return (
        <section className="acct-hr" aria-label="HR">
            <div className="acct-hr__filters">
                <input
                    type="search"
                    className="acct-hr__search"
                    placeholder="Имя, почта или должность"
                    aria-label="Поиск сотрудника"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <span className="acct-hr__count">{shown.length} из {people.length}</span>
                <div className="acct-hr__chips" role="group" aria-label="Должность">
                    <button type="button" className={`acct-hr__chip${!position ? ' acct-hr__chip--on' : ''}`} onClick={() => setPosition('')}>
                        Все должности
                    </button>
                    {positions.map((name) => (
                        <button
                            key={name}
                            type="button"
                            className={`acct-hr__chip${position === name ? ' acct-hr__chip--on' : ''}`}
                            onClick={() => setPosition(position === name ? '' : name)}
                        >
                            {name}
                        </button>
                    ))}
                </div>
                {accessRoles.length > 0 && (
                    <div className="acct-hr__access" role="group" aria-label="Доступ к системе">
                        <span className="acct-hr__access-label">Доступ</span>
                        <button type="button" className={`acct-hr__chip acct-hr__chip--quiet${!access ? ' acct-hr__chip--on' : ''}`} onClick={() => setAccess('')}>
                            Все
                        </button>
                        {accessRoles.map((name) => (
                            <button
                                key={name}
                                type="button"
                                className={`acct-hr__chip acct-hr__chip--quiet${access === name ? ' acct-hr__chip--on' : ''}`}
                                onClick={() => setAccess(access === name ? '' : name)}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {error ? <p className="acct-settings__error" role="alert">{error}</p> : null}
            {loading ? (
                <div className="acct-hr__table-wrap" aria-busy="true" aria-label="Загрузка сотрудников">
                    <div className="acct-skel acct-skel--row" />
                    <div className="acct-skel acct-skel--row" />
                    <div className="acct-skel acct-skel--row" />
                    <div className="acct-skel acct-skel--row" />
                    <div className="acct-skel acct-skel--row" />
                    <div className="acct-skel acct-skel--row" />
                </div>
            ) : null}
            {!loading && !error && shown.length === 0 ? (
                <p className="acct-settings__muted">
                    {people.length === 0 ? 'В каталоге нет действующих сотрудников.' : 'Никого не нашлось по этому запросу.'}
                </p>
            ) : null}
            {!loading && shown.length > 0 && (
                <div className="acct-hr__table-wrap">
                    <table className="acct-hr__table">
                        <thead>
                            <tr>
                                <th>Сотрудник</th>
                                <th>Должность</th>
                                <th>Почта</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map((user) => (
                                <tr key={user.id}>
                                    <td>
                                        <button type="button" className="acct-hr__person" onClick={() => setSelected(user)}>
                                            <PersonPhoto user={user} size="sm" />
                                            <span>{personName(user)}</span>
                                        </button>
                                    </td>
                                    <td>{user.position || '—'}</td>
                                    <td>{user.email}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {selected && (
                <>
                    <button type="button" className="acct-hr__backdrop" aria-label="Закрыть карточку" onClick={() => setSelected(null)} />
                    <aside className="acct-hr__drawer" role="dialog" aria-modal="true" aria-labelledby="acct-hr-drawer-title">
                        <div className="acct-hr__drawer-head">
                            <PersonPhoto user={selected} size="lg" />
                            <div>
                                <h2 id="acct-hr-drawer-title" className="acct-hr__drawer-name">{personName(selected)}</h2>
                                <p className="acct-hr__drawer-position">{selected.position || 'Должность не указана'}</p>
                            </div>
                            <button type="button" className="acct-hr__drawer-close" onClick={() => setSelected(null)} aria-label="Закрыть">
                                ×
                            </button>
                        </div>
                        <dl className="acct-hr__facts">
                            <div>
                                <dt>Почта</dt>
                                <dd>{selected.email}</dd>
                            </div>
                            <div>
                                <dt>Доступ к системе</dt>
                                <dd>{selected.role || '—'}</dd>
                            </div>
                        </dl>
                    </aside>
                </>
            )}
        </section>
    );
}
