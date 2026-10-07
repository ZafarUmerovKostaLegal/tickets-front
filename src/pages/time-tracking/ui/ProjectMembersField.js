import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useId, useState, useCallback } from 'react';
import { listTimeTrackingUsers, firstNonStubUserText, pickUserDisplayLabel, upsertTimeTrackingUser, TIME_TRACKING_PROJECT_CURRENCIES } from '@entities/time-tracking';
import { listColleaguesAsUsers } from '@entities/contacts';
import { SearchableSelect } from '@shared/ui';
import { isHiddenSystemUser, compareRuLabels } from '@shared/lib';
import { useI18n } from '@shared/i18n';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
function userLabel(u, fallbackKey, t) {
    return pickUserDisplayLabel(u.display_name, u.email, u.id, t(fallbackKey));
}
function userOptionA11yLabel(u, t) {
    const pos = u.position?.trim();
    return [
        userLabel(u, 'timeTrackingPage.users.panel.fallbackUser', t),
        pos || t('timeTrackingPage.projects.membersField.positionNotSetA11y'),
        u.email,
        String(u.id),
    ].filter(Boolean).join(', ');
}
function userPositionDisplay(u, t) {
    const p = u.position?.trim();
    if (p)
        return { text: p, isPlaceholder: false };
    return { text: t('timeTrackingPage.projects.membersField.positionNotSet'), isPlaceholder: true };
}
function userSearchText(u) {
    return [u.display_name, u.email, String(u.id), u.position].filter(Boolean).join(' ');
}
function authUserToPickerRow(u) {
    return {
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        picture: u.picture,
        role: u.role,
        position: u.position,
        is_blocked: u.is_blocked,
        is_archived: u.is_archived,
        weekly_capacity_hours: u.weekly_capacity_hours ?? undefined,
        created_at: u.created_at,
        updated_at: u.updated_at,
    };
}
function pickerRowToUpsertUser(u) {
    return {
        id: u.id,
        email: u.email,
        display_name: u.display_name ?? null,
        picture: u.picture ?? null,
        role: u.role ?? '',
        position: u.position ?? null,
        is_blocked: u.is_blocked,
        is_archived: u.is_archived,
        time_tracking_role: null,
        created_at: u.created_at,
        updated_at: u.updated_at ?? null,
        desktop_background: null,
    };
}
function fallbackPickerRow(id, t) {
    return {
        id,
        email: '',
        display_name: t('timeTrackingPage.users.panel.fallbackUser').replace('{id}', `#${id}`),
        is_blocked: false,
        is_archived: false,
        created_at: '',
    };
}
function normalizeAssignedIds(ids) {
    const out = [];
    const seen = new Set();
    for (const raw of ids) {
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0 || seen.has(n))
            continue;
        seen.add(n);
        out.push(n);
    }
    return out;
}
function MemberChangeRateFromModal({ memberLabel, projectLabel, currency, currentAmount, onSave, onClose, }) {
    const { t } = useI18n();
    const uid = useId();
    const [effectiveFrom, setEffectiveFrom] = useState('');
    const [amount, setAmount] = useState('');
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const amtNum = parseFloat(amount.replace(',', '.'));
    const handleSubmit = async () => {
        if (!effectiveFrom) {
            setError(t('timeTrackingPage.projects.membersField.changeFrom.errDate'));
            return;
        }
        if (!amount || !Number.isFinite(amtNum) || amtNum <= 0) {
            setError(t('timeTrackingPage.projects.membersField.changeFrom.errAmount'));
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await Promise.resolve(onSave({ effectiveFrom, amount: amtNum, currency }));
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t('timeTrackingPage.projects.membersField.changeFrom.errSave'));
        }
        finally {
            setSaving(false);
        }
    };
    return portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--task", role: "dialog", "aria-modal": "true", onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { className: "tt-tm-modal__title", children: t('timeTrackingPage.projects.membersField.changeFrom.title') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tt-tm-modal__body", children: [_jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.projects.membersField.changeFrom.hint')
                                .replace('{member}', memberLabel)
                                .replace('{project}', projectLabel) }), _jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-eff`, children: t('timeTrackingPage.projects.membersField.changeFrom.effectiveFrom') }), _jsx("input", { id: `${uid}-eff`, type: "date", className: "tt-tm-input", value: effectiveFrom, onChange: (e) => setEffectiveFrom(e.target.value) })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-amt`, children: t('timeTrackingPage.projects.membersField.changeFrom.newAmount') }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem' }, children: [_jsx("input", { id: `${uid}-amt`, type: "text", inputMode: "decimal", className: "tt-tm-input", placeholder: "0.00", value: amount, onChange: (e) => setAmount(e.target.value) }), _jsx("input", { className: "tt-tm-input", style: { maxWidth: '5.5rem' }, value: currency, readOnly: true, disabled: true, "aria-label": t('timeTrackingPage.projects.membersField.changeFrom.currency') })] }), currentAmount != null && Number.isFinite(currentAmount) ? (_jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.projects.membersField.changeFrom.current').replace('{amount}', String(currentAmount)).replace('{currency}', currency) })) : null] }), error ? _jsx("p", { className: "tt-tm-field-error", role: "alert", children: error }) : null] }), _jsxs("div", { className: "tt-tm-modal__foot", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", disabled: saving, onClick: onClose, children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: saving, onClick: () => void handleSubmit(), children: saving ? t('timeTrackingPage.saving') : t('timeTrackingPage.projects.membersField.changeFrom.submit') })] })] }) }));
}
export function ProjectMembersField({ assignedIds, onAssignedChange, disabled = false, showBillableRate = false, projectCurrency, projectName, memberRates, onUpdateMemberRate, allowChangeRateFromDate = false, onChangeRateFromDate, }) {
    const { t } = useI18n();
    const uid = useId();
    const [users, setUsers] = useState([]);
    const [ttUserIds, setTtUserIds] = useState(() => new Set());
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [pickKey, setPickKey] = useState(0);
    const [addingUserId, setAddingUserId] = useState(null);
    const [addError, setAddError] = useState(null);
    const [changeFromUserId, setChangeFromUserId] = useState(null);
    const userFallbackKey = 'timeTrackingPage.users.panel.fallbackUser';
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        Promise.all([
            listTimeTrackingUsers(),
            listColleaguesAsUsers().catch(() => []),
        ])
            .then(([ttRows, authRows]) => {
            if (cancelled)
                return;
            const activeTt = ttRows.filter((u) => !u.is_archived && !u.is_blocked && !isHiddenSystemUser(u));
            const byId = new Map();
            for (const u of activeTt)
                byId.set(u.id, u);
            setTtUserIds(new Set(activeTt.map((u) => u.id)));
            for (const au of authRows) {
                if (au.is_archived || au.is_blocked)
                    continue;
                if (isHiddenSystemUser(au))
                    continue;
                if (!byId.has(au.id))
                    byId.set(au.id, authUserToPickerRow(au));
                else {
                    const existing = byId.get(au.id);
                    if (existing) {
                        byId.set(au.id, {
                            ...existing,
                            display_name: firstNonStubUserText(existing.display_name, au.display_name) ?? existing.display_name,
                            email: firstNonStubUserText(existing.email, au.email) ?? existing.email,
                            picture: existing.picture || au.picture,
                        });
                    }
                }
            }
            const merged = [...byId.values()].sort((a, b) => compareRuLabels(userLabel(a, userFallbackKey, t), userLabel(b, userFallbackKey, t)));
            setUsers(merged);
        })
            .catch((e) => {
            if (!cancelled) {
                setLoadError(e instanceof Error ? e.message : t('timeTrackingPage.projects.membersField.errLoadUsers'));
                setUsers([]);
                setTtUserIds(new Set());
            }
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [t]);
    const normalizedAssignedIds = useMemo(() => normalizeAssignedIds(assignedIds), [assignedIds]);
    const assignedSet = useMemo(() => new Set(normalizedAssignedIds), [normalizedAssignedIds]);
    const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
    const assignedUsers = useMemo(() => normalizedAssignedIds.map((id) => userById.get(id) ?? fallbackPickerRow(id, t)), [normalizedAssignedIds, userById, t]);
    const available = useMemo(() => users.filter((u) => !assignedSet.has(u.id)), [users, assignedSet]);
    const remove = (id) => {
        if (disabled)
            return;
        onAssignedChange(normalizedAssignedIds.filter((x) => x !== id));
    };
    const addMember = useCallback(async (u) => {
        if (disabled || addingUserId != null)
            return;
        if (assignedSet.has(u.id))
            return;
        setAddError(null);
        if (!ttUserIds.has(u.id)) {
            setAddingUserId(u.id);
            try {
                await upsertTimeTrackingUser(pickerRowToUpsertUser(u));
                setTtUserIds((prev) => new Set([...prev, u.id]));
            }
            catch (e) {
                setAddError(e instanceof Error ? e.message : t('timeTrackingPage.projects.membersField.errAddToTt'));
                setAddingUserId(null);
                return;
            }
            setAddingUserId(null);
        }
        onAssignedChange([...normalizedAssignedIds, u.id]);
        setPickKey((k) => k + 1);
    }, [disabled, addingUserId, assignedSet, normalizedAssignedIds, onAssignedChange, ttUserIds, t]);
    const addLabelId = `${uid}-members-label`;
    const addHintId = `${uid}-members-hint`;
    const curOpts = useMemo(() => TIME_TRACKING_PROJECT_CURRENCIES, []);
    const pickerDisabled = disabled || addingUserId != null;
    const changeFromUser = changeFromUserId != null
        ? (userById.get(changeFromUserId) ?? fallbackPickerRow(changeFromUserId, t))
        : null;
    const changeFromDraft = changeFromUserId != null ? memberRates[changeFromUserId] : undefined;
    return (_jsxs("div", { className: "tt-tm-field tt-tm-members", children: [_jsx("span", { className: "tt-tm-label", id: addLabelId, children: t('timeTrackingPage.projects.membersField.label') }), loadError && (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: loadError })), addError && (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: addError })), loading && !loadError && (_jsx("p", { className: "tt-tm-hint", role: "status", children: t('timeTrackingPage.projects.membersField.loadingUsers') })), !loading && !loadError && (_jsxs(_Fragment, { children: [assignedUsers.length > 0 && (_jsx("ul", { className: "tt-tm-members__chips", "aria-label": t('timeTrackingPage.projects.membersField.selectedAria'), children: assignedUsers.map((u) => {
                            const dr = memberRates[u.id] ?? { amount: '', currency: projectCurrency || 'USD' };
                            const pos = userPositionDisplay(u, t);
                            const label = userLabel(u, userFallbackKey, t);
                            const sourceHint = dr.source === 'global'
                                ? t('timeTrackingPage.projects.membersField.rateSourceGlobal')
                                : dr.source === 'project'
                                    ? t('timeTrackingPage.projects.membersField.rateSourceProject')
                                    : dr.source === 'other_project'
                                        ? t('timeTrackingPage.projects.membersField.rateSourceOtherProject')
                                        : null;
                            return (_jsxs("li", { className: "tt-tm-members__chip", children: [_jsxs("div", { className: "tt-tm-members__chip-identity", children: [_jsx("span", { className: "tt-tm-members__chip-text", children: label }), _jsx("span", { className: `tt-tm-members__chip-position${pos.isPlaceholder ? ' tt-tm-members__chip-position--empty' : ''}`, children: pos.text }), u.email ? (_jsx("span", { className: "tt-tm-members__chip-meta", children: u.email })) : null] }), showBillableRate && (_jsxs("div", { className: "tt-tm-members__rate", onClick: (e) => e.stopPropagation(), children: [_jsx("label", { className: "tt-tm-members__rate-lbl", htmlFor: `${uid}-rate-${u.id}`, children: t('timeTrackingPage.projects.membersField.billableRateLabel') }), _jsxs("div", { className: "tt-tm-members__rate-row", children: [_jsx("input", { id: `${uid}-rate-${u.id}`, type: "text", className: "tt-tm-input tt-tm-members__rate-amt", inputMode: "decimal", autoComplete: "off", placeholder: "0.00", value: dr.amount, disabled: disabled, onChange: (e) => onUpdateMemberRate(u.id, { ...dr, amount: e.target.value }), "aria-label": t('timeTrackingPage.projects.membersField.rateAria').replace('{name}', label) }), _jsx("select", { className: "tt-tm-input tt-tm-members__rate-cur", value: TIME_TRACKING_PROJECT_CURRENCIES.includes(dr.currency) ? dr.currency : 'USD', disabled: disabled, onChange: (e) => onUpdateMemberRate(u.id, { ...dr, currency: e.target.value }), "aria-label": t('timeTrackingPage.projects.membersField.currencyAria').replace('{name}', label), children: curOpts.map((c) => (_jsx("option", { value: c, children: c }, c))) })] }), sourceHint ? _jsx("p", { className: "tt-tm-hint tt-tm-members__rate-source", children: sourceHint }) : null, allowChangeRateFromDate && onChangeRateFromDate && !disabled ? (_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost tt-tm-members__change-from", onClick: () => setChangeFromUserId(u.id), children: t('timeTrackingPage.projects.membersField.changeFrom.cta') })) : null] })), _jsx("button", { type: "button", className: "tt-tm-members__chip-remove", disabled: disabled, onClick: () => remove(u.id), "aria-label": t('timeTrackingPage.projects.membersField.removeAria').replace('{name}', label), title: t('timeTrackingPage.projects.membersField.removeTitle'), children: _jsx("svg", { viewBox: "0 0 24 24", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }, u.id));
                        }) })), available.length === 0
                        ? (assignedUsers.length === 0
                            ? (_jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.projects.membersField.noUsersAvailable') }))
                            : (_jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.projects.membersField.allAdded') })))
                        : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tt-tm-members__add-row", children: [_jsx("button", { type: "button", className: "tt-tm-members__add-plus", disabled: pickerDisabled, title: t('timeTrackingPage.projects.membersField.addMemberTitle'), "aria-label": t('timeTrackingPage.projects.membersField.addMemberAria'), onClick: () => {
                                                if (pickerDisabled)
                                                    return;
                                                document.getElementById(`${uid}-add-member`)?.click();
                                            }, children: _jsxs("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }) }), _jsx(SearchableSelect, { buttonId: `${uid}-add-member`, className: "tt-tm-dd tt-tm-members__add-select", buttonClassName: "tt-tm-dd__btn", value: "", items: available, getOptionValue: (u) => String(u.id), getOptionLabel: (u) => userOptionA11yLabel(u, t), getSearchText: userSearchText, onSelect: (u) => {
                                                void addMember(u);
                                            }, placeholder: addingUserId != null ? t('timeTrackingPage.projects.membersField.adding') : t('timeTrackingPage.projects.membersField.addPlaceholder'), emptyListText: t('timeTrackingPage.projects.membersField.noUsers'), noMatchText: t('timeTrackingPage.projects.membersField.noMatch'), disabled: pickerDisabled, portalDropdown: true, portalZIndex: 12000, portalMinWidth: 300, portalDropdownClassName: "tsp-srch__dropdown--tall", "aria-labelledby": addLabelId, "aria-describedby": addHintId, renderOption: (u) => {
                                                const { text, isPlaceholder } = userPositionDisplay(u, t);
                                                const needsTt = !ttUserIds.has(u.id);
                                                return (_jsxs("span", { className: "tt-tm-members__opt", children: [_jsx("span", { className: "tt-tm-members__opt-name", children: userLabel(u, userFallbackKey, t) }), _jsx("span", { className: `tt-tm-members__opt-position${isPlaceholder ? ' tt-tm-members__opt-position--empty' : ''}`, children: text }), u.email ? (_jsx("span", { className: "tt-tm-members__opt-email", children: u.email })) : null, needsTt ? (_jsx("span", { className: "tt-tm-members__opt-email", children: t('timeTrackingPage.projects.membersField.willAddToTt') })) : null] }));
                                            } }, pickKey)] }), _jsx("p", { id: addHintId, className: "tt-tm-hint tt-tm-members__add-hint", children: showBillableRate
                                        ? t('timeTrackingPage.projects.membersField.hintWithRate')
                                        : t('timeTrackingPage.projects.membersField.hint') })] }))] })), changeFromUser && onChangeRateFromDate ? (_jsx(MemberChangeRateFromModal, { memberLabel: userLabel(changeFromUser, userFallbackKey, t), projectLabel: (projectName || '').trim() || '—', currency: (changeFromDraft?.currency || projectCurrency || 'USD').trim() || 'USD', currentAmount: (() => {
                    const n = parseFloat(String(changeFromDraft?.amount ?? '').replace(',', '.'));
                    return Number.isFinite(n) ? n : null;
                })(), onSave: (data) => onChangeRateFromDate(changeFromUser.id, data), onClose: () => setChangeFromUserId(null) })) : null] }));
}
