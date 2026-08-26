import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
    createVacationLeaveRequest,
    getVacationLeaveBalance,
    getVacationLeaveKinds,
    getVacationPartners,
    invalidateVacationLeaveRequests,
    type VacationLeaveBalanceApi,
    type VacationLeaveKindApi,
    type VacationLeaveRequestApi,
    type VacationLeaveRequestKind,
    type VacationPartnerApi,
} from '@entities/vacation';
import { useCurrentUser } from '@shared/hooks';
import { DatePicker, SearchableSelect, useAppToast } from '@shared/ui';
import {
    countCalendarDaysInclusive,
    leaveKindLabel,
    ruDaysWord,
} from '../lib/leaveRequestDisplay';
import './VacationScheduleImportModal.css';
import './VacationAbsenceRequestModal.css';

type PartnerOption = {
    id: string;
    label: string;
    search: string;
    userId: number;
    position: string | null;
};

type Props = {
    open: boolean;
    onClose: () => void;

    onSubmitted?: (request: VacationLeaveRequestApi) => void;
};

const FALLBACK_KINDS: VacationLeaveKindApi[] = [
    { kind_code: 1, kind: 'annual_vacation', label_ru: 'Ежегодный отпуск', color_hex: '#E8D5F2', color_text_hex: '#4A148C' },
    { kind_code: 2, kind: 'sick_leave', label_ru: 'Больничный', color_hex: '#FF1493', color_text_hex: '#880E4F' },
    { kind_code: 3, kind: 'day_off', label_ru: 'Неоплачиваемый отпуск', color_hex: '#81D4FA', color_text_hex: '#01579B' },
    { kind_code: 5, kind: 'remote_work', label_ru: 'Дистанционный режим', color_hex: '#FFF59D', color_text_hex: '#F57F17' },
];

const KIND_DESCRIPTIONS: Record<VacationLeaveRequestKind, string> = {
    annual_vacation: 'Оплачиваемый отпуск в пределах доступного остатка. Одна из частей отпуска должна быть непрерывной — не менее 14 календарных дней.',
    sick_leave: 'Отсутствие по болезни. Укажите период нетрудоспособности.',
    day_off: 'Отпуск без сохранения заработной платы. Эти дни не вычитаются из остатка ежегодного отпуска.',
    remote_work: 'Работа вне офиса в течение согласованного периода.',
};

function mergeLeaveKinds(apiList: VacationLeaveKindApi[]): VacationLeaveKindApi[] {
    const byKind = new Map(apiList.map((k) => [k.kind, k]));
    const merged: VacationLeaveKindApi[] = [];
    for (const fb of FALLBACK_KINDS) {
        merged.push(byKind.get(fb.kind) ?? fb);
        byKind.delete(fb.kind);
    }
    for (const extra of byKind.values())
        merged.push(extra);
    return merged;
}

function yearFromIso(iso: string): number | null {
    const m = /^(\d{4})-/.exec(iso.trim());
    if (!m)
        return null;
    const y = Number(m[1]);
    return Number.isFinite(y) ? y : null;
}

export function VacationAbsenceRequestModal({ open, onClose, onSubmitted }: Props) {
    const uid = useId();
    const { user } = useCurrentUser();
    const { pushToast } = useAppToast();
    const [kinds, setKinds] = useState<VacationLeaveKindApi[]>(FALLBACK_KINDS);
    const [kind, setKind] = useState<VacationLeaveRequestKind>('annual_vacation');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [reason, setReason] = useState('');
    const [partnerId, setPartnerId] = useState('');
    const [partners, setPartners] = useState<PartnerOption[]>([]);
    const [partnersLoading, setPartnersLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [balance, setBalance] = useState<VacationLeaveBalanceApi | null>(null);
    const [balanceLoading, setBalanceLoading] = useState(false);

    const dayCount = useMemo(() => countCalendarDaysInclusive(dateFrom, dateTo), [dateFrom, dateTo]);
    const balanceYear = useMemo(() => {
        return yearFromIso(dateFrom) ?? yearFromIso(dateTo) ?? new Date().getFullYear();
    }, [dateFrom, dateTo]);

    useEffect(() => {
        if (!open)
            return;
        setKind('annual_vacation');
        setDateFrom('');
        setDateTo('');
        setReason('');
        setPartnerId('');
        setError(null);
        setSubmitting(false);
        setBalance(null);
    }, [open]);

    useEffect(() => {
        if (!open)
            return;
        let cancelled = false;
        void getVacationLeaveKinds()
            .then((list) => {
                if (cancelled || list.length === 0)
                    return;
                setKinds(mergeLeaveKinds(list));
            })
            .catch(() => {
            });
        return () => {
            cancelled = true;
        };
    }, [open]);

    useEffect(() => {
        if (!open || kind !== 'annual_vacation')
            return;
        let cancelled = false;
        setBalanceLoading(true);
        void getVacationLeaveBalance(balanceYear)
            .then((b) => {
                if (!cancelled)
                    setBalance(b);
            })
            .catch(() => {
                if (!cancelled)
                    setBalance(null);
            })
            .finally(() => {
                if (!cancelled)
                    setBalanceLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, kind, balanceYear]);

    useEffect(() => {
        if (!open)
            return;
        let cancelled = false;
        setPartnersLoading(true);
        void getVacationPartners()
            .then((list: VacationPartnerApi[]) => {
                if (cancelled)
                    return;
                const opts: PartnerOption[] = list
                    .map((u) => {
                        const label = (u.display_name?.trim() || u.email || `Пользователь ${u.user_id}`).trim();
                        const position = u.position?.trim() || null;
                        return {
                            id: String(u.user_id),
                            userId: u.user_id,
                            label,
                            position,
                            search: `${label} ${position ?? ''} ${u.email}`.toLowerCase(),
                        };
                    })
                    .sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
                setPartners(opts);
            })
            .catch((e: unknown) => {
                if (!cancelled) {
                    setPartners([]);
                    setError(e instanceof Error ? e.message : 'Не удалось загрузить список партнёров.');
                }
            })
            .finally(() => {
                if (!cancelled)
                    setPartnersLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open]);

    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !submitting)
                onClose();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open, onClose, submitting]);

    const handleSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!user) {
            setError('Не удалось определить текущего пользователя.');
            return;
        }
        if (!dateFrom || !dateTo) {
            setError('Укажите дату начала и окончания.');
            return;
        }
        if (dateTo < dateFrom) {
            setError('Дата окончания не может быть раньше даты начала.');
            return;
        }
        if (dayCount < 1) {
            setError('Проверьте выбранный период.');
            return;
        }
        if (kind === 'annual_vacation' && balance) {
            if (dayCount > balance.remaining_days) {
                setError(
                    `Недостаточно дней отпуска: доступно ${balance.remaining_days}, в заявке — ${dayCount}.`,
                );
                return;
            }
            if (!balance.continuous_14_satisfied && dayCount < balance.min_continuous_days) {
                if (dayCount > balance.flexible_days_remaining) {
                    setError(
                        balance.flexible_days_remaining > 0
                            ? `Дробный ежегодный отпуск: осталось ${balance.flexible_days_remaining} из ${balance.flexible_days_max} дн., в заявке — ${dayCount}. `
                                + `Иначе оформите непрерывные ${balance.min_continuous_days} дн. или неоплачиваемый отпуск.`
                            : `Дробные ${balance.flexible_days_max} дн. ежегодного отпуска исчерпаны. `
                                + `Оформите непрерывный отпуск не менее ${balance.min_continuous_days} дн. `
                                + `либо выберите неоплачиваемый отпуск.`,
                    );
                    return;
                }
            }
        }
        const partner = partners.find((p) => p.id === partnerId);
        if (!partner) {
            setError('Выберите курирующего партнёра для согласования.');
            return;
        }
        setSubmitting(true);
        try {
            const created = await createVacationLeaveRequest({
                kind,
                date_from: dateFrom.slice(0, 10),
                date_to: dateTo.slice(0, 10),
                partner_user_id: partner.userId,
                reason: reason.trim() || null,
            });
            pushToast({
                variant: 'success',
                message: `Заявка #${created.id} отправлена партнёру ${partner.label}.`,
            });
            invalidateVacationLeaveRequests();
            onSubmitted?.(created);
            onClose();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось создать заявку.');
        }
        finally {
            setSubmitting(false);
        }
    }, [user, dateFrom, dateTo, dayCount, partners, partnerId, kind, balance, reason, onClose, onSubmitted, pushToast]);

    if (!open)
        return null;

    const periodValid = Boolean(dateFrom && dateTo && dayCount > 0);
    const daysMeta = !dateFrom || !dateTo
        ? 'Дни посчитаются автоматически'
        : dayCount > 0
            ? 'Календарные дни'
            : 'Укажите корректный период';

    const ruleHint = kind === 'annual_vacation' && balance
        ? (balance.continuous_14_satisfied
            ? `Остаток можно оформлять любыми частями (не больше ${balance.remaining_days} дн.).`
            : balance.flexible_days_remaining > 0
                ? `Дробный ежегодный отпуск: ещё ${balance.flexible_days_remaining} из ${balance.flexible_days_max} дн. (по 1–2–3…). Дальше — непрерывные ${balance.min_continuous_days} дн. или неоплачиваемый отпуск.`
                : `Дробные ${balance.flexible_days_max} дн. исчерпаны. Оформите непрерывный ежегодный отпуск не менее ${balance.min_continuous_days} дн. либо выберите неоплачиваемый отпуск.`)
        : null;

    return createPortal(
        <div className="vac-imp-modal" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
            <form className="vac-imp-modal__dialog vac-req-modal__dialog" onSubmit={handleSubmit}>
                <div className="vac-imp-modal__head">
                    <h2 id={`${uid}-title`} className="vac-imp-modal__title">
                        Заявка на отсутствие
                    </h2>
                    <button type="button" className="vac-imp-modal__x" onClick={onClose} disabled={submitting} aria-label="Закрыть">
                        ×
                    </button>
                </div>
                <div className="vac-imp-modal__body vac-req-modal__body">
                    {kind === 'annual_vacation' && (
                        <div className="vac-req-modal__balance" aria-live="polite">
                            {balanceLoading && !balance ? (
                                <p className="vac-req-modal__hint">Загрузка баланса отпуска…</p>
                            ) : balance ? (
                                <>
                                    <div className="vac-req-modal__balance-top">
                                        <p className="vac-req-modal__balance-title">
                                            Ежегодный отпуск · {balance.year}
                                        </p>
                                        {!balance.continuous_14_satisfied && (
                                            <span className="vac-req-modal__flex-pill" title="Оставшиеся дробные дни">
                                                Дробные {balance.flexible_days_remaining}/{balance.flexible_days_max}
                                            </span>
                                        )}
                                    </div>
                                    <div className="vac-req-modal__balance-main">
                                        <div className="vac-req-modal__balance-hero">
                                            <span className="vac-req-modal__balance-hero-label">Остаток</span>
                                            <span className="vac-req-modal__balance-hero-value">{balance.remaining_days}</span>
                                        </div>
                                        <dl className="vac-req-modal__balance-side">
                                            <div>
                                                <dt>Положено</dt>
                                                <dd>{balance.entitled_days}</dd>
                                            </div>
                                            <div>
                                                <dt>Использовано</dt>
                                                <dd>{balance.used_days}</dd>
                                            </div>
                                        </dl>
                                    </div>
                                    {balance.pending_days > 0 && (
                                        <p className="vac-req-modal__hint vac-req-modal__hint--tight">
                                            В ожидании согласования: {balance.pending_days} дн. (уже учтены в остатке).
                                        </p>
                                    )}
                                    {ruleHint && (
                                        <p className="vac-req-modal__rule">{ruleHint}</p>
                                    )}
                                </>
                            ) : (
                                <p className="vac-req-modal__hint">Не удалось загрузить баланс отпуска.</p>
                            )}
                        </div>
                    )}

                    <fieldset className="vac-req-modal__section">
                        <legend className="vac-req-modal__legend">Тип отсутствия</legend>
                        <div className="vac-req-modal__categories" role="radiogroup" aria-label="Тип отсутствия">
                            {kinds.map((item) => (
                                <label
                                    key={item.kind}
                                    className={`vac-req-modal__cat${kind === item.kind ? ' vac-req-modal__cat--on' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name={`${uid}-kind`}
                                        value={item.kind}
                                        checked={kind === item.kind}
                                        onChange={() => setKind(item.kind)}
                                    />
                                    <span
                                        className="vac-req-modal__cat-dot"
                                        style={{ background: item.color_hex || 'var(--app-accent, #4f46e5)' }}
                                        aria-hidden
                                    />
                                    <span className="vac-req-modal__cat-copy">
                                        <span className="vac-req-modal__cat-label">{leaveKindLabel(item.kind, kinds)}</span>
                                        <span className="vac-req-modal__cat-description">{KIND_DESCRIPTIONS[item.kind]}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset className="vac-req-modal__section">
                        <legend className="vac-req-modal__legend">Период</legend>
                        <div className="vac-req-modal__dates">
                            <div className="vac-req-modal__field">
                                <span id={`${uid}-from`}>С</span>
                                <DatePicker
                                    className="vac-req-modal__date-picker"
                                    buttonClassName="vac-req-modal__date-picker-btn"
                                    value={dateFrom}
                                    max={dateTo || undefined}
                                    onChange={(iso) => {
                                        setDateFrom(iso);
                                        if (dateTo && iso > dateTo)
                                            setDateTo(iso);
                                    }}
                                    portal
                                    portalZIndex={12600}
                                    emptyLabel="дд.мм.гггг"
                                    showChevron={false}
                                    iconAfterLabel
                                    title="Дата начала"
                                    aria-labelledby={`${uid}-from`}
                                />
                            </div>
                            <div className="vac-req-modal__field">
                                <span id={`${uid}-to`}>По</span>
                                <DatePicker
                                    className="vac-req-modal__date-picker"
                                    buttonClassName="vac-req-modal__date-picker-btn"
                                    value={dateTo}
                                    min={dateFrom || undefined}
                                    onChange={(iso) => {
                                        setDateTo(iso);
                                        if (dateFrom && iso < dateFrom)
                                            setDateFrom(iso);
                                    }}
                                    portal
                                    portalZIndex={12600}
                                    emptyLabel="дд.мм.гггг"
                                    showChevron={false}
                                    iconAfterLabel
                                    title="Дата окончания"
                                    aria-labelledby={`${uid}-to`}
                                />
                            </div>
                        </div>
                        <div className="vac-req-modal__period-meta" aria-live="polite">
                            {periodValid ? (
                                <span className="vac-req-modal__days-pill">{dayCount} {ruDaysWord(dayCount)}</span>
                            ) : null}
                            <span className={`vac-req-modal__days-hint${periodValid ? '' : ' vac-req-modal__days-hint--alone'}`}>
                                {daysMeta}
                            </span>
                        </div>
                    </fieldset>

                    <fieldset className="vac-req-modal__section">
                        <legend className="vac-req-modal__legend">Согласование</legend>
                        <label className="vac-req-modal__field vac-req-modal__field--full">
                            <span>Курирующий партнёр</span>
                            {partnersLoading ? (
                                <span className="vac-req-modal__hint">Загрузка списка партнёров…</span>
                            ) : (
                                <SearchableSelect<PartnerOption>
                                    portalDropdown
                                    className="vac-req-modal__select"
                                    buttonClassName="vac-req-modal__select-btn"
                                    aria-label="Курирующий партнёр для согласования"
                                    placeholder={partners.length === 0 ? 'Партнёры не найдены' : 'Выберите курирующего партнёра…'}
                                    emptyListText="Нет в списке"
                                    noMatchText="Не найдено"
                                    value={partnerId}
                                    items={partners}
                                    getOptionValue={(o) => o.id}
                                    getOptionLabel={(o) => (o.position ? `${o.label} (${o.position})` : o.label)}
                                    getSearchText={(o) => o.search}
                                    disabled={partners.length === 0}
                                    onSelect={(o) => setPartnerId(o.id)}
                                />
                            )}
                        </label>
                        <p className="vac-req-modal__tip">
                            Курирующий партнёр получит PDF с кнопками «Утвердить» / «Отклонить». После approve дни появятся в графике.
                        </p>
                    </fieldset>

                    <fieldset className="vac-req-modal__section">
                        <legend className="vac-req-modal__legend">Комментарий</legend>
                        <textarea
                            className="vac-req-modal__reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Необязательно — для партнёра в заявке и PDF"
                            rows={3}
                            maxLength={500}
                            disabled={submitting}
                        />
                    </fieldset>

                    {error && (
                        <p className="vac-req-modal__error" role="alert">
                            {error}
                        </p>
                    )}
                </div>
                <div className="vac-req-modal__footer">
                    <button type="button" className="vac-imp-modal__btn-secondary" onClick={onClose} disabled={submitting}>
                        Отмена
                    </button>
                    <button type="submit" className="vac-req-modal__submit" disabled={submitting || partnersLoading}>
                        {submitting ? 'Отправка…' : 'Отправить партнёру'}
                    </button>
                </div>
            </form>
        </div>,
        document.body,
    );
}
