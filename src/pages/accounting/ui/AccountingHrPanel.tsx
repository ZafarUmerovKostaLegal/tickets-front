import { useEffect, useMemo, useState } from 'react';
import { getUsers, type User } from '@entities/user';
import { fetchInternalExtensions, type InternalExtension } from '@entities/internal-communication';
import { getItems, type InventoryItem } from '@entities/inventory';
import {
    fetchVacationLeaveRequestPdfBlob,
    fetchVacationManualEntryDocumentBlob,
    listVacationAbsenceDays,
    listVacationLeaveRequests,
    listVacationManualEntries,
    listVacationScheduleEmployees,
    type VacationAbsenceDayApi,
    type VacationLeaveRequestApi,
    type VacationManualEntryApi,
    type VacationScheduleEmployeeApi,
} from '@entities/vacation';
import { routes } from '@shared/config';
import { NavLink } from 'react-router-dom';
import './AccountingHrPanel.css';

type DrawerTab = 'profile' | 'documents' | 'equipment' | 'leave';
type SortKey = 'name' | 'position' | 'newest';

function personName(user: User): string {
    return (user.display_name || user.email || '').trim();
}

function initials(user: User): string {
    const source = (user.initials || personName(user) || '?').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2)
        return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return source.slice(0, 2).toUpperCase();
}

function formatDate(iso: string | null | undefined): string {
    if (!iso)
        return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '—';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function normalizeName(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchExtension(user: User, extensions: InternalExtension[]): InternalExtension | null {
    const name = normalizeName(personName(user));
    if (!name)
        return null;
    const exact = extensions.find((row) => normalizeName(row.fullName) === name);
    if (exact)
        return exact;
    return extensions.find((row) => {
        const n = normalizeName(row.fullName);
        return n.includes(name) || name.includes(n);
    }) ?? null;
}

function roleTone(role: string): 'partner' | 'admin' | 'staff' {
    const r = role.trim().toLowerCase();
    if (r.includes('партн') || r.includes('partner'))
        return 'partner';
    if (r.includes('админ') || r.includes('admin'))
        return 'admin';
    return 'staff';
}

function PersonPhoto({ user, size }: { user: User; size: 'card' | 'hero' | 'sm' }) {
    const picture = user.picture?.trim();
    return (
        <span className={`acct-hr__photo acct-hr__photo--${size}${picture ? '' : ' acct-hr__photo--fallback'}`}>
            {picture
                ? <img src={picture} alt="" loading="lazy" />
                : <span aria-hidden>{initials(user)}</span>}
        </span>
    );
}

const DOSSIER_SLOTS = [
    { id: 'contract', title: 'Трудовой договор', hint: 'Основной договор и допсоглашения' },
    { id: 'id', title: 'Документ, удостоверяющий личность', hint: 'Паспорт / ID — сканы для кадрового дела' },
    { id: 'education', title: 'Образование', hint: 'Дипломы и сертификаты' },
    { id: 'medical', title: 'Медицинские справки', hint: 'При необходимости по должности' },
] as const;

type ProfileExtras = {
    loading: boolean;
    extension: string | null;
    equipment: InventoryItem[];
    leaveRequests: VacationLeaveRequestApi[];
    absences: VacationAbsenceDayApi[];
    manualEntries: VacationManualEntryApi[];
    scheduleEmployee: VacationScheduleEmployeeApi | null;
    error: string;
};

const EMPTY_EXTRAS: ProfileExtras = {
    loading: false,
    extension: null,
    equipment: [],
    leaveRequests: [],
    absences: [],
    manualEntries: [],
    scheduleEmployee: null,
    error: '',
};

export function AccountingHrPanel() {
    const year = new Date().getFullYear();
    const [people, setPeople] = useState<User[]>([]);
    const [extensions, setExtensions] = useState<InternalExtension[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [position, setPosition] = useState('');
    const [access, setAccess] = useState('');
    const [sort, setSort] = useState<SortKey>('name');
    const [selected, setSelected] = useState<User | null>(null);
    const [tab, setTab] = useState<DrawerTab>('profile');
    const [extras, setExtras] = useState<ProfileExtras>(EMPTY_EXTRAS);
    const [docBusyId, setDocBusyId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        void Promise.allSettled([
            getUsers(false),
            fetchInternalExtensions().catch(() => [] as InternalExtension[]),
        ]).then(([usersResult, extResult]) => {
            if (cancelled)
                return;
            if (usersResult.status === 'fulfilled') {
                setPeople(usersResult.value.filter((user) => !user.is_archived && !user.is_blocked));
                setError('');
            }
            else {
                setError(usersResult.reason instanceof Error
                    ? usersResult.reason.message
                    : 'Не удалось загрузить сотрудников');
            }
            if (extResult.status === 'fulfilled')
                setExtensions(extResult.value);
        }).finally(() => {
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

    useEffect(() => {
        if (!selected) {
            setExtras(EMPTY_EXTRAS);
            setTab('profile');
            return undefined;
        }
        let cancelled = false;
        const userId = selected.id;
        setExtras({ ...EMPTY_EXTRAS, loading: true, extension: matchExtension(selected, extensions)?.extension ?? null });
        void (async () => {
            try {
                const [equipPage, leaveAll, schedule] = await Promise.all([
                    getItems({ assigned_to_user_id: userId, limit: 100 }).catch(() => ({ items: [] as InventoryItem[] })),
                    listVacationLeaveRequests({ scope: 'all', status: 'any' }).catch(() => [] as VacationLeaveRequestApi[]),
                    listVacationScheduleEmployees(year).catch(() => [] as VacationScheduleEmployeeApi[]),
                ]);
                if (cancelled)
                    return;
                const scheduleEmployee = schedule.find((row) => row.auth_user_id === userId) ?? null;
                const leaveRequests = leaveAll.filter((row) => row.employee_user_id === userId);
                let absences: VacationAbsenceDayApi[] = [];
                let manualEntries: VacationManualEntryApi[] = [];
                if (scheduleEmployee) {
                    const [abs, manuals] = await Promise.all([
                        listVacationAbsenceDays(year, { employeeId: scheduleEmployee.id }).catch(() => [] as VacationAbsenceDayApi[]),
                        listVacationManualEntries({ year, employeeId: scheduleEmployee.id }).catch(() => [] as VacationManualEntryApi[]),
                    ]);
                    if (cancelled)
                        return;
                    absences = abs;
                    manualEntries = manuals;
                }
                setExtras({
                    loading: false,
                    extension: matchExtension(selected, extensions)?.extension ?? null,
                    equipment: equipPage.items ?? [],
                    leaveRequests,
                    absences,
                    manualEntries,
                    scheduleEmployee,
                    error: '',
                });
            }
            catch (e: unknown) {
                if (cancelled)
                    return;
                setExtras({
                    ...EMPTY_EXTRAS,
                    loading: false,
                    extension: matchExtension(selected, extensions)?.extension ?? null,
                    error: e instanceof Error ? e.message : 'Не удалось загрузить карточку сотрудника',
                });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selected, extensions, year]);

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
        const filtered = people.filter((user) => {
            if (position && (user.position || '').trim() !== position)
                return false;
            if (access && user.role !== access)
                return false;
            if (!q)
                return true;
            return [personName(user), user.email, user.position, user.role]
                .some((part) => String(part ?? '').toLowerCase().includes(q));
        });
        const sorted = [...filtered];
        sorted.sort((a, b) => {
            if (sort === 'newest')
                return String(b.created_at).localeCompare(String(a.created_at));
            if (sort === 'position')
                return (a.position || '').localeCompare(b.position || '', 'ru') || personName(a).localeCompare(personName(b), 'ru');
            return personName(a).localeCompare(personName(b), 'ru');
        });
        return sorted;
    }, [people, query, position, access, sort]);

    const stats = useMemo(() => {
        const withPhoto = people.filter((u) => Boolean(u.picture?.trim())).length;
        const partners = people.filter((u) => roleTone(u.role) === 'partner').length;
        return {
            total: people.length,
            withPhoto,
            partners,
            positions: positions.length,
        };
    }, [people, positions.length]);

    const openPdf = async (requestId: number) => {
        setDocBusyId(`leave-${requestId}`);
        try {
            const blob = await fetchVacationLeaveRequestPdfBlob(requestId);
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank', 'noopener,noreferrer');
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
        catch {
            /* ignore open failures */
        }
        finally {
            setDocBusyId(null);
        }
    };

    const openManualDoc = async (entryId: number, docId: number) => {
        setDocBusyId(`manual-${entryId}-${docId}`);
        try {
            const blob = await fetchVacationManualEntryDocumentBlob(entryId, docId);
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank', 'noopener,noreferrer');
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
        catch {
            /* ignore */
        }
        finally {
            setDocBusyId(null);
        }
    };

    const docCount = extras.leaveRequests.length
        + extras.manualEntries.reduce((sum, entry) => sum + (entry.documents?.length ?? 0), 0);

    return (
        <section className="acct-hr" aria-label="HR">
            <header className="acct-hr__intro">
                <div>
                    <p className="acct-hr__eyebrow">Кадровый сервис</p>
                    <h2 className="acct-hr__title">Команда Kosta Legal</h2>
                    <p className="acct-hr__lead">
                        Карточки сотрудников с фото, контактами, кадровыми документами, оборудованием и отпусками.
                    </p>
                </div>
                <NavLink to={routes.vacationSchedule} className="acct-hr__ext-link">
                    График отпусков →
                </NavLink>
            </header>

            <div className="acct-hr__kpis" aria-label="Сводка по команде">
                <article className="acct-hr__kpi">
                    <span className="acct-hr__kpi-value">{stats.total}</span>
                    <span className="acct-hr__kpi-label">сотрудников</span>
                </article>
                <article className="acct-hr__kpi">
                    <span className="acct-hr__kpi-value">{stats.withPhoto}</span>
                    <span className="acct-hr__kpi-label">с фото</span>
                </article>
                <article className="acct-hr__kpi">
                    <span className="acct-hr__kpi-value">{stats.partners}</span>
                    <span className="acct-hr__kpi-label">партнёров</span>
                </article>
                <article className="acct-hr__kpi">
                    <span className="acct-hr__kpi-value">{stats.positions}</span>
                    <span className="acct-hr__kpi-label">должностей</span>
                </article>
            </div>

            <div className="acct-hr__toolbar">
                <input
                    type="search"
                    className="acct-hr__search"
                    placeholder="Поиск: имя, почта, должность…"
                    aria-label="Поиск сотрудника"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <label className="acct-hr__field">
                    <span className="acct-hr__field-label">Должность</span>
                    <select className="acct-hr__select" value={position} onChange={(e) => setPosition(e.target.value)} aria-label="Фильтр по должности">
                        <option value="">Все</option>
                        {positions.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                </label>
                <label className="acct-hr__field">
                    <span className="acct-hr__field-label">Доступ</span>
                    <select className="acct-hr__select" value={access} onChange={(e) => setAccess(e.target.value)} aria-label="Фильтр по доступу">
                        <option value="">Все</option>
                        {accessRoles.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                </label>
                <label className="acct-hr__field">
                    <span className="acct-hr__field-label">Сортировка</span>
                    <select className="acct-hr__select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Сортировка">
                        <option value="name">По имени</option>
                        <option value="position">По должности</option>
                        <option value="newest">Сначала новые</option>
                    </select>
                </label>
                <span className="acct-hr__count">{shown.length} из {people.length}</span>
            </div>

            {error ? <p className="acct-hr__error" role="alert">{error}</p> : null}

            {loading ? (
                <div className="acct-hr__grid" aria-busy="true" aria-label="Загрузка сотрудников">
                    {Array.from({ length: 8 }, (_, i) => <div key={i} className="acct-hr__skel-card" />)}
                </div>
            ) : null}

            {!loading && !error && shown.length === 0 ? (
                <p className="acct-hr__empty">
                    {people.length === 0 ? 'В каталоге нет действующих сотрудников.' : 'Никого не нашлось по этому запросу.'}
                </p>
            ) : null}

            {!loading && shown.length > 0 && (
                <ul className="acct-hr__grid" role="list">
                    {shown.map((user) => {
                        const tone = roleTone(user.role);
                        return (
                            <li key={user.id}>
                                <button type="button" className="acct-hr__card" onClick={() => setSelected(user)}>
                                    <PersonPhoto user={user} size="card" />
                                    <span className="acct-hr__card-body">
                                        <span className="acct-hr__card-name">{personName(user)}</span>
                                        <span className="acct-hr__card-position">{user.position || 'Должность не указана'}</span>
                                        <span className="acct-hr__card-email">{user.email}</span>
                                        <span className={`acct-hr__badge acct-hr__badge--${tone}`}>{user.role || 'Сотрудник'}</span>
                                    </span>
                                    <span className="acct-hr__card-cta">Открыть профиль →</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {selected && (
                <>
                    <button type="button" className="acct-hr__backdrop" aria-label="Закрыть карточку" onClick={() => setSelected(null)} />
                    <aside className="acct-hr__drawer" role="dialog" aria-modal="true" aria-labelledby="acct-hr-drawer-title">
                        <div className="acct-hr__drawer-hero">
                            <PersonPhoto user={selected} size="hero" />
                            <div className="acct-hr__drawer-hero-text">
                                <h2 id="acct-hr-drawer-title" className="acct-hr__drawer-name">{personName(selected)}</h2>
                                <p className="acct-hr__drawer-position">{selected.position || 'Должность не указана'}</p>
                                <span className={`acct-hr__badge acct-hr__badge--${roleTone(selected.role)}`}>{selected.role || 'Сотрудник'}</span>
                            </div>
                            <button type="button" className="acct-hr__drawer-close" onClick={() => setSelected(null)} aria-label="Закрыть">
                                ×
                            </button>
                        </div>

                        <nav className="acct-hr__tabs" aria-label="Разделы карточки">
                            {([
                                ['profile', 'Профиль'],
                                ['documents', `Документы${docCount ? ` (${docCount})` : ''}`],
                                ['equipment', `Оборудование${extras.equipment.length ? ` (${extras.equipment.length})` : ''}`],
                                ['leave', 'Отпуска'],
                            ] as const).map(([id, label]) => (
                                <button
                                    key={id}
                                    type="button"
                                    className={`acct-hr__tab${tab === id ? ' acct-hr__tab--on' : ''}`}
                                    aria-selected={tab === id}
                                    onClick={() => setTab(id)}
                                >
                                    {label}
                                </button>
                            ))}
                        </nav>

                        <div className="acct-hr__drawer-body">
                            {extras.loading ? <p className="acct-hr__muted">Загрузка данных сотрудника…</p> : null}
                            {extras.error ? <p className="acct-hr__error" role="alert">{extras.error}</p> : null}

                            {!extras.loading && tab === 'profile' && (
                                <dl className="acct-hr__facts">
                                    <div>
                                        <dt>Корпоративная почта</dt>
                                        <dd><a href={`mailto:${selected.email}`}>{selected.email}</a></dd>
                                    </div>
                                    <div>
                                        <dt>Внутренний номер</dt>
                                        <dd>{extras.extension ? `доб. ${extras.extension}` : 'Не найден в справочнике АТС'}</dd>
                                    </div>
                                    <div>
                                        <dt>Должность</dt>
                                        <dd>{selected.position || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt>Доступ к системе</dt>
                                        <dd>{selected.role || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt>Роль в учёте времени</dt>
                                        <dd>
                                            {selected.time_tracking_role === 'manager'
                                                ? 'Менеджер'
                                                : selected.time_tracking_role === 'user'
                                                    ? 'Сотрудник'
                                                    : '—'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Недельная ёмкость</dt>
                                        <dd>
                                            {selected.weekly_capacity_hours != null && Number.isFinite(Number(selected.weekly_capacity_hours))
                                                ? `${selected.weekly_capacity_hours} ч`
                                                : '—'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>В системе с</dt>
                                        <dd>{formatDate(selected.created_at)}</dd>
                                    </div>
                                    <div>
                                        <dt>Обновлён</dt>
                                        <dd>{formatDate(selected.updated_at)}</dd>
                                    </div>
                                </dl>
                            )}

                            {!extras.loading && tab === 'documents' && (
                                <div className="acct-hr__docs">
                                    <p className="acct-hr__muted">
                                        Живые файлы из заявок на отпуск и оснований отсутствий. Шаблоны кадрового досье —
                                        структура под полноценный HR-архив (загрузка личного дела подключится отдельным API).
                                    </p>
                                    <h3 className="acct-hr__block-title">Кадровое досье</h3>
                                    <ul className="acct-hr__doc-slots">
                                        {DOSSIER_SLOTS.map((slot) => (
                                            <li key={slot.id} className="acct-hr__doc-slot">
                                                <div>
                                                    <strong>{slot.title}</strong>
                                                    <span>{slot.hint}</span>
                                                </div>
                                                <em>Нет файла</em>
                                            </li>
                                        ))}
                                    </ul>

                                    <h3 className="acct-hr__block-title">Заявления на отпуск</h3>
                                    {extras.leaveRequests.length === 0 ? (
                                        <p className="acct-hr__muted">Заявок пока нет.</p>
                                    ) : (
                                        <ul className="acct-hr__doc-list">
                                            {extras.leaveRequests.map((req) => (
                                                <li key={req.id} className="acct-hr__doc-row">
                                                    <div>
                                                        <strong>{req.kind} · {req.days_count} дн.</strong>
                                                        <span>{req.date_from} — {req.date_to} · {req.status}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="acct-hr__doc-btn"
                                                        disabled={docBusyId === `leave-${req.id}`}
                                                        onClick={() => void openPdf(req.id)}
                                                    >
                                                        PDF
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    <h3 className="acct-hr__block-title">Документы оснований (ручные записи)</h3>
                                    {extras.manualEntries.every((e) => !(e.documents?.length)) ? (
                                        <p className="acct-hr__muted">Прикреплённых файлов нет.</p>
                                    ) : (
                                        <ul className="acct-hr__doc-list">
                                            {extras.manualEntries.flatMap((entry) =>
                                                (entry.documents ?? []).map((doc) => (
                                                    <li key={`${entry.id}-${doc.id}`} className="acct-hr__doc-row">
                                                        <div>
                                                            <strong>{doc.original_filename || `Документ #${doc.id}`}</strong>
                                                            <span>Запись #{entry.id}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="acct-hr__doc-btn"
                                                            disabled={docBusyId === `manual-${entry.id}-${doc.id}`}
                                                            onClick={() => void openManualDoc(entry.id, doc.id)}
                                                        >
                                                            Открыть
                                                        </button>
                                                    </li>
                                                )))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {!extras.loading && tab === 'equipment' && (
                                extras.equipment.length === 0 ? (
                                    <p className="acct-hr__muted">За этим сотрудником нет закреплённого оборудования.</p>
                                ) : (
                                    <ul className="acct-hr__equip-list">
                                        {extras.equipment.map((item) => (
                                            <li key={item.id} className="acct-hr__equip-row">
                                                <strong>{item.name}</strong>
                                                <span>
                                                    {item.inventory_number}
                                                    {item.serial_number ? ` · S/N ${item.serial_number}` : ''}
                                                    {' · '}
                                                    {item.status}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )
                            )}

                            {!extras.loading && tab === 'leave' && (
                                <div className="acct-hr__leave">
                                    {!extras.scheduleEmployee ? (
                                        <p className="acct-hr__muted">
                                            Сотрудник не найден в графике отпусков {year}. Добавьте его в разделе «График отпусков».
                                        </p>
                                    ) : (
                                        <>
                                            <p className="acct-hr__muted">
                                                График {year}
                                                {extras.scheduleEmployee.planned_period_note
                                                    ? ` · ${extras.scheduleEmployee.planned_period_note}`
                                                    : ''}
                                            </p>
                                            {extras.absences.length === 0 ? (
                                                <p className="acct-hr__muted">Отмеченных отсутствий за год пока нет.</p>
                                            ) : (
                                                <ul className="acct-hr__leave-list">
                                                    {extras.absences
                                                        .slice()
                                                        .sort((a, b) => String(a.absence_on).localeCompare(String(b.absence_on)))
                                                        .map((day) => (
                                                            <li key={`${day.employee_id}-${day.absence_on}-${day.kind_code}`} className="acct-hr__leave-row">
                                                                <strong>{day.absence_on}</strong>
                                                                <span>{day.kind || `Код ${day.kind_code}`}</span>
                                                            </li>
                                                        ))}
                                                </ul>
                                            )}
                                        </>
                                    )}
                                    <NavLink to={routes.vacationSchedule} className="acct-hr__ext-link acct-hr__ext-link--inline">
                                        Открыть график отпусков →
                                    </NavLink>
                                </div>
                            )}
                        </div>
                    </aside>
                </>
            )}
        </section>
    );
}
