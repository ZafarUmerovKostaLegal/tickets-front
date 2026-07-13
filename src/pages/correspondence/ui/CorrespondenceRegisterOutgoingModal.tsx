import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SearchableSelect } from '@shared/ui';
import { CORR_DOC_TYPE_OPTIONS, CORR_SCAN_ACCEPT, CORR_SCAN_MAX_BYTES } from '../model/constants';
import { isAllowedScanFile } from '@entities/correspondence';
import type { CorrDocType, OutgoingRegisterPayload } from '../model/types';

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

function appendFiles(incoming: FileList | null, setList: (updater: (prev: File[]) => File[]) => void, onReject: (name: string, reason: string) => void) {
    if (!incoming?.length)
        return;
    const added: File[] = [];
    for (const file of Array.from(incoming)) {
        if (file.size > CORR_SCAN_MAX_BYTES) {
            onReject(file.name, 'Файл больше 15 МБ');
            continue;
        }
        if (!isAllowedScanFile(file)) {
            onReject(file.name, 'Файл больше 15 МБ');
            continue;
        }
        added.push(file);
    }
    if (!added.length)
        return;
    setList((prev) => [...prev, ...added]);
}

export function CorrespondenceRegisterOutgoingModal({
    open,
    onClose,
    onSubmit,
    submitPending = false,
}: CorrespondenceRegisterOutgoingModalProps) {
    const titleId = useId();
    const recipientRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleSubmit = useCallback(() => {
        const next: FormErrors = {};
        if (!counterparty.trim())
            next.counterparty = 'Укажите получателя';
        if (!subject.trim())
            next.subject = 'Укажите тему письма';
        setErrors(next);
        if (Object.keys(next).length > 0)
            return;

        onSubmit({
            counterparty: counterparty.trim(),
            subject: subject.trim(),
            type,
            comment: comment.trim(),
            attachmentFiles: [...attachmentFiles],
        });
    }, [attachmentFiles, comment, counterparty, onSubmit, subject, type]);

    if (!open || typeof document === 'undefined')
        return null;

    const canSubmit = counterparty.trim().length > 0 && subject.trim().length > 0 && !submitPending;

    return createPortal(<div className="corr-modal" role="presentation" onClick={onClose}>
      <div className="corr-modal__panel" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <div className="corr-modal__head">
          <div>
            <h2 className="corr-modal__title" id={titleId}>Зарегистрировать исходящее</h2>
            <p className="corr-modal__lead">
              Укажите получателя и тему. Вложение необязательно. Сохранение выполняется локально до подключения API.
            </p>
          </div>
          <button type="button" className="corr-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="corr-modal__form">
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
            <span className="corr-modal__label">Вложение</span>
            <div
              className="corr-modal__file-zone corr-modal__file-zone--compact"
              role="button"
              tabIndex={0}
              onClick={() => {
                  if (!submitPending)
                      fileInputRef.current?.click();
              }}
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && !submitPending)
                      fileInputRef.current?.click();
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={CORR_SCAN_ACCEPT}
                multiple
                style={{ display: 'none' }}
                disabled={submitPending}
                onChange={(e) => {
                    appendFiles(e.target.files, setAttachmentFiles, (name, reason) => {
                        setFileHint(`${name}: ${reason}`);
                    });
                    e.target.value = '';
                }}
              />
              <span className="corr-modal__file-zone-title">Прикрепить файл</span>
              <span className="corr-modal__file-zone-hint">Необязательно · любой формат, до 15 МБ</span>
            </div>
            {fileHint ? <p className="corr-modal__hint corr-modal__hint--warn">{fileHint}</p> : null}
            {attachmentFiles.length > 0 ? (
              <ul className="corr-modal__file-list">
                {attachmentFiles.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`} className="corr-modal__file-item">
                    <span className="corr-modal__file-name" title={file.name}>{file.name}</span>
                    <button
                      type="button"
                      className="corr-modal__file-remove"
                      onClick={() => setAttachmentFiles((prev) => prev.filter((_, i) => i !== index))}
                      disabled={submitPending}
                      aria-label={`Удалить ${file.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
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
            {submitPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>, document.body);
}
