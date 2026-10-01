import { useEffect, useMemo, useState } from 'react';
import { getUsers, type User } from '@entities/user';

function personName(user: User): string {
    return (user.display_name || user.email || '').trim();
}

export function AccountingHrPanel() {
    const [people, setPeople] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [role, setRole] = useState('');

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

    const roles = useMemo(() => {
        const names = new Set(people.map((user) => user.role).filter(Boolean));
        return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
    }, [people]);

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return people.filter((user) => {
            if (role && user.role !== role)
                return false;
            if (!q)
                return true;
            return [personName(user), user.email, user.position, user.role]
                .some((part) => String(part ?? '').toLowerCase().includes(q));
        });
    }, [people, query, role]);

    return (
        <section className="acct-hr" aria-label="HR">
            <div className="acct-hr__bar">
                <input
                    type="search"
                    className="acct-hr__search"
                    placeholder="Имя, почта или должность"
                    aria-label="Поиск сотрудника"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <select className="acct-hr__select" aria-label="Роль" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="">Все роли</option>
                    {roles.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <span className="acct-hr__count">{shown.length} из {people.length}</span>
            </div>
            {error ? <p className="acct-settings__error" role="alert">{error}</p> : null}
            {loading ? <p className="acct-settings__muted">Загрузка сотрудников…</p> : null}
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
                                <th>Роль</th>
                                <th>Почта</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map((user) => (
                                <tr key={user.id}>
                                    <td>{personName(user)}</td>
                                    <td>{user.position || '—'}</td>
                                    <td>{user.role || '—'}</td>
                                    <td>{user.email}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
