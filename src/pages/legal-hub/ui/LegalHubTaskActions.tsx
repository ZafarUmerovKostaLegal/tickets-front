import { useEffect, useState } from 'react';
import { useI18n, type TranslationKey } from '@shared/i18n';
import { SearchableSelect } from '@shared/ui';
import type { MineTask } from './LegalHubMyTasks';
import type { LegalHubTaskActivity, TaskActionId } from './legalHubTaskApi';
import { fetchHubTeams, runTaskAction, teammates, type TeamPerson } from './legalHubTeamApi';

const LABEL: Record<TaskActionId, TranslationKey> = {
    take: 'legalHub.actTake',
    submit: 'legalHub.actSubmit',
    return: 'legalHub.actReturn',
    approve: 'legalHub.actApprove',
    reassign: 'legalHub.actReassign',
};

function needsForm(action: TaskActionId, hasReviewer: boolean): boolean {
    return action === 'return' || action === 'reassign' || action === 'approve' || (action === 'submit' && !hasReviewer);
}

export function LegalHubTaskActions({ taskId, actions, reviewerId, assigneeId, onDone }: {
    taskId: string;
    actions: TaskActionId[];
    reviewerId?: number | null;
    assigneeId?: number | null;
    onDone: (result: { task: MineTask | null; activity: LegalHubTaskActivity }) => void;
}) {
    const { t } = useI18n();
    const [open, setOpen] = useState<TaskActionId | null>(null);
    const [people, setPeople] = useState<TeamPerson[]>([]);
    const [personId, setPersonId] = useState<number | null>(null);
    const [comment, setComment] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (open !== 'reassign' && open !== 'submit')
            return;
        let cancelled = false;
        void fetchHubTeams().then((data) => {
            if (!cancelled)
                setPeople(teammates(data));
        }).catch((err: unknown) => {
            if (!cancelled)
                setError(err instanceof Error ? err.message : String(err));
        });
        return () => {
            cancelled = true;
        };
    }, [open]);

    if (actions.length === 0)
        return null;

    const run = async (action: TaskActionId) => {
        setBusy(true);
        setError('');
        try {
            const result = await runTaskAction(taskId, action, {
                comment: comment.trim() || undefined,
                userId: action === 'reassign' || (action === 'submit' && !reviewerId) ? personId ?? undefined : undefined,
            });
            setOpen(null);
            setComment('');
            setPersonId(null);
            onDone(result);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setBusy(false);
        }
    };

    const start = (action: TaskActionId) => {
        setError('');
        if (needsForm(action, Boolean(reviewerId))) {
            setOpen(open === action ? null : action);
            return;
        }
        void run(action);
    };

    const pickPerson = open === 'reassign' || (open === 'submit' && !reviewerId);
    const choices = people.filter((person) => person.id !== assigneeId);
    const commentRequired = open === 'return';
    const canConfirm = !busy && (!pickPerson || personId != null) && (!commentRequired || comment.trim().length > 0);

    return (
        <section className="lh-act" aria-label={t('legalHub.actConfirm')}>
            <div className="lh-act__row">
                {actions.map((action) => (
                    <button
                        key={action}
                        type="button"
                        disabled={busy}
                        aria-expanded={needsForm(action, Boolean(reviewerId)) ? open === action : undefined}
                        className={`lh-act__btn lh-act__btn--${action}${open === action ? ' is-on' : ''}`}
                        onClick={() => start(action)}
                    >
                        {t(LABEL[action])}
                    </button>
                ))}
            </div>
            {open ? (
                <div className="lh-act__form">
                    {pickPerson ? (
                        <label className="lh-act__field">
                            <span>{open === 'reassign' ? t('legalHub.actAssignee') : t('legalHub.actReviewer')}</span>
                            <SearchableSelect
                                portalDropdown
                                portalZIndex={6000}
                                className="lh-act__srch"
                                buttonClassName="lh-act__pick"
                                placeholder={t('legalHub.actPickPerson')}
                                emptyListText={t('legalHub.actOnlyTeam')}
                                noMatchText={t('legalHub.actOnlyTeam')}
                                value={personId == null ? '' : String(personId)}
                                items={choices}
                                getOptionValue={(person) => String(person.id)}
                                getOptionLabel={(person) => person.name || person.email || String(person.id)}
                                getSearchText={(person) => `${person.name} ${person.email ?? ''}`}
                                onSelect={(person) => setPersonId(person.id)}
                            />
                            <small>{t('legalHub.actOnlyTeam')}</small>
                        </label>
                    ) : null}
                    <textarea
                        className="lh-act__area"
                        rows={3}
                        value={comment}
                        required={commentRequired}
                        placeholder={commentRequired ? t('legalHub.actReturnPh') : t('legalHub.actCommentPh')}
                        aria-label={commentRequired ? t('legalHub.actReturnPh') : t('legalHub.actCommentPh')}
                        onChange={(event) => setComment(event.target.value)}
                    />
                    <div className="lh-act__row">
                        <button type="button" className="lh-act__btn lh-act__btn--primary" disabled={!canConfirm} onClick={() => void run(open)}>
                            {t(LABEL[open])}
                        </button>
                        <button type="button" className="lh-act__btn" disabled={busy} onClick={() => setOpen(null)}>{t('legalHub.actCancel')}</button>
                    </div>
                </div>
            ) : null}
            {error ? <p className="lh-act__error" role="alert">{error}</p> : null}
        </section>
    );
}
