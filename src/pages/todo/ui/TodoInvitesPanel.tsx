import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    acceptTodoInvite,
    declineTodoInvite,
    fetchMyTodoInvites,
    invalidateTodoInvites,
    type TodoBoard,
    type TodoBoardInvite,
} from '@entities/todo';
import { useI18n } from '@shared/i18n';

type TodoInvitesPanelProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAccepted: (board: TodoBoard) => void | Promise<void>;
    onInvitesChanged?: () => void;
};

export function TodoInvitesPanel({ open, onOpenChange, onAccepted, onInvitesChanged }: TodoInvitesPanelProps) {
    const { t } = useI18n();
    const [invites, setInvites] = useState<TodoBoardInvite[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

    const reload = useCallback(() => {
        setLoading(true);
        setError(null);
        return fetchMyTodoInvites()
            .then((list) => {
                setInvites(list.filter((i) => (i.status || '').toLowerCase() === 'pending'));
            })
            .catch((e: unknown) => {
                setInvites([]);
                setError(e instanceof Error ? e.message : t('todoPage.errors.load'));
            })
            .finally(() => setLoading(false));
    }, [t]);

    useEffect(() => {
        void reload();
    }, [reload]);

    useEffect(() => {
        if (open)
            void reload();
    }, [open, reload]);

    const pendingCount = invites.length;

    const handleAccept = async (invite: TodoBoardInvite) => {
        setBusyId(invite.id);
        setError(null);
        try {
            const board = await acceptTodoInvite(invite.id);
            await onAccepted(board);
            await reload();
            invalidateTodoInvites();
            onInvitesChanged?.();
            onOpenChange(false);
        }
        catch (e: unknown) {
            setError(e instanceof Error ? e.message : t('todoPage.invites.acceptError'));
        }
        finally {
            setBusyId(null);
        }
    };

    const handleDecline = async (invite: TodoBoardInvite) => {
        setBusyId(invite.id);
        setError(null);
        try {
            await declineTodoInvite(invite.id);
            await reload();
            invalidateTodoInvites();
            onInvitesChanged?.();
        }
        catch (e: unknown) {
            setError(e instanceof Error ? e.message : t('todoPage.invites.declineError'));
        }
        finally {
            setBusyId(null);
        }
    };

    const modal = open && typeof document !== 'undefined'
        ? createPortal(
            <div className="todo-invites__backdrop" onClick={() => onOpenChange(false)}>
                <div className="todo-invites__modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="todo-invites-title">
                    <div className="todo-invites__head">
                        <h2 id="todo-invites-title" className="todo-invites__title">{t('todoPage.invites.title')}</h2>
                        <button type="button" className="todo-invites__close" onClick={() => onOpenChange(false)} aria-label={t('todoPage.close')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                    {error && <p className="todo-invites__error" role="alert">{error}</p>}
                    {loading && <p className="todo-invites__status">{t('todoPage.loading')}</p>}
                    {!loading && invites.length === 0 && (
                        <p className="todo-invites__status">{t('todoPage.invites.empty')}</p>
                    )}
                    <ul className="todo-invites__list">
                        {invites.map((inv) => (
                            <li key={inv.id} className="todo-invites__item">
                                <div className="todo-invites__item-main">
                                    <span className="todo-invites__board">{inv.board_title || `#${inv.board_id}`}</span>
                                    <span className="todo-invites__role">{t('todoPage.invites.roleOffered').replace('{role}', inv.role_offered)}</span>
                                </div>
                                <div className="todo-invites__actions">
                                    <button
                                        type="button"
                                        className="todo-invites__btn todo-invites__btn--primary"
                                        disabled={busyId != null}
                                        onClick={() => void handleAccept(inv)}
                                    >
                                        {busyId === inv.id ? t('todoPage.loading') : t('todoPage.invites.accept')}
                                    </button>
                                    <button
                                        type="button"
                                        className="todo-invites__btn todo-invites__btn--ghost"
                                        disabled={busyId != null}
                                        onClick={() => void handleDecline(inv)}
                                    >
                                        {t('todoPage.invites.decline')}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>,
            document.body,
        )
        : null;

    return (
        <>
            <button
                type="button"
                className={`todo-page__header-btn${open ? ' todo-page__header-btn--active' : ''}`}
                onClick={() => onOpenChange(!open)}
                aria-expanded={open}
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>{t('todoPage.invites.nav')}</span>
                {pendingCount > 0 && <span className="todo-page__header-badge">{pendingCount}</span>}
            </button>
            {modal}
        </>
    );
}
