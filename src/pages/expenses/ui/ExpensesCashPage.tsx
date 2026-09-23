import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { fetchCashState, postCashAction, type CashMovement, type CashState } from '@entities/expenses/model/cashApi';
import { ExpensesShell } from './ExpensesShell';
import './ExpensesPage.css';
import './ExpensesCashPage.css';

type FormKind = 'balance' | 'expense' | 'topup';
type HistoryFilter = 'all' | 'topup' | 'expense' | 'set';

const KIND_LABEL: Record<CashMovement['kind'], string> = {
    set: 'Остаток задан',
    expense: 'Расход',
    topup: 'Пополнение',
};

function moneyNumber(raw: string | null | undefined): number | null {
    if (raw == null || raw === '')
        return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

function formatCash(raw: string | null | undefined, withCurrency = true): string {
    const n = moneyNumber(raw ?? null);
    if (n == null)
        return '—';
    const text = n.toLocaleString('ru-RU', {
        minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        maximumFractionDigits: 2,
    });
    return withCurrency ? `${text} UZS` : text;
}

function dayKey(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return iso;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatClock(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '';
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function friendlyLoadError(message: string): string {
    if (message.includes('Заявка не найдена') || message.includes('HTTP 404'))
        return 'Касса ещё не подключена на сервере. Нужно обновить сервис расходов.';
    return message;
}

function IconWallet() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <rect x="3" y="6" width="18" height="14" rx="3" />
            <path d="M3 10h18" />
            <circle cx="16.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
        </svg>
    );
}

function IconMinus() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="12" cy="12" r="8" />
            <path d="M8 12h8" strokeLinecap="round" />
        </svg>
    );
}

function IconPlus() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 8v8M8 12h8" strokeLinecap="round" />
        </svg>
    );
}

export function ExpensesCashPage() {
    const { user, loading } = useCurrentUser();
    const allowed = isPartnerOrgRole(user?.role, user?.position);
    const [state, setState] = useState<CashState | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState<FormKind | null>(null);
    const [filter, setFilter] = useState<HistoryFilter>('all');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [flash, setFlash] = useState<string | null>(null);

    const reload = useCallback(async () => {
        const next = await fetchCashState();
        setState(next);
        setLoadError(null);
    }, []);

    useEffect(() => {
        if (!allowed)
            return;
        let cancelled = false;
        void fetchCashState()
            .then((next) => {
                if (!cancelled)
                    setState(next);
            })
            .catch((err: unknown) => {
                if (!cancelled)
                    setLoadError(friendlyLoadError(err instanceof Error ? err.message : 'Не удалось загрузить кассу'));
            });
        return () => {
            cancelled = true;
        };
    }, [allowed]);

    const stats = useMemo(() => {
        const rows = state?.history ?? [];
        let spent = 0;
        let topped = 0;
        for (const row of rows) {
            const n = moneyNumber(row.amount) ?? 0;
            if (row.kind === 'expense')
                spent += n;
            if (row.kind === 'topup')
                topped += n;
        }
        return { spent, topped, count: rows.length };
    }, [state]);

    const groups = useMemo(() => {
        const rows = (state?.history ?? []).filter((row) => filter === 'all' || row.kind === filter);
        const map = new Map<string, CashMovement[]>();
        for (const row of rows) {
            const key = dayKey(row.createdAt);
            const list = map.get(key) ?? [];
            list.push(row);
            map.set(key, list);
        }
        return [...map.entries()];
    }, [state, filter]);

    if (loading)
        return (
            <ExpensesShell title="Касса">
                <div className="exp-cash exp-cash--loading" aria-busy="true">
                    <div className="exp-cash__hero exp-cash__skel" />
                    <div className="exp-cash__stats">
                        <div className="exp-cash__stat exp-cash__skel" />
                        <div className="exp-cash__stat exp-cash__skel" />
                        <div className="exp-cash__stat exp-cash__skel" />
                    </div>
                </div>
            </ExpensesShell>
        );
    if (!allowed)
        return <Navigate to={routes.expenses} replace />;

    const openForm = (kind: FormKind) => {
        setForm((current) => (current === kind ? null : kind));
        setFormError(null);
        setAmount('');
        setNote('');
    };

    const submit = async () => {
        if (!form)
            return;
        setBusy(true);
        setFormError(null);
        try {
            const result = await postCashAction(form, amount.trim(), note.trim());
            setFlash(result.message);
            setAmount('');
            setNote('');
            setForm(null);
            await reload();
        }
        catch (err: unknown) {
            setFormError(err instanceof Error ? err.message : 'Не удалось сохранить операцию');
        }
        finally {
            setBusy(false);
        }
    };

    const formCopy = form === 'balance'
        ? { title: 'Задать остаток', hint: 'Эта сумма станет текущим остатком кассы.', submit: 'Установить' }
        : form === 'expense'
            ? { title: 'Списать расход', hint: 'Сумма вычтется из остатка. Напишите, на что потратили.', submit: 'Списать' }
            : { title: 'Пополнить кассу', hint: 'Сумма прибавится к остатку. Комментарий необязателен.', submit: 'Пополнить' };

    const filters: { id: HistoryFilter; label: string }[] = [
        { id: 'all', label: 'Все' },
        { id: 'topup', label: 'Пополнения' },
        { id: 'expense', label: 'Расходы' },
        { id: 'set', label: 'Остаток' },
    ];

    return (
        <ExpensesShell title="Касса">
            <div className="exp-cash">
                <div className="exp-header-queue-wrap">
                    <NavLink to={routes.expenses} className="exp-queue-nav">Расходы компании</NavLink>
                    <NavLink to={routes.expensesPartners} className="exp-queue-nav">Расходы партнёров</NavLink>
                </div>

                {loadError && <p className="exp-cash__banner exp-cash__banner--error" role="alert">{loadError}</p>}

                <section className="exp-cash__hero">
                    <div>
                        <p className="exp-cash__eyebrow">Остаток в кассе</p>
                        <p className="exp-cash__balance">{state ? formatCash(state.balance) : '…'}</p>
                        <p className="exp-cash__hint">
                            {state && !state.balanceSet
                                ? 'Остаток ещё не задан. Укажите, сколько сейчас в кассе.'
                                : 'Общая касса компании. Её видят только партнёры.'}
                        </p>
                    </div>
                    <div className="exp-cash__hero-mark" aria-hidden><IconWallet /></div>
                </section>

                <div className="exp-cash__stats">
                    <article className="exp-cash__stat">
                        <span className="exp-cash__stat-label">Пополнено</span>
                        <strong className="exp-cash__stat-value exp-cash__stat-value--in">{formatCash(String(stats.topped))}</strong>
                    </article>
                    <article className="exp-cash__stat">
                        <span className="exp-cash__stat-label">Потрачено</span>
                        <strong className="exp-cash__stat-value exp-cash__stat-value--out">{formatCash(String(stats.spent))}</strong>
                    </article>
                    <article className="exp-cash__stat">
                        <span className="exp-cash__stat-label">Операций</span>
                        <strong className="exp-cash__stat-value">{stats.count}</strong>
                    </article>
                </div>

                <div className="exp-cash__actions" role="tablist" aria-label="Операции кассы">
                    <button type="button" className={`exp-cash__action${form === 'balance' ? ' exp-cash__action--on' : ''}`} onClick={() => openForm('balance')}>
                        <span className="exp-cash__action-icon"><IconWallet /></span>
                        <span>Обновить остаток</span>
                    </button>
                    <button type="button" className={`exp-cash__action${form === 'expense' ? ' exp-cash__action--on' : ''}`} onClick={() => openForm('expense')} disabled={!state?.balanceSet}>
                        <span className="exp-cash__action-icon exp-cash__action-icon--out"><IconMinus /></span>
                        <span>Внести расход</span>
                    </button>
                    <button type="button" className={`exp-cash__action${form === 'topup' ? ' exp-cash__action--on' : ''}`} onClick={() => openForm('topup')} disabled={!state?.balanceSet}>
                        <span className="exp-cash__action-icon exp-cash__action-icon--in"><IconPlus /></span>
                        <span>Пополнить</span>
                    </button>
                </div>

                {form && (
                    <form className="exp-cash__form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
                        <div>
                            <h2 className="exp-cash__form-title">{formCopy.title}</h2>
                            <p className="exp-cash__form-hint">{formCopy.hint}</p>
                        </div>
                        <label className="exp-cash__field">
                            <span>Сумма, UZS</span>
                            <input
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={form === 'balance' ? '298 000' : '50 000'}
                                required
                                autoFocus
                            />
                        </label>
                        {form !== 'balance' && (
                            <label className="exp-cash__field">
                                <span>{form === 'expense' ? 'На что потрачено' : 'Комментарий'}</span>
                                <input
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder={form === 'expense' ? 'Канцелярия' : 'Необязательно'}
                                />
                            </label>
                        )}
                        {formError && <p className="exp-cash__banner exp-cash__banner--error" role="alert">{formError}</p>}
                        <div className="exp-cash__form-row">
                            <button type="submit" className="tt-settings__btn tt-settings__btn--primary" disabled={busy}>
                                {busy ? 'Сохранение…' : formCopy.submit}
                            </button>
                            <button type="button" className="tt-settings__btn tt-settings__btn--outline" onClick={() => setForm(null)} disabled={busy}>
                                Отмена
                            </button>
                        </div>
                    </form>
                )}

                {flash && <p className="exp-cash__banner">{flash}</p>}

                <section className="exp-cash__ledger">
                    <div className="exp-cash__ledger-head">
                        <h2>История</h2>
                        <div className="exp-cash__filters" role="tablist" aria-label="Фильтр истории">
                            {filters.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={filter === item.id}
                                    className={`exp-cash__filter${filter === item.id ? ' exp-cash__filter--on' : ''}`}
                                    onClick={() => setFilter(item.id)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {groups.length === 0 ? (
                        <p className="exp-cash__empty">
                            {filter === 'all' ? 'Операций пока нет. Задайте остаток, чтобы начать.' : 'В этом разделе пока пусто.'}
                        </p>
                    ) : groups.map(([day, rows]) => (
                        <div key={day} className="exp-cash__day">
                            <h3>{day}</h3>
                            <ol className="exp-cash__timeline">
                                {rows.map((row) => (
                                    <li key={row.id} className={`exp-cash__event exp-cash__event--${row.kind}`}>
                                        <span className="exp-cash__dot" aria-hidden />
                                        <div className="exp-cash__event-body">
                                            <div className="exp-cash__event-top">
                                                <strong>{KIND_LABEL[row.kind]}</strong>
                                                <time dateTime={row.createdAt}>{formatClock(row.createdAt)}</time>
                                            </div>
                                            {row.note ? <p className="exp-cash__event-note">{row.note}</p> : null}
                                            <p className="exp-cash__event-after">После операции: {formatCash(row.balanceAfter)}</p>
                                        </div>
                                        <span className={`exp-cash__event-sum exp-cash__event-sum--${row.kind}`}>
                                            {row.kind === 'expense' ? '−' : row.kind === 'topup' ? '+' : ''}
                                            {formatCash(row.amount, false)}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    ))}
                </section>
            </div>
        </ExpensesShell>
    );
}
