import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    listVacationManualEntries,
    type VacationManualEntryApi,
} from '@entities/vacation';
import { VACATION_MONTH_NAMES } from '../lib/vacationScheduleModel';
import { VacationDocLightbox, type VacationDocLightboxTarget } from './VacationDocLightbox';
import './VacationEmployeeDetailModal.css';

function formatIsoDateRu(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m)
        return iso;
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12)
        return iso;
    return `${Number(m[3])} ${VACATION_MONTH_NAMES[mo - 1]} ${Number(m[1])}`;
}

function dateInRange(iso: string, from: string, to: string): boolean {
    const d = iso.slice(0, 10);
    return d >= from.slice(0, 10) && d <= to.slice(0, 10);
}

type Props = {
    open: boolean;
    onClose: () => void;
    employeeId: number;
    employeeName: string;
    dateIso: string;
    year: number;
};

export function VacationPeriodDocsModal({ open, onClose, employeeId, employeeName, dateIso, year }: Props) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [entries, setEntries] = useState<VacationManualEntryApi[]>([]);
    const [preview, setPreview] = useState<VacationDocLightboxTarget | null>(null);

    useEffect(() => {
        if (!open)
            return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        void listVacationManualEntries({ year, employeeId })
            .then((list) => {
                if (cancelled)
                    return;
                setEntries(list.filter((en) => dateInRange(dateIso, en.date_from, en.date_to)));
            })
            .catch((e: unknown) => {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Не удалось загрузить документы');
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, employeeId, dateIso, year]);

    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    if (!open)
        return null;

    return createPortal(
        <div className="vac-emp-ov" role="dialog" aria-modal="true" aria-labelledby="vac-period-docs-title" onClick={onClose}>
            <div className="vac-emp-card" onClick={(e) => e.stopPropagation()}>
                <div className="vac-emp-card__head">
                    <h2 id="vac-period-docs-title" className="vac-emp-card__title">
                        Основания · {formatIsoDateRu(dateIso)}
                    </h2>
                    <button type="button" className="vac-emp-card__x" onClick={onClose} aria-label="Закрыть">×</button>
                </div>
                <div className="vac-emp-card__body">
                    <p className="vac-emp-card__meta">
                        Сотрудник: <strong>{employeeName}</strong>
                    </p>
                    {error && <p className="vac-emp-card__err" role="alert">{error}</p>}
                    {!error && loading && <p className="vac-emp-card__empty">Загрузка…</p>}
                    {!error && !loading && entries.length === 0 && (
                        <p className="vac-emp-card__empty">
                            За эту дату нет ручной записи с документами-основаниями.
                        </p>
                    )}
                    {!error && !loading && entries.length > 0 && (
                        <ul className="vac-emp-card__entries">
                            {entries.map((en) => (
                                <li key={en.id} className="vac-emp-entry">
                                    <div className="vac-emp-entry__head">
                                        <span className="vac-emp-entry__kind">{en.label_ru || en.kind}</span>
                                        <span className="vac-emp-entry__period">
                                            {formatIsoDateRu(en.date_from)} — {formatIsoDateRu(en.date_to)}
                                        </span>
                                    </div>
                                    {en.reason?.trim() && <p className="vac-emp-entry__reason">{en.reason}</p>}
                                    {en.created_by_name && <p className="vac-emp-entry__author">Внёс: {en.created_by_name}</p>}
                                    <ul className="vac-emp-entry__docs">
                                        {en.documents.length === 0 ? (
                                            <li className="vac-emp-entry__doc vac-emp-entry__doc--empty">Документы отсутствуют</li>
                                        ) : en.documents.map((doc) => (
                                            <li key={doc.id} className="vac-emp-entry__doc">
                                                <button
                                                    type="button"
                                                    className="vac-emp-entry__doc-name"
                                                    title={`Предпросмотр ${doc.original_filename}`}
                                                    onClick={() => setPreview({ entryId: en.id, docId: doc.id, filename: doc.original_filename, contentType: doc.content_type })}
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                                                        <circle cx="12" cy="12" r="3" />
                                                    </svg>
                                                    <span>{doc.original_filename}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            {preview && (
                <VacationDocLightbox
                    entryId={preview.entryId}
                    docId={preview.docId}
                    filename={preview.filename}
                    contentType={preview.contentType}
                    onClose={() => setPreview(null)}
                />
            )}
        </div>,
        document.body,
    );
}
