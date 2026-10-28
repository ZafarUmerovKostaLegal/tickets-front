import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createVacationLeaveRequest, getVacationLeaveBalance, getVacationLeaveKinds, getVacationPartners, invalidateVacationLeaveRequests, isVacationManagingPartner, } from '@entities/vacation';
import { useCurrentUser } from '@shared/hooks';
import { DatePicker, SearchableSelect, useAppToast } from '@shared/ui';
import { emptyAnnualOverlapCache, loadAnnualTeamOverlapWarning, } from '../lib/annualTeamOverlap';
import { countCalendarDaysInclusive, leaveKindLabel, ruDaysWord, } from '../lib/leaveRequestDisplay';
import './VacationScheduleImportModal.css';
import './VacationAbsenceRequestModal.css';
const FALLBACK_KINDS = [
    { kind_code: 1, kind: 'annual_vacation', label_ru: 'Ежегодный отпуск', color_hex: '#E8D5F2', color_text_hex: '#4A148C' },
    { kind_code: 2, kind: 'sick_leave', label_ru: 'Больничный', color_hex: '#FF1493', color_text_hex: '#880E4F' },
    { kind_code: 3, kind: 'day_off', label_ru: 'Неоплачиваемый отпуск', color_hex: '#81D4FA', color_text_hex: '#01579B' },
    { kind_code: 5, kind: 'remote_work', label_ru: 'Дистанционный режим', color_hex: '#FFF59D', color_text_hex: '#F57F17' },
];
const KIND_DESCRIPTIONS = {
    annual_vacation: 'Оплачиваемый отпуск в пределах доступного остатка. Одна из частей отпуска должна быть непрерывной — не менее 14 календарных дней.',
    sick_leave: 'Отсутствие по болезни. Укажите период нетрудоспособности.',
    day_off: 'Отпуск без сохранения заработной платы. Эти дни не вычитаются из остатка ежегодного отпуска.',
    remote_work: 'Работа вне офиса в течение согласованного периода.',
};
function mergeLeaveKinds(apiList) {
    const byKind = new Map(apiList.map((k) => [k.kind, k]));
    const merged = [];
    for (const fb of FALLBACK_KINDS) {
        merged.push(byKind.get(fb.kind) ?? fb);
        byKind.delete(fb.kind);
    }
    for (const extra of byKind.values())
        merged.push(extra);
    return merged;
}
function yearFromIso(iso) {
    const m = /^(\d{4})-/.exec(iso.trim());
    if (!m)
        return null;
    const y = Number(m[1]);
    return Number.isFinite(y) ? y : null;
}
export function VacationAbsenceRequestModal({ open, onClose, onSubmitted }) {
    const uid = useId();
    const { user } = useCurrentUser();
    const { pushToast } = useAppToast();
    const [kinds, setKinds] = useState(FALLBACK_KINDS);
    const [kind, setKind] = useState('annual_vacation');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [reason, setReason] = useState('');
    const [partnerId, setPartnerId] = useState('');
    const [partners, setPartners] = useState([]);
    const [partnersLoading, setPartnersLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [balance, setBalance] = useState(null);
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [teamWarning, setTeamWarning] = useState(null);
    const overlapCache = useRef(emptyAnnualOverlapCache());
    const dayCount = useMemo(() => countCalendarDaysInclusive(dateFrom, dateTo), [dateFrom, dateTo]);
    const selectedPartner = useMemo(() => partners.find((p) => p.id === partnerId) ?? null, [partners, partnerId]);
    const selectedIsManaging = Boolean(selectedPartner && isVacationManagingPartner(selectedPartner.email));
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
        setTeamWarning(null);
        overlapCache.current = emptyAnnualOverlapCache();
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
            .then((list) => {
            if (cancelled)
                return;
            const opts = list
                .map((u) => {
                const label = (u.display_name?.trim() || u.email || `Пользователь ${u.user_id}`).trim();
                const position = u.position?.trim() || null;
                return {
                    id: String(u.user_id),
                    userId: u.user_id,
                    label,
                    position,
                    email: u.email || '',
                    search: `${label} ${position ?? ''} ${u.email}`.toLowerCase(),
                };
            })
                .sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
            setPartners(opts);
        })
            .catch((e) => {
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
        const onKey = (e) => {
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
    useEffect(() => {
        if (!open || kind !== 'annual_vacation' || !dateFrom || !dateTo || dayCount < 1 || user?.id == null) {
            setTeamWarning(null);
            return;
        }
        let cancelled = false;
        const userId = user.id;
        const from = dateFrom.slice(0, 10);
        const to = dateTo.slice(0, 10);
        setTeamWarning(null);
        void loadAnnualTeamOverlapWarning(overlapCache.current, userId, from, to)
            .then((text) => {
            if (!cancelled)
                setTeamWarning(text);
        })
            .catch(() => {
            if (!cancelled)
                setTeamWarning(null);
        });
        return () => {
            cancelled = true;
        };
    }, [open, kind, dateFrom, dateTo, dayCount, user?.id]);
    const handleSubmit = useCallback(async (e) => {
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
                setError(`Недостаточно дней отпуска: доступно ${balance.remaining_days}, в заявке — ${dayCount}.`);
                return;
            }
            if (!balance.continuous_14_satisfied && dayCount < balance.min_continuous_days) {
                if (dayCount > balance.flexible_days_remaining) {
                    setError(balance.flexible_days_remaining > 0
                        ? `Дробный ежегодный отпуск: осталось ${balance.flexible_days_remaining} из ${balance.flexible_days_max} дн., в заявке — ${dayCount}. `
                            + `Иначе оформите непрерывные ${balance.min_continuous_days} дн. или неоплачиваемый отпуск.`
                        : `Дробные ${balance.flexible_days_max} дн. ежегодного отпуска исчерпаны. `
                            + `Оформите непрерывный отпуск не менее ${balance.min_continuous_days} дн. `
                            + `либо выберите неоплачиваемый отпуск.`);
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
                message: `Заявка #${created.id} отправлена курирующему партнёру ${partner.label}.`,
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
    return createPortal(_jsx("div", { className: "vac-imp-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-title`, children: _jsxs("form", { className: "vac-imp-modal__dialog vac-req-modal__dialog", onSubmit: handleSubmit, children: [_jsxs("div", { className: "vac-imp-modal__head", children: [_jsx("h2", { id: `${uid}-title`, className: "vac-imp-modal__title", children: "\u0417\u0430\u044F\u0432\u043A\u0430 \u043D\u0430 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435" }), _jsx("button", { type: "button", className: "vac-imp-modal__x", onClick: onClose, disabled: submitting, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsxs("div", { className: "vac-imp-modal__body vac-req-modal__body", children: [kind === 'annual_vacation' && (_jsx("div", { className: "vac-req-modal__balance", "aria-live": "polite", children: balanceLoading && !balance ? (_jsx("p", { className: "vac-req-modal__hint", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0431\u0430\u043B\u0430\u043D\u0441\u0430 \u043E\u0442\u043F\u0443\u0441\u043A\u0430\u2026" })) : balance ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "vac-req-modal__balance-top", children: [_jsxs("p", { className: "vac-req-modal__balance-title", children: ["\u0415\u0436\u0435\u0433\u043E\u0434\u043D\u044B\u0439 \u043E\u0442\u043F\u0443\u0441\u043A \u00B7 ", balance.year] }), !balance.continuous_14_satisfied && (_jsxs("span", { className: "vac-req-modal__flex-pill", title: "\u041E\u0441\u0442\u0430\u0432\u0448\u0438\u0435\u0441\u044F \u0434\u0440\u043E\u0431\u043D\u044B\u0435 \u0434\u043D\u0438", children: ["\u0414\u0440\u043E\u0431\u043D\u044B\u0435 ", balance.flexible_days_remaining, "/", balance.flexible_days_max] }))] }), _jsxs("div", { className: "vac-req-modal__balance-main", children: [_jsxs("div", { className: "vac-req-modal__balance-hero", children: [_jsx("span", { className: "vac-req-modal__balance-hero-label", children: "\u041E\u0441\u0442\u0430\u0442\u043E\u043A" }), _jsx("span", { className: "vac-req-modal__balance-hero-value", children: balance.remaining_days })] }), _jsxs("dl", { className: "vac-req-modal__balance-side", children: [_jsxs("div", { children: [_jsx("dt", { children: "\u041F\u043E\u043B\u043E\u0436\u0435\u043D\u043E" }), _jsx("dd", { children: balance.entitled_days })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043E" }), _jsx("dd", { children: balance.used_days })] })] })] }), balance.pending_days > 0 && (_jsxs("p", { className: "vac-req-modal__hint vac-req-modal__hint--tight", children: ["\u0412 \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u0438 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F: ", balance.pending_days, " \u0434\u043D. (\u0443\u0436\u0435 \u0443\u0447\u0442\u0435\u043D\u044B \u0432 \u043E\u0441\u0442\u0430\u0442\u043A\u0435)."] })), ruleHint && (_jsx("p", { className: "vac-req-modal__rule", children: ruleHint }))] })) : (_jsx("p", { className: "vac-req-modal__hint", children: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0431\u0430\u043B\u0430\u043D\u0441 \u043E\u0442\u043F\u0443\u0441\u043A\u0430." })) })), _jsxs("fieldset", { className: "vac-req-modal__section", children: [_jsx("legend", { className: "vac-req-modal__legend", children: "\u0422\u0438\u043F \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u044F" }), _jsx("div", { className: "vac-req-modal__categories", role: "radiogroup", "aria-label": "\u0422\u0438\u043F \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u044F", children: kinds.map((item) => (_jsxs("label", { className: `vac-req-modal__cat${kind === item.kind ? ' vac-req-modal__cat--on' : ''}`, children: [_jsx("input", { type: "radio", name: `${uid}-kind`, value: item.kind, checked: kind === item.kind, onChange: () => setKind(item.kind) }), _jsx("span", { className: "vac-req-modal__cat-dot", style: { background: item.color_hex || 'var(--app-accent, #4f46e5)' }, "aria-hidden": true }), _jsxs("span", { className: "vac-req-modal__cat-copy", children: [_jsx("span", { className: "vac-req-modal__cat-label", children: leaveKindLabel(item.kind, kinds) }), _jsx("span", { className: "vac-req-modal__cat-description", children: KIND_DESCRIPTIONS[item.kind] })] })] }, item.kind))) })] }), _jsxs("fieldset", { className: "vac-req-modal__section", children: [_jsx("legend", { className: "vac-req-modal__legend", children: "\u041F\u0435\u0440\u0438\u043E\u0434" }), _jsxs("div", { className: "vac-req-modal__dates", children: [_jsxs("div", { className: "vac-req-modal__field", children: [_jsx("span", { id: `${uid}-from`, children: "\u0421" }), _jsx(DatePicker, { className: "vac-req-modal__date-picker", buttonClassName: "vac-req-modal__date-picker-btn", value: dateFrom, max: dateTo || undefined, onChange: (iso) => {
                                                        setDateFrom(iso);
                                                        if (dateTo && iso > dateTo)
                                                            setDateTo(iso);
                                                    }, portal: true, portalZIndex: 12600, emptyLabel: "\u0434\u0434.\u043C\u043C.\u0433\u0433\u0433\u0433", showChevron: false, iconAfterLabel: true, title: "\u0414\u0430\u0442\u0430 \u043D\u0430\u0447\u0430\u043B\u0430", "aria-labelledby": `${uid}-from` })] }), _jsxs("div", { className: "vac-req-modal__field", children: [_jsx("span", { id: `${uid}-to`, children: "\u041F\u043E" }), _jsx(DatePicker, { className: "vac-req-modal__date-picker", buttonClassName: "vac-req-modal__date-picker-btn", value: dateTo, min: dateFrom || undefined, onChange: (iso) => {
                                                        setDateTo(iso);
                                                        if (dateFrom && iso < dateFrom)
                                                            setDateFrom(iso);
                                                    }, portal: true, portalZIndex: 12600, emptyLabel: "\u0434\u0434.\u043C\u043C.\u0433\u0433\u0433\u0433", showChevron: false, iconAfterLabel: true, title: "\u0414\u0430\u0442\u0430 \u043E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u044F", "aria-labelledby": `${uid}-to` })] })] }), _jsxs("div", { className: "vac-req-modal__period-meta", "aria-live": "polite", children: [periodValid ? (_jsxs("span", { className: "vac-req-modal__days-pill", children: [dayCount, " ", ruDaysWord(dayCount)] })) : null, _jsx("span", { className: `vac-req-modal__days-hint${periodValid ? '' : ' vac-req-modal__days-hint--alone'}`, children: daysMeta })] }), kind === 'annual_vacation' && teamWarning ? (_jsx("p", { className: "vac-req-modal__team-warn", role: "status", children: teamWarning })) : null] }), _jsxs("fieldset", { className: "vac-req-modal__section", children: [_jsx("legend", { className: "vac-req-modal__legend", children: "\u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsxs("label", { className: "vac-req-modal__field vac-req-modal__field--full", children: [_jsx("span", { children: "\u041A\u0443\u0440\u0438\u0440\u0443\u044E\u0449\u0438\u0439 \u043F\u0430\u0440\u0442\u043D\u0451\u0440" }), partnersLoading ? (_jsx("span", { className: "vac-req-modal__hint", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0441\u043F\u0438\u0441\u043A\u0430 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432\u2026" })) : (_jsx(SearchableSelect, { portalDropdown: true, className: "vac-req-modal__select", buttonClassName: "vac-req-modal__select-btn", "aria-label": "\u041A\u0443\u0440\u0438\u0440\u0443\u044E\u0449\u0438\u0439 \u043F\u0430\u0440\u0442\u043D\u0451\u0440 \u0434\u043B\u044F \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F", placeholder: partners.length === 0 ? 'Партнёры не найдены' : 'Выберите курирующего партнёра…', emptyListText: "\u041D\u0435\u0442 \u0432 \u0441\u043F\u0438\u0441\u043A\u0435", noMatchText: "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", value: partnerId, items: partners, getOptionValue: (o) => o.id, getOptionLabel: (o) => (o.position ? `${o.label} (${o.position})` : o.label), getSearchText: (o) => o.search, disabled: partners.length === 0, onSelect: (o) => setPartnerId(o.id) }))] }), _jsx("p", { className: "vac-req-modal__tip", children: selectedIsManaging
                                        ? 'Вы выбрали управляющего партнёра. Он одобряет заявку сразу, без промежуточного согласования — после утверждения дни появятся в графике.'
                                        : 'Курирующий партнёр получит PDF с кнопками «Утвердить» / «Отклонить». Если он отклонит — заявка аннулируется, если согласует — заявку финально подтверждает управляющий партнёр, и только после этого дни появятся в графике.' })] }), _jsxs("fieldset", { className: "vac-req-modal__section", children: [_jsx("legend", { className: "vac-req-modal__legend", children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439" }), _jsx("textarea", { className: "vac-req-modal__reason", value: reason, onChange: (e) => setReason(e.target.value), placeholder: "\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u2014 \u0434\u043B\u044F \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430 \u0432 \u0437\u0430\u044F\u0432\u043A\u0435 \u0438 PDF", rows: 3, maxLength: 500, disabled: submitting })] }), error && (_jsx("p", { className: "vac-req-modal__error", role: "alert", children: error }))] }), _jsxs("div", { className: "vac-req-modal__footer", children: [_jsx("button", { type: "button", className: "vac-imp-modal__btn-secondary", onClick: onClose, disabled: submitting, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "submit", className: "vac-req-modal__submit", disabled: submitting || partnersLoading, children: submitting ? 'Отправка…' : 'Отправить партнёру' })] })] }) }), document.body);
}
