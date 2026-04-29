import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { postVacationScheduleImport } from '@entities/vacation';
import './VacationScheduleImportModal.css';
const MAX_BYTES = 20 * 1024 * 1024;
type Props = {
    open: boolean;
    onClose: () => void;
    defaultYear: number;
    onImportSuccess: () => void;
};
export function VacationScheduleImportModal({ open, onClose, defaultYear, onImportSuccess }: Props) {
    const uid = useId();
    const [year, setYear] = useState(String(defaultYear));
    const [sheet, setSheet] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const prevOpenRef = useRef(false);
    useEffect(() => {
        if (open)
            setYear(String(defaultYear));
    }, [defaultYear, open]);
    useEffect(() => {
        if (open && !prevOpenRef.current) {
            setSheet('');
            setFile(null);
            setMessage(null);
            setError(null);
            const input = document.getElementById(`${uid}-file`) as HTMLInputElement | null;
            if (input)
                input.value = '';
        }
        prevOpenRef.current = open;
    }, [open, uid]);
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
    const onPickFile = useCallback((f: File | null) => {
        setFile(f);
        setError(null);
        setMessage(null);
        if (!f)
            return;
        const lower = f.name.toLowerCase();
        if (!lower.endsWith('.xlsx') && !lower.endsWith('.xlsm')) {
            setError('Допустимы только файлы .xlsx или .xlsm');
            setFile(null);
            return;
        }
        if (f.size > MAX_BYTES) {
            setError('Файл больше 20 МБ — уменьшите размер или разделите данные.');
            setFile(null);
        }
    }, []);
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        const y = Number.parseInt(year, 10);
        if (!Number.isFinite(y) || y < 2000 || y > 2100) {
            setError('Укажите год графика от 2000 до 2100.');
            return;
        }
        if (!file) {
            setError('Выберите файл Excel.');
            return;
        }
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('year', String(y));
            const sh = sheet.trim();
            if (sh)
                fd.append('sheet', sh);
            const res = await postVacationScheduleImport(fd);
            setMessage(`Импорт за ${res.year} г. выполнен: сотрудников — ${res.employees_imported}, дней отсутствий — ${res.absence_days_imported}. Данные за этот год в базе заменены новым файлом.`);
            setFile(null);
            const input = document.getElementById(`${uid}-file`) as HTMLInputElement | null;
            if (input)
                input.value = '';
            onImportSuccess();
        }
        catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Не удалось выполнить импорт');
        }
        finally {
            setSubmitting(false);
        }
    }, [file, onImportSuccess, sheet, uid, year]);
    if (!open)
        return null;
    return createPortal(<div className="vac-imp-modal" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} onClick={() => !submitting && onClose()}>
      <div className="vac-imp-modal__dialog" onClick={(e) => e.stopPropagation()}>
        <div className="vac-imp-modal__head">
          <h2 id={`${uid}-title`} className="vac-imp-modal__title">
            Загрузка графика (Excel)
          </h2>
          <button type="button" className="vac-imp-modal__x" onClick={onClose} disabled={submitting} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="vac-imp-modal__body">
          <p className="vac-imp__warn" role="note">
            <strong>Внимание:</strong> для выбранного года существующие строки сотрудников и все отметки дней в базе
            будут <strong>удалены</strong> и заменены данными из файла. Другие годы не затрагиваются.
          </p>
          <p className="vac-imp__hint">
            Формат .xlsx / .xlsm, до 20 МБ. Год в форме должен совпадать с годом дат в колонках файла (иначе ответ
            400).
          </p>
          <form className="vac-imp__form" onSubmit={(ev) => void handleSubmit(ev)}>
            <div className="vac-imp__row">
              <label className="vac-imp__lbl" htmlFor={`${uid}-year`}>
                Год графика
              </label>
              <input id={`${uid}-year`} className="vac-imp__inp" type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value)} required/>
            </div>
            <div className="vac-imp__row">
              <label className="vac-imp__lbl" htmlFor={`${uid}-sheet`}>
                Имя листа (необязательно)
              </label>
              <input id={`${uid}-sheet`} className="vac-imp__inp" type="text" value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="По умолчанию — первый лист" autoComplete="off"/>
            </div>
            <div className="vac-imp__row">
              <label className="vac-imp__lbl" htmlFor={`${uid}-file`}>
                Файл
              </label>
              <input id={`${uid}-file`} className="vac-imp__file" type="file" accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} disabled={submitting}/>
            </div>
            {error && (<p className="vac-imp__err" role="alert">
                {error}
              </p>)}
            {message && (<p className="vac-imp__ok" role="status">
                {message}
              </p>)}
            <div className="vac-imp-modal__actions">
              <button type="button" className="vac-imp-modal__btn-secondary" onClick={onClose} disabled={submitting}>
                Закрыть
              </button>
              <button type="submit" className="vac-imp__btn" disabled={submitting}>
                {submitting ? 'Загрузка…' : 'Импортировать'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>, document.body);
}
