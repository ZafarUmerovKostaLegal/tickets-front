import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
    createVacationManualEntry,
    VACATION_MANUAL_ENTRY_ALLOWED_EXTENSIONS,
    VACATION_MANUAL_ENTRY_MAX_FILE_BYTES,
    VACATION_MANUAL_ENTRY_MAX_FILES,
} from '@entities/vacation';
import { DatePicker, SearchableSelect, useAppToast } from '@shared/ui';
import { isVacationSystemRowId, vacationKindSealUsesDarkInk, type VacationScheduleEmployeeRow, type VacationUiLegendItem } from '../lib/vacationScheduleModel';
import { countCalendarDaysInclusive, ruDaysWord } from '../lib/leaveRequestDisplay';
import './VacationScheduleImportModal.css';
import './VacationAbsenceRequestModal.css';
import './VacationManualEntryModal.css';

type EmployeeOption = {
    id: string;
    label: string;
    search: string;
    employeeId: number;
};

type Props = {
    open: boolean;
    onClose: () => void;
    year: number;
    employees: VacationScheduleEmployeeRow[];
    legendItems: VacationUiLegendItem[];

    presetEmployeeId?: number | null;
    onSuccess?: () => void;
};

const ALLOWED_EXT_SET = new Set<string>(VACATION_MANUAL_ENTRY_ALLOWED_EXTENSIONS);

function fileExtension(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function formatBytes(bytes: number): string {
    if (bytes < 1024)
        return `${bytes} Б`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function VacationManualEntryModal({ open, onClose, year, employees, legendItems, presetEmployeeId, onSuccess }: Props) {
    const uid = useId();
    const { pushToast } = useAppToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [employeeId, setEmployeeId] = useState('');
    const [kindCode, setKindCode] = useState<number | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [reason, setReason] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const employeeOptions = useMemo<EmployeeOption[]>(() => {
        return employees
            .filter((e) => !e.systemOnly && !isVacationSystemRowId(e.id))
            .map((e) => ({ id: String(e.id), label: e.label, search: e.label.toLowerCase(), employeeId: e.id }))
            .sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
    }, [employees]);

    const kindOptions = useMemo(() => {
        return legendItems
            .filter((it) => it.kindCode >= 1 && it.kindCode <= 5)
            .map((it) => ({
                kindCode: it.kindCode,
                kind: it.kind,
                label: it.label,
                color: it.color,
                seal: it.seal,
            }));
    }, [legendItems]);

    const dayCount = useMemo(() => countCalendarDaysInclusive(dateFrom, dateTo), [dateFrom, dateTo]);

    useEffect(() => {
        if (!open)
            return;
        setEmployeeId(presetEmployeeId != null ? String(presetEmployeeId) : '');
        setKindCode(null);
        setDateFrom('');
        setDateTo('');
        setReason('');
        setFiles([]);
        setError(null);
        setSubmitting(false);
    }, [open, presetEmployeeId]);

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

    const addFiles = useCallback((incoming: FileList | File[]) => {
        const list = Array.from(incoming);
        if (list.length === 0)
            return;
        setError(null);
        setFiles((prev) => {
            const next = [...prev];
            for (const f of list) {
                const ext = fileExtension(f.name);
                if (!ALLOWED_EXT_SET.has(ext)) {
                    setError(`Недопустимый тип файла «${f.name}». Разрешено: ${VACATION_MANUAL_ENTRY_ALLOWED_EXTENSIONS.join(', ')}.`);
                    continue;
                }
                if (f.size > VACATION_MANUAL_ENTRY_MAX_FILE_BYTES) {
                    setError(`Файл «${f.name}» больше ${formatBytes(VACATION_MANUAL_ENTRY_MAX_FILE_BYTES)}.`);
                    continue;
                }
                if (next.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified))
                    continue;
                if (next.length >= VACATION_MANUAL_ENTRY_MAX_FILES) {
                    setError(`Не более ${VACATION_MANUAL_ENTRY_MAX_FILES} файлов.`);
                    break;
                }
                next.push(f);
            }
            return next;
        });
    }, []);

    const removeFile = useCallback((idx: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== idx));
    }, []);

    const handleSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        const empOpt = employeeOptions.find((o) => o.id === employeeId);
        if (!empOpt) {
            setError('Выберите сотрудника.');
            return;
        }
        if (kindCode == null) {
            setError('Выберите категорию.');
            return;
        }
        if (!dateFrom || !dateTo) {
            setError('Укажите период (с и по).');
            return;
        }
        if (dateTo < dateFrom) {
            setError('Дата окончания не может быть раньше даты начала.');
            return;
        }
        const fromYear = Number(dateFrom.slice(0, 4));
        const toYear = Number(dateTo.slice(0, 4));
        if (fromYear !== year || toYear !== year) {
            setError(`Период должен быть в пределах ${year} года.`);
            return;
        }
        if (files.length === 0) {
            setError('Приложите хотя бы один документ-основание.');
            return;
        }
        setSubmitting(true);
        try {
            await createVacationManualEntry({
                employeeId: empOpt.employeeId,
                kindCode,
                dateFrom: dateFrom.slice(0, 10),
                dateTo: dateTo.slice(0, 10),
                reason: reason.trim() || null,
                files,
            });
            pushToast({ variant: 'success', message: `Ручная запись для «${empOpt.label}» добавлена в график.` });
            onSuccess?.();
            onClose();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось создать запись.');
        }
        finally {
            setSubmitting(false);
        }
    }, [employeeOptions, employeeId, kindCode, dateFrom, dateTo, year, files, reason, pushToast, onSuccess, onClose]);

    if (!open)
        return null;

    const daysHint = dateFrom && dateTo
        ? dayCount > 0
            ? `Календарных ${ruDaysWord(dayCount)}: ${dayCount}`
            : 'Укажите корректный период'
        : 'Период в пределах одного года графика';

    return createPortal(
        <div className="vac-imp-modal" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
            <form className="vac-imp-modal__dialog vac-req-modal__dialog" onSubmit={handleSubmit}>
                <div className="vac-imp-modal__head">
                    <h2 id={`${uid}-title`} className="vac-imp-modal__title">
                        Ручная запись в график
                    </h2>
                    <button type="button" className="vac-imp-modal__x" onClick={onClose} disabled={submitting} aria-label="Закрыть">
                        ×
                    </button>
                </div>
                <div className="vac-imp-modal__body vac-req-modal__body">
                    <fieldset className="vac-req-modal__section">
                        <legend className="vac-req-modal__legend">Сотрудник</legend>
                        <label className="vac-req-modal__field vac-req-modal__field--full">
                            <span>Кому вносим</span>
                            <SearchableSelect<EmployeeOption>
                                portalDropdown
                                className="vac-req-modal__select"
                                buttonClassName="vac-req-modal__select-btn"
                                aria-label="Сотрудник графика"
                                placeholder={employeeOptions.length === 0 ? 'Нет сотрудников в графике' : 'Выберите сотрудника…'}
                                emptyListText="Нет в списке"
                                noMatchText="Не найдено"
                                value={employeeId}
                                items={employeeOptions}
                                getOptionValue={(o) => o.id}
                                getOptionLabel={(o) => o.label}
                                getSearchText={(o) => o.search}
                                disabled={employeeOptions.length === 0 || presetEmployeeId != null}
                                onSelect={(o) => setEmployeeId(o.id)}
                            />
                        </label>
                    </fieldset>

                    <fieldset className="vac-req-modal__section">
                        <legend className="vac-req-modal__legend">Категория</legend>
                        <div className="vac-req-modal__categories" role="radiogroup" aria-label="Категория">
                            {kindOptions.map((item) => (
                                <label
                                    key={item.kindCode}
                                    className={`vac-req-modal__cat${kindCode === item.kindCode ? ' vac-req-modal__cat--on' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name={`${uid}-kind`}
                                        value={item.kindCode}
                                        checked={kindCode === item.kindCode}
                                        onChange={() => setKindCode(item.kindCode)}
                                    />
                                    <span
                                        className={`vac-me__cat-dot${vacationKindSealUsesDarkInk(item.kind) ? ' vac-me__cat-dot--dark-ink' : ''}`}
                                        style={{ background: item.color }}
                                        aria-hidden
                                    >
                                        {item.seal}
                                    </span>
                                    <span>{item.label}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset className="vac-req-modal__section">
                        <legend className="vac-req-modal__legend">Период</legend>
                        <div className="vac-req-modal__dates">
                            <div className="vac-req-modal__field">
                                <span id={`${uid}-from`}>С</span>
                                <DatePicker
                                    className="vac-req-modal__date-picker"
                                    buttonClassName="vac-req-modal__date-picker-btn"
                                    value={dateFrom}
                                    min={`${year}-01-01`}
                                    max={dateTo || `${year}-12-31`}
                                    onChange={(iso) => {
                                        setDateFrom(iso);
                                        if (dateTo && iso > dateTo)
                                            setDateTo(iso);
                                    }}
                                    portal
                                    portalZIndex={12600}
                                    emptyLabel="дд.мм.гггг"
                                    showChevron={false}
                                    iconAfterLabel
                                    title="Дата начала"
                                    aria-labelledby={`${uid}-from`}
                                />
                            </div>
                            <div className="vac-req-modal__field">
                                <span id={`${uid}-to`}>По</span>
                                <DatePicker
                                    className="vac-req-modal__date-picker"
                                    buttonClassName="vac-req-modal__date-picker-btn"
                                    value={dateTo}
                                    min={dateFrom || `${year}-01-01`}
                                    max={`${year}-12-31`}
                                    onChange={(iso) => {
                                        setDateTo(iso);
                                        if (dateFrom && iso < dateFrom)
                                            setDateFrom(iso);
                                    }}
                                    portal
                                    portalZIndex={12600}
                                    emptyLabel="дд.мм.гггг"
                                    showChevron={false}
                                    iconAfterLabel
                                    title="Дата окончания"
                                    aria-labelledby={`${uid}-to`}
                                />
                            </div>
                        </div>
                        <p className="vac-req-modal__days" aria-live="polite">{daysHint}</p>
                    </fieldset>

                    <fieldset className="vac-req-modal__section">
                        <legend className="vac-req-modal__legend">Документы-основания <span className="vac-me__req">*</span></legend>
                        <div className="vac-me__files">
                            <button
                                type="button"
                                className="vac-me__add-files"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={submitting || files.length >= VACATION_MANUAL_ENTRY_MAX_FILES}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                </svg>
                                Прикрепить файлы
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                hidden
                                accept={VACATION_MANUAL_ENTRY_ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
                                onChange={(e) => {
                                    if (e.target.files)
                                        addFiles(e.target.files);
                                    e.target.value = '';
                                }}
                            />
                            <span className="vac-me__files-hint">
                                Обязательно ≥ 1 файла. До {VACATION_MANUAL_ENTRY_MAX_FILES} шт., до {formatBytes(VACATION_MANUAL_ENTRY_MAX_FILE_BYTES)} каждый.
                            </span>
                        </div>
                        {files.length > 0 && (
                            <ul className="vac-me__file-list">
                                {files.map((f, idx) => (
                                    <li key={`${f.name}-${f.size}-${f.lastModified}`} className="vac-me__file">
                                        <span className="vac-me__file-name" title={f.name}>{f.name}</span>
                                        <span className="vac-me__file-size">{formatBytes(f.size)}</span>
                                        <button
                                            type="button"
                                            className="vac-me__file-del"
                                            onClick={() => removeFile(idx)}
                                            disabled={submitting}
                                            aria-label={`Убрать ${f.name}`}
                                        >
                                            ×
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </fieldset>

                    <fieldset className="vac-req-modal__section">
                        <legend className="vac-req-modal__legend">Комментарий (необязательно)</legend>
                        <textarea
                            className="vac-req-modal__reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Например: командировка в Ташкент по приказу №…"
                            rows={3}
                            maxLength={500}
                            disabled={submitting}
                        />
                    </fieldset>

                    <p className="vac-req-modal__note">
                        Дни периода появятся в графике с привязкой к этой записи. Если на дату уже была отметка — она будет заменена выбранной категорией.
                    </p>

                    {error && (
                        <p className="vac-req-modal__error" role="alert">{error}</p>
                    )}

                    <div className="vac-imp-modal__actions">
                        <button type="button" className="vac-imp-modal__btn-secondary" onClick={onClose} disabled={submitting}>
                            Отмена
                        </button>
                        <button type="submit" className="vac-req-modal__submit" disabled={submitting}>
                            {submitting ? 'Сохранение…' : 'Внести в график'}
                        </button>
                    </div>
                </div>
            </form>
        </div>,
        document.body,
    );
}
