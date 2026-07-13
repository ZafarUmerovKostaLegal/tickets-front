import { useState } from 'react';
import type { CreatePollInput } from '@entities/chat';
import { KostaDailyChatModalShell } from './KostaDailyChatModalShell';

export type KostaDailyPollComposerModalProps = {
    open: boolean;
    onClose: () => void;
    onSubmit: (input: CreatePollInput) => Promise<void>;
};

const EMPTY_OPTIONS = ['', ''];

export function KostaDailyPollComposerModal({
    open,
    onClose,
    onSubmit,
}: KostaDailyPollComposerModalProps) {
    const [kind, setKind] = useState<'poll' | 'quiz'>('poll');
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState<string[]>(EMPTY_OPTIONS);
    const [allowsMultiple, setAllowsMultiple] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [correctIndex, setCorrectIndex] = useState(0);
    const [explanation, setExplanation] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateOption = (index: number, value: string) => {
        setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
    };

    const addOption = () => {
        if (options.length >= 10)
            return;
        setOptions((prev) => [...prev, '']);
    };

    const removeOption = (index: number) => {
        if (options.length <= 2)
            return;
        setOptions((prev) => prev.filter((_, i) => i !== index));
        if (correctIndex >= index)
            setCorrectIndex(Math.max(0, correctIndex - 1));
    };

    const reset = () => {
        setKind('poll');
        setQuestion('');
        setOptions(EMPTY_OPTIONS);
        setAllowsMultiple(false);
        setIsAnonymous(false);
        setCorrectIndex(0);
        setExplanation('');
        setError(null);
    };

    const handleSubmit = async () => {
        const q = question.trim();
        const cleaned = options.map((o) => o.trim()).filter(Boolean);
        if (!q) {
            setError('Введите вопрос');
            return;
        }
        if (cleaned.length < 2) {
            setError('Нужно минимум 2 варианта ответа');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await onSubmit({
                kind,
                question: q,
                options: cleaned,
                allowsMultiple: kind === 'poll' ? allowsMultiple : false,
                isAnonymous,
                correctOptionIndex: kind === 'quiz' ? correctIndex : undefined,
                explanation: kind === 'quiz' ? explanation.trim() || undefined : undefined,
            });
            reset();
            onClose();
        }
        catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Не удалось создать');
        }
        finally {
            setSaving(false);
        }
    };

    return (
        <KostaDailyChatModalShell
            open={open}
            title="Опрос или викторина"
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
                        {saving ? 'Отправка…' : 'Опубликовать'}
                    </button>
                </div>
            )}
        >
            <div className="kd-tg__modal-tabs" role="tablist" aria-label="Тип">
                <button
                    type="button"
                    role="tab"
                    aria-selected={kind === 'poll'}
                    className={`kd-tg__modal-tab${kind === 'poll' ? ' kd-tg__modal-tab--on' : ''}`}
                    onClick={() => setKind('poll')}
                >
                    Опрос
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={kind === 'quiz'}
                    className={`kd-tg__modal-tab${kind === 'quiz' ? ' kd-tg__modal-tab--on' : ''}`}
                    onClick={() => setKind('quiz')}
                >
                    Викторина
                </button>
            </div>

            <label className="kd-tg__modal-field">
                <span className="kd-tg__modal-label">Вопрос</span>
                <input
                    type="text"
                    className="kd-tg__modal-input"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Введите вопрос"
                    maxLength={500}
                    autoFocus
                />
            </label>

            <div className="kd-tg__modal-field">
                <span className="kd-tg__modal-label">
                    {kind === 'quiz' ? 'Варианты · отметьте правильный' : 'Варианты ответа'}
                </span>
                <div className="kd-tg__modal-options">
                    {options.map((opt, index) => (
                        <div key={index} className="kd-tg__poll-compose-row">
                            {kind === 'quiz' ? (
                                <label className="kd-tg__poll-compose-radio" title="Правильный ответ">
                                    <input
                                        type="radio"
                                        name="correct"
                                        checked={correctIndex === index}
                                        onChange={() => setCorrectIndex(index)}
                                    />
                                    <span className="kd-tg__poll-compose-radio-mark" aria-hidden />
                                </label>
                            ) : (
                                <span className="kd-tg__poll-compose-num" aria-hidden>{index + 1}</span>
                            )}
                            <input
                                type="text"
                                className="kd-tg__modal-input kd-tg__modal-input--plain"
                                value={opt}
                                onChange={(e) => updateOption(index, e.target.value)}
                                placeholder={`Вариант ${index + 1}`}
                            />
                            <button
                                type="button"
                                className="kd-tg__modal-option-remove"
                                onClick={() => removeOption(index)}
                                disabled={options.length <= 2}
                                aria-label={`Удалить вариант ${index + 1}`}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    className="kd-tg__modal-link"
                    onClick={addOption}
                    disabled={options.length >= 10}
                >
                    + Добавить вариант
                </button>
            </div>

            {kind === 'poll' ? (
                <div className="kd-tg__modal-settings">
                    <label className="kd-tg__modal-check">
                        <input type="checkbox" checked={allowsMultiple} onChange={(e) => setAllowsMultiple(e.target.checked)} />
                        <span className="kd-tg__modal-check-box" aria-hidden />
                        <span>Несколько ответов</span>
                    </label>
                </div>
            ) : (
                <label className="kd-tg__modal-field">
                    <span className="kd-tg__modal-label">Пояснение (после ответа)</span>
                    <input
                        type="text"
                        className="kd-tg__modal-input"
                        value={explanation}
                        onChange={(e) => setExplanation(e.target.value)}
                        placeholder="Необязательно"
                    />
                </label>
            )}

            <div className="kd-tg__modal-settings">
                <label className="kd-tg__modal-check">
                    <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
                    <span className="kd-tg__modal-check-box" aria-hidden />
                    <span>Анонимное голосование</span>
                </label>
            </div>

            {error ? <p className="kd-tg__modal-error" role="alert">{error}</p> : null}
        </KostaDailyChatModalShell>
    );
}
