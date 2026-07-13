import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppDialog } from '@shared/ui';
import {
    deleteVacationAbsenceDay,
    deleteVacationManualEntry,
    deleteVacationManualEntryDocument,
    deleteVacationScheduleEmployee,
    getVacationScheduleEmployee,
    listVacationManualEntries,
    patchVacationScheduleEmployee,
    type VacationManualEntryApi,
} from '@entities/vacation';
import type { User } from '@entities/user';
import { listColleaguesAsUsers } from '@entities/contacts';
import { isHiddenSystemUser } from '@shared/lib';
import { apiAbsenceKindToUi, vacationKindHumanLabel, VACATION_MONTH_NAMES, } from '../lib/vacationScheduleModel';
import { VacationDocLightbox, type VacationDocLightboxTarget } from './VacationDocLightbox';
import './VacationEmployeeDetailModal.css';

function formatIsoDateRu(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m)
        return iso;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12)
        return iso;
    return `${d} ${VACATION_MONTH_NAMES[mo - 1]} ${y}`;
}
type Props = {
    employeeId: number;
    year: number;
    onClose: () => void;
    canEdit?: boolean;

    canViewDocs?: boolean;
    onScheduleMutated?: () => void;
};
type LinkOption = {
    id: string;
    userId: number;
    label: string;
    email: string;
};
function userLabel(u: User): string {
    return (u.display_name?.trim() || u.email || `Пользователь ${u.id}`).trim();
}
export function VacationEmployeeDetailModal({ employeeId, year, onClose, canEdit = false, canViewDocs = false, onScheduleMutated, }: Props) {
    const { showConfirm } = useAppDialog();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fullName, setFullName] = useState('');
    const [authUserId, setAuthUserId] = useState<number | null>(null);
    const [plannedNote, setPlannedNote] = useState<string | null>(null);
    const [excelRow, setExcelRow] = useState<number | null>(null);
    const [days, setDays] = useState<{
        id?: number;
        absence_on: string;
        kind: string;
    }[]>([]);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [deletingEmployee, setDeletingEmployee] = useState(false);
    const [manualEntries, setManualEntries] = useState<VacationManualEntryApi[]>([]);
    const [preview, setPreview] = useState<VacationDocLightboxTarget | null>(null);
    const [busyEntryId, setBusyEntryId] = useState<number | null>(null);
    const [linkOptions, setLinkOptions] = useState<LinkOption[]>([]);
    const [selectedLinkUserId, setSelectedLinkUserId] = useState('');
    const [linkSaving, setLinkSaving] = useState(false);
    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        void Promise.all([
            getVacationScheduleEmployee(employeeId, year),
            canViewDocs
                ? listVacationManualEntries({ year, employeeId }).catch(() => [] as VacationManualEntryApi[])
                : Promise.resolve([] as VacationManualEntryApi[]),
        ])
            .then(([row, entries]) => {
                setFullName(row.full_name);
                setAuthUserId(row.auth_user_id);
                setSelectedLinkUserId(row.auth_user_id != null ? String(row.auth_user_id) : '');
                setPlannedNote(row.planned_period_note);
                setExcelRow(row.excel_row_no);
                setDays(row.absence_days ?? []);
                setManualEntries(entries);
            })
            .catch((e: unknown) => {
                setError(e instanceof Error ? e.message : 'Не удалось загрузить данные');
            })
            .finally(() => {
                setLoading(false);
            });
    }, [employeeId, year, canViewDocs]);
    useEffect(() => {
        load();
    }, [load]);
    useEffect(() => {
        if (!canEdit)
            return;
        let cancelled = false;
        void listColleaguesAsUsers()
            .then((list) => {
                if (cancelled)
                    return;
                const opts = list
                    .filter((u) => !u.is_archived && !u.is_blocked && !isHiddenSystemUser(u))
                    .map((u) => ({
                        id: String(u.id),
                        userId: u.id,
                        label: userLabel(u),
                        email: u.email,
                    }))
                    .sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
                setLinkOptions(opts);
            })
            .catch(() => setLinkOptions([]));
        return () => {
            cancelled = true;
        };
    }, [canEdit]);
    useEffect(() => {
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
    }, [onClose]);
    const handleDeleteDay = async (absenceDayId: number) => {
        if (!Number.isFinite(absenceDayId))
            return;
        setDeletingId(absenceDayId);
        try {
            await deleteVacationAbsenceDay(absenceDayId);
            onScheduleMutated?.();
            setDays((prev) => prev.filter((d) => d.id !== absenceDayId));
        }
        catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Не удалось удалить день');
        }
        finally {
            setDeletingId(null);
        }
    };
    const handleDeleteDoc = async (entryId: number, docId: number) => {
        const ok = await showConfirm({
            title: 'Удалить документ-основание?',
            message: 'Документ будет удалён из записи. Нельзя удалить последний документ, если основание обязательно.',
            variant: 'danger',
            confirmLabel: 'Удалить',
        });
        if (!ok)
            return;
        setBusyEntryId(entryId);
        setError(null);
        try {
            await deleteVacationManualEntryDocument(entryId, docId);
            setManualEntries((prev) => prev.map((en) => en.id === entryId
                ? { ...en, documents: en.documents.filter((d) => d.id !== docId) }
                : en));
        }
        catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Не удалось удалить документ');
        }
        finally {
            setBusyEntryId(null);
        }
    };
    const handleDeleteManualEntry = async (entryId: number) => {
        const ok = await showConfirm({
            title: 'Удалить ручную запись?',
            message: 'Запись, её документы и связанные дни графика будут удалены.',
            variant: 'danger',
            confirmLabel: 'Удалить',
        });
        if (!ok)
            return;
        setBusyEntryId(entryId);
        setError(null);
        try {
            await deleteVacationManualEntry(entryId);
            setManualEntries((prev) => prev.filter((en) => en.id !== entryId));
            onScheduleMutated?.();
        }
        catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Не удалось удалить запись');
        }
        finally {
            setBusyEntryId(null);
        }
    };
    const handleDeleteEmployee = async () => {
        const ok = await showConfirm({
            title: 'Удалить строку из графика?',
            message: 'Все отмеченные дни отсутствий этого сотрудника за год будут удалены.',
            variant: 'danger',
            confirmLabel: 'Удалить',
        });
        if (!ok) {
            return;
        }
        setDeletingEmployee(true);
        setError(null);
        try {
            await deleteVacationScheduleEmployee(employeeId);
            onScheduleMutated?.();
            onClose();
        }
        catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Не удалось удалить сотрудника');
        }
        finally {
            setDeletingEmployee(false);
        }
    };
    const handleSaveAuthLink = async () => {
        const nextId = selectedLinkUserId ? Number(selectedLinkUserId) : null;
        if (nextId === authUserId)
            return;
        const selected = nextId != null ? linkOptions.find((o) => o.userId === nextId) : null;
        setLinkSaving(true);
        setError(null);
        try {
            await patchVacationScheduleEmployee(employeeId, {
                auth_user_id: nextId,
                email: selected?.email ?? null,
            });
            setAuthUserId(nextId);
            onScheduleMutated?.();
        }
        catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Не удалось сохранить связку с пользователем');
        }
        finally {
            setLinkSaving(false);
        }
    };
    return createPortal(<div className="vac-emp-ov" role="dialog" aria-modal="true" aria-labelledby="vac-emp-title">
        <div className="vac-emp-card">
            <div className="vac-emp-card__head">
                <h2 id="vac-emp-title" className="vac-emp-card__title">
                    {loading ? 'Загрузка…' : fullName || 'Сотрудник'}
                </h2>
                <button type="button" className="vac-emp-card__x" onClick={onClose} aria-label="Закрыть">
                    ×
                </button>
            </div>
            <div className="vac-emp-card__body">
                {error && (<p className="vac-emp-card__err" role="alert">
                    {error}
                </p>)}
                {!error && !loading && (<>
                    <p className="vac-emp-card__meta">
                        Год графика: <strong>{year}</strong>
                        {excelRow != null && (<>
                            {' '}
                            · Историческое № строки: <strong>{excelRow}</strong>
                        </>)}
                    </p>
                    {plannedNote?.trim() && (<p className="vac-emp-card__note">
                        <span className="vac-emp-card__note-lbl">Период:</span> {plannedNote}
                    </p>)}
                    {canEdit && (<div className="vac-emp-card__link-box">
                        <label className="vac-emp-card__link-label" htmlFor="vac-emp-auth-link">
                            Связка с пользователем системы
                        </label>
                        <div className="vac-emp-card__link-row">
                            <select id="vac-emp-auth-link" className="vac-emp-card__link-select" value={selectedLinkUserId} disabled={linkSaving} onChange={(ev) => setSelectedLinkUserId(ev.target.value)}>
                                <option value="">Не привязан</option>
                                {linkOptions.map((opt) => (<option key={opt.id} value={opt.id}>
                                    {opt.label} ({opt.email})
                                </option>))}
                            </select>
                            <button type="button" className="vac-emp-card__link-save" disabled={linkSaving || (selectedLinkUserId ? Number(selectedLinkUserId) : null) === authUserId} onClick={() => void handleSaveAuthLink()}>
                                {linkSaving ? 'Сохранение…' : 'Сохранить'}
                            </button>
                        </div>
                    </div>)}
                    <h3 className="vac-emp-card__sub">Дни отсутствий</h3>
                    {days.length === 0 ? (<p className="vac-emp-card__empty">Нет отмеченных дней за этот год.</p>) : (<ul className="vac-emp-card__list">
                        {days.map((d) => {
                            const ui = apiAbsenceKindToUi(d.kind);
                            const label = ui ? vacationKindHumanLabel(ui) : d.kind;
                            const rowKey = d.id != null ? String(d.id) : `${d.absence_on}-${d.kind}-${label}`;
                            return (<li key={rowKey} className="vac-emp-card__li">
                                <span className="vac-emp-card__li-date">{formatIsoDateRu(d.absence_on)}</span>
                                <span className="vac-emp-card__li-kind">{label}</span>
                                {canEdit && d.id != null && (<button type="button" className="vac-emp-card__li-del" disabled={deletingId === d.id || deletingEmployee} onClick={() => void handleDeleteDay(d.id!)}>
                                    {deletingId === d.id ? '…' : 'Удалить'}
                                </button>)}
                            </li>);
                        })}
                    </ul>)}
                    {canViewDocs && (<>
                        <h3 className="vac-emp-card__sub">Ручные записи (основания)</h3>
                        {manualEntries.length === 0 ? (<p className="vac-emp-card__empty">Нет ручных записей с документами за этот год.</p>) : (<ul className="vac-emp-card__entries">
                            {manualEntries.map((en) => (<li key={en.id} className="vac-emp-entry">
                                <div className="vac-emp-entry__head">
                                    <span className="vac-emp-entry__kind">{en.label_ru || en.kind}</span>
                                    <span className="vac-emp-entry__period">
                                        {formatIsoDateRu(en.date_from)} — {formatIsoDateRu(en.date_to)}
                                    </span>
                                </div>
                                {en.reason?.trim() && (<p className="vac-emp-entry__reason">{en.reason}</p>)}
                                {en.created_by_name && (<p className="vac-emp-entry__author">Внёс: {en.created_by_name}</p>)}
                                <ul className="vac-emp-entry__docs">
                                    {en.documents.length === 0 ? (<li className="vac-emp-entry__doc vac-emp-entry__doc--empty">Документы отсутствуют</li>) : en.documents.map((doc) => (<li key={doc.id} className="vac-emp-entry__doc">
                                        <button type="button" className="vac-emp-entry__doc-name" title={`Предпросмотр ${doc.original_filename}`} onClick={() => setPreview({ entryId: en.id, docId: doc.id, filename: doc.original_filename, contentType: doc.content_type })}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                            <span>{doc.original_filename}</span>
                                        </button>
                                        {canEdit && (<button type="button" className="vac-emp-entry__doc-del" disabled={busyEntryId === en.id} onClick={() => void handleDeleteDoc(en.id, doc.id)} aria-label="Удалить документ">×</button>)}
                                    </li>))}
                                </ul>
                                {canEdit && (<div className="vac-emp-entry__actions">
                                    <button type="button" className="vac-emp-entry__del" disabled={busyEntryId === en.id} onClick={() => void handleDeleteManualEntry(en.id)}>
                                        {busyEntryId === en.id ? 'Удаление…' : 'Удалить запись'}
                                    </button>
                                </div>)}
                            </li>))}
                        </ul>)}
                    </>)}
                    {canEdit && (<div className="vac-emp-card__footer">
                        <button type="button" className="vac-emp-card__del-employee" disabled={deletingEmployee || deletingId != null} onClick={() => void handleDeleteEmployee()}>
                            {deletingEmployee ? 'Удаление…' : 'Удалить из графика'}
                        </button>
                    </div>)}
                </>)}
            </div>
        </div>
        {preview && (<VacationDocLightbox entryId={preview.entryId} docId={preview.docId} filename={preview.filename} contentType={preview.contentType} onClose={() => setPreview(null)} />)}
    </div>, document.body);
}
