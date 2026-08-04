import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { listPartners, type UserPublic } from '@entities/user';
import { sortByRuLabel } from '@shared/lib/sortByRuLabel';
import { SearchableSelect } from '@shared/ui';

export type OutgoingSubmitReviewModalProps = {
    open: boolean;
    onClose: () => void;
    onSubmit: (partnerUserId: number, partnerName: string) => void;
    submitPending?: boolean;
};

function partnerLabel(p: UserPublic): string {
    return p.display_name?.trim() || p.email || `User #${p.id}`;
}

export function OutgoingSubmitReviewModal({
    open,
    onClose,
    onSubmit,
    submitPending = false,
}: OutgoingSubmitReviewModalProps) {
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
                setPartnersLoadErr(err instanceof Error ? err.message : 'Не удалось загрузить партнёров');
            });
        return () => { cancelled = true; };
    }, [open]);

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
            setError('Выберите партнёра');
            return;
        }
        onSubmit(partner.id, partnerLabel(partner));
    };

    return createPortal(
        <div
            className="corr-modal corr-modal--enter"
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !submitPending)
                    onClose();
            }}
        >
            <div
                className="corr-modal__panel"
                role="dialog"
                aria-modal
                aria-labelledby={titleId}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <header className="corr-modal__head">
                    <div>
                        <h2 id={titleId} className="corr-modal__title">Отправить на проверку</h2>
                        <p className="corr-modal__lead">
                            Партнёр проверит письмо. После подтверждения документ зарегистрируется автоматически.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="corr-modal__close"
                        onClick={onClose}
                        disabled={submitPending}
                        aria-label="Закрыть"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </header>

                <div className={`corr-modal__field${error ? ' corr-modal__field--err' : ''}`}>
                    <label className="corr-modal__label" id="outgoing-review-partner-label">
                        Партнёр <span className="corr-modal__req" aria-hidden>*</span>
                    </label>
                    <SearchableSelect<UserPublic>
                        portalDropdown
                        portalZIndex={10120}
                        className="corr-modal__srch"
                        buttonClassName="corr-modal__srch-btn"
                        buttonId="outgoing-review-partner"
                        aria-labelledby="outgoing-review-partner-label"
                        aria-invalid={Boolean(error)}
                        placeholder={partnersLoad === 'loading' ? 'Загрузка партнёров…' : 'Выберите партнёра'}
                        emptyListText="Нет партнёров"
                        noMatchText="Не найдено"
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
                    {error ? <p className="corr-modal__err">{error}</p> : null}
                    {partnersLoadErr ? <p className="corr-modal__err">{partnersLoadErr}</p> : null}
                </div>

                <div className="corr-modal__actions">
                    <button
                        type="button"
                        className="corr-modal__btn corr-modal__btn--ghost"
                        onClick={onClose}
                        disabled={submitPending}
                    >
                        Отмена
                    </button>
                    <button
                        type="button"
                        className="corr-modal__btn corr-modal__btn--primary"
                        onClick={handleSubmit}
                        disabled={submitPending || partnersLoad !== 'ok'}
                    >
                        {submitPending ? 'Отправка…' : 'На проверку'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
