import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { listPartners, type UserPublic } from '@entities/user';
import { sortByRuLabel } from '@shared/lib/sortByRuLabel';
import { SearchableSelect } from '@shared/ui';
import { useI18n } from '@shared/i18n';

export type TicketSubmitApprovalModalProps = {
    open: boolean;
    onClose: () => void;
    onSubmit: (partnerUserId: number) => void;
    submitPending?: boolean;
};

function partnerLabel(p: UserPublic): string {
    return p.display_name?.trim() || p.email || `User #${p.id}`;
}

export function TicketSubmitApprovalModal({
    open,
    onClose,
    onSubmit,
    submitPending = false,
}: TicketSubmitApprovalModalProps) {
    const { t } = useI18n();
    const titleId = useId();
    const [partnerUserId, setPartnerUserId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [partnerOptions, setPartnerOptions] = useState<UserPublic[]>([]);
    const [partnersLoad, setPartnersLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const [partnersLoadErr, setPartnersLoadErr] = useState<string | null>(null);

    const sortedPartners = useMemo(
        () => sortByRuLabel(partnerOptions, partnerLabel),
        [partnerOptions],
    );

    useEffect(() => {
        if (!open)
            return;
        setPartnerUserId('');
        setError(null);
    }, [open]);

    useEffect(() => {
        if (!open)
            return;
        let cancelled = false;
        setPartnersLoad('loading');
        setPartnersLoadErr(null);
        void listPartners()
            .then((rows) => {
                if (cancelled)
                    return;
                setPartnerOptions(rows);
                setPartnersLoad('ok');
            })
            .catch((err) => {
                if (cancelled)
                    return;
                setPartnerOptions([]);
                setPartnersLoad('error');
                setPartnersLoadErr(err instanceof Error ? err.message : t('ticketDetailPage.approvalPartnersLoadErr'));
            });
        return () => { cancelled = true; };
    }, [open, t]);

    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !submitPending) {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, submitPending]);

    if (!open)
        return null;

    const handleSubmit = () => {
        const partner = partnerOptions.find((p) => String(p.id) === partnerUserId);
        if (!partner) {
            setError(t('ticketDetailPage.approvalPartnerRequired'));
            return;
        }
        onSubmit(partner.id);
    };

    return createPortal(
        <div
            className="td-approval-modal"
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !submitPending)
                    onClose();
            }}
        >
            <div
                className="td-approval-modal__panel"
                role="dialog"
                aria-modal
                aria-labelledby={titleId}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <header className="td-approval-modal__head">
                    <div>
                        <h2 id={titleId} className="td-approval-modal__title">
                            {t('ticketDetailPage.approvalModalTitle')}
                        </h2>
                        <p className="td-approval-modal__lead">
                            {t('ticketDetailPage.approvalModalLead')}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="td-approval-modal__close"
                        onClick={onClose}
                        disabled={submitPending}
                        aria-label={t('ticketDetailPage.closePreview')}
                    >
                        ×
                    </button>
                </header>

                <div className={`td-approval-modal__field${error ? ' td-approval-modal__field--err' : ''}`}>
                    <label className="td-approval-modal__label" id="ticket-approval-partner-label">
                        {t('ticketDetailPage.approvalPartnerLabel')}
                    </label>
                    <SearchableSelect<UserPublic>
                        portalDropdown
                        portalZIndex={10120}
                        className="td-approval-modal__srch"
                        buttonClassName="td-approval-modal__srch-btn"
                        buttonId="ticket-approval-partner"
                        aria-labelledby="ticket-approval-partner-label"
                        aria-invalid={Boolean(error)}
                        placeholder={
                            partnersLoad === 'loading'
                                ? t('ticketDetailPage.approvalPartnersLoading')
                                : t('ticketDetailPage.approvalPartnerPlaceholder')
                        }
                        emptyListText={t('ticketDetailPage.approvalPartnersEmpty')}
                        noMatchText={t('ticketDetailPage.approvalPartnersNoMatch')}
                        value={partnerUserId}
                        items={sortedPartners}
                        disabled={partnersLoad === 'loading' || submitPending || partnersLoad === 'error'}
                        getOptionValue={(p) => String(p.id)}
                        getOptionLabel={partnerLabel}
                        getSearchText={(p) => `${partnerLabel(p)} ${p.email ?? ''}`.trim()}
                        onSelect={(p) => {
                            setPartnerUserId(String(p.id));
                            setError(null);
                        }}
                    />
                    {error ? <p className="td-approval-modal__err">{error}</p> : null}
                    {partnersLoadErr ? <p className="td-approval-modal__err">{partnersLoadErr}</p> : null}
                </div>

                <div className="td-approval-modal__actions">
                    <button
                        type="button"
                        className="td-approval-modal__btn td-approval-modal__btn--ghost"
                        onClick={onClose}
                        disabled={submitPending}
                    >
                        {t('ticketDetailPage.approvalCancel')}
                    </button>
                    <button
                        type="button"
                        className="td-approval-modal__btn td-approval-modal__btn--primary"
                        onClick={handleSubmit}
                        disabled={submitPending || partnersLoad !== 'ok'}
                    >
                        {submitPending
                            ? t('ticketDetailPage.approvalSubmitting')
                            : t('ticketDetailPage.approvalSubmit')}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
