import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { deleteCashAttachment, deleteCashMovement, fetchCashState, isManualCashMovement, openCashAttachment, postCashAction, updateCashMovement, uploadCashAttachment, type CashMovement, type CashState } from '@entities/expenses/model/cashApi';
import { showToast } from '@shared/ui/app-toast';
import { ExpensesShell } from './ExpensesShell';
import './ExpensesPage.css';
import './ExpensesCashPage.css';

type FormKind = 'balance' | 'expense' | 'topup';
type HistoryFilter = 'all' | 'topup' | 'expense' | 'set';

const FILE_ACCEPT = 'image/*,application/pdf,video/*,audio/*';

function CashFileDrop({
    files,
    disabled,
    onFiles,
}: {
    files: File[];
    disabled?: boolean;
    onFiles: (files: File[]) => void;
}) {
    const [over, setOver] = useState(false);
    return (
        <label
            className={`exp-cash__drop${over ? ' exp-cash__drop--over' : ''}`}
            onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                    setOver(false);
            }}
            onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                if (!disabled)
                    onFiles([...(e.dataTransfer.files ?? [])]);
            }}
        >
            <input
                type="file"
                multiple
                accept={FILE_ACCEPT}
                disabled={disabled}
                onChange={(e) => {
                    onFiles([...(e.target.files ?? [])]);
                    e.target.value = '';
                }}
            />
            <strong>{over ? 'Отпустите, чтобы вложить' : 'Перетащите файлы сюда'}</strong>
            <span>или нажмите и выберите скрин, скан, фото, видео или аудио</span>
            {files.length > 0 ? (
                <ul>
                    {files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}
                </ul>
            ) : null}
        </label>
    );
}

function RowFileDrop({ onFiles }: { onFiles: (files: File[]) => void }) {
    const [over, setOver] = useState(false);
    return (
        <label
            className={`exp-cash__file-add${over ? ' exp-cash__file-add--over' : ''}`}
            onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                    setOver(false);
            }}
            onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                const picked = [...(e.dataTransfer.files ?? [])];
                if (picked.length > 0)
                    onFiles(picked);
            }}
        >
            {over ? 'Отпустите файлы' : 'Вложить файл или перетащите сюда'}
            <input
                type="file"
                multiple
                accept={FILE_ACCEPT}
                onChange={(e) => {
                    const picked = [...(e.target.files ?? [])];
                    e.target.value = '';
                    if (picked.length > 0)
                        onFiles(picked);
                }}
            />
        </label>
    );
}

const KIND_LABEL: Record<CashMovement['kind'], string> = {
    set: 'Остаток установлен',
    expense: 'Потрачено',
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

function movementNotice(row: CashMovement): string {
    const amount = formatCash(row.amount);
    const after = formatCash(row.balanceAfter);
    const before = row.balanceBefore ? formatCash(row.balanceBefore) : null;
    const note = row.note.trim();
    if (row.kind === 'set') {
        return [
            before ? `Остаток в кассе: ${before}` : null,
            `Остаток установлен: ${amount}`,
            '',
            `Остаток на текущий момент: ${after}`,
        ].filter((line): line is string => line !== null).join('\n');
    }
    const label = row.kind === 'expense' ? 'Потрачено' : 'Пополнение';
    const middle = note ? `${label}: ${amount} (${note})` : `${label}: ${amount}`;
    return [
        `Остаток в кассе: ${before ?? '—'}`,
        middle,
        '',
        `Остаток на текущий момент: ${after}`,
    ].join('\n');
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

function IconPencil() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
        </svg>
    );
}

function IconTrash() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 7h16" />
            <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            <path d="M7 7l1 13h8l1-13" />
            <path d="M10 11v6M14 11v6" />
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
    const [editing, setEditing] = useState<CashMovement | null>(null);
    const [deleting, setDeleting] = useState<CashMovement | null>(null);
    const [filter, setFilter] = useState<HistoryFilter>('all');
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [searchHits, setSearchHits] = useState<CashMovement[] | null>(null);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [formError, setFormError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        const next = await fetchCashState();
        setState(next);
        setLoadError(null);
        if (debouncedQuery) {
            const found = await fetchCashState(debouncedQuery);
            setSearchHits(found.history);
        }
    }, [debouncedQuery]);

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

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
        return () => window.clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        if (!allowed)
            return;
        if (!debouncedQuery) {
            setSearchHits(null);
            return;
        }
        let cancelled = false;
        void fetchCashState(debouncedQuery)
            .then((next) => {
                if (!cancelled)
                    setSearchHits(next.history);
            })
            .catch(() => {
                if (!cancelled)
                    setSearchHits([]);
            });
        return () => {
            cancelled = true;
        };
    }, [allowed, debouncedQuery]);

    const dialogOpen = form !== null || editing !== null || deleting !== null;
    useEffect(() => {
        if (!dialogOpen)
            return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || busy)
                return;
            setForm(null);
            setEditing(null);
            setDeleting(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dialogOpen, busy]);

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
        const source = debouncedQuery ? (searchHits ?? []) : (state?.history ?? []);
        const needle = debouncedQuery.toLowerCase();
        const rows = source.filter((row) => {
            if (filter !== 'all' && row.kind !== filter)
                return false;
            if (!needle)
                return true;
            const hay = `${row.note} ${row.expenseId ?? ''} ${KIND_LABEL[row.kind]}`.toLowerCase();
            return hay.includes(needle);
        });
        const map = new Map<string, CashMovement[]>();
        for (const row of rows) {
            const key = dayKey(row.createdAt);
            const list = map.get(key) ?? [];
            list.push(row);
            map.set(key, list);
        }
        return [...map.entries()];
    }, [state, filter, debouncedQuery, searchHits]);

    if (loading)
        return (
            <ExpensesShell title="Касса" backTo={routes.expenses}>
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

    const closeDialogs = () => {
        if (busy)
            return;
        setForm(null);
        setEditing(null);
        setDeleting(null);
        setFormError(null);
    };

    const openForm = (kind: FormKind) => {
        setEditing(null);
        setDeleting(null);
        setForm((current) => (current === kind ? null : kind));
        setFormError(null);
        setAmount('');
        setNote('');
        setFiles([]);
    };

    const openEdit = (row: CashMovement) => {
        setForm(null);
        setDeleting(null);
        setEditing(row);
        setFormError(null);
        setAmount(formatCash(row.amount, false));
        setNote(row.note);
    };

    const submit = async () => {
        if (!form)
            return;
        setBusy(true);
        setFormError(null);
        try {
            const result = await postCashAction(form, amount.trim(), note.trim());
            for (const file of files)
                await uploadCashAttachment(result.movement.id, file);
            showToast({ message: movementNotice(result.movement), variant: 'success', durationMs: 8000 });
            setAmount('');
            setNote('');
            setFiles([]);
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

    const submitEdit = async () => {
        if (!editing)
            return;
        setBusy(true);
        setFormError(null);
        try {
            const result = await updateCashMovement(editing.id, amount.trim(), note.trim());
            showToast({ message: movementNotice(result.movement), variant: 'success', durationMs: 8000 });
            setEditing(null);
            await reload();
        }
        catch (err: unknown) {
            setFormError(err instanceof Error ? err.message : 'Не удалось сохранить запись');
        }
        finally {
            setBusy(false);
        }
    };

    const submitDelete = async () => {
        if (!deleting)
            return;
        setBusy(true);
        setFormError(null);
        try {
            const result = await deleteCashMovement(deleting.id);
            const label = deleting.kind === 'expense' ? 'Потрачено' : 'Пополнение';
            const detail = deleting.note.trim();
            const middle = detail
                ? `${label}: ${formatCash(deleting.amount)} (${detail})`
                : `${label}: ${formatCash(deleting.amount)}`;
            showToast({
                message: `Запись удалена\n${middle}\n\nОстаток на текущий момент: ${formatCash(result.balance)}`,
                variant: 'success',
                durationMs: 8000,
            });
            setDeleting(null);
            await reload();
        }
        catch (err: unknown) {
            setFormError(err instanceof Error ? err.message : 'Не удалось удалить запись');
        }
        finally {
            setBusy(false);
        }
    };

    const formCopy = form === 'balance'
        ? { title: 'Задать остаток', submit: 'Установить' }
        : form === 'expense'
            ? { title: 'Списать расход', submit: 'Списать' }
            : { title: 'Пополнить кассу', submit: 'Пополнить' };

    const filters: { id: HistoryFilter; label: string }[] = [
        { id: 'all', label: 'Все' },
        { id: 'topup', label: 'Пополнения' },
        { id: 'expense', label: 'Расходы' },
        { id: 'set', label: 'Остаток' },
    ];

    return (
        <ExpensesShell title="Касса" backTo={routes.expenses}>
            <div className="exp-cash">
                {loadError && <p className="exp-cash__banner exp-cash__banner--error" role="alert">{loadError}</p>}

                <section className="exp-cash__hero">
                    <div>
                        <p className="exp-cash__eyebrow">Остаток в кассе</p>
                        <p className="exp-cash__balance">{state ? formatCash(state.balance) : '…'}</p>
                    </div>
                    <div className="exp-cash__hero-side">
                        {state?.balanceSet ? (
                            <button
                                type="button"
                                className={`exp-cash__rare${form === 'balance' ? ' exp-cash__rare--on' : ''}`}
                                onClick={() => openForm('balance')}
                            >
                                Задать остаток заново
                            </button>
                        ) : null}
                        <div className="exp-cash__hero-mark" aria-hidden><IconWallet /></div>
                    </div>
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
                    <button type="button" className={`exp-cash__action${form === 'topup' ? ' exp-cash__action--on' : ''}`} onClick={() => openForm('topup')} disabled={!state?.balanceSet}>
                        <span className="exp-cash__action-icon exp-cash__action-icon--in"><IconPlus /></span>
                        <span>Пополнить</span>
                    </button>
                    <button type="button" className={`exp-cash__action${form === 'expense' ? ' exp-cash__action--on' : ''}`} onClick={() => openForm('expense')} disabled={!state?.balanceSet}>
                        <span className="exp-cash__action-icon exp-cash__action-icon--out"><IconMinus /></span>
                        <span>Внести расход</span>
                    </button>
                    {!state?.balanceSet ? (
                        <button type="button" className={`exp-cash__action${form === 'balance' ? ' exp-cash__action--on' : ''}`} onClick={() => openForm('balance')}>
                            <span className="exp-cash__action-icon"><IconWallet /></span>
                            <span>Задать остаток</span>
                        </button>
                    ) : null}
                </div>

                {form && createPortal(
                    <div
                        className="exp-mod-backdrop"
                        role="presentation"
                        onClick={() => {
                            if (!busy)
                                setForm(null);
                        }}
                    >
                        <form
                            className="exp-mod-dialog"
                            role="dialog"
                            aria-modal
                            aria-labelledby="exp-cash-form-title"
                            onClick={(e) => e.stopPropagation()}
                            onSubmit={(e) => { e.preventDefault(); void submit(); }}
                        >
                            <h3 id="exp-cash-form-title" className="exp-mod-dialog__title">{formCopy.title}</h3>
                            <label className="exp-cash__field">
                                <span>Сумма, UZS</span>
                                <input
                                    inputMode="decimal"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                    autoFocus
                                    disabled={busy}
                                />
                            </label>
                            {form !== 'balance' && (
                                <label className="exp-cash__field">
                                    <span>{form === 'expense' ? 'На что потрачено' : 'Комментарий'}</span>
                                    <input
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        disabled={busy}
                                    />
                                </label>
                            )}
                            <CashFileDrop files={files} disabled={busy} onFiles={setFiles} />
                            {formError && <p className="exp-mod-err" role="alert">{formError}</p>}
                            <div className="exp-mod-dialog__ft">
                                <button type="button" className="exp-panel-btn exp-panel-btn--ghost" onClick={() => setForm(null)} disabled={busy}>
                                    Отмена
                                </button>
                                <button type="submit" className="exp-panel-btn exp-panel-btn--primary" disabled={busy}>
                                    {busy ? 'Сохранение…' : formCopy.submit}
                                </button>
                            </div>
                        </form>
                    </div>,
                    document.body,
                )}

                {editing && createPortal(
                    <div className="exp-mod-backdrop" role="presentation" onClick={closeDialogs}>
                        <form
                            className="exp-mod-dialog"
                            role="dialog"
                            aria-modal
                            aria-labelledby="exp-cash-edit-title"
                            onClick={(e) => e.stopPropagation()}
                            onSubmit={(e) => { e.preventDefault(); void submitEdit(); }}
                        >
                            <h3 id="exp-cash-edit-title" className="exp-mod-dialog__title">
                                {editing.kind === 'expense' ? 'Изменить расход' : 'Изменить пополнение'}
                            </h3>
                            <label className="exp-cash__field">
                                <span>Сумма, UZS</span>
                                <input
                                    inputMode="decimal"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                    autoFocus
                                    disabled={busy}
                                />
                            </label>
                            <label className="exp-cash__field">
                                <span>{editing.kind === 'expense' ? 'На что потрачено' : 'Комментарий'}</span>
                                <input
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    disabled={busy}
                                />
                            </label>
                            {formError && <p className="exp-mod-err" role="alert">{formError}</p>}
                            <div className="exp-mod-dialog__ft">
                                <button type="button" className="exp-panel-btn exp-panel-btn--ghost" onClick={closeDialogs} disabled={busy}>
                                    Отмена
                                </button>
                                <button type="submit" className="exp-panel-btn exp-panel-btn--primary" disabled={busy}>
                                    {busy ? 'Сохранение…' : 'Сохранить'}
                                </button>
                            </div>
                        </form>
                    </div>,
                    document.body,
                )}

                {deleting && createPortal(
                    <div className="exp-mod-backdrop" role="presentation" onClick={closeDialogs}>
                        <div
                            className="exp-mod-dialog"
                            role="dialog"
                            aria-modal
                            aria-labelledby="exp-cash-delete-title"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 id="exp-cash-delete-title" className="exp-mod-dialog__title">Удалить запись</h3>
                            <p className="exp-mod-dialog__sub">
                                {KIND_LABEL[deleting.kind]}
                                {deleting.note.trim() ? ` — ${deleting.note.trim()}` : ''}
                                {', '}
                                {formatCash(deleting.amount)}
                            </p>
                            {formError && <p className="exp-mod-err" role="alert">{formError}</p>}
                            <div className="exp-mod-dialog__ft">
                                <button type="button" className="exp-panel-btn exp-panel-btn--ghost" onClick={closeDialogs} disabled={busy}>
                                    Отмена
                                </button>
                                <button type="button" className="exp-panel-btn exp-panel-btn--primary exp-panel-btn--danger" onClick={() => void submitDelete()} disabled={busy}>
                                    {busy ? 'Удаление…' : 'Удалить'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}

                <section className="exp-cash__ledger">
                    <div className="exp-cash__ledger-head">
                        <h2>История</h2>
                        <label className="exp-cash__search">
                            <svg viewBox="0 0 24 24" aria-hidden>
                                <circle cx="11" cy="11" r="6.5" />
                                <path d="M16 16l4 4" />
                            </svg>
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Поиск по слову"
                                aria-label="Поиск по слову по всем расходам"
                            />
                        </label>
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
                        <p className="exp-cash__empty">{debouncedQuery ? 'Ничего не найдено' : 'Операций нет'}</p>
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
                                            {(row.expenseId || row.note) ? (
                                                <p className="exp-cash__event-note">
                                                    {row.expenseId ? (
                                                        <Link to={`${routes.expenses}/${encodeURIComponent(row.expenseId)}`} className="exp-cash__event-id">
                                                            {row.expenseId}
                                                        </Link>
                                                    ) : null}
                                                    {row.note ? <span>{row.note}</span> : null}
                                                </p>
                                            ) : null}
                                            {(row.attachments ?? []).length > 0 ? (
                                                <ul className="exp-cash__files">
                                                    {(row.attachments ?? []).map((file) => (
                                                        <li key={file.id}>
                                                            <button type="button" onClick={() => void openCashAttachment(row.id, file.id).catch((err: unknown) => showToast({ message: err instanceof Error ? err.message : 'Не удалось открыть файл', variant: 'error' }))}>
                                                                {file.fileName}
                                                            </button>
                                                            <button type="button" aria-label={`Убрать ${file.fileName}`} onClick={() => void deleteCashAttachment(row.id, file.id).then(() => reload()).catch((err: unknown) => showToast({ message: err instanceof Error ? err.message : 'Не удалось убрать файл', variant: 'error' }))}>
                                                                ×
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : null}
                                            <RowFileDrop
                                                onFiles={(picked) => {
                                                    void (async () => {
                                                        try {
                                                            for (const file of picked)
                                                                await uploadCashAttachment(row.id, file);
                                                            await reload();
                                                        }
                                                        catch (err: unknown) {
                                                            showToast({ message: err instanceof Error ? err.message : 'Не удалось вложить файл', variant: 'error' });
                                                        }
                                                    })();
                                                }}
                                            />
                                            <p className="exp-cash__event-after">Остаток на текущий момент: {formatCash(row.balanceAfter)}</p>
                                        </div>
                                        <div className="exp-cash__event-side">
                                            {isManualCashMovement(row) ? (
                                                <div className="exp-cash__event-tools">
                                                    <button type="button" className="exp-cash__event-tool" aria-label="Изменить" onClick={() => openEdit(row)}>
                                                        <IconPencil />
                                                    </button>
                                                    <button type="button" className="exp-cash__event-tool exp-cash__event-tool--danger" aria-label="Удалить" onClick={() => { setForm(null); setEditing(null); setFormError(null); setDeleting(row); }}>
                                                        <IconTrash />
                                                    </button>
                                                </div>
                                            ) : null}
                                            <span className={`exp-cash__event-sum exp-cash__event-sum--${row.kind}`}>
                                                {row.kind === 'expense' ? '−' : row.kind === 'topup' ? '+' : ''}
                                                {formatCash(row.amount, false)}
                                            </span>
                                        </div>
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
