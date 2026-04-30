import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppDialog } from '@shared/ui';
import { deleteVacationAbsenceDay, deleteVacationScheduleEmployee, getVacationScheduleEmployee, } from '@entities/vacation';
import { apiAbsenceKindToUi, vacationKindHumanLabel, VACATION_MONTH_NAMES, } from '../lib/vacationScheduleModel';
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
    onScheduleMutated?: () => void;
};
export function VacationEmployeeDetailModal({ employeeId, year, onClose, canEdit = false, onScheduleMutated, }: Props) {
    const { showConfirm } = useAppDialog();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fullName, setFullName] = useState('');
    const [plannedNote, setPlannedNote] = useState<string | null>(null);
    const [excelRow, setExcelRow] = useState<number | null>(null);
    const [days, setDays] = useState<{
        id?: number;
        absence_on: string;
        kind: string;
    }[]>([]);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [deletingEmployee, setDeletingEmployee] = useState(false);
    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        void getVacationScheduleEmployee(employeeId, year)
            .then((row) => {
            setFullName(row.full_name);
            setPlannedNote(row.planned_period_note);
            setExcelRow(row.excel_row_no);
            setDays(row.absence_days ?? []);
        })
            .catch((e: unknown) => {
            setError(e instanceof Error ? e.message : 'Не удалось загрузить данные');
        })
            .finally(() => {
            setLoading(false);
        });
    }, [employeeId, year]);
    useEffect(() => {
        load();
    }, [load]);
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
                    · № в файле: <strong>{excelRow}</strong>
                  </>)}
              </p>
              {plannedNote?.trim() && (<p className="vac-emp-card__note">
                  <span className="vac-emp-card__note-lbl">Период (из файла):</span> {plannedNote}
                </p>)}
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
              {canEdit && (<div className="vac-emp-card__footer">
                  <button type="button" className="vac-emp-card__del-employee" disabled={deletingEmployee || deletingId != null} onClick={() => void handleDeleteEmployee()}>
                    {deletingEmployee ? 'Удаление…' : 'Удалить из графика'}
                  </button>
                </div>)}
            </>)}
        </div>
      </div>
    </div>, document.body);
}
