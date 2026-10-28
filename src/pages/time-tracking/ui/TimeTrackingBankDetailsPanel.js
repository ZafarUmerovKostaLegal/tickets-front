import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './TimeTrackingForms.css';
import { useEffect, useId, useMemo, useState } from 'react';
import { createFirmBankProfile, deleteFirmBankProfile, loadFirmBankingProfiles, patchFirmBankProfile, setDefaultFirmBankProfile, } from '@entities/time-tracking/api';
import { TIME_TRACKING_PROJECT_CURRENCIES } from '@entities/time-tracking';
import { createEmptyFirmBankingProfile, EMPTY_FIRM_BANKING_DETAILS, profileDisplayTitle, } from '@entities/time-tracking/lib/firmBankingDetailsStorage';
import { canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { SearchableSelect, useAppDialog, useAppToast } from '@shared/ui';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
import './TimeTrackingBankDetailsPanel.css';
const IcoPen = () => (_jsxs("svg", { className: "tt-task-card__btn-ico", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), _jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })] }));
const IcoTrash = () => (_jsxs("svg", { className: "tt-task-card__btn-ico", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("polyline", { points: "3 6 5 6 21 6" }), _jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })] }));
const IcoStar = () => (_jsx("svg", { className: "tt-bank-card__star", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, children: _jsx("path", { d: "M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19.5l1-5.8L3.6 9.6l5.8-.8L12 3.5z" }) }));
function emptyForm() {
    return {
        title: '',
        isDefault: false,
        ...EMPTY_FIRM_BANKING_DETAILS,
    };
}
function profileToForm(row) {
    return {
        title: row.title,
        isDefault: row.isDefault,
        tin: row.tin,
        bankName: row.bankName,
        bankAddress: row.bankAddress,
        accountCurrency: row.accountCurrency,
        accountNumber: row.accountNumber,
        bankCode: row.bankCode,
        swift: row.swift,
        correspondentBank: row.correspondentBank,
        correspondentAccount: row.correspondentAccount,
    };
}
function metaChips(row, t) {
    const chips = [];
    if (row.accountCurrency.trim())
        chips.push(row.accountCurrency.trim());
    if (row.accountNumber.trim())
        chips.push(row.accountNumber.trim());
    if (row.swift.trim())
        chips.push(`${t('timeTrackingPage.bankDetails.fields.swift')}: ${row.swift.trim()}`);
    if (row.tin.trim())
        chips.push(`${t('timeTrackingPage.bankDetails.fields.tin')}: ${row.tin.trim()}`);
    return chips;
}
function BankDetailsModal({ mode, initial, profilesCount, onClose, onSaved }) {
    const { t } = useI18n();
    const { pushToast } = useAppToast();
    const uid = useId();
    const [form, setForm] = useState(() => (initial ? profileToForm(initial) : emptyForm()));
    const [saving, setSaving] = useState(false);
    const currencyOptions = useMemo(() => TIME_TRACKING_PROJECT_CURRENCIES.map((c) => ({ id: c, label: c })), []);
    const patch = (partial) => setForm((f) => ({ ...f, ...partial }));
    const handleSubmit = async () => {
        if (saving)
            return;
        setSaving(true);
        try {
            const base = initial ?? createEmptyFirmBankingProfile();
            const next = {
                ...base,
                title: form.title.trim(),
                tin: form.tin.trim(),
                bankName: form.bankName.trim(),
                bankAddress: form.bankAddress.trim(),
                accountCurrency: form.accountCurrency.trim().toUpperCase() || 'EUR',
                accountNumber: form.accountNumber.trim(),
                bankCode: form.bankCode.trim(),
                swift: form.swift.trim(),
                correspondentBank: form.correspondentBank.trim(),
                correspondentAccount: form.correspondentAccount.trim(),
                isDefault: form.isDefault || profilesCount === 0,
            };
            if (mode === 'create' || !initial) {
                await createFirmBankProfile(next, { makeDefault: next.isDefault });
            }
            else {
                await patchFirmBankProfile(initial.id, {
                    title: next.title,
                    tin: next.tin,
                    bankName: next.bankName,
                    bankAddress: next.bankAddress,
                    accountCurrency: next.accountCurrency,
                    accountNumber: next.accountNumber,
                    bankCode: next.bankCode,
                    swift: next.swift,
                    correspondentBank: next.correspondentBank,
                    correspondentAccount: next.correspondentAccount,
                    isDefault: next.isDefault,
                });
            }
            onSaved();
            onClose();
        }
        catch (e) {
            pushToast({
                message: e instanceof Error ? e.message : t('timeTrackingPage.bankDetails.saveError'),
                variant: 'error',
            });
        }
        finally {
            setSaving(false);
        }
    };
    return portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", onClick: onClose, children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--task tt-bank-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { id: `${uid}-title`, className: "tt-tm-modal__title", children: mode === 'create'
                                ? t('timeTrackingPage.bankDetails.modal.createTitle')
                                : t('timeTrackingPage.bankDetails.modal.editTitle') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tt-tm-modal__body", children: [_jsx("p", { className: "tt-bank-modal__hint", children: t('timeTrackingPage.bankDetails.modal.allOptional') }), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-title-inp`, children: [t('timeTrackingPage.bankDetails.fields.title'), _jsx("span", { className: "tt-bank-optional", children: t('timeTrackingPage.bankDetails.optional') })] }), _jsx("input", { id: `${uid}-title-inp`, className: "tt-tm-input", value: form.title, onChange: (e) => patch({ title: e.target.value }), placeholder: t('timeTrackingPage.bankDetails.fields.titlePlaceholder'), disabled: saving, autoComplete: "off" })] }), _jsxs("div", { className: "tt-bank-modal__grid", children: [_jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-tin`, children: [t('timeTrackingPage.bankDetails.fields.tin'), _jsx("span", { className: "tt-bank-optional", children: t('timeTrackingPage.bankDetails.optional') })] }), _jsx("input", { id: `${uid}-tin`, className: "tt-tm-input", value: form.tin, onChange: (e) => patch({ tin: e.target.value }), disabled: saving, autoComplete: "off" })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-bank`, children: [t('timeTrackingPage.bankDetails.fields.bankName'), _jsx("span", { className: "tt-bank-optional", children: t('timeTrackingPage.bankDetails.optional') })] }), _jsx("input", { id: `${uid}-bank`, className: "tt-tm-input", value: form.bankName, onChange: (e) => patch({ bankName: e.target.value }), disabled: saving, autoComplete: "organization" })] }), _jsxs("div", { className: "tt-tm-field tt-bank-modal__wide", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-addr`, children: [t('timeTrackingPage.bankDetails.fields.bankAddress'), _jsx("span", { className: "tt-bank-optional", children: t('timeTrackingPage.bankDetails.optional') })] }), _jsx("input", { id: `${uid}-addr`, className: "tt-tm-input", value: form.bankAddress, onChange: (e) => patch({ bankAddress: e.target.value }), disabled: saving, autoComplete: "street-address" })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("span", { className: "tt-tm-label", id: `${uid}-cur-lbl`, children: [t('timeTrackingPage.bankDetails.fields.accountCurrency'), _jsx("span", { className: "tt-bank-optional", children: t('timeTrackingPage.bankDetails.optional') })] }), _jsx(SearchableSelect, { className: "tt-tm-dd", buttonClassName: "tt-tm-dd__btn", buttonId: `${uid}-cur`, value: form.accountCurrency, items: currencyOptions, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.label, getSearchText: (o) => o.label, onSelect: (o) => patch({ accountCurrency: o.id }), placeholder: t('timeTrackingPage.bankDetails.fields.accountCurrency'), emptyListText: t('timeTrackingPage.projects.modal.noOptions'), noMatchText: t('timeTrackingPage.common.notFound'), disabled: saving, portalDropdown: true, portalZIndex: 11020, portalMinWidth: 160, "aria-labelledby": `${uid}-cur-lbl` })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-acc`, children: [t('timeTrackingPage.bankDetails.fields.accountNumber'), _jsx("span", { className: "tt-bank-optional", children: t('timeTrackingPage.bankDetails.optional') })] }), _jsx("input", { id: `${uid}-acc`, className: "tt-tm-input", value: form.accountNumber, onChange: (e) => patch({ accountNumber: e.target.value }), disabled: saving, autoComplete: "off" })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-code`, children: [t('timeTrackingPage.bankDetails.fields.bankCode'), _jsx("span", { className: "tt-bank-optional", children: t('timeTrackingPage.bankDetails.optional') })] }), _jsx("input", { id: `${uid}-code`, className: "tt-tm-input", value: form.bankCode, onChange: (e) => patch({ bankCode: e.target.value }), disabled: saving, autoComplete: "off" })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-swift`, children: [t('timeTrackingPage.bankDetails.fields.swift'), _jsx("span", { className: "tt-bank-optional", children: t('timeTrackingPage.bankDetails.optional') })] }), _jsx("input", { id: `${uid}-swift`, className: "tt-tm-input", value: form.swift, onChange: (e) => patch({ swift: e.target.value }), disabled: saving, autoComplete: "off" })] }), _jsxs("div", { className: "tt-tm-field tt-bank-modal__wide", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-cb`, children: [t('timeTrackingPage.bankDetails.fields.correspondentBank'), _jsx("span", { className: "tt-bank-optional", children: t('timeTrackingPage.bankDetails.optional') })] }), _jsx("input", { id: `${uid}-cb`, className: "tt-tm-input", value: form.correspondentBank, onChange: (e) => patch({ correspondentBank: e.target.value }), disabled: saving, autoComplete: "off" })] }), _jsxs("div", { className: "tt-tm-field tt-bank-modal__wide", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-ca`, children: [t('timeTrackingPage.bankDetails.fields.correspondentAccount'), _jsx("span", { className: "tt-bank-optional", children: t('timeTrackingPage.bankDetails.optional') })] }), _jsx("input", { id: `${uid}-ca`, className: "tt-tm-input", value: form.correspondentAccount, onChange: (e) => patch({ correspondentAccount: e.target.value }), disabled: saving, autoComplete: "off" })] })] }), _jsxs("label", { className: "tt-tm-check-row tt-bank-modal__default", children: [_jsx("input", { type: "checkbox", checked: form.isDefault || profilesCount === 0, onChange: (e) => patch({ isDefault: e.target.checked }), disabled: saving || profilesCount === 0 }), _jsx("span", { children: t('timeTrackingPage.bankDetails.fields.isDefault') })] })] }), _jsxs("div", { className: "tt-tm-modal__foot", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", disabled: saving, onClick: onClose, children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: saving, onClick: () => void handleSubmit(), children: saving
                                ? t('timeTrackingPage.saving')
                                : mode === 'create'
                                    ? t('timeTrackingPage.common.create')
                                    : t('timeTrackingPage.save') })] })] }) }));
}
export function TimeTrackingBankDetailsPanel() {
    const { t } = useI18n();
    const { pushToast } = useAppToast();
    const { showConfirm } = useAppDialog();
    const { user } = useCurrentUser();
    const canManage = canManageTimeTrackingClients(user);
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const untitled = t('timeTrackingPage.bankDetails.untitled');
    const reload = async () => {
        const list = await loadFirmBankingProfiles({ migrateLocal: canManage });
        setProfiles(list);
        return list;
    };
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const list = await loadFirmBankingProfiles({ migrateLocal: canManage });
                if (!cancelled)
                    setProfiles(list);
            }
            catch {
                if (!cancelled)
                    setProfiles([]);
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [canManage]);
    const handleDelete = async (row) => {
        if (!canManage)
            return;
        const ok = await showConfirm({
            title: t('timeTrackingPage.bankDetails.deleteConfirm.title'),
            message: t('timeTrackingPage.bankDetails.deleteConfirm.message').replace('{name}', profileDisplayTitle(row, untitled)),
            variant: 'danger',
            confirmLabel: t('timeTrackingPage.delete'),
        });
        if (!ok)
            return;
        try {
            await deleteFirmBankProfile(row.id);
            await reload();
            pushToast({ message: t('timeTrackingPage.bankDetails.deleted'), variant: 'info' });
        }
        catch (e) {
            pushToast({
                message: e instanceof Error ? e.message : t('timeTrackingPage.bankDetails.saveError'),
                variant: 'error',
            });
        }
    };
    const handleSetDefault = async (row) => {
        if (!canManage || row.isDefault)
            return;
        try {
            await setDefaultFirmBankProfile(row.id);
            await reload();
            pushToast({ message: t('timeTrackingPage.bankDetails.defaultSet'), variant: 'success' });
        }
        catch (e) {
            pushToast({
                message: e instanceof Error ? e.message : t('timeTrackingPage.bankDetails.saveError'),
                variant: 'error',
            });
        }
    };
    return (_jsxs("div", { className: "tt-settings__content tt-tasks-page tt-bank-page", children: [_jsx("h1", { className: "tt-settings__page-title", children: t('timeTrackingPage.bankDetails.title') }), _jsx("p", { className: "tt-settings__desc tt-tasks-page__lead", children: t('timeTrackingPage.bankDetails.intro') }), _jsxs("div", { className: "tt-tasks-page__controls", children: [_jsx("div", { className: "tt-tasks-toolbar tt-ecat-toolbar", children: _jsx("div", { className: "tt-ecat-toolbar__main", children: _jsxs("div", { className: "tt-ecat-toolbar__row tt-bank-page__toolbar-row", children: [_jsx("p", { className: "tt-bank-page__toolbar-hint", children: t('timeTrackingPage.bankDetails.toolbarHint') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary tt-ecat-toolbar__new-btn", disabled: !canManage || loading, title: !canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined, onClick: () => setModal({ mode: 'create', row: null }), children: t('timeTrackingPage.bankDetails.cta.newProfile') })] }) }) }), _jsxs("div", { className: "tt-tasks-page__notice", children: [_jsx("p", { className: "tt-tasks-page__notice-title", children: t('timeTrackingPage.bankDetails.policy.title') }), _jsx("p", { className: "tt-tasks-page__notice-text", children: t('timeTrackingPage.bankDetails.policy.text') })] })] }), !canManage ? (_jsx("p", { className: "tt-settings__banner-info tt-tasks-page__banner", role: "status", children: t('timeTrackingPage.bankDetails.viewOnly') })) : null, _jsx("h2", { className: "tt-tasks-page__list-heading", children: t('timeTrackingPage.bankDetails.listHeading') }), _jsx("div", { className: "tt-settings__list tt-tasks-page__list tt-bank-page__list", children: loading ? (_jsx("div", { className: "tt-settings__rates-empty tt-settings__list-empty-inner tt-tasks-page__empty", children: t('timeTrackingPage.bankDetails.loading') })) : profiles.length === 0 ? (_jsx("div", { className: "tt-settings__rates-empty tt-settings__list-empty-inner tt-tasks-page__empty", children: t('timeTrackingPage.bankDetails.empty') })) : (profiles.map((row) => {
                    const chips = metaChips(row, t);
                    return (_jsxs("div", { className: `tt-settings__list-row tt-task-card tt-task-card--v2 tt-bank-card${row.isDefault ? ' tt-bank-card--default' : ''}`, children: [_jsxs("div", { className: "tt-task-card__body", children: [_jsx("div", { className: "tt-task-card__line", children: _jsxs("h3", { className: "tt-task-card__title", children: [profileDisplayTitle(row, untitled), row.isDefault ? (_jsxs("span", { className: "tt-bank-badge tt-bank-badge--default", title: t('timeTrackingPage.bankDetails.defaultBadge'), children: [_jsx(IcoStar, {}), t('timeTrackingPage.bankDetails.defaultBadge')] })) : null] }) }), row.bankName.trim() && row.title.trim() ? (_jsx("p", { className: "tt-bank-card__bank", children: row.bankName.trim() })) : null, row.bankAddress.trim() ? (_jsx("p", { className: "tt-bank-card__addr", children: row.bankAddress.trim() })) : null, _jsx("ul", { className: "tt-bank-card__chips", "aria-label": t('timeTrackingPage.bankDetails.listHeading'), children: chips.length === 0 ? (_jsx("li", { className: "tt-bank-card__chip tt-bank-card__chip--empty", children: t('timeTrackingPage.bankDetails.noFieldsFilled') })) : (chips.map((chip) => (_jsx("li", { className: "tt-bank-card__chip", children: chip }, chip)))) })] }), _jsxs("div", { className: "tt-task-card__actions", children: [!row.isDefault && canManage ? (_jsx("button", { type: "button", className: "tt-task-card__text-btn", onClick: () => void handleSetDefault(row), children: t('timeTrackingPage.bankDetails.actions.makeDefault') })) : null, _jsx("button", { type: "button", className: "tt-task-card__icon-btn", disabled: !canManage, title: t('timeTrackingPage.common.edit'), "aria-label": t('timeTrackingPage.common.edit'), onClick: () => setModal({ mode: 'edit', row }), children: _jsx(IcoPen, {}) }), _jsx("button", { type: "button", className: "tt-task-card__icon-btn tt-task-card__icon-btn--danger", disabled: !canManage, title: t('timeTrackingPage.delete'), "aria-label": t('timeTrackingPage.delete'), onClick: () => void handleDelete(row), children: _jsx(IcoTrash, {}) })] })] }, row.id));
                })) }), modal ? (_jsx(BankDetailsModal, { mode: modal.mode, initial: modal.row, profilesCount: profiles.length, onClose: () => setModal(null), onSaved: () => {
                    void reload().then(() => {
                        pushToast({
                            message: modal.mode === 'create'
                                ? t('timeTrackingPage.bankDetails.created')
                                : t('timeTrackingPage.bankDetails.saved'),
                            variant: 'success',
                        });
                    });
                } })) : null] }));
}
