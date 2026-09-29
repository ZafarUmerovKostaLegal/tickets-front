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
            className="kd-tg__modal--checklist"
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
                <span className="kd-tg__modal-label">
                    Задачи
                    <span className="kd-cl__count">{tasks.length}/{MAX_TASKS}</span>
                </span>
                <div className="kd-cl__tasks">
                    {tasks.map((task, index) => (
                        <div key={index} className="kd-cl__task">
                            <span className="kd-cl__box" aria-hidden />
                            <input
                                type="text"
                                className="kd-cl__task-input"
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
                                className="kd-cl__remove"
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
                    className="kd-cl__add"
                    onClick={addTask}
                    disabled={tasks.length >= MAX_TASKS}
                >
                    + Добавить задачу
                </button>
            </div>

            <div className="kd-cl__options">
                <p className="kd-tg__modal-label">Кто ещё может менять список</p>
                <label className="kd-cl__switch">
                    <span className="kd-cl__switch-copy">
                        <span className="kd-cl__switch-title">Отмечать выполненным</span>
                        <span className="kd-cl__switch-hint">Участники чата смогут ставить и снимать галочки</span>
                    </span>
                    <input
                        type="checkbox"
                        className="kd-cl__switch-input"
                        checked={othersCanComplete}
                        onChange={(e) => setOthersCanComplete(e.target.checked)}
                    />
                    <span className="kd-cl__switch-track" aria-hidden />
                </label>
                <label className="kd-cl__switch">
                    <span className="kd-cl__switch-copy">
                        <span className="kd-cl__switch-title">Добавлять задачи</span>
                        <span className="kd-cl__switch-hint">Участники смогут дописывать новые пункты</span>
                    </span>
                    <input
                        type="checkbox"
                        className="kd-cl__switch-input"
                        checked={othersCanAppend}
                        onChange={(e) => setOthersCanAppend(e.target.checked)}
                    />
                    <span className="kd-cl__switch-track" aria-hidden />
                </label>
            </div>

            {error ? <p className="kd-tg__modal-error" role="alert">{error}</p> : null}
        </KostaDailyChatModalShell>
    );
}
