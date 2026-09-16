import { useEffect, useId, useRef, useState } from 'react';
import type { OutgoingLetterDraftComment } from '../lib/outgoingLetterSession';

type Props = {
    open: boolean;
    comments: OutgoingLetterDraftComment[];
    disabled?: boolean;
    activeId: string | null;
    draftQuote: string;
    onClose: () => void;
    onNewComment: () => void;
    onSelect: (id: string) => void;
    onChangeBody: (id: string, body: string) => void;
    onToggleResolved: (id: string) => void;
    onDelete: (id: string) => void;
    onCommitNew: (body: string) => void;
    onCancelNew: () => void;
    composing: boolean;
};

function formatCommentWhen(iso: string): string {
    try {
        return new Date(iso).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    catch {
        return iso;
    }
}

function authorInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function OutgoingLetterCommentsPane({
    open,
    comments,
    disabled,
    activeId,
    draftQuote,
    onClose,
    onNewComment,
    onSelect,
    onChangeBody,
    onToggleResolved,
    onDelete,
    onCommitNew,
    onCancelNew,
    composing,
}: Props) {
    const titleId = useId();
    const composeRef = useRef<HTMLTextAreaElement>(null);
    const [composeBody, setComposeBody] = useState('');
    const openCount = comments.filter((c) => !c.resolved).length;

    useEffect(() => {
        if (!composing)
            return;
        setComposeBody('');
        const t = window.setTimeout(() => composeRef.current?.focus(), 40);
        return () => window.clearTimeout(t);
    }, [composing, draftQuote]);

    if (!open)
        return null;

    return (
        <aside
            className="corr-word-comments"
            aria-labelledby={titleId}
            data-word-comments
        >
            <header className="corr-word-comments__header">
                <div className="corr-word-comments__title-row">
                    <h2 id={titleId} className="corr-word-comments__title">
                        Комментарии
                    </h2>
                    {openCount > 0 ? (
                        <span className="corr-word-comments__badge" aria-label={`Открытых: ${openCount}`}>
                            {openCount}
                        </span>
                    ) : null}
                </div>
                <div className="corr-word-comments__header-actions">
                    <button
                        type="button"
                        className="corr-word-comments__icon-btn"
                        onClick={onNewComment}
                        disabled={disabled || composing}
                        title="Новый комментарий (Ctrl+Alt+M)"
                        aria-label="Новый комментарий"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            <line x1="12" y1="8" x2="12" y2="14" />
                            <line x1="9" y1="11" x2="15" y2="11" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        className="corr-word-comments__icon-btn"
                        onClick={onClose}
                        aria-label="Закрыть панель комментариев"
                        title="Закрыть"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </header>

            <p className="corr-word-comments__hint">
                Выделите текст в письме и нажмите «+», либо Ctrl+Alt+M — как в Word.
            </p>

            <div className="corr-word-comments__list">
                {composing ? (
                    <article className="corr-word-comments__card corr-word-comments__card--compose">
                        {draftQuote ? (
                            <blockquote className="corr-word-comments__quote">{draftQuote}</blockquote>
                        ) : (
                            <p className="corr-word-comments__quote-empty">Комментарий к документу</p>
                        )}
                        <textarea
                            ref={composeRef}
                            className="corr-word-comments__input"
                            rows={3}
                            placeholder="Напишите комментарий…"
                            value={composeBody}
                            disabled={disabled}
                            onChange={(e) => setComposeBody(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    e.preventDefault();
                                    onCancelNew();
                                    return;
                                }
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                    e.preventDefault();
                                    const body = composeBody.trim();
                                    if (body)
                                        onCommitNew(body);
                                }
                            }}
                        />
                        <div className="corr-word-comments__compose-actions">
                            <button
                                type="button"
                                className="corr__btn corr__btn--outline"
                                disabled={disabled}
                                onClick={onCancelNew}
                            >
                                Отмена
                            </button>
                            <button
                                type="button"
                                className="corr__btn corr__btn--primary"
                                disabled={disabled || !composeBody.trim()}
                                onClick={() => onCommitNew(composeBody.trim())}
                            >
                                Сохранить
                            </button>
                        </div>
                    </article>
                ) : null}

                {comments.length === 0 && !composing ? (
                    <div className="corr-word-comments__empty" role="status">
                        Пока нет комментариев.
                    </div>
                ) : null}

                {comments.map((c) => {
                    const active = c.id === activeId;
                    return (
                        <article
                            key={c.id}
                            className={[
                                'corr-word-comments__card',
                                active ? 'corr-word-comments__card--active' : '',
                                c.resolved ? 'corr-word-comments__card--resolved' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => onSelect(c.id)}
                        >
                            <div className="corr-word-comments__meta">
                                <span className="corr-word-comments__avatar" aria-hidden>
                                    {authorInitials(c.authorName)}
                                </span>
                                <div className="corr-word-comments__meta-text">
                                    <span className="corr-word-comments__author">{c.authorName}</span>
                                    <time className="corr-word-comments__when" dateTime={c.createdAt}>
                                        {formatCommentWhen(c.createdAt)}
                                    </time>
                                </div>
                            </div>
                            {c.quote ? (
                                <blockquote className="corr-word-comments__quote">{c.quote}</blockquote>
                            ) : null}
                            <textarea
                                className="corr-word-comments__input"
                                rows={2}
                                value={c.body}
                                disabled={disabled || c.resolved}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => onChangeBody(c.id, e.target.value)}
                                aria-label={`Комментарий от ${c.authorName}`}
                            />
                            <div className="corr-word-comments__card-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className="corr-word-comments__link-btn"
                                    disabled={disabled}
                                    onClick={() => onToggleResolved(c.id)}
                                >
                                    {c.resolved ? 'Открыть снова' : 'Пометить решённым'}
                                </button>
                                <button
                                    type="button"
                                    className="corr-word-comments__link-btn corr-word-comments__link-btn--danger"
                                    disabled={disabled}
                                    onClick={() => onDelete(c.id)}
                                >
                                    Удалить
                                </button>
                            </div>
                        </article>
                    );
                })}
            </div>
        </aside>
    );
}
