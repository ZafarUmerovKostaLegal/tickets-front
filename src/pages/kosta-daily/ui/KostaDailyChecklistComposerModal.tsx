import { useEffect, useState } from 'react';
import type { CreateChecklistInput } from '@entities/chat';
import { KostaDailyChatModalShell } from './KostaDailyChatModalShell';

export type KostaDailyChecklistComposerModalProps = {
    open: boolean;
    onClose: () => void;
    onSubmit: (input: CreateChecklistInput) => Promise<void>;
};

const MAX_TASKS = 30;

export function KostaDailyChecklistComposerModal({
    open,
    onClose,
    onSubmit,
}: KostaDailyChecklistComposerModalProps) {
    const [title, setTitle] = useState('');
    const [tasks, setTasks] = useState<string[]>(['']);
    const [othersCanComplete, setOthersCanComplete] = useState(false);
    const [othersCanAppend, setOthersCanAppend] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open)
            return;
        setTitle('');
        setTasks(['']);
        setOthersCanComplete(false);
        setOthersCanAppend(false);
        setSaving(false);
        setError(null);
    }, [open]);

    const updateTask = (index: number, value: string) => {
        setTasks((prev) => prev.map((task, i) => (i === index ? value : task)));
    };

    const addTask = () => {
        if (tasks.length >= MAX_TASKS)
            return;
        setTasks((prev) => [...prev, '']);
    };

    const removeTask = (index: number) => {
        setTasks((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
    };

    const handleSubmit = async () => {
        const cleanedTitle = title.trim();
        const cleanedTasks = tasks.map((task) => task.trim()).filter(Boolean);
        if (!cleanedTitle) {
            setError('Введите название');
            return;
        }
        if (cleanedTasks.length === 0) {
            setError('Добавьте хотя бы одну задачу');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await onSubmit({
                title: cleanedTitle,
                tasks: cleanedTasks,
                othersCanComplete,
                othersCanAppend,
            });
            onClose();
        }
        catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Не удалось создать чеклист');
        }
        finally {
            setSaving(false);
        }
    };

    return (
        <KostaDailyChatModalShell
            open={open}
            title="Новый чеклист"
            ariaLabel="Новый чеклист"
            onClose={onClose}
            className="kd-tg__modal--poll"
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
            <label className="kd-tg__modal-field">
                <span className="kd-tg__modal-label">Название</span>
                <input
                    type="text"
                    className="kd-tg__modal-input"
                    value={title}
                    maxLength={255}
                    autoFocus
                    placeholder="Например: Подготовка к встрече"
                    onChange={(e) => setTitle(e.target.value)}
                />
            </label>

            <div className="kd-tg__modal-field">
                <span className="kd-tg__modal-label">Задачи</span>
                <div className="kd-tg__modal-options">
                    {tasks.map((task, index) => (
                        <div key={index} className="kd-tg__poll-compose-row">
                            <span className="kd-tg__poll-compose-num" aria-hidden>{index + 1}</span>
                            <input
                                type="text"
                                className="kd-tg__modal-input kd-tg__modal-input--plain"
                                value={task}
                                maxLength={200}
                                placeholder="Задача"
                                aria-label={`Задача ${index + 1}`}
                                onChange={(e) => updateTask(index, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addTask();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                className="kd-tg__modal-option-remove"
                                aria-label="Удалить задачу"
                                disabled={tasks.length <= 1}
                                onClick={() => removeTask(index)}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    className="kd-tg__modal-link"
                    onClick={addTask}
                    disabled={tasks.length >= MAX_TASKS}
                >
                    + Добавить задачу
                </button>
            </div>

            <div className="kd-tg__modal-settings">
                <p className="kd-tg__modal-label">Параметры</p>
                <label className="kd-tg__modal-check">
                    <input
                        type="checkbox"
                        checked={othersCanComplete}
                        onChange={(e) => setOthersCanComplete(e.target.checked)}
                    />
                    <span className="kd-tg__modal-check-box" aria-hidden />
                    <span>Другие могут отмечать выполненным</span>
                </label>
                <label className="kd-tg__modal-check">
                    <input
                        type="checkbox"
                        checked={othersCanAppend}
                        onChange={(e) => setOthersCanAppend(e.target.checked)}
                    />
                    <span className="kd-tg__modal-check-box" aria-hidden />
                    <span>Другие могут добавлять задачи</span>
                </label>
            </div>

            {error ? <p className="kd-tg__modal-error" role="alert">{error}</p> : null}
        </KostaDailyChatModalShell>
    );
}
