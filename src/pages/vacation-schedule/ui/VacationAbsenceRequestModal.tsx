import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
    createVacationLeaveRequest,
    getVacationLeaveBalance,
    getVacationLeaveKinds,
    getVacationPartners,
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
    { kind_code: 3, kind: 'day_off', label_ru: 'Day Off (нерабочий)', color_hex: '#81D4FA', color_text_hex: '#01579B' },
    { kind_code: 5, kind: 'remote_work', label_ru: 'Дистанционный режим', color_hex: '#FFF59D', color_text_hex: '#F57F17' },
];

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
                setKinds(list);
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
                                + `Иначе оформите непрерывные ${balance.min_continuous_days} дн. или Day Off (неоплачиваемый).`
                            : `Дробные ${balance.flexible_days_max} дн. ежегодного отпуска исчерпаны. `
                                + `Оформите непрерывный отпуск не менее ${balance.min_continuous_days} дн. `
                                + `либо выберите Day Off (нерабочий / неоплачиваемый).`,
                    );
                    return;
                }
            }
        }
        const partner = partners.find((p) => p.id === partnerId);
        if (!partner) {
            setError('Выберите партнёра для согласования.');
            return;
        }
        setSubmitting(true);
        try {
            const created = await createVacationLeaveRequest({
                kind,
                date_from: dateFrom.slice(0, 10),
                date_to: dateTo.slice(0, 10),
                partner_user_id: partner.userId,
            });
            pushToast({
                variant: 'success',
                message: `Заявка #${created.id} отправлена партнёру ${partner.label}.`,
            });
            onSubmitted?.(created);
            onClose();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось создать заявку.');
        }
        finally {
            setSubmitting(false);
        }
    }, [user, dateFrom, dateTo, dayCount, partners, partnerId, kind, balance, onClose, onSubmitted, pushToast]);

    if (!open)
        return null;

    const daysHint = dateFrom && dateTo
        ? dayCount > 0
            ? `Календарных ${ruDaysWord(dayCount)}: ${dayCount}`
            : 'Укажите корректный период'
        : 'Дни посчитаются автоматически';

    const ruleHint = kind === 'annual_vacation' && balance
        ? (balance.continuous_14_satisfied
            ? `Остаток можно оформлять любыми частями (не больше ${balance.remaining_days} дн.).`
            : balance.flexible_days_remaining > 0
                ? `Дробный ежегодный отпуск: ещё ${balance.flexible_days_remaining} из ${balance.flexible_days_max} дн. (по 1–2–3…). Дальше — непрерывные ${balance.min_continuous_days} дн. или Day Off (неоплачиваемый).`
                : `Дробные ${balance.flexible_days_max} дн. исчерпаны. Оформите непрерывный ежегодный отпуск не менее ${balance.min_continuous_days} дн. либо выберите Day Off (нерабочий / неоплачиваемый).`)
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
                                    <p className="vac-req-modal__balance-title">
                                        Ежегодный отпуск · {balance.year}
                                    </p>
                                    <dl className="vac-req-modal__balance-grid">
                                        <div>
                                            <dt>Положено</dt>
                                            <dd>{balance.entitled_days}</dd>
                                        </div>
                                        <div>
                                            <dt>Использовано</dt>
                                            <dd>{balance.used_days}</dd>
                                        </div>
                                        <div>
                                            <dt>Остаток</dt>
                                            <dd>{balance.remaining_days}</dd>
                                        </div>
                                        {!balance.continuous_14_satisfied && (
                                            <div>
                                                <dt>Дробные</dt>
                                                <dd>
                                                    {balance.flexible_days_remaining}/{balance.flexible_days_max}
                                                </dd>
                                            </div>
                                        )}
                                    </dl>
                                    {balance.pending_days > 0 && (
                                        <p className="vac-req-modal__hint">
                                            В ожидании согласования: {balance.pending_days} дн. (уже учтены в остатке).
                                        </p>
                                    )}
                                    {ruleHint && (
                                        <p className="vac-req-modal__hint">{ruleHint}</p>
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
                                    <span>{leaveKindLabel(item.kind, kinds)}</span>
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
                        <p className="vac-req-modal__days" aria-live="polite">
                            {daysHint}
                        </p>
                    </fieldset>

                    <fieldset className="vac-req-modal__section">
                        <legend className="vac-req-modal__legend">Согласование</legend>
                        <label className="vac-req-modal__field vac-req-modal__field--full">
                            <span>Партнёр</span>
                            {partnersLoading ? (
                                <span className="vac-req-modal__hint">Загрузка списка партнёров…</span>
                            ) : (
                                <SearchableSelect<PartnerOption>
                                    portalDropdown
                                    className="vac-req-modal__select"
                                    buttonClassName="vac-req-modal__select-btn"
                                    aria-label="Партнёр для согласования"
                                    placeholder={partners.length === 0 ? 'Партнёры не найдены' : 'Выберите партнёра…'}
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
                    </fieldset>

                    <p className="vac-req-modal__note">
                        Партнёр получит письмо с PDF-заявкой и кнопками «Утвердить»/«Отклонить». После approve дни отсутствия появятся в графике, а остаток отпуска обновится автоматически.
                    </p>

                    {error && (
                        <p className="vac-req-modal__error" role="alert">
                            {error}
                        </p>
                    )}

                    <div className="vac-imp-modal__actions">
                        <button type="button" className="vac-imp-modal__btn-secondary" onClick={onClose} disabled={submitting}>
                            Отмена
                        </button>
                        <button type="submit" className="vac-req-modal__submit" disabled={submitting || partnersLoading}>
                            {submitting ? 'Отправка…' : 'Отправить партнёру'}
                        </button>
                    </div>
                </div>
            </form>
        </div>,
        document.body,
    );
}
