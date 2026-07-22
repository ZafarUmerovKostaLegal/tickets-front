import { useCallback, useId, useMemo, useState } from 'react';
import { TIME_TRACKING_PROJECT_CURRENCIES, type TimeManagerProjectCurrency } from '@entities/time-tracking';
import {
    EMPTY_FIRM_BANKING_DETAILS,
    getFirmBankingDetails,
    setFirmBankingDetails,
    type FirmBankingDetails,
} from '@entities/time-tracking/lib/firmBankingDetailsStorage';
import { canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { SearchableSelect, useAppToast } from '@shared/ui';
import './TimeTrackingBankDetailsPanel.css';

type CurrencyOpt = { id: TimeManagerProjectCurrency; label: string };

export function TimeTrackingBankDetailsPanel() {
    const { t } = useI18n();
    const { pushToast } = useAppToast();
    const { user } = useCurrentUser();
    const canManage = canManageTimeTrackingClients(user);
    const uid = useId();
    const [form, setForm] = useState<FirmBankingDetails>(() => getFirmBankingDetails());
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const currencyOptions = useMemo<CurrencyOpt[]>(
        () => TIME_TRACKING_PROJECT_CURRENCIES.map((c) => ({ id: c, label: c })),
        [],
    );

    const patch = useCallback((partial: Partial<FirmBankingDetails>) => {
        setForm((prev) => ({ ...prev, ...partial }));
        setDirty(true);
    }, []);

    const handleSave = () => {
        if (!canManage || saving)
            return;
        setSaving(true);
        try {
            setFirmBankingDetails(form);
            setForm(getFirmBankingDetails());
            setDirty(false);
            pushToast({
                message: t('timeTrackingPage.bankDetails.saved'),
                variant: 'success',
            });
        }
        finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setForm(getFirmBankingDetails());
        setDirty(false);
    };

    const handleClear = () => {
        setForm({ ...EMPTY_FIRM_BANKING_DETAILS });
        setDirty(true);
    };

    return (
        <div className="tt-settings__content tt-bank-page">
            <h1 className="tt-settings__page-title">{t('timeTrackingPage.bankDetails.title')}</h1>
            <p className="tt-settings__desc tt-bank-page__lead">
                {t('timeTrackingPage.bankDetails.intro')}
            </p>

            {!canManage ? (
                <p className="tt-bank-page__view-only" role="status">
                    {t('timeTrackingPage.bankDetails.viewOnly')}
                </p>
            ) : null}

            <div className="tt-bank-page__card">
                <div className="tt-bank-page__grid">
                    <div className="tt-tm-field">
                        <label className="tt-tm-label" htmlFor={`${uid}-tin`}>
                            {t('timeTrackingPage.bankDetails.fields.tin')}
                        </label>
                        <input
                            id={`${uid}-tin`}
                            className="tt-tm-input"
                            value={form.tin}
                            onChange={(e) => patch({ tin: e.target.value })}
                            disabled={!canManage || saving}
                            autoComplete="off"
                        />
                    </div>

                    <div className="tt-tm-field">
                        <label className="tt-tm-label" htmlFor={`${uid}-bank`}>
                            {t('timeTrackingPage.bankDetails.fields.bankName')}
                        </label>
                        <input
                            id={`${uid}-bank`}
                            className="tt-tm-input"
                            value={form.bankName}
                            onChange={(e) => patch({ bankName: e.target.value })}
                            disabled={!canManage || saving}
                            autoComplete="organization"
                        />
                    </div>

                    <div className="tt-tm-field tt-bank-page__field--wide">
                        <label className="tt-tm-label" htmlFor={`${uid}-addr`}>
                            {t('timeTrackingPage.bankDetails.fields.bankAddress')}
                        </label>
                        <input
                            id={`${uid}-addr`}
                            className="tt-tm-input"
                            value={form.bankAddress}
                            onChange={(e) => patch({ bankAddress: e.target.value })}
                            disabled={!canManage || saving}
                            autoComplete="street-address"
                        />
                    </div>

                    <div className="tt-tm-field">
                        <span className="tt-tm-label" id={`${uid}-cur-lbl`}>
                            {t('timeTrackingPage.bankDetails.fields.accountCurrency')}
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
                            disabled={!canManage || saving}
                            portalDropdown
                            portalZIndex={11020}
                            portalMinWidth={160}
                            aria-labelledby={`${uid}-cur-lbl`}
                        />
                    </div>

                    <div className="tt-tm-field">
                        <label className="tt-tm-label" htmlFor={`${uid}-acc`}>
                            {t('timeTrackingPage.bankDetails.fields.accountNumber')}
                        </label>
                        <input
                            id={`${uid}-acc`}
                            className="tt-tm-input"
                            value={form.accountNumber}
                            onChange={(e) => patch({ accountNumber: e.target.value })}
                            disabled={!canManage || saving}
                            autoComplete="off"
                        />
                    </div>

                    <div className="tt-tm-field">
                        <label className="tt-tm-label" htmlFor={`${uid}-code`}>
                            {t('timeTrackingPage.bankDetails.fields.bankCode')}
                        </label>
                        <input
                            id={`${uid}-code`}
                            className="tt-tm-input"
                            value={form.bankCode}
                            onChange={(e) => patch({ bankCode: e.target.value })}
                            disabled={!canManage || saving}
                            autoComplete="off"
                        />
                    </div>

                    <div className="tt-tm-field">
                        <label className="tt-tm-label" htmlFor={`${uid}-swift`}>
                            {t('timeTrackingPage.bankDetails.fields.swift')}
                        </label>
                        <input
                            id={`${uid}-swift`}
                            className="tt-tm-input"
                            value={form.swift}
                            onChange={(e) => patch({ swift: e.target.value })}
                            disabled={!canManage || saving}
                            autoComplete="off"
                        />
                    </div>

                    <div className="tt-tm-field tt-bank-page__field--wide">
                        <label className="tt-tm-label" htmlFor={`${uid}-cb`}>
                            {t('timeTrackingPage.bankDetails.fields.correspondentBank')}
                        </label>
                        <input
                            id={`${uid}-cb`}
                            className="tt-tm-input"
                            value={form.correspondentBank}
                            onChange={(e) => patch({ correspondentBank: e.target.value })}
                            disabled={!canManage || saving}
                            autoComplete="off"
                        />
                    </div>

                    <div className="tt-tm-field tt-bank-page__field--wide">
                        <label className="tt-tm-label" htmlFor={`${uid}-ca`}>
                            {t('timeTrackingPage.bankDetails.fields.correspondentAccount')}
                        </label>
                        <input
                            id={`${uid}-ca`}
                            className="tt-tm-input"
                            value={form.correspondentAccount}
                            onChange={(e) => patch({ correspondentAccount: e.target.value })}
                            disabled={!canManage || saving}
                            autoComplete="off"
                        />
                    </div>
                </div>

                {canManage ? (
                    <div className="tt-bank-page__actions">
                        <button
                            type="button"
                            className="tt-settings__btn tt-settings__btn--ghost"
                            disabled={saving || !dirty}
                            onClick={handleReset}
                        >
                            {t('timeTrackingPage.bankDetails.actions.reset')}
                        </button>
                        <button
                            type="button"
                            className="tt-settings__btn tt-settings__btn--outline"
                            disabled={saving}
                            onClick={handleClear}
                        >
                            {t('timeTrackingPage.bankDetails.actions.clear')}
                        </button>
                        <button
                            type="button"
                            className="tt-settings__btn tt-settings__btn--primary"
                            disabled={saving || !dirty}
                            onClick={handleSave}
                        >
                            {saving
                                ? t('timeTrackingPage.bankDetails.actions.saving')
                                : t('timeTrackingPage.bankDetails.actions.save')}
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
