import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { DatePicker, SearchableSelect } from '@shared/ui';
import { canSelectLegalHubReviewer } from './legalHubRank';
import { useLegalHubView } from './legalHubView';
import {
    addLegalHubCheck,
    addLegalHubCheckNote,
    addLegalHubComment,
    deleteLegalHubCheckNote,
    deleteLegalHubFile,
    fetchLegalHubTaskActivity,
    patchLegalHubCheck,
    patchLegalHubTask,
    uploadLegalHubFiles,
    type LegalHubTaskActivity,
} from './legalHubTaskApi';
import { LegalHubFilePreview } from './LegalHubFilePreview';
import {
    PERSON_LABEL,
    PROJECT_LABEL,
    TASK_PRIORITIES,
    taskDrawerDetail,
    type HubTask,
    type TaskCheck,
    type TaskComment,
    type TaskFile,
    type TaskPriorityId,
    type TaskStatusId,
} from './legalHubTasks';

type TabId = 'details' | 'files' | 'comments' | 'history';

const STATUS_LABEL: Record<TaskStatusId, TranslationKey> = {
    partner: 'legalHub.taskStatusPartner',
    progress: 'legalHub.statusInProgress',
    wait: 'legalHub.statusWaiting',
    changes: 'legalHub.statusChanges',
    associate: 'legalHub.taskStatusAssociate',
    todo: 'legalHub.taskStatusTodo',
};

const HISTORY_LABEL: Record<'created' | 'started' | 'review' | 'file' | 'comment', TranslationKey> = {
    created: 'legalHub.taskHistCreated',
    started: 'legalHub.taskHistStarted',
    review: 'legalHub.taskHistReview',
    file: 'legalHub.taskHistFile',
    comment: 'legalHub.taskHistComment',
};

const PRIORITY_LABEL: Record<TaskPriorityId, TranslationKey> = {
    high: 'legalHub.taskPriorityHigh',
    normal: 'legalHub.taskPriorityNormal',
    low: 'legalHub.taskPriorityLow',
};

const REVIEW_STAGES: TranslationKey[] = [
    'legalHub.taskStageSubmitted',
    'legalHub.taskStageAssociate',
    'legalHub.taskStagePartner',
    'legalHub.taskStageApproved',
];

function stageIndex(status: TaskStatusId): number {
    if (status === 'partner')
        return 2;
    if (status === 'associate' || status === 'changes')
        return 1;
    return 0;
}

function dayDelta(iso: string): number {
    const [year, month, day] = iso.split('-').map(Number);
    const target = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target.getTime() - start.getTime()) / 86400000);
}

function IconClose() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
        </svg>
    );
}

function IconFolder() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
            <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.2L10.5 7.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V7.5z" />
        </svg>
    );
}

function IconStar({ filled }: { filled: boolean }) {
    return (
        <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
            <path d="m12 3.6 2.15 4.7 5.15.5-3.9 3.4 1.15 5.1L12 14.9 7.45 17.3l1.15-5.1-3.9-3.4 5.15-.5L12 3.6z" />
        </svg>
    );
}

const DETAIL_MONTHS: Record<string, string[]> = {
    ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'нояб', 'дек'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

function formatDetailDate(iso: string, locale: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    const names = DETAIL_MONTHS[locale] ?? DETAIL_MONTHS.en!;
    return `${day ?? ''} ${names[(month ?? 1) - 1] ?? ''} ${year ?? ''}`.trim();
}

const CHAT_COLORS = ['#3b82f6', '#22c55e', '#8b5cf6', '#f97316', '#06b6d4', '#ef4444'];

function chatInitials(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return (parts[0]!.length <= 2 ? parts[0]! : parts[0]!.slice(0, 1)).toUpperCase();
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function IconSend() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m5 12 14-7-4 14-3-5-7-2z" />
        </svg>
    );
}

function IconClip() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m21.4 11.1-9.2 9.2a5 5 0 0 1-7.1-7.1l9.2-9.2a3.4 3.4 0 0 1 4.8 4.8l-9.2 9.2a1.7 1.7 0 0 1-2.4-2.4l8.5-8.5" />
        </svg>
    );
}

export function LegalHubTaskDrawer({ task, owner, onClose, onReviewed }: {
    task: HubTask;
    owner: { code: string; name: string } | null;
    onClose: () => void;
    onReviewed?: (patch: { status?: TaskStatusId; boardColumn: string; reviewerId?: number; done?: boolean; approval?: boolean }) => void;
}) {
    const { t, locale } = useI18n();
    const { userId, staff, me } = useLegalHubView();
    const formId = useId();
    const seed = taskDrawerDetail(task);
    const stored = task as HubTask & { instructions?: string; internalOn?: string };
    const [tab, setTab] = useState<TabId>('details');
    const [closing, setClosing] = useState(false);
    const [status, setStatus] = useState<TaskStatusId>(task.status);
    const [priority, setPriority] = useState<TaskPriorityId>(task.priority);
    const [minutes, setMinutes] = useState(String(task.minutes));
    const [internalOn, setInternalOn] = useState(stored.internalOn || seed.internalOn || '');
    const [reviewOn, setReviewOn] = useState(task.reviewOn ?? '');
    const [clientOn, setClientOn] = useState(task.clientOn);
    const [instructions, setInstructions] = useState(stored.instructions || seed.instructions);
    const [checks, setChecks] = useState<TaskCheck[]>(seed.checks);
    const [checkDraft, setCheckDraft] = useState('');
    const [panel, setPanel] = useState<{ id: string; kind: 'notes' | 'files' } | null>(null);
    const [noteDraft, setNoteDraft] = useState('');
    const threadRef = useRef<HTMLDivElement>(null);
    const fileTargetRef = useRef<string | null>(null);
    const fileModeRef = useRef<'item' | 'task'>('item');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<TaskFile[]>(seed.files);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [comments, setComments] = useState<TaskComment[]>(seed.comments);
    const [history, setHistory] = useState(seed.history);
    const [commentDraft, setCommentDraft] = useState('');
    const [commentFiles, setCommentFiles] = useState<File[]>([]);
    const [preview, setPreview] = useState<{ id: string; name: string } | null>(null);
    const commentFileRef = useRef<HTMLInputElement>(null);
    const [important, setImportant] = useState(seed.important || task.important === true);
    const [reviewerId, setReviewerId] = useState<number | null>(task.reviewerId ?? null);
    const [reviewError, setReviewError] = useState('');
    const [approved, setApproved] = useState((task as { approval?: boolean }).approval === true);
    const ownerPerson = owner ?? (task.assigneeName?.trim()
        ? { name: task.assigneeName.trim(), code: task.assigneeCode?.trim() || task.assigneeName.trim().slice(0, 2).toUpperCase() }
        : PERSON_LABEL[task.owner]);
    const ownerName = ownerPerson.name;
    const ownerTone = owner ? 'member' : task.owner;
    const actor = me ?? (userId != null ? { id: userId, rank: 5000 } : null);
    const reviewers = staff
        .filter((person) => (
            person.id === reviewerId
            || (actor != null && canSelectLegalHubReviewer(actor, person))
        ))
        .slice()
        .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name, locale));
    const requestClose = useCallback(() => {
        setClosing((already) => {
            if (already)
                return already;
            if (closeTimer.current)
                clearTimeout(closeTimer.current);
            closeTimer.current = setTimeout(() => onClose(), 220);
            return true;
        });
    }, [onClose]);
    const clientLate = clientOn !== '' && dayDelta(clientOn) < 0;
    const dateLabel = (iso: string, late = false) => {
        if (!iso)
            return '';
        const text = formatDetailDate(iso, locale);
        return late ? `${text} · ${t('legalHub.taskOverdueMark')}` : text;
    };
    const stage = approved ? REVIEW_STAGES.length - 1 : stageIndex(status);
    const inReview = approved || status === 'associate' || status === 'partner' || status === 'changes';
    const primaryLabel: TranslationKey = approved
        ? 'legalHub.taskApprovedDone'
        : status === 'partner'
            ? 'legalHub.taskApprove'
            : status === 'associate'
                ? 'legalHub.taskPassPartner'
                : status === 'changes'
                    ? 'legalHub.taskSendFixes'
                    : 'legalHub.taskSendReview';
    const sendingReview = !approved && status !== 'partner';
    const missingFile = sendingReview && files.length === 0;
    const selectedReviewer = reviewers.find((item) => item.id === reviewerId);
    const needsPartner = status === 'associate' && selectedReviewer?.rank !== 0;
    const missingReviewer = sendingReview && (reviewerId == null || needsPartner);
    const notifyReviewer = () => {
        if (approved)
            return;
        if (status === 'partner') {
            void patchLegalHubTask(task.id, { boardColumn: 'done', approval: true }).then((ok) => {
                if (!ok) {
                    setReviewError(t('legalHub.taskSaveError'));
                    return;
                }
                setReviewError('');
                setApproved(true);
                onReviewed?.({ boardColumn: 'done', done: true, approval: true });
            });
            return;
        }
        if (missingFile || reviewerId == null)
            return;
        const person = selectedReviewer;
        if (status === 'associate' && person?.rank !== 0) {
            setReviewError(t('legalHub.taskReviewNeedsPartner'));
            return;
        }
        const next: TaskStatusId = person?.rank === 0 ? 'partner' : 'associate';
        void patchLegalHubTask(task.id, {
            status: next,
            boardColumn: next,
            reviewerUserId: reviewerId,
            notifyReview: true,
        }).then((ok) => {
            if (!ok) {
                setReviewError(t('legalHub.taskSaveError'));
                return;
            }
            setReviewError('');
            setStatus(next);
            onReviewed?.({ status: next, boardColumn: next, reviewerId });
            void fetchLegalHubTaskActivity(task.id).then((activity) => {
                if (activity)
                    setHistory(activity.history);
            });
        });
    };
    const saveDate = (field: 'internalOn' | 'reviewOn' | 'dueOn', value: string) => {
        if (field === 'internalOn')
            void patchLegalHubTask(task.id, value ? { internalOn: value, notifyDates: true } : { clearInternalOn: true, notifyDates: true });
        else if (field === 'reviewOn')
            void patchLegalHubTask(task.id, value ? { reviewOn: value, notifyDates: true } : { clearReviewOn: true, notifyDates: true });
        else
            void patchLegalHubTask(task.id, value ? { dueOn: value, notifyDates: true } : { clearDueOn: true, notifyDates: true });
    };
    const withdraw = () => {
        setApproved(false);
        setStatus(task.status === 'todo' || task.status === 'wait' ? task.status : 'progress');
    };
    const done = checks.filter((item) => item.done).length;
    const progress = checks.length === 0 ? 0 : Math.round((done / checks.length) * 100);
    const priorities = TASK_PRIORITIES.map((id) => ({ id, label: t(PRIORITY_LABEL[id]) }));

    const applyActivity = (activity: LegalHubTaskActivity) => {
        setFiles(activity.files);
        setChecks(activity.checks);
        setComments(activity.comments.map((comment) => ({ ...comment, mine: comment.authorUserId === userId })));
        setHistory(activity.history);
    };

    useEffect(() => {
        let cancelled = false;
        void fetchLegalHubTaskActivity(task.id).then((activity) => {
            if (cancelled || activity == null)
                return;
            applyActivity(activity);
        });
        return () => {
            cancelled = true;
        };
    }, [task.id, userId]);

    useEffect(() => {
        if (tab !== 'comments')
            return;
        const node = threadRef.current;
        if (node)
            node.scrollTop = node.scrollHeight;
    }, [comments, tab]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape')
                return;
            if (document.querySelector('.ttp-pop, .tsp-srch--open'))
                return;
            requestClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [requestClose]);

    useEffect(() => () => {
        if (closeTimer.current)
            clearTimeout(closeTimer.current);
    }, []);

    const addCheck = () => {
        const label = checkDraft.trim();
        if (!label)
            return;
        void addLegalHubCheck(task.id, label).then((activity) => {
            if (activity == null) {
                setReviewError(t('legalHub.taskSaveError'));
                return;
            }
            applyActivity(activity);
            setCheckDraft('');
        });
    };
    const addComment = () => {
        const pending = commentFiles;
        const text = commentDraft.trim() || (pending[0]?.name ?? '');
        if (!text)
            return;
        setCommentDraft('');
        setCommentFiles([]);
        void addLegalHubComment(task.id, text, pending).then((activity) => {
            if (activity == null) {
                setReviewError(t('legalHub.taskSaveError'));
                setCommentDraft(text);
                setCommentFiles(pending);
                return;
            }
            applyActivity(activity);
            setTab('comments');
        });
    };

    const taskFiles = files.filter((file) => !file.checkId && !file.commentId);
    const tabs: { id: TabId; label: string; count?: number }[] = [
        { id: 'details', label: t('legalHub.taskTabDetails') },
        { id: 'files', label: t('legalHub.taskTabFiles'), count: taskFiles.length },
        { id: 'comments', label: t('legalHub.taskTabComments'), count: comments.length },
        { id: 'history', label: t('legalHub.taskTabHistory') },
    ];

    const filesBlock = (
        <section className="lh-drawer__block">
            <div className="lh-drawer__block-head">
                <h3>{t('legalHub.taskFilesTitle')}</h3>
                <span className="lh-drawer__count">{taskFiles.length}</span>
            </div>
            {taskFiles.length === 0 ? null : (
                <ul className="lh-drawer__files">
                    {taskFiles.map((file) => (
                        <li key={file.id}>
                            <span className={`lh-drawer__file-mark lh-drawer__file-mark--${file.kind}`}>{file.kind === 'pdf' ? 'PDF' : 'DOC'}</span>
                            <span className="lh-drawer__file-body">
                            <button
                                type="button"
                                className="lh-drawer__file-open"
                                onClick={() => setPreview({ id: file.id, name: file.name })}
                            >
                                <strong>{file.name}</strong>
                            </button>
                                <small>{file.size} · {file.when}</small>
                            </span>
                            <button
                                type="button"
                                aria-label={t('legalHub.taskCheckClearFile')}
                                onClick={() => {
                                    void deleteLegalHubFile(task.id, file.id).then((ok) => {
                                        if (!ok)
                                            return;
                                        setFiles((current) => current.filter((row) => row.id !== file.id));
                                    });
                                }}
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <button
                type="button"
                className="lh-drawer__add-file"
                onClick={() => {
                    fileModeRef.current = 'task';
                    fileInputRef.current?.click();
                }}
            >
                + {t('legalHub.taskAddFiles')}
            </button>
        </section>
    );

    return (
        <>
            {createPortal(
        <div className={`lh-drawer${closing ? ' is-closing' : ''}`} role="presentation" onMouseDown={requestClose}>
            <div
                className={`lh-drawer__panel${closing ? ' is-closing' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${formId}-title`}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="lh-drawer__head">
                    <span className="lh-drawer__project">
                        <IconFolder />
                        <span>{task.projectName?.trim() || PROJECT_LABEL[task.project]}{task.workstream && task.workstream !== '—' ? ` / ${task.workstream}` : ''}</span>
                    </span>
                    <button type="button" className="lh-drawer__close" aria-label={t('legalHub.taskDrawerClose')} onClick={requestClose}>
                        <IconClose />
                    </button>
                </header>
                <div className="lh-drawer__intro">
                    <h2 id={`${formId}-title`}>{task.title}</h2>
                    <div className="lh-drawer__badges">
                        <span className={`lh-drawer__status lh-drawer__status--${stage === 3 ? 'partner' : status}`}>
                            <i aria-hidden />
                            {stage === 3 ? t('legalHub.taskStageApproved') : t(STATUS_LABEL[status])}
                        </span>
                        <button
                            type="button"
                            className={`lh-drawer__mark${important ? ' is-on' : ''}`}
                            aria-pressed={important}
                            onClick={() => setImportant((value) => !value)}
                        >
                            <IconStar filled={important} />
                            {t('legalHub.taskImportantChip')}
                        </button>
                    </div>
                </div>
                <div className="lh-drawer__tabs" role="tablist">
                    {tabs.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === item.id}
                            className={tab === item.id ? 'is-active' : ''}
                            onClick={() => setTab(item.id)}
                        >
                            {item.label}
                            {item.count != null && item.count > 0 ? <span>{item.count}</span> : null}
                        </button>
                    ))}
                </div>
                <div className={`lh-drawer__body${tab === 'comments' ? ' lh-drawer__body--chat' : ''}`}>
                    {tab === 'details' ? (
                        <>
                            <div className="lh-drawer__rows">
                                <PersonField label={t('legalHub.taskFieldOwner')} name={ownerPerson.code} code={ownerPerson.code} tone={ownerTone} />
                                <div className="lh-drawer__row">
                                    <span>{t('legalHub.taskFieldReviewer')}</span>
                                    <SearchableSelect
                                        portalDropdown
                                        portalZIndex={6000}
                                        className="lh-drawer__assign"
                                        buttonClassName="lh-drawer__assign-btn"
                                        aria-label={t('legalHub.taskFieldReviewer')}
                                        placeholder={`+ ${t('legalHub.taskAssign')}`}
                                        emptyListText={t('legalHub.taskFilterAll')}
                                        noMatchText={t('legalHub.teamNoMatch')}
                                        value={reviewerId == null ? '' : String(reviewerId)}
                                        items={reviewers}
                                        getOptionValue={(item) => String(item.id)}
                                        getOptionLabel={(item) => `${item.name} · ${item.position}`}
                                        getSearchText={(item) => `${item.name} ${item.position} ${item.code}`}
                                        onSelect={(item) => {
                                            setReviewerId(item.id);
                                            setReviewError('');
                                            void patchLegalHubTask(task.id, { reviewerUserId: item.id });
                                        }}
                                        renderButtonContent={(item) => (
                                            <span className="lh-drawer__person">
                                                <span className="lh-tasks__avatar" aria-hidden>{item.code}</span>
                                                {item.name}
                                            </span>
                                        )}
                                    />
                                </div>
                                <DateField id={`${formId}-internal`} label={t('legalHub.taskFieldInternal')} value={internalOn} emptyLabel={t('legalHub.taskDateEmpty')} labelText={dateLabel(internalOn)} onChange={(value) => { setInternalOn(value); saveDate('internalOn', value); }} />
                                <DateField id={`${formId}-review`} label={t('legalHub.taskFieldReview')} value={reviewOn} emptyLabel={t('legalHub.taskDateEmpty')} labelText={dateLabel(reviewOn)} onChange={(value) => { setReviewOn(value); saveDate('reviewOn', value); }} />
                                <DateField id={`${formId}-client`} label={t('legalHub.taskFieldClient')} value={clientOn} emptyLabel={t('legalHub.taskDateEmpty')} labelText={dateLabel(clientOn, clientLate)} late={clientLate} onChange={(value) => { setClientOn(value); saveDate('dueOn', value); }} />
                                <div className="lh-drawer__row">
                                    <span>{t('legalHub.taskColPriority')}</span>
                                    <SearchableSelect
                                        portalDropdown
                                        portalZIndex={6000}
                                        className="lh-drawer__plain"
                                        buttonClassName="lh-drawer__plain-btn"
                                        aria-label={t('legalHub.taskColPriority')}
                                        placeholder={t('legalHub.taskColPriority')}
                                        emptyListText={t('legalHub.taskFilterAll')}
                                        noMatchText={t('legalHub.teamNoMatch')}
                                        value={priority}
                                        items={priorities}
                                        getOptionValue={(item) => item.id}
                                        getOptionLabel={(item) => item.label}
                                        getSearchText={(item) => item.label}
                                        onSelect={(item) => setPriority(item.id)}
                                        renderButtonContent={(item) => (
                                            <span className={`lh-drawer__prio lh-drawer__prio--${item.id}`}>
                                                <i aria-hidden />
                                                {item.label}
                                            </span>
                                        )}
                                    />
                                </div>
                                <label className="lh-drawer__row">
                                    <span>{t('legalHub.taskColEstimate')}</span>
                                    <input
                                        className="lh-drawer__estimate"
                                        inputMode="numeric"
                                        placeholder={t('legalHub.taskEstimateEmpty')}
                                        aria-label={t('legalHub.taskColEstimate')}
                                        value={minutes}
                                        onChange={(event) => setMinutes(event.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                                    />
                                </label>
                            </div>
                            <div className="lh-drawer__stage">
                                <span id={`${formId}-stage`}>{t('legalHub.taskReviewStatus')}</span>
                                <ol className="lh-drawer__steps">
                                    {REVIEW_STAGES.map((key, index) => (
                                        <li key={key} className={index === stage ? 'is-on' : index < stage ? 'is-done' : ''}>
                                            <span className="lh-drawer__step-mark" aria-hidden />
                                            <span>{t(key)}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                            <label className="lh-drawer__field lh-drawer__field--stack">
                                <span>{t('legalHub.taskFieldInstructions')}</span>
                                <textarea className="lh-drawer__area" rows={4} placeholder={t('legalHub.taskInstructionsPh')} value={instructions} onChange={(event) => setInstructions(event.target.value)} />
                            </label>
                            <section className="lh-drawer__block">
                                <div className="lh-drawer__block-head">
                                    <h3>{t('legalHub.taskChecklist')}</h3>
                                    <span>{t('legalHub.taskChecklistProgress').replace('{done}', String(done)).replace('{total}', String(checks.length))}</span>
                                </div>
                                <span className="lh-drawer__meter" aria-hidden>
                                    <span style={{ width: `${progress}%` }} />
                                </span>
                                <ul className="lh-drawer__checks">
                                    {checks.map((item) => {
                                        const notes = item.notes ?? [];
                                        const itemFiles = item.files ?? [];
                                        const notesOpen = panel?.id === item.id && panel.kind === 'notes';
                                        const filesOpen = panel?.id === item.id && panel.kind === 'files';
                                        const openKind = (kind: 'notes' | 'files') => {
                                            setPanel((current) => current?.id === item.id && current.kind === kind ? null : { id: item.id, kind });
                                            setNoteDraft('');
                                        };
                                        return (
                                            <li key={item.id}>
                                                <div className="lh-drawer__check-row">
                                                <button
                                                    type="button"
                                                    className="lh-drawer__check"
                                                    aria-pressed={item.done}
                                                    onClick={() => {
                                                        void patchLegalHubCheck(task.id, item.id, !item.done).then((activity) => {
                                                            if (activity)
                                                                applyActivity(activity);
                                                        });
                                                    }}
                                                >
                                                    <span className={item.done ? 'is-on' : ''} aria-hidden />
                                                    <span className={item.done ? 'is-done' : ''}>{item.label}</span>
                                                </button>
                                                <div className="lh-drawer__check-tools">
                                                    <button
                                                        type="button"
                                                        className={`lh-drawer__check-tool${notesOpen || notes.length > 0 ? ' is-on' : ''}`}
                                                        aria-expanded={notesOpen}
                                                        onClick={() => openKind('notes')}
                                                    >
                                                        {t('legalHub.taskCheckComment')}
                                                        {notes.length > 0 ? <span>{notes.length}</span> : null}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`lh-drawer__check-tool${filesOpen || itemFiles.length > 0 ? ' is-on' : ''}`}
                                                        aria-expanded={filesOpen}
                                                        onClick={() => openKind('files')}
                                                    >
                                                        {t('legalHub.taskCheckFile')}
                                                        {itemFiles.length > 0 ? <span>{itemFiles.length}</span> : null}
                                                    </button>
                                                </div>
                                                </div>
                                                {notesOpen ? (
                                                    <div className="lh-drawer__check-panel">
                                                        {notes.map((note) => (
                                                            <div key={note.id} className="lh-drawer__chip">
                                                                <p>{note.text}</p>
                                                                <button
                                                                    type="button"
                                                                    aria-label={t('legalHub.taskCheckClearNote')}
                                                                    onClick={() => {
                                                                        void deleteLegalHubCheckNote(task.id, item.id, note.id).then((activity) => {
                                                                            if (activity)
                                                                                applyActivity(activity);
                                                                        });
                                                                    }}
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <form
                                                            className="lh-drawer__add"
                                                            onSubmit={(event) => {
                                                                event.preventDefault();
                                                                const text = noteDraft.trim();
                                                                if (!text)
                                                                    return;
                                                                void addLegalHubCheckNote(task.id, item.id, text).then((activity) => {
                                                                    if (activity == null) {
                                                                        setReviewError(t('legalHub.taskSaveError'));
                                                                        return;
                                                                    }
                                                                    applyActivity(activity);
                                                                    setNoteDraft('');
                                                                });
                                                            }}
                                                        >
                                                            <input
                                                                value={noteDraft}
                                                                onChange={(event) => setNoteDraft(event.target.value)}
                                                                placeholder={t('legalHub.taskCheckNote')}
                                                                aria-label={t('legalHub.taskCheckNote')}
                                                            />
                                                            <button type="submit">{t('legalHub.taskCheckAddBtn')}</button>
                                                        </form>
                                                    </div>
                                                ) : null}
                                                {filesOpen ? (
                                                    <div className="lh-drawer__check-panel">
                                                        {itemFiles.map((file) => (
                                                            <div key={file.id} className="lh-drawer__chip">
                                                                <button type="button" className="lh-drawer__file-open" onClick={() => setPreview({ id: file.id, name: file.name })}>
                                                                    {file.name}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    aria-label={t('legalHub.taskCheckClearFile')}
                                                                    onClick={() => {
                                                                        void deleteLegalHubFile(task.id, file.id).then((ok) => {
                                                                            if (!ok)
                                                                                return;
                                                                            setFiles((current) => current.filter((row) => row.id !== file.id));
                                                                            setChecks((current) => current.map((row) => row.id === item.id ? { ...row, files: (row.files ?? []).filter((entry) => entry.id !== file.id) } : row));
                                                                        });
                                                                    }}
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            className="lh-drawer__add-file"
                                                            onClick={() => {
                                                                fileModeRef.current = 'item';
                                                                fileTargetRef.current = item.id;
                                                                fileInputRef.current?.click();
                                                            }}
                                                        >
                                                            + {t('legalHub.taskCheckFile')}
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                                <input
                                    ref={fileInputRef}
                                    className="lh-drawer__file-input"
                                    type="file"
                                    multiple
                                    tabIndex={-1}
                                    aria-hidden
                                    onChange={(event) => {
                                        const picked = [...(event.target.files ?? [])];
                                        const mode = fileModeRef.current;
                                        const targetId = fileTargetRef.current;
                                        event.target.value = '';
                                        if (picked.length === 0)
                                            return;
                                        void uploadLegalHubFiles(task.id, picked, mode === 'item' && targetId ? { checkId: targetId } : undefined).then((activity) => {
                                            if (activity == null) {
                                                setReviewError(t('legalHub.taskFileError'));
                                                return;
                                            }
                                            applyActivity(activity);
                                        });
                                    }}
                                />
                                <form
                                    className="lh-drawer__add"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        addCheck();
                                    }}
                                >
                                    <input
                                        value={checkDraft}
                                        onChange={(event) => setCheckDraft(event.target.value)}
                                        placeholder={t('legalHub.taskCheckAdd')}
                                        aria-label={t('legalHub.taskCheckAdd')}
                                    />
                                    <button type="submit">{t('legalHub.taskCheckAddBtn')}</button>
                                </form>
                            </section>
                            {filesBlock}
                        </>
                    ) : null}
                    {tab === 'files' ? filesBlock : null}
                    {tab === 'comments' ? (
                        <div className="lh-chat">
                            <div className="lh-chat__thread" ref={threadRef}>
                                {comments.length === 0 ? <p className="lh-chat__empty">{t('legalHub.taskCommentsEmpty')}</p> : null}
                                {comments.map((comment, index) => {
                                    const mine = comment.mine === true;
                                    const color = CHAT_COLORS[comment.author.charCodeAt(0) % CHAT_COLORS.length] ?? CHAT_COLORS[0];
                                    return (
                                        <article
                                            key={comment.id}
                                            className={`lh-chat__msg${mine ? ' lh-chat__msg--mine' : ''}`}
                                            style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
                                        >
                                            {mine ? null : (
                                                <span className="lh-chat__avatar" style={{ background: color }} aria-hidden>
                                                    {chatInitials(comment.author)}
                                                </span>
                                            )}
                                            <div className="lh-chat__stack">
                                                <div className="lh-chat__meta">
                                                    {mine ? null : <strong>{comment.author}</strong>}
                                                    <span>{comment.when} · {comment.time}</span>
                                                </div>
                                                <div className="lh-chat__bubble">
                                                    <p>{comment.text}</p>
                                                    {(comment.files ?? []).map((file) => (
                                                        <button
                                                            key={file.id}
                                                            type="button"
                                                            className="lh-chat__file"
                                                            onClick={() => setPreview({ id: file.id, name: file.name })}
                                                        >
                                                            {file.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                            <form
                                className="lh-chat__compose"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    addComment();
                                }}
                            >
                                {commentFiles.length > 0 ? (
                                    <div className="lh-chat__pending">
                                        {commentFiles.map((file, index) => (
                                            <span key={`${file.name}-${index}`} className="lh-drawer__chip">
                                                <span>{file.name}</span>
                                                <button
                                                    type="button"
                                                    aria-label={t('legalHub.taskCheckClearFile')}
                                                    onClick={() => setCommentFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                                <div className="lh-chat__compose-row">
                                    <button
                                        type="button"
                                        className="lh-chat__clip"
                                        aria-label={t('legalHub.taskCommentAttach')}
                                        onClick={() => commentFileRef.current?.click()}
                                    >
                                        <IconClip />
                                    </button>
                                    <textarea
                                        rows={1}
                                        value={commentDraft}
                                        placeholder={t('legalHub.taskCommentPlaceholder')}
                                        aria-label={t('legalHub.taskCommentPlaceholder')}
                                        onChange={(event) => setCommentDraft(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key !== 'Enter' || event.shiftKey)
                                                return;
                                            event.preventDefault();
                                            addComment();
                                        }}
                                    />
                                    <button type="submit" aria-label={t('legalHub.taskCommentSend')} disabled={commentDraft.trim().length === 0 && commentFiles.length === 0}>
                                        <IconSend />
                                    </button>
                                </div>
                                <input
                                    ref={commentFileRef}
                                    className="lh-drawer__file-input"
                                    type="file"
                                    multiple
                                    tabIndex={-1}
                                    aria-hidden
                                    onChange={(event) => {
                                        const picked = [...(event.target.files ?? [])];
                                        event.target.value = '';
                                        if (picked.length === 0)
                                            return;
                                        setCommentFiles((current) => [...current, ...picked]);
                                    }}
                                />
                            </form>
                        </div>
                    ) : null}
                    {tab === 'history' ? (
                        <ul className="lh-drawer__history">
                            {history.map((event, index) => (
                                <li key={event.id} style={{ ['--lh-delay' as string]: `${index * 70}ms` }}>
                                    <span className={`lh-drawer__history-dot lh-drawer__history-dot--${event.kind}`} aria-hidden />
                                    <div>
                                        <strong>{t(HISTORY_LABEL[event.kind])}</strong>
                                        <span>{[event.actor || ownerName, event.text, event.when, event.time].filter(Boolean).join(' · ')}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
                <footer className="lh-drawer__foot">
                    <button
                        type="button"
                        className={`lh-drawer__send${approved ? ' is-done' : ''}`}
                        disabled={approved || missingFile || missingReviewer}
                        onClick={notifyReviewer}
                    >
                        {approved ? <IconCheck /> : <IconBell />}
                        <span>{t(primaryLabel)}</span>
                    </button>
                    {missingFile ? <p className="lh-drawer__note">{t('legalHub.taskReviewNeedsFile')}</p> : null}
                    {!missingFile && missingReviewer ? <p className="lh-drawer__note">{t(needsPartner ? 'legalHub.taskReviewNeedsPartner' : 'legalHub.taskReviewNeedsPerson')}</p> : null}
                    {reviewError ? <p className="lh-drawer__note">{reviewError}</p> : null}
                    <div className="lh-drawer__foot-row">
                        <button type="button" onClick={() => setTab('comments')}>{t('legalHub.taskAddComment')}</button>
                        {inReview ? <button type="button" onClick={withdraw}>{t('legalHub.taskWithdraw')}</button> : null}
                    </div>
                    {status === 'partner' && !approved ? <p className="lh-drawer__note">{t('legalHub.taskReviewerOnly')}</p> : null}
                </footer>
            </div>
        </div>,
        document.body,
    )}
            {preview ? (
                <LegalHubFilePreview
                    taskId={task.id}
                    fileId={preview.id}
                    name={preview.name}
                    onClose={() => setPreview(null)}
                />
            ) : null}
        </>
    );
}

function IconCheck() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

function IconBell() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
            <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
    );
}

function PersonField({ label, name, code, tone, muted }: {
    label: string;
    name: string;
    code: string;
    tone: string;
    muted?: boolean;
}) {
    return (
        <div className="lh-drawer__row">
            <span>{label}</span>
            <strong className={`lh-drawer__person${muted ? ' is-muted' : ''}`}>
                {muted || code === '' ? null : <span className={`lh-tasks__avatar lh-tasks__avatar--${tone}`} aria-hidden>{code}</span>}
                {name}
            </strong>
        </div>
    );
}

function DateField({ id, label, value, emptyLabel, labelText, late, onChange }: {
    id: string;
    label: string;
    value: string;
    emptyLabel: string;
    labelText: string;
    late?: boolean;
    onChange: (iso: string) => void;
}) {
    return (
        <div className="lh-drawer__row">
            <span id={id}>{label}</span>
            <DatePicker
                portal
                portalZIndex={6000}
                showChevron={false}
                className="lh-drawer__calendar"
                buttonClassName={`lh-drawer__date${late ? ' is-late' : ''}`}
                aria-labelledby={id}
                title={label}
                emptyLabel={emptyLabel}
                labelText={labelText}
                value={value}
                onChange={onChange}
            />
        </div>
    );
}
