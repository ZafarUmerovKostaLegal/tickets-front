import { useMemo, useState } from 'react';
import type { TimeTrackingUserRow } from '@entities/time-tracking';
import { sortByRuLabel } from '@shared/lib/sortByRuLabel';
import { KostaDailyChatModalShell } from './KostaDailyChatModalShell';

export type CreateRoomKind = 'group' | 'channel';

export type KostaDailyCreateRoomModalProps = {
    open: boolean;
    kind: CreateRoomKind;
    employees: TimeTrackingUserRow[];
    currentUserId?: number | null;
    onClose: () => void;
    onSubmit: (title: string, memberIds: number[]) => Promise<void>;
};

function employeeLabel(emp: TimeTrackingUserRow): string {
    return emp.display_name?.trim() || emp.email?.trim() || `Пользователь ${emp.id}`;
}

function employeeInitials(emp: TimeTrackingUserRow): string {
    const name = employeeLabel(emp);
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2)
        return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

export function KostaDailyCreateRoomModal({
    open,
    kind,
    employees,
    currentUserId,
    onClose,
    onSubmit,
}: KostaDailyCreateRoomModalProps) {
    const [title, setTitle] = useState('');
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const rows = employees.filter((e) => {
            if (currentUserId != null && e.id === currentUserId)
                return false;
            if (!q)
                return true;
            const name = employeeLabel(e).toLowerCase();
            return name.includes(q) || (e.email?.toLowerCase().includes(q) ?? false);
        });
        return sortByRuLabel(rows, employeeLabel);
    }, [employees, query, currentUserId]);

    const toggle = (id: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    };

    const handleSubmit = async () => {
        const t = title.trim();
        if (!t) {
            setError('Введите название');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await onSubmit(t, [...selected]);
            setTitle('');
            setQuery('');
            setSelected(new Set());
            onClose();
        }
        catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Не удалось создать');
        }
        finally {
            setSaving(false);
        }
    };

    const label = kind === 'channel' ? 'канал' : 'группу';
    const selectedCount = selected.size;

    return (
        <KostaDailyChatModalShell
            open={open}
            title={kind === 'channel' ? 'Новый канал' : 'Новая группа'}
            ariaLabel={`Создать ${label}`}
            onClose={onClose}
            className="kd-tg__modal--room"
            footer={(
                <div className="kd-tg__modal-actions">
                    <button type="button" className="kd-tg__modal-btn" onClick={onClose} disabled={saving}>
                        Отмена
                    </button>
                    <button
                        type="button"
                        className="kd-tg__modal-btn kd-tg__modal-btn--primary"
                        onClick={() => void handleSubmit()}
                        disabled={saving}
                    >
                        {saving ? 'Создание…' : 'Создать'}
                    </button>
                </div>
            )}
        >
            <p className="kd-tg__modal-hint">
                {kind === 'channel'
                    ? 'В канале писать могут только администраторы. Подписчики читают сообщения.'
                    : 'Все участники группы могут отправлять сообщения.'}
            </p>

            <label className="kd-tg__modal-field">
                <span className="kd-tg__modal-label">Название</span>
                <input
                    type="text"
                    className="kd-tg__modal-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={kind === 'channel' ? 'Например: Новости офиса' : 'Например: Команда проекта'}
                    maxLength={200}
                    autoFocus
                />
            </label>

            <label className="kd-tg__modal-field">
                <span className="kd-tg__modal-label">
                    Участники
                    {selectedCount > 0 ? (
                        <span className="kd-tg__modal-label-badge">{selectedCount}</span>
                    ) : null}
                </span>
                <input
                    type="search"
                    className="kd-tg__modal-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Поиск сотрудников"
                />
            </label>

            <ul className="kd-tg__modal-members" role="list">
                {filtered.length === 0 ? (
                    <li className="kd-tg__modal-members-empty" role="listitem">Никого не найдено</li>
                ) : filtered.map((emp) => (
                    <li key={emp.id} role="listitem">
                        <label className={`kd-tg__modal-member${selected.has(emp.id) ? ' kd-tg__modal-member--on' : ''}`}>
                            <input
                                type="checkbox"
                                checked={selected.has(emp.id)}
                                onChange={() => toggle(emp.id)}
                            />
                            <span className="kd-tg__modal-check-box" aria-hidden />
                            <span className="kd-tg__modal-member-avatar" aria-hidden>
                                {employeeInitials(emp)}
                            </span>
                            <span className="kd-tg__modal-member-name">{employeeLabel(emp)}</span>
                        </label>
                    </li>
                ))}
            </ul>

            {error ? <p className="kd-tg__modal-error" role="alert">{error}</p> : null}
        </KostaDailyChatModalShell>
    );
}
