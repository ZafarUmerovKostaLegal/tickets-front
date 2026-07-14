import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppDialog } from '@shared/ui';
import {
    deleteVacationAbsenceDay,
    deleteVacationManualEntry,
    deleteVacationManualEntryDocument,
    deleteVacationScheduleEmployee,
    getVacationScheduleEmployee,
    listVacationAttendanceMarkers,
    listVacationManualEntries,
    patchVacationScheduleEmployee,
    type VacationAttendanceMarkerApi,
    type VacationManualEntryApi,
} from '@entities/vacation';
import type { User } from '@entities/user';
import { listColleaguesAsUsers } from '@entities/contacts';
import { fetchWorkdaySettings, workdayDtoToSettings } from '@entities/attendance';
import { DEFAULT_WORKDAY_SETTINGS, type WorkdaySettings } from '@shared/lib/attendanceSettings';
import { isHiddenSystemUser } from '@shared/lib';
import { ruDaysWord } from '../lib/leaveRequestDisplay';
import {
    apiAbsenceKindToUi,
    formatVacationLateMinutes,
    formatVacationLateMinutesTotal,
    vacationAttendanceArrivalClock,
    vacationAttendanceLateMinutes,
    vacationDayIsWeekendRu,
    vacationKindHumanLabel,
    VACATION_MONTH_NAMES,
    type VacationAttendanceWorkday,
} from '../lib/vacationScheduleModel';
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

function parseIsoParts(iso: string): { year: number; monthIndex: number; day: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m)
        return null;
    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    const day = Number(m[3]);
    if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31)
        return null;
    return { year, monthIndex, day };
}

type AttendanceDayRow = {
    date: string;
    status: 'late' | 'absent';
    minutes: number | null;
    arrival: string | null;
    explanation: string | null;
};

type AttendanceSummary = {
    lateCount: number;
    absentCount: number;
    lateMinutesTotal: number;
    days: AttendanceDayRow[];
};

function summarizeAttendanceForUser(
    markers: VacationAttendanceMarkerApi[],
    appUserId: number,
    year: number,
    workday: VacationAttendanceWorkday,
): AttendanceSummary {
    const days: AttendanceDayRow[] = [];
    let lateCount = 0;
    let absentCount = 0;
    let lateMinutesTotal = 0;
    for (const marker of markers) {
        if (marker.app_user_id !== appUserId)
            continue;
        const parts = parseIsoParts(marker.date);
        if (!parts || parts.year !== year)
            continue;
        if (vacationDayIsWeekendRu(year, parts.monthIndex, parts.day))
            continue;
        if (marker.status === 'late') {
            lateCount += 1;
            const minutes = vacationAttendanceLateMinutes(marker.first_event_time, workday);
            if (minutes != null && minutes > 0)
                lateMinutesTotal += minutes;
            days.push({
                date: marker.date,
                status: 'late',
                minutes,
                arrival: vacationAttendanceArrivalClock(marker.first_event_time),
                explanation: marker.explanation_text,
            });
        }
        else if (marker.status === 'absent') {
            absentCount += 1;
            days.push({
                date: marker.date,
                status: 'absent',
                minutes: null,
                arrival: null,
                explanation: marker.explanation_text,
            });
        }
    }
    days.sort((a, b) => a.date.localeCompare(b.date));
    return { lateCount, absentCount, lateMinutesTotal, days };
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
    const [workdaySettings, setWorkdaySettings] = useState<WorkdaySettings>(DEFAULT_WORKDAY_SETTINGS);
    const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [attendanceError, setAttendanceError] = useState<string | null>(null);

    const absenceByKind = useMemo(() => {
        const map = new Map<string, number>();
        for (const d of days) {
            const ui = apiAbsenceKindToUi(d.kind);
            const label = ui ? vacationKindHumanLabel(ui) : d.kind;
            map.set(label, (map.get(label) ?? 0) + 1);
        }
        return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'));
    }, [days]);

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
        let cancelled = false;
        if (authUserId == null || authUserId <= 0) {
            setAttendance(null);
            setAttendanceError(null);
            setAttendanceLoading(false);
            return;
        }
        setAttendanceLoading(true);
        setAttendanceError(null);
        const from = `${year}-01-01`;
        const today = new Date();
        const to = year === today.getFullYear()
            ? `${year}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
            : `${year}-12-31`;
        void Promise.all([
            listVacationAttendanceMarkers(from, to),
            fetchWorkdaySettings().then(workdayDtoToSettings).catch(() => DEFAULT_WORKDAY_SETTINGS),
        ])
            .then(([markers, workday]) => {
                if (cancelled)
                    return;
                setWorkdaySettings(workday);
                setAttendance(summarizeAttendanceForUser(markers, authUserId, year, workday));
            })
            .catch((e: unknown) => {
                if (cancelled)
                    return;
                setAttendance(null);
                setAttendanceError(e instanceof Error ? e.message : 'Не удалось загрузить посещаемость');
            })
            .finally(() => {
                if (!cancelled)
                    setAttendanceLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [authUserId, year]);

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

                    <section className="vac-emp-card__summary" aria-label="Сводка за год">
                        <h3 className="vac-emp-card__sub">Сводка</h3>
                        <div className="vac-emp-card__kpis">
                            <article className="vac-emp-card__kpi">
                                <span className="vac-emp-card__kpi-label">В графике</span>
                                <strong className="vac-emp-card__kpi-value">{days.length}</strong>
                                <span className="vac-emp-card__kpi-sub">{ruDaysWord(days.length)} отсутствий</span>
                            </article>
                            <article className="vac-emp-card__kpi vac-emp-card__kpi--late">
                                <span className="vac-emp-card__kpi-label">Опоздания</span>
                                <strong className="vac-emp-card__kpi-value">
                                    {authUserId == null
                                        ? '—'
                                        : attendanceLoading
                                            ? '…'
                                            : (attendance?.lateCount ?? 0)}
                                </strong>
                                <span className="vac-emp-card__kpi-sub">
                                    {authUserId == null
                                        ? 'нужна связка'
                                        : attendanceLoading
                                            ? 'загрузка…'
                                            : formatVacationLateMinutesTotal(attendance?.lateMinutesTotal ?? 0)}
                                </span>
                            </article>
                            <article className="vac-emp-card__kpi vac-emp-card__kpi--absent">
                                <span className="vac-emp-card__kpi-label">Без прохода</span>
                                <strong className="vac-emp-card__kpi-value">
                                    {authUserId == null
                                        ? '—'
                                        : attendanceLoading
                                            ? '…'
                                            : (attendance?.absentCount ?? 0)}
                                </strong>
                                <span className="vac-emp-card__kpi-sub">рабочих дней</span>
                            </article>
                            <article className="vac-emp-card__kpi">
                                <span className="vac-emp-card__kpi-label">Сред. опозд.</span>
                                <strong className="vac-emp-card__kpi-value vac-emp-card__kpi-value--sm">
                                    {authUserId == null || !attendance || attendance.lateCount === 0
                                        ? '—'
                                        : formatVacationLateMinutesTotal(
                                            Math.round(attendance.lateMinutesTotal / attendance.lateCount),
                                        )}
                                </strong>
                                <span className="vac-emp-card__kpi-sub">на одно опоздание</span>
                            </article>
                        </div>
                        {absenceByKind.length > 0 && (
                            <ul className="vac-emp-card__kind-totals" aria-label="По видам отсутствий">
                                {absenceByKind.map(([label, count]) => (
                                    <li key={label} className="vac-emp-card__kind-total">
                                        <span className="vac-emp-card__kind-total-label">{label}</span>
                                        <span className="vac-emp-card__kind-total-count">{count} {ruDaysWord(count)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {authUserId == null && (
                            <p className="vac-emp-card__hint">
                                Привяжите пользователя системы — появятся опоздания и отсутствия по проходам.
                            </p>
                        )}
                        {attendanceError && (
                            <p className="vac-emp-card__hint vac-emp-card__hint--err">{attendanceError}</p>
                        )}
                        {!attendanceLoading && attendance && attendance.days.length > 0 && (
                            <details className="vac-emp-card__att-details">
                                <summary>
                                    Детали посещаемости ({attendance.days.length})
                                </summary>
                                <ul className="vac-emp-card__att-list">
                                    {attendance.days.map((row) => (
                                        <li key={`${row.date}-${row.status}`} className={`vac-emp-card__att-li vac-emp-card__att-li--${row.status}`}>
                                            <span className="vac-emp-card__att-date">{formatIsoDateRu(row.date)}</span>
                                            <span className="vac-emp-card__att-status">
                                                {row.status === 'late'
                                                    ? (row.minutes != null && row.minutes > 0
                                                        ? `Опоздание +${formatVacationLateMinutes(row.minutes)}`
                                                        : 'Опоздание')
                                                    : 'Без прохода'}
                                            </span>
                                            {row.arrival && (
                                                <span className="vac-emp-card__att-meta">приход {row.arrival}</span>
                                            )}
                                            {row.explanation?.trim() && (
                                                <span className="vac-emp-card__att-meta" title={row.explanation}>
                                                    {row.explanation.trim()}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                <p className="vac-emp-card__hint">
                                    Норма прихода: {workdaySettings.startTime}
                                    {workdaySettings.lateMinutes > 0 ? ` (+${workdaySettings.lateMinutes} мин)` : ''}.
                                    До сегодняшнего дня в {year} г.
                                </p>
                            </details>
                        )}
                    </section>

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
