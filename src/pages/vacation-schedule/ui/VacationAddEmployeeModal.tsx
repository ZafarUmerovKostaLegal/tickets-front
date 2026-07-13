import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { postVacationScheduleEmployee } from '@entities/vacation';
import type { User } from '@entities/user';
import { listColleaguesAsUsers } from '@entities/contacts';
import { isHiddenSystemUser } from '@shared/lib';
import { SearchableSelect } from '@shared/ui';
import './VacationScheduleImportModal.css';

type Props = {
    open: boolean;
    onClose: () => void;
    year: number;
    onSuccess: () => void;
};

type EmployeeOption = {
    id: string;
    userId: number;
    label: string;
    email: string;
    search: string;
};

function userLabel(u: User): string {
    return (u.display_name?.trim() || u.email || `Пользователь ${u.id}`).trim();
}

export function VacationAddEmployeeModal({ open, onClose, year, onSuccess }: Props) {
    const uid = useId();
    const prevOpenRef = useRef(false);
    const [employeeId, setEmployeeId] = useState('');
    const [note, setNote] = useState('');
    const [users, setUsers] = useState<EmployeeOption[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && !prevOpenRef.current) {
            setEmployeeId('');
            setNote('');
            setError(null);
        }
        prevOpenRef.current = open;
    }, [open]);

    useEffect(() => {
        if (!open)
            return;
        let cancelled = false;
        setUsersLoading(true);
        void listColleaguesAsUsers()
            .then((list) => {
                if (cancelled)
                    return;
                const opts: EmployeeOption[] = list
                    .filter((u) => !u.is_archived && !u.is_blocked && !isHiddenSystemUser(u))
                    .map((u) => {
                        const label = userLabel(u);
                        return {
                            id: String(u.id),
                            userId: u.id,
                            label,
                            email: u.email,
                            search: `${label} ${u.email}`.toLowerCase(),
                        };
                    })
                    .sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
                setUsers(opts);
            })
            .catch((e: unknown) => {
                if (!cancelled) {
                    setUsers([]);
                    setError(e instanceof Error ? e.message : 'Не удалось загрузить список сотрудников.');
                }
            })
            .finally(() => {
                if (!cancelled)
                    setUsersLoading(false);
            });
        return () => {
            cancelled = true;
        };
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

    const selectedUser = useMemo(() => users.find((u) => u.id === employeeId) ?? null, [users, employeeId]);

    const handleSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!selectedUser) {
            setError('Выберите сотрудника из каталога.');
            return;
        }
        setSubmitting(true);
        try {
            const body: Parameters<typeof postVacationScheduleEmployee>[0] = {
                year,
                full_name: selectedUser.label,
                auth_user_id: selectedUser.userId,
                email: selectedUser.email,
            };
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
    }, [selectedUser, note, onClose, onSuccess, year]);

    if (!open)
        return null;

    return createPortal(
        <div className="vac-imp-modal" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
            <div className="vac-imp-modal__dialog">
                <div className="vac-imp-modal__head">
                    <h2 id={`${uid}-title`} className="vac-imp-modal__title">
                        Добавить сотрудника в график
                    </h2>
                    <button type="button" className="vac-imp-modal__x" onClick={onClose} disabled={submitting} aria-label="Закрыть">
                        ×
                    </button>
                </div>
                <div className="vac-imp-modal__body">
                    <p className="vac-imp__hint">
                        Год: {year}. Выберите зарегистрированного сотрудника — строка будет привязана к его профилю.
                        Обычно строки в графике появляются автоматически после согласования заявки; вручную — для исключений.
                    </p>
                    <form className="vac-imp__form" onSubmit={(ev) => void handleSubmit(ev)}>
                        <div className="vac-imp__row">
                            <label className="vac-imp__lbl" htmlFor={`${uid}-emp`}>
                                Сотрудник
                            </label>
                            <SearchableSelect<EmployeeOption>
                                portalDropdown
                                aria-label="Сотрудник"
                                placeholder={usersLoading ? 'Загрузка…' : users.length === 0 ? 'Сотрудники не найдены' : 'Выберите сотрудника…'}
                                emptyListText="Нет в списке"
                                noMatchText="Не найдено"
                                value={employeeId}
                                items={users}
                                getOptionValue={(o) => o.id}
                                getOptionLabel={(o) => `${o.label} (${o.email})`}
                                getSearchText={(o) => o.search}
                                disabled={usersLoading || users.length === 0}
                                onSelect={(o) => setEmployeeId(o.id)}
                            />
                        </div>
                        <div className="vac-imp__row">
                            <label className="vac-imp__lbl" htmlFor={`${uid}-note`}>
                                Период / примечание
                            </label>
                            <input id={`${uid}-note`} className="vac-imp__inp" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Необязательно" autoComplete="off" />
                        </div>
                        {error && (
                            <p className="vac-imp__err" role="alert">
                                {error}
                            </p>
                        )}
                        <div className="vac-imp-modal__actions">
                            <button type="button" className="vac-imp-modal__btn-secondary" onClick={onClose} disabled={submitting}>
                                Отмена
                            </button>
                            <button type="submit" className="vac-imp__btn" disabled={submitting || !selectedUser}>
                                {submitting ? 'Сохранение…' : 'Добавить'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body,
    );
}
