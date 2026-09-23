import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { fetchCashState, postCashAction, type CashMovement, type CashState } from '@entities/expenses/model/cashApi';
import { ExpensesShell } from './ExpensesShell';
import './ExpensesPage.css';
import './ExpensesCashPage.css';

type FormKind = 'balance' | 'expense' | 'topup';

const KIND_LABEL: Record<CashMovement['kind'], string> = {
    set: 'Остаток',
    expense: 'Расход',
    topup: 'Пополнение',
};

function formatCash(raw: string | null): string {
    if (raw == null || raw === '')
        return '—';
    const n = Number(raw);
    if (!Number.isFinite(n))
        return raw;
    return `${n.toLocaleString('ru-RU', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })} UZS`;
}

function formatWhen(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return iso;
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ExpensesCashPage() {
    const { user, loading } = useCurrentUser();
    const allowed = isPartnerOrgRole(user?.role, user?.position);
    const [state, setState] = useState<CashState | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState<FormKind | null>(null);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

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
                    setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить кассу');
            });
        return () => {
            cancelled = true;
        };
    }, [allowed]);

    if (loading)
        return <ExpensesShell title="Касса"><p className="exp-cash__empty">Загрузка…</p></ExpensesShell>;
    if (!allowed)
        return <Navigate to={routes.expenses} replace />;

    const submit = async () => {
        if (!form)
            return;
        setBusy(true);
        setFormError(null);
        try {
            const result = await postCashAction(form, amount.trim(), note.trim());
            setMessage(result.message);
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

    const formTitle = form === 'balance'
        ? 'Новый остаток'
        : form === 'expense'
            ? 'Расход из кассы'
            : 'Пополнение кассы';

    return (
        <ExpensesShell title="Касса">
            <div className="exp-header-queue-wrap" style={{ marginBottom: '0.85rem' }}>
                <NavLink to={routes.expenses} className="exp-queue-nav">Расходы компании</NavLink>
                <NavLink to={routes.expensesPartners} className="exp-queue-nav">Расходы партнёров</NavLink>
            </div>
            {loadError && <p className="exp-cash__error" role="alert">{loadError}</p>}
            <section className="exp-cash">
                <div className="exp-cash__balance">
                    <div>
                        <p className="exp-cash__balance-label">Остаток</p>
                        <p className="exp-cash__balance-value">{state ? formatCash(state.balance) : '…'}</p>
                        {state && !state.balanceSet && (
                            <p className="exp-cash__balance-hint">Остаток ещё не задан. Нажмите «Обновить остаток».</p>
                        )}
                    </div>
                    <div className="exp-cash__actions">
                        <button type="button" className="tt-settings__btn tt-settings__btn--outline" onClick={() => { setForm('balance'); setFormError(null); }}>
                            Обновить остаток
                        </button>
                        <button type="button" className="tt-settings__btn tt-settings__btn--outline" onClick={() => { setForm('expense'); setFormError(null); }} disabled={!state?.balanceSet}>
                            Внести расход
                        </button>
                        <button type="button" className="tt-settings__btn tt-settings__btn--primary" onClick={() => { setForm('topup'); setFormError(null); }} disabled={!state?.balanceSet}>
                            Пополнить
                        </button>
                    </div>
                </div>

                {form && (
                    <form className="exp-cash__form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
                        <h2 className="exp-cash__form-title">{formTitle}</h2>
                        <div className="exp-cash__fields">
                            <input
                                className="exp-cash__input"
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={form === 'balance' ? '298000' : '50000'}
                                aria-label="Сумма"
                                required
                            />
                            {form !== 'balance' && (
                                <input
                                    className="exp-cash__input"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder={form === 'expense' ? 'На что потрачено' : 'Комментарий'}
                                    aria-label="Комментарий"
                                />
                            )}
                        </div>
                        {formError && <p className="exp-cash__error" role="alert">{formError}</p>}
                        <div className="exp-cash__form-row">
                            <button type="submit" className="tt-settings__btn tt-settings__btn--primary" disabled={busy}>
                                {busy ? 'Сохранение…' : 'Сохранить'}
                            </button>
                            <button type="button" className="tt-settings__btn tt-settings__btn--outline" onClick={() => setForm(null)} disabled={busy}>
                                Отмена
                            </button>
                        </div>
                    </form>
                )}

                {message && <p className="exp-cash__message">{message}</p>}

                <section className="exp-cash__history">
                    <h2 className="exp-cash__history-title">История</h2>
                    {!state || state.history.length === 0 ? (
                        <p className="exp-cash__empty">Операций пока нет.</p>
                    ) : (
                        <ul className="exp-cash__list">
                            {state.history.map((row) => (
                                <li key={row.id} className="exp-cash__item">
                                    <span className="exp-cash__when">{formatWhen(row.createdAt)}</span>
                                    <div>
                                        <div className="exp-cash__kind">{KIND_LABEL[row.kind]}</div>
                                        {row.note ? <p className="exp-cash__note">{row.note}</p> : null}
                                    </div>
                                    <span className={`exp-cash__amount exp-cash__amount--${row.kind === 'expense' ? 'out' : row.kind === 'topup' ? 'in' : 'set'}`}>
                                        {row.kind === 'expense' ? '−' : row.kind === 'topup' ? '+' : ''}
                                        {formatCash(row.amount)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </section>
        </ExpensesShell>
    );
}
