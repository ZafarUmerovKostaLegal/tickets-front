import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { VacationAbsenceBasis } from '../lib/vacationAbsenceBasisStorage';
import { readFileAsBasisAttachment, vacationAbsenceBasisLimits } from '../lib/vacationAbsenceBasisStorage';
import type { VacationMarkCell, VacationUiLegendItem } from '../lib/vacationScheduleModel';
import './VacationDayEditPopover.css';
type Props = {
    open: boolean;
    x: number;
    y: number;
    legendItems: VacationUiLegendItem[];
    current: VacationMarkCell | undefined;
    saving: boolean;
    cellKey?: string;
    initialBasis?: VacationAbsenceBasis;
    onPersistBasis: (cellKey: string, basis: VacationAbsenceBasis | null) => void;
    context?: {
        employeeName: string;
        dateLabel: string;
    };
    onPickKindCode: (kindCode: number) => void;
    onClear: () => void;
    onClose: () => void;
};
function emptyBasis(): VacationAbsenceBasis {
    return { comment: '', attachments: [] };
}
export function VacationDayEditPopover({ open, x, y, legendItems, current, saving, cellKey, initialBasis, onPersistBasis, context, onPickKindCode, onClear, onClose, }: Props) {
    const uid = useId();
    const ref = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const draftRef = useRef<VacationAbsenceBasis>(emptyBasis());
    const [basisDraft, setBasisDraft] = useState<VacationAbsenceBasis>(() => (initialBasis
        ? {
            comment: initialBasis.comment,
            attachments: initialBasis.attachments.map((a) => ({ ...a })),
        }
        : emptyBasis()));
    const [basisNotice, setBasisNotice] = useState<string | null>(null);
    draftRef.current = basisDraft;
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node))
                onClose();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDoc);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDoc);
        };
    }, [open, onClose]);
    if (!open)
        return null;
    const pad = 12;
    const maxW = 280;
    const left = Math.max(pad, Math.min(x, window.innerWidth - maxW - pad));
    const top = Math.max(pad, Math.min(y + 6, window.innerHeight - 420));
    const canEditBasis = Boolean(cellKey && current != null);
    const persistDraft = () => {
        if (!cellKey || !canEditBasis)
            return;
        const empty = !basisDraft.comment.trim() && basisDraft.attachments.length === 0;
        onPersistBasis(cellKey, empty ? null : basisDraft);
        setBasisNotice(empty ? 'Основание очищено' : 'Сохранено в этом браузере (до появления сервера)');
    };
    const onFiles = async (files: FileList | null) => {
        if (!files?.length || !canEditBasis)
            return;
        setBasisNotice(null);
        const attachments = [...draftRef.current.attachments];
        for (const f of Array.from(files)) {
            if (attachments.length >= vacationAbsenceBasisLimits.maxAttachments) {
                setBasisNotice(`Не больше ${vacationAbsenceBasisLimits.maxAttachments} файлов`);
                break;
            }
            const r = await readFileAsBasisAttachment(f);
            if (typeof r === 'string') {
                setBasisNotice(r);
                continue;
            }
            attachments.push(r);
        }
        setBasisDraft((d) => ({ ...d, attachments }));
        if (fileInputRef.current)
            fileInputRef.current.value = '';
    };
    const removeAtt = (id: string) => {
        setBasisDraft((d) => ({
            ...d,
            attachments: d.attachments.filter((a) => a.id !== id),
        }));
    };
    return createPortal(<div ref={ref} className="vac-day-pop" style={{ position: 'fixed', left, top, zIndex: 10050 }} role="dialog" aria-modal="true" aria-labelledby={`${uid}-title ${uid}-basis-title`}>
      {context && (<div className="vac-day-pop__context">
          <span className="vac-day-pop__ctx-date">{context.dateLabel}</span>
          <span className="vac-day-pop__ctx-name">{context.employeeName}</span>
        </div>)}
      <button type="button" className="vac-day-pop__close" onClick={onClose} aria-label="Закрыть" title="Закрыть">
        ✕
      </button>
      <div id={`${uid}-title`} className="vac-day-pop__title">
        Вид отсутствия
      </div>
      <ul className="vac-day-pop__list">
        {legendItems.map((it) => {
            const isCurrent = current?.kindCode === it.kindCode;
            return (<li key={`${it.kindCode}-${it.kind}`}>
              <button type="button" className={['vac-day-pop__opt', isCurrent && 'vac-day-pop__opt--current'].filter(Boolean).join(' ')} disabled={saving} onClick={() => onPickKindCode(it.kindCode)}>
                <span className="vac-day-pop__swatch" style={{ backgroundColor: it.color }} aria-hidden/>
                {it.label}
              </button>
            </li>);
        })}
      </ul>
      {current != null && current.absenceDayId != null && (<button type="button" className="vac-day-pop__clear" disabled={saving} onClick={() => onClear()}>
          Снять отметку
        </button>)}
      <hr className="vac-day-pop__divider"/>
      <div id={`${uid}-basis-title`} className="vac-day-pop__title vac-day-pop__title--secondary">
        Основание (комментарий, файлы)
      </div>
      {!canEditBasis ? (<p className="vac-day-pop__basis-hint">
          Чтобы добавить основание, сначала выберите вид отсутствия. Данные пока сохраняются только в этом браузере.
        </p>) : (<>
          <p className="vac-day-pop__basis-hint vac-day-pop__basis-hint--dim">
            Локально в браузере (до API). Макс. {vacationAbsenceBasisLimits.maxAttachments} файлов, до{' '}
            {Math.round(vacationAbsenceBasisLimits.maxFileBytes / 1024)} КБ каждый.
          </p>
          <label className="vac-day-pop__basis-label" htmlFor={`${uid}-comment`}>
            Комментарий
          </label>
          <textarea id={`${uid}-comment`} className="vac-day-pop__comment" rows={3} disabled={saving} value={basisDraft.comment} onChange={(e) => setBasisDraft((d) => ({ ...d, comment: e.target.value }))} placeholder="Например: заявление, приказ, согласование…"/>
          <label className="vac-day-pop__basis-label" htmlFor={`${uid}-files`}>
            Файлы (фото, скан, PDF)
          </label>
          <input ref={fileInputRef} id={`${uid}-files`} type="file" className="vac-day-pop__file-input" disabled={saving} multiple accept="image/*,.pdf,.doc,.docx" onChange={(e) => void onFiles(e.target.files)}/>
          {basisDraft.attachments.length > 0 && (<ul className="vac-day-pop__att-list">
              {basisDraft.attachments.map((a) => (<li key={a.id} className="vac-day-pop__att-item">
                    {a.mimeType.startsWith('image/')
                    ? (<img src={a.dataUrl} className="vac-day-pop__att-thumb" alt=""/>)
                    : (<span className="vac-day-pop__att-file" aria-hidden>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 7.5V10a4 4 0 008 0V6.5a3 3 0 10-6 0V9a1.5 1.5 0 003 0V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>)}
                    <span className="vac-day-pop__att-name" title={a.name}>
                      {a.name}
                    </span>
                    <button type="button" className="vac-day-pop__att-remove" disabled={saving} onClick={() => removeAtt(a.id)} aria-label={`Удалить ${a.name}`}>
                      ✕
                    </button>
                  </li>))}
            </ul>)}
          <div className="vac-day-pop__basis-actions">
            <button type="button" className="vac-day-pop__save-basis" disabled={saving} onClick={() => persistDraft()}>
              Сохранить основание
            </button>
          </div>
          {basisNotice && (<p className="vac-day-pop__basis-notice" role="status">
              {basisNotice}
            </p>)}
        </>)}
    </div>, document.body);
}
