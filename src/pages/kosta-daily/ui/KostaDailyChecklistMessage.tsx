import { useState } from 'react';
import type { ChatChecklist } from '@entities/chat';

export type KostaDailyChecklistMessageProps = {
    checklist: ChatChecklist;
    onToggle: (itemId: number) => void;
    onAppend: (text: string) => Promise<void>;
    onRemove: (itemId: number) => void;
};

export function KostaDailyChecklistMessage({
    checklist,
    onToggle,
    onAppend,
    onRemove,
}: KostaDailyChecklistMessageProps) {
    const [draft, setDraft] = useState('');
    const [adding, setAdding] = useState(false);
    const total = checklist.tasks.length;
    const done = checklist.done_count;

    const submitTask = async () => {
        const text = draft.trim();
        if (!text || adding)
            return;
        setAdding(true);
        try {
            await onAppend(text);
            setDraft('');
        }
        finally {
            setAdding(false);
        }
    };

    return (
        <div className="kd-tg__checklist">
            <div className="kd-tg__checklist-head">
                <span className="kd-tg__poll-badge">Чеклист</span>
                <span className="kd-tg__checklist-progress">{done}/{total}</span>
            </div>
            <p className="kd-tg__poll-question">{checklist.title}</p>
            <ul className="kd-tg__checklist-tasks">
                {checklist.tasks.map((task) => {
                    const doneTask = task.completed_by_user_id != null;
                    return (
                        <li key={task.id} className={`kd-tg__checklist-task${doneTask ? ' kd-tg__checklist-task--done' : ''}`}>
                            <button
                                type="button"
                                className="kd-tg__checklist-check"
                                role="checkbox"
                                aria-checked={doneTask}
                                aria-label={doneTask ? 'Снять отметку' : 'Отметить выполненным'}
                                disabled={!checklist.can_toggle}
                                onClick={() => onToggle(task.id)}
                            >
                                {doneTask ? (
                                    <svg viewBox="0 0 24 24" aria-hidden>
                                        <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
                                    </svg>
                                ) : null}
                            </button>
                            <span className="kd-tg__checklist-text">{task.text}</span>
                            {checklist.can_remove ? (
                                <button
                                    type="button"
                                    className="kd-tg__checklist-remove"
                                    aria-label="Удалить задачу"
                                    disabled={total <= 1}
                                    onClick={() => onRemove(task.id)}
                                >
                                    ×
                                </button>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
            {checklist.can_append ? (
                <form
                    className="kd-tg__checklist-add"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void submitTask();
                    }}
                >
                    <input
                        type="text"
                        className="kd-tg__checklist-add-input"
                        value={draft}
                        maxLength={200}
                        placeholder="Добавить задачу"
                        aria-label="Добавить задачу"
                        disabled={adding || total >= 30}
                        onChange={(e) => setDraft(e.target.value)}
                    />
                    <button type="submit" className="kd-tg__checklist-add-btn" disabled={adding || !draft.trim() || total >= 30}>
                        +
                    </button>
                </form>
            ) : null}
        </div>
    );
}
