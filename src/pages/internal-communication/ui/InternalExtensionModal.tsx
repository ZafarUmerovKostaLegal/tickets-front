import { useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@shared/i18n';
import type { InternalExtension } from '@entities/internal-communication';

type InternalExtensionModalProps = {
    initial: InternalExtension | null;
    submitting: boolean;
    error: string | null;
    onClose: () => void;
    onSubmit: (body: { fullName: string; extension: string }) => void;
};

export function InternalExtensionModal({
    initial,
    submitting,
    error,
    onClose,
    onSubmit,
}: InternalExtensionModalProps) {
    const { t } = useI18n();
    const titleId = useId();
    const [fullName, setFullName] = useState(initial?.fullName ?? '');
    const [extension, setExtension] = useState(initial?.extension ?? '');

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !submitting)
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, submitting]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const name = fullName.trim();
        const ext = extension.trim();
        if (!name || !ext)
            return;
        onSubmit({ fullName: name, extension: ext });
    };

    const isEdit = initial != null;

    return createPortal(
        <div className="icom-modal-backdrop" onClick={() => !submitting && onClose()}>
            <form
                className="icom-modal"
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                aria-labelledby={titleId}
            >
                <h3 id={titleId} className="icom-modal__title">
                    {isEdit ? t('internalCommunicationPage.editContact') : t('internalCommunicationPage.addContact')}
                </h3>
                {error ? (
                    <p className="icom-modal__error" role="alert">{error}</p>
                ) : null}
                <label className="icom-modal__field">
                    <span>{t('internalCommunicationPage.colName')}</span>
                    <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        maxLength={200}
                        autoFocus
                        disabled={submitting}
                        required
                    />
                </label>
                <label className="icom-modal__field">
                    <span>{t('internalCommunicationPage.colExtension')}</span>
                    <input
                        value={extension}
                        onChange={(e) => setExtension(e.target.value)}
                        maxLength={32}
                        inputMode="numeric"
                        disabled={submitting}
                        required
                    />
                </label>
                <div className="icom-modal__actions">
                    <button type="button" className="icom-modal__btn icom-modal__btn--ghost" onClick={onClose} disabled={submitting}>
                        {t('common.cancel')}
                    </button>
                    <button
                        type="submit"
                        className="icom-modal__btn icom-modal__btn--primary"
                        disabled={submitting || !fullName.trim() || !extension.trim()}
                    >
                        {submitting ? t('internalCommunicationPage.saving') : t('internalCommunicationPage.save')}
                    </button>
                </div>
            </form>
        </div>,
        document.body,
    );
}
