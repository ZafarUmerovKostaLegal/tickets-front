import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SearchableSelect } from '@shared/ui';
import { CORR_DOC_TYPE_OPTIONS } from '../model/constants';
import type { CorrDocType, OutgoingRegisterPayload } from '../model/types';
import { CorrespondenceFileDrivePicker } from './CorrespondenceFileDrivePicker';

export type CorrespondenceRegisterOutgoingModalProps = {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: OutgoingRegisterPayload) => void;
    submitPending?: boolean;
};

type FormErrors = {
    counterparty?: string;
    subject?: string;
};

export function CorrespondenceRegisterOutgoingModal({
    open,
    onClose,
    onSubmit,
    submitPending = false,
}: CorrespondenceRegisterOutgoingModalProps) {
    const titleId = useId();
    const recipientRef = useRef<HTMLInputElement>(null);

    const [counterparty, setCounterparty] = useState('');
    const [subject, setSubject] = useState('');
    const [type, setType] = useState<CorrDocType>('letter');
    const [comment, setComment] = useState('');
    const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
    const [errors, setErrors] = useState<FormErrors>({});
    const [fileHint, setFileHint] = useState<string | null>(null);

    useEffect(() => {
        if (!open)
            return;
        setCounterparty('');
        setSubject('');
        setType('letter');
        setComment('');
        setAttachmentFiles([]);
        setErrors({});
        setFileHint(null);
        const t = window.setTimeout(() => recipientRef.current?.focus(), 0);
        return () => window.clearTimeout(t);
    }, [open]);

    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const validate = useCallback((): FormErrors => {
        const next: FormErrors = {};
        if (!counterparty.trim())
            next.counterparty = 'Укажите получателя';
        if (!subject.trim())
            next.subject = 'Укажите тему письма';
        return next;
    }, [counterparty, subject]);

    const handleSubmit = useCallback(() => {
        const nextErrors = validate();
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0)
            return;
        onSubmit({
            counterparty: counterparty.trim(),
            subject: subject.trim(),
            type,
            comment: comment.trim() || undefined,
            attachmentFiles: attachmentFiles.length > 0 ? [...attachmentFiles] : undefined,
        });
    }, [attachmentFiles, comment, counterparty, onSubmit, subject, type, validate]);

    if (!open || typeof document === 'undefined')
        return null;

    const canSubmit = counterparty.trim().length > 0 && subject.trim().length > 0 && !submitPending;

    return createPortal(<div className="corr-modal" role="presentation" onClick={onClose}>
      <div
        className="corr-modal__panel corr-modal__panel--drive"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="corr-modal__head">
          <div>
            <h2 className="corr-modal__title" id={titleId}>Зарегистрировать исходящее</h2>
            <p className="corr-modal__lead">
              Для уже готового документа: укажите получателя и тему. Чтобы написать письмо на бланке, закройте окно и нажмите «Написать письмо».
            </p>
          </div>
          <button type="button" className="corr-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="corr-modal__form corr-modal__form--drive">
          <div className="corr-modal__form-fields">
            <div className={`corr-modal__field${errors.counterparty ? ' corr-modal__field--err' : ''}`}>
              <label className="corr-modal__label" htmlFor="corr-out-recipient">
                Получатель <span className="corr-modal__req" aria-hidden>*</span>
              </label>
              <input
                id="corr-out-recipient"
                ref={recipientRef}
                className="corr-modal__input"
                value={counterparty}
                onChange={(e) => {
                    setCounterparty(e.target.value);
                    setErrors((prev) => ({ ...prev, counterparty: undefined }));
                }}
                placeholder="Например, ООО «Ромашка»"
                autoComplete="organization"
                disabled={submitPending}
              />
              {errors.counterparty ? <p className="corr-modal__err">{errors.counterparty}</p> : null}
            </div>

            <div className={`corr-modal__field${errors.subject ? ' corr-modal__field--err' : ''}`}>
              <label className="corr-modal__label" htmlFor="corr-out-subject">
                Тема <span className="corr-modal__req" aria-hidden>*</span>
              </label>
              <input
                id="corr-out-subject"
                className="corr-modal__input"
                value={subject}
                onChange={(e) => {
                    setSubject(e.target.value);
                    setErrors((prev) => ({ ...prev, subject: undefined }));
                }}
                placeholder="Кратко о содержании"
                disabled={submitPending}
              />
              {errors.subject ? <p className="corr-modal__err">{errors.subject}</p> : null}
            </div>

            <div className="corr-modal__field">
              <label className="corr-modal__label" id="corr-out-type-label">Тип документа</label>
              <SearchableSelect<{ key: CorrDocType; label: string }>
                portalDropdown
                portalZIndex={10120}
                className="corr-modal__srch"
                buttonClassName="corr-modal__srch-btn"
                buttonId="corr-out-type"
                aria-labelledby="corr-out-type-label"
                placeholder="Выберите тип"
                value={type}
                items={CORR_DOC_TYPE_OPTIONS}
                disabled={submitPending}
                getOptionValue={(o) => o.key}
                getOptionLabel={(o) => o.label}
                getSearchText={(o) => o.label}
                onSelect={(o) => setType(o.key)}
              />
            </div>

            <div className="corr-modal__field">
              <label className="corr-modal__label" htmlFor="corr-out-comment">Комментарий</label>
              <textarea
                id="corr-out-comment"
                className="corr-modal__textarea"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Необязательно"
                disabled={submitPending}
              />
            </div>
          </div>

          <CorrespondenceFileDrivePicker
            files={attachmentFiles}
            onChange={setAttachmentFiles}
            disabled={submitPending}
            hint={fileHint}
            onHint={setFileHint}
            label="Файл документа"
          />
        </div>

        <div className="corr-modal__actions">
          <button type="button" className="corr-modal__btn corr-modal__btn--ghost" onClick={onClose} disabled={submitPending}>
            Отмена
          </button>
          <button
            type="button"
            className="corr-modal__btn corr-modal__btn--primary"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitPending ? 'Сохранение…' : 'Зарегистрировать'}
          </button>
        </div>
      </div>
    </div>, document.body);
}
