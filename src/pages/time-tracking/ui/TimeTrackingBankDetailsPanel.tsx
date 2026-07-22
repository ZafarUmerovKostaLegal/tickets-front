import { useId, useMemo, useState } from 'react';
import { TIME_TRACKING_PROJECT_CURRENCIES, type TimeManagerProjectCurrency } from '@entities/time-tracking';
import {
    createEmptyFirmBankingProfile,
    deleteFirmBankingProfile,
    EMPTY_FIRM_BANKING_DETAILS,
    listFirmBankingProfiles,
    profileDisplayTitle,
    setDefaultFirmBankingProfile,
    upsertFirmBankingProfile,
    type FirmBankingDetails,
    type FirmBankingProfile,
} from '@entities/time-tracking/lib/firmBankingDetailsStorage';
import { canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { SearchableSelect, useAppDialog, useAppToast } from '@shared/ui';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
import './TimeTrackingBankDetailsPanel.css';

type CurrencyOpt = { id: TimeManagerProjectCurrency; label: string };

type FormState = FirmBankingDetails & {
    title: string;
    isDefault: boolean;
};

const IcoPen = () => (
    <svg className="tt-task-card__btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const IcoTrash = () => (
    <svg className="tt-task-card__btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const IcoStar = () => (
    <svg className="tt-bank-card__star" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19.5l1-5.8L3.6 9.6l5.8-.8L12 3.5z" />
    </svg>
);

function emptyForm(): FormState {
    return {
        title: '',
        isDefault: false,
        ...EMPTY_FIRM_BANKING_DETAILS,
    };
}

function profileToForm(row: FirmBankingProfile): FormState {
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

function metaChips(row: FirmBankingProfile, t: (k: string) => string): string[] {
    const chips: string[] = [];
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

type BankModalProps = {
    mode: 'create' | 'edit';
    initial: FirmBankingProfile | null;
    profilesCount: number;
    onClose: () => void;
    onSaved: (list: FirmBankingProfile[]) => void;
};

function BankDetailsModal({ mode, initial, profilesCount, onClose, onSaved }: BankModalProps) {
    const { t } = useI18n();
    const uid = useId();
    const [form, setForm] = useState<FormState>(() => (initial ? profileToForm(initial) : emptyForm()));
    const [saving, setSaving] = useState(false);

    const currencyOptions = useMemo<CurrencyOpt[]>(
        () => TIME_TRACKING_PROJECT_CURRENCIES.map((c) => ({ id: c, label: c })),
        [],
    );

    const patch = (partial: Partial<FormState>) => setForm((f) => ({ ...f, ...partial }));

    const handleSubmit = () => {
        if (saving)
            return;
        setSaving(true);
        try {
            const base = initial ?? createEmptyFirmBankingProfile();
            const next: FirmBankingProfile = {
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
            const list = upsertFirmBankingProfile(next, { makeDefault: next.isDefault });
            onSaved(list);
            onClose();
        }
        finally {
            setSaving(false);
        }
    };

    return portalTimeTrackingModal(
        <div className="tt-tm-modal-backdrop" role="presentation" onClick={onClose}>
            <div
                className="tt-tm-modal tt-tm-modal--task tt-bank-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${uid}-title`}
                onClick={(ev) => ev.stopPropagation()}
            >
                <div className="tt-tm-modal__head">
                    <h2 id={`${uid}-title`} className="tt-tm-modal__title">
                        {mode === 'create'
                            ? t('timeTrackingPage.bankDetails.modal.createTitle')
                            : t('timeTrackingPage.bankDetails.modal.editTitle')}
                    </h2>
                    <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="tt-tm-modal__body">
                    <p className="tt-bank-modal__hint">{t('timeTrackingPage.bankDetails.modal.allOptional')}</p>

                    <div className="tt-tm-field">
                        <label className="tt-tm-label" htmlFor={`${uid}-title-inp`}>
                            {t('timeTrackingPage.bankDetails.fields.title')}
                            <span className="tt-bank-optional">{t('timeTrackingPage.bankDetails.optional')}</span>
                        </label>
                        <input
                            id={`${uid}-title-inp`}
                            className="tt-tm-input"
                            value={form.title}
                            onChange={(e) => patch({ title: e.target.value })}
                            placeholder={t('timeTrackingPage.bankDetails.fields.titlePlaceholder')}
                            disabled={saving}
                            autoComplete="off"
                        />
                    </div>

                    <div className="tt-bank-modal__grid">
                        <div className="tt-tm-field">
                            <label className="tt-tm-label" htmlFor={`${uid}-tin`}>
                                {t('timeTrackingPage.bankDetails.fields.tin')}
                                <span className="tt-bank-optional">{t('timeTrackingPage.bankDetails.optional')}</span>
                            </label>
                            <input id={`${uid}-tin`} className="tt-tm-input" value={form.tin} onChange={(e) => patch({ tin: e.target.value })} disabled={saving} autoComplete="off" />
                        </div>
                        <div className="tt-tm-field">
                            <label className="tt-tm-label" htmlFor={`${uid}-bank`}>
                                {t('timeTrackingPage.bankDetails.fields.bankName')}
                                <span className="tt-bank-optional">{t('timeTrackingPage.bankDetails.optional')}</span>
                            </label>
                            <input id={`${uid}-bank`} className="tt-tm-input" value={form.bankName} onChange={(e) => patch({ bankName: e.target.value })} disabled={saving} autoComplete="organization" />
                        </div>
                        <div className="tt-tm-field tt-bank-modal__wide">
                            <label className="tt-tm-label" htmlFor={`${uid}-addr`}>
                                {t('timeTrackingPage.bankDetails.fields.bankAddress')}
                                <span className="tt-bank-optional">{t('timeTrackingPage.bankDetails.optional')}</span>
                            </label>
                            <input id={`${uid}-addr`} className="tt-tm-input" value={form.bankAddress} onChange={(e) => patch({ bankAddress: e.target.value })} disabled={saving} autoComplete="street-address" />
                        </div>
                        <div className="tt-tm-field">
                            <span className="tt-tm-label" id={`${uid}-cur-lbl`}>
                                {t('timeTrackingPage.bankDetails.fields.accountCurrency')}
                                <span className="tt-bank-optional">{t('timeTrackingPage.bankDetails.optional')}</span>
                            </span>
                            <SearchableSelect<CurrencyOpt>
                                className="tt-tm-dd"
                                buttonClassName="tt-tm-dd__btn"
                                buttonId={`${uid}-cur`}
                                value={form.accountCurrency}
                                items={currencyOptions}
                                getOptionValue={(o) => o.id}
                                getOptionLabel={(o) => o.label}
                                getSearchText={(o) => o.label}
                                onSelect={(o) => patch({ accountCurrency: o.id })}
                                placeholder={t('timeTrackingPage.bankDetails.fields.accountCurrency')}
                                emptyListText={t('timeTrackingPage.projects.modal.noOptions')}
                                noMatchText={t('timeTrackingPage.common.notFound')}
                                disabled={saving}
                                portalDropdown
                                portalZIndex={11020}
                                portalMinWidth={160}
                                aria-labelledby={`${uid}-cur-lbl`}
                            />
                        </div>
                        <div className="tt-tm-field">
                            <label className="tt-tm-label" htmlFor={`${uid}-acc`}>
                                {t('timeTrackingPage.bankDetails.fields.accountNumber')}
                                <span className="tt-bank-optional">{t('timeTrackingPage.bankDetails.optional')}</span>
                            </label>
                            <input id={`${uid}-acc`} className="tt-tm-input" value={form.accountNumber} onChange={(e) => patch({ accountNumber: e.target.value })} disabled={saving} autoComplete="off" />
                        </div>
                        <div className="tt-tm-field">
                            <label className="tt-tm-label" htmlFor={`${uid}-code`}>
                                {t('timeTrackingPage.bankDetails.fields.bankCode')}
                                <span className="tt-bank-optional">{t('timeTrackingPage.bankDetails.optional')}</span>
                            </label>
                            <input id={`${uid}-code`} className="tt-tm-input" value={form.bankCode} onChange={(e) => patch({ bankCode: e.target.value })} disabled={saving} autoComplete="off" />
                        </div>
                        <div className="tt-tm-field">
                            <label className="tt-tm-label" htmlFor={`${uid}-swift`}>
                                {t('timeTrackingPage.bankDetails.fields.swift')}
                                <span className="tt-bank-optional">{t('timeTrackingPage.bankDetails.optional')}</span>
                            </label>
                            <input id={`${uid}-swift`} className="tt-tm-input" value={form.swift} onChange={(e) => patch({ swift: e.target.value })} disabled={saving} autoComplete="off" />
                        </div>
                        <div className="tt-tm-field tt-bank-modal__wide">
                            <label className="tt-tm-label" htmlFor={`${uid}-cb`}>
                                {t('timeTrackingPage.bankDetails.fields.correspondentBank')}
                                <span className="tt-bank-optional">{t('timeTrackingPage.bankDetails.optional')}</span>
                            </label>
                            <input id={`${uid}-cb`} className="tt-tm-input" value={form.correspondentBank} onChange={(e) => patch({ correspondentBank: e.target.value })} disabled={saving} autoComplete="off" />
                        </div>
                        <div className="tt-tm-field tt-bank-modal__wide">
                            <label className="tt-tm-label" htmlFor={`${uid}-ca`}>
                                {t('timeTrackingPage.bankDetails.fields.correspondentAccount')}
                                <span className="tt-bank-optional">{t('timeTrackingPage.bankDetails.optional')}</span>
                            </label>
                            <input id={`${uid}-ca`} className="tt-tm-input" value={form.correspondentAccount} onChange={(e) => patch({ correspondentAccount: e.target.value })} disabled={saving} autoComplete="off" />
                        </div>
                    </div>

                    <label className="tt-tm-check-row tt-bank-modal__default">
                        <input
                            type="checkbox"
                            checked={form.isDefault || profilesCount === 0}
                            onChange={(e) => patch({ isDefault: e.target.checked })}
                            disabled={saving || profilesCount === 0}
                        />
                        <span>{t('timeTrackingPage.bankDetails.fields.isDefault')}</span>
                    </label>
                </div>

                <div className="tt-tm-modal__foot">
                    <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>
                        {t('timeTrackingPage.cancel')}
                    </button>
                    <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving} onClick={handleSubmit}>
                        {saving
                            ? t('timeTrackingPage.saving')
                            : mode === 'create'
                                ? t('timeTrackingPage.common.create')
                                : t('timeTrackingPage.save')}
                    </button>
                </div>
            </div>
        </div>,
    );
}

export function TimeTrackingBankDetailsPanel() {
    const { t } = useI18n();
    const { pushToast } = useAppToast();
    const { showConfirm } = useAppDialog();
    const { user } = useCurrentUser();
    const canManage = canManageTimeTrackingClients(user);
    const [profiles, setProfiles] = useState<FirmBankingProfile[]>(() => listFirmBankingProfiles());
    const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row: FirmBankingProfile | null } | null>(null);

    const untitled = t('timeTrackingPage.bankDetails.untitled');

    const handleDelete = async (row: FirmBankingProfile) => {
        if (!canManage)
            return;
        const ok = await showConfirm({
            title: t('timeTrackingPage.bankDetails.deleteConfirm.title'),
            message: t('timeTrackingPage.bankDetails.deleteConfirm.message').replace(
                '{name}',
                profileDisplayTitle(row, untitled),
            ),
            variant: 'danger',
            confirmLabel: t('timeTrackingPage.delete'),
        });
        if (!ok)
            return;
        setProfiles(deleteFirmBankingProfile(row.id));
        pushToast({ message: t('timeTrackingPage.bankDetails.deleted'), variant: 'info' });
    };

    const handleSetDefault = (row: FirmBankingProfile) => {
        if (!canManage || row.isDefault)
            return;
        setProfiles(setDefaultFirmBankingProfile(row.id));
        pushToast({ message: t('timeTrackingPage.bankDetails.defaultSet'), variant: 'success' });
    };

    return (
        <div className="tt-settings__content tt-tasks-page tt-bank-page">
            <h1 className="tt-settings__page-title">{t('timeTrackingPage.bankDetails.title')}</h1>
            <p className="tt-settings__desc tt-tasks-page__lead">
                {t('timeTrackingPage.bankDetails.intro')}
            </p>

            <div className="tt-tasks-page__controls">
                <div className="tt-tasks-toolbar tt-ecat-toolbar">
                    <div className="tt-ecat-toolbar__main">
                        <div className="tt-ecat-toolbar__row tt-bank-page__toolbar-row">
                            <p className="tt-bank-page__toolbar-hint">{t('timeTrackingPage.bankDetails.toolbarHint')}</p>
                            <button
                                type="button"
                                className="tt-settings__btn tt-settings__btn--primary tt-ecat-toolbar__new-btn"
                                disabled={!canManage}
                                title={!canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined}
                                onClick={() => setModal({ mode: 'create', row: null })}
                            >
                                {t('timeTrackingPage.bankDetails.cta.newProfile')}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="tt-tasks-page__notice">
                    <p className="tt-tasks-page__notice-title">{t('timeTrackingPage.bankDetails.policy.title')}</p>
                    <p className="tt-tasks-page__notice-text">{t('timeTrackingPage.bankDetails.policy.text')}</p>
                </div>
            </div>

            {!canManage ? (
                <p className="tt-settings__banner-info tt-tasks-page__banner" role="status">
                    {t('timeTrackingPage.bankDetails.viewOnly')}
                </p>
            ) : null}

            <h2 className="tt-tasks-page__list-heading">{t('timeTrackingPage.bankDetails.listHeading')}</h2>

            <div className="tt-settings__list tt-tasks-page__list tt-bank-page__list">
                {profiles.length === 0 ? (
                    <div className="tt-settings__rates-empty tt-settings__list-empty-inner tt-tasks-page__empty">
                        {t('timeTrackingPage.bankDetails.empty')}
                    </div>
                ) : (
                    profiles.map((row) => {
                        const chips = metaChips(row, t as (k: string) => string);
                        return (
                            <div key={row.id} className={`tt-settings__list-row tt-task-card tt-task-card--v2 tt-bank-card${row.isDefault ? ' tt-bank-card--default' : ''}`}>
                                <div className="tt-task-card__body">
                                    <div className="tt-task-card__line">
                                        <h3 className="tt-task-card__title">
                                            {profileDisplayTitle(row, untitled)}
                                            {row.isDefault ? (
                                                <span className="tt-bank-badge tt-bank-badge--default" title={t('timeTrackingPage.bankDetails.defaultBadge')}>
                                                    <IcoStar />
                                                    {t('timeTrackingPage.bankDetails.defaultBadge')}
                                                </span>
                                            ) : null}
                                        </h3>
                                    </div>
                                    {row.bankName.trim() && row.title.trim() ? (
                                        <p className="tt-bank-card__bank">{row.bankName.trim()}</p>
                                    ) : null}
                                    {row.bankAddress.trim() ? (
                                        <p className="tt-bank-card__addr">{row.bankAddress.trim()}</p>
                                    ) : null}
                                    <ul className="tt-bank-card__chips" aria-label={t('timeTrackingPage.bankDetails.listHeading')}>
                                        {chips.length === 0 ? (
                                            <li className="tt-bank-card__chip tt-bank-card__chip--empty">
                                                {t('timeTrackingPage.bankDetails.noFieldsFilled')}
                                            </li>
                                        ) : (
                                            chips.map((chip) => (
                                                <li key={chip} className="tt-bank-card__chip">{chip}</li>
                                            ))
                                        )}
                                    </ul>
                                </div>
                                <div className="tt-task-card__actions">
                                    {!row.isDefault && canManage ? (
                                        <button
                                            type="button"
                                            className="tt-task-card__text-btn"
                                            onClick={() => handleSetDefault(row)}
                                        >
                                            {t('timeTrackingPage.bankDetails.actions.makeDefault')}
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        className="tt-task-card__icon-btn"
                                        disabled={!canManage}
                                        title={t('timeTrackingPage.common.edit')}
                                        aria-label={t('timeTrackingPage.common.edit')}
                                        onClick={() => setModal({ mode: 'edit', row })}
                                    >
                                        <IcoPen />
                                    </button>
                                    <button
                                        type="button"
                                        className="tt-task-card__icon-btn tt-task-card__icon-btn--danger"
                                        disabled={!canManage}
                                        title={t('timeTrackingPage.delete')}
                                        aria-label={t('timeTrackingPage.delete')}
                                        onClick={() => void handleDelete(row)}
                                    >
                                        <IcoTrash />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {modal ? (
                <BankDetailsModal
                    mode={modal.mode}
                    initial={modal.row}
                    profilesCount={profiles.length}
                    onClose={() => setModal(null)}
                    onSaved={(list) => {
                        setProfiles(list);
                        pushToast({
                            message: modal.mode === 'create'
                                ? t('timeTrackingPage.bankDetails.created')
                                : t('timeTrackingPage.bankDetails.saved'),
                            variant: 'success',
                        });
                    }}
                />
            ) : null}
        </div>
    );
}
