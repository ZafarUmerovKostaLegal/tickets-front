import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { postVacationScheduleEmployee } from '@entities/vacation';
import './VacationScheduleImportModal.css';
type Props = {
    open: boolean;
    onClose: () => void;
    year: number;
    onSuccess: () => void;
};
export function VacationAddEmployeeModal({ open, onClose, year, onSuccess }: Props) {
    const uid = useId();
    const prevOpenRef = useRef(false);
    const [fullName, setFullName] = useState('');
    const [excelRow, setExcelRow] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (open && !prevOpenRef.current) {
            setFullName('');
            setExcelRow('');
            setNote('');
            setError(null);
        }
        prevOpenRef.current = open;
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !submitting)
                onClose();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open, onClose, submitting]);
    const handleSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        const name = fullName.trim();
        if (name.length < 1 || name.length > 500) {
            setError('Укажите ФИО от 1 до 500 символов.');
            return;
        }
        setSubmitting(true);
        try {
            const body: Parameters<typeof postVacationScheduleEmployee>[0] = {
                year,
                full_name: name,
            };
            const rowN = excelRow.trim();
            if (rowN) {
                const n = Number.parseInt(rowN, 10);
                if (!Number.isFinite(n) || n < 1) {
                    setError('№ строки — целое число не меньше 1.');
                    setSubmitting(false);
                    return;
                }
                body.excel_row_no = n;
            }
            const nt = note.trim();
            if (nt)
                body.planned_period_note = nt;
            await postVacationScheduleEmployee(body);
            onSuccess();
            onClose();
        }
        catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Не удалось добавить строку');
        }
        finally {
            setSubmitting(false);
        }
    }, [excelRow, fullName, note, onClose, onSuccess, year]);
    if (!open)
        return null;
    return createPortal(<div className="vac-imp-modal" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} onClick={() => !submitting && onClose()}>
      <div className="vac-imp-modal__dialog" onClick={(ev) => ev.stopPropagation()}>
        <div className="vac-imp-modal__head">
          <h2 id={`${uid}-title`} className="vac-imp-modal__title">
            Добавить сотрудника в график
          </h2>
          <button type="button" className="vac-imp-modal__x" onClick={onClose} disabled={submitting} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="vac-imp-modal__body">
          <p className="vac-imp__hint">Год: {year}. После сохранения можно отметить дни отсутствий в таблице.</p>
          <form className="vac-imp__form" onSubmit={(ev) => void handleSubmit(ev)}>
            <div className="vac-imp__row">
              <label className="vac-imp__lbl" htmlFor={`${uid}-name`}>
                ФИО
              </label>
              <input id={`${uid}-name`} className="vac-imp__inp" value={fullName} onChange={(ev) => setFullName(ev.target.value)} required maxLength={500} autoComplete="name"/>
            </div>
            <div className="vac-imp__row">
              <label className="vac-imp__lbl" htmlFor={`${uid}-row`}>
                № строки (необязательно)
              </label>
              <input id={`${uid}-row`} className="vac-imp__inp" type="number" min={1} value={excelRow} onChange={(ev) => setExcelRow(ev.target.value)} placeholder="Как в Excel"/>
            </div>
            <div className="vac-imp__row">
              <label className="vac-imp__lbl" htmlFor={`${uid}-note`}>
                Период / примечание
              </label>
              <input id={`${uid}-note`} className="vac-imp__inp" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Необязательно" autoComplete="off"/>
            </div>
            {error && (<p className="vac-imp__err" role="alert">
                {error}
              </p>)}
            <div className="vac-imp-modal__actions">
              <button type="button" className="vac-imp-modal__btn-secondary" onClick={onClose} disabled={submitting}>
                Отмена
              </button>
              <button type="submit" className="vac-imp__btn" disabled={submitting}>
                {submitting ? 'Сохранение…' : 'Добавить'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>, document.body);
}
