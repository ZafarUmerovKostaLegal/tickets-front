import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listPartners, type UserPublic } from '@entities/user';
import { sortByRuLabel } from '@shared/lib/sortByRuLabel';
import { SearchableSelect } from '@shared/ui';
import { CORR_DOC_TYPE_OPTIONS } from '../model/constants';
import type { CorrDocType, IncomingRegisterPayload } from '../model/types';
import { CorrespondenceFileDrivePicker } from './CorrespondenceFileDrivePicker';

export type CorrespondenceRegisterIncomingModalProps = {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: IncomingRegisterPayload) => void;
    submitPending?: boolean;
};

type FormErrors = {
    partnerUserId?: string;
    counterparty?: string;
    subject?: string;
    scanFiles?: string;
};

function partnerLabel(p: UserPublic): string {
    return p.display_name?.trim() || p.email || `User #${p.id}`;
}

export function CorrespondenceRegisterIncomingModal({
    open,
    onClose,
    onSubmit,
    submitPending = false,
}: CorrespondenceRegisterIncomingModalProps) {
    const titleId = useId();
    const senderRef = useRef<HTMLInputElement>(null);

    const [partnerUserId, setPartnerUserId] = useState('');
    const [counterparty, setCounterparty] = useState('');
    const [subject, setSubject] = useState('');
    const [type, setType] = useState<CorrDocType>('letter');
    const [comment, setComment] = useState('');
    const [scanFiles, setScanFiles] = useState<File[]>([]);
    const [errors, setErrors] = useState<FormErrors>({});
    const [fileHint, setFileHint] = useState<string | null>(null);

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
        setCounterparty('');
        setSubject('');
        setType('letter');
        setComment('');
        setScanFiles([]);
        setErrors({});
        setFileHint(null);
        const t = window.setTimeout(() => senderRef.current?.focus(), 0);
        return () => window.clearTimeout(t);
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
        if (!partnerUserId.trim())
            next.partnerUserId = 'Выберите партнёра';
        if (!counterparty.trim())
            next.counterparty = 'Укажите отправителя';
        if (!subject.trim())
            next.subject = 'Укажите тему письма';
        if (scanFiles.length === 0)
            next.scanFiles = 'Загрузите фото или скан документа';
        return next;
    }, [counterparty, partnerUserId, scanFiles.length, subject]);

    const handleSubmit = useCallback(() => {
        const nextErrors = validate();
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0)
            return;

        const partner = partnerOptions.find((p) => String(p.id) === partnerUserId);
        if (!partner) {
            setErrors({ partnerUserId: 'Выберите партнёра из списка' });
            return;
        }

        onSubmit({
            partnerUserId: partner.id,
            partnerName: partnerLabel(partner),
            counterparty: counterparty.trim(),
            subject: subject.trim(),
            type,
            comment: comment.trim(),
            scanFiles: [...scanFiles],
        });
    }, [comment, counterparty, onSubmit, partnerOptions, partnerUserId, scanFiles, subject, type, validate]);

    if (!open || typeof document === 'undefined')
        return null;

    const canSubmit = partnerUserId.trim().length > 0
        && counterparty.trim().length > 0
        && subject.trim().length > 0
        && scanFiles.length > 0
        && !submitPending;

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
            <h2 className="corr-modal__title" id={titleId}>Зарегистрировать входящее письмо</h2>
            <p className="corr-modal__lead">
              Укажите партнёра, отправителя и приложите скан или фото документа. Можно перетащить файлы, как в Google Диске.
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
          <div className={`corr-modal__field${errors.partnerUserId ? ' corr-modal__field--err' : ''}`}>
            <label className="corr-modal__label" id="corr-in-partner-label">
              Партнёр <span className="corr-modal__req" aria-hidden>*</span>
            </label>
            <SearchableSelect<UserPublic>
              portalDropdown
              portalZIndex={10120}
              className="corr-modal__srch"
              buttonClassName="corr-modal__srch-btn"
              buttonId="corr-in-partner"
              aria-labelledby="corr-in-partner-label"
              aria-invalid={Boolean(errors.partnerUserId)}
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
                  setErrors((prev) => ({ ...prev, partnerUserId: undefined }));
              }}
            />
            {partnersLoad === 'loading' ? <p className="corr-modal__hint">Загрузка списка партнёров…</p> : null}
            {partnersLoadErr ? <p className="corr-modal__err">{partnersLoadErr}</p> : null}
            {errors.partnerUserId ? <p className="corr-modal__err">{errors.partnerUserId}</p> : null}
          </div>

          <div className={`corr-modal__field${errors.counterparty ? ' corr-modal__field--err' : ''}`}>
            <label className="corr-modal__label" htmlFor="corr-in-sender">
              Отправитель <span className="corr-modal__req" aria-hidden>*</span>
            </label>
            <input
              id="corr-in-sender"
              ref={senderRef}
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
            <label className="corr-modal__label" htmlFor="corr-in-subject">
              Тема <span className="corr-modal__req" aria-hidden>*</span>
            </label>
            <input
              id="corr-in-subject"
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
            <label className="corr-modal__label" id="corr-in-type-label">Тип документа</label>
            <SearchableSelect<{ key: CorrDocType; label: string }>
              portalDropdown
              portalZIndex={10120}
              className="corr-modal__srch"
              buttonClassName="corr-modal__srch-btn"
              buttonId="corr-in-type"
              aria-labelledby="corr-in-type-label"
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
            <label className="corr-modal__label" htmlFor="corr-in-comment">Комментарий</label>
            <textarea
              id="corr-in-comment"
              className="corr-modal__textarea"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Необязательно"
              disabled={submitPending}
            />
          </div>
          </div>

          <CorrespondenceFileDrivePicker
            files={scanFiles}
            onChange={(next) => {
                setScanFiles(next);
                setErrors((prev) => ({ ...prev, scanFiles: undefined }));
            }}
            disabled={submitPending}
            error={errors.scanFiles}
            hint={fileHint}
            onHint={setFileHint}
            label="Скан или фото документа"
            required
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
            {submitPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>, document.body);
}
