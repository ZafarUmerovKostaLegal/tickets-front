import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { DatePicker, SearchableSelect } from '@shared/ui';
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
};

function IconClose() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
        </svg>
    );
}

function IconFolder() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10z" />
        </svg>
    );
}

function IconStar() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="m12 3 2.4 5.4 5.9.6-4.4 3.9 1.3 5.8L12 15.8 6.8 18.7l1.3-5.8L3.7 9l5.9-.6L12 3z" />
        </svg>
    );
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

export function LegalHubTaskDrawer({ task, owner, onClose }: {
    task: HubTask;
    owner: { code: string; name: string } | null;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const formId = useId();
    const seed = taskDrawerDetail(task);
    const [tab, setTab] = useState<TabId>('details');
    const [status, setStatus] = useState<TaskStatusId>(task.status);
    const [priority, setPriority] = useState<TaskPriorityId>(task.priority);
    const [minutes, setMinutes] = useState(String(task.minutes));
    const [internalOn, setInternalOn] = useState(seed.internalOn ?? '');
    const [reviewOn, setReviewOn] = useState(task.reviewOn ?? '');
    const [clientOn, setClientOn] = useState(task.clientOn);
    const [instructions, setInstructions] = useState(seed.instructions);
    const [checks, setChecks] = useState<TaskCheck[]>(seed.checks);
    const [checkDraft, setCheckDraft] = useState('');
    const [panel, setPanel] = useState<{ id: string; kind: 'notes' | 'files' } | null>(null);
    const [noteDraft, setNoteDraft] = useState('');
    const threadRef = useRef<HTMLDivElement>(null);
    const fileTargetRef = useRef<string | null>(null);
    const fileModeRef = useRef<'item' | 'task'>('item');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<TaskFile[]>(seed.files);
    const [comments, setComments] = useState<TaskComment[]>(seed.comments);
    const [commentDraft, setCommentDraft] = useState('');
    const ownerName = owner?.name ?? PERSON_LABEL[task.owner].name;
    const reviewerName = task.reviewer ? PERSON_LABEL[task.reviewer].name : t('legalHub.taskReviewerEmpty');
    const done = checks.filter((item) => item.done).length;
    const progress = checks.length === 0 ? 0 : Math.round((done / checks.length) * 100);
    const priorities = TASK_PRIORITIES.map((id) => ({ id, label: t(PRIORITY_LABEL[id]) }));

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
            onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const addCheck = () => {
        const label = checkDraft.trim();
        if (!label)
            return;
        setChecks((current) => [...current, { id: `${task.id}-extra-${current.length}`, label, done: false, notes: [], files: [] }]);
        setCheckDraft('');
    };
    const rememberFiles = (picked: File[]) => picked.map((file, index) => ({
        id: `${task.id}-file-${Date.now()}-${index}`,
        name: file.name,
        kind: file.name.toLowerCase().endsWith('.pdf') ? 'pdf' as const : 'docx' as const,
        size: file.size < 1024 * 1024
            ? `${Math.max(1, Math.round(file.size / 1024))} KB`
            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        when: t('legalHub.taskFileToday'),
    }));
    const addComment = () => {
        const text = commentDraft.trim();
        if (!text)
            return;
        const now = new Date();
        const pad = (value: number) => String(value).padStart(2, '0');
        setComments((current) => [...current, {
            id: `${task.id}-comment-${Date.now()}`,
            author: t('legalHub.taskYou'),
            text,
            when: t('legalHub.taskFileToday'),
            time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
            mine: true,
        }]);
        setCommentDraft('');
        setTab('comments');
    };

    const tabs: { id: TabId; label: string; count?: number }[] = [
        { id: 'details', label: t('legalHub.taskTabDetails') },
        { id: 'files', label: t('legalHub.taskTabFiles'), count: files.length },
        { id: 'comments', label: t('legalHub.taskTabComments'), count: comments.length },
        { id: 'history', label: t('legalHub.taskTabHistory') },
    ];

    const filesBlock = (
        <section className="lh-drawer__block">
            <div className="lh-drawer__block-head">
                <h3>{t('legalHub.taskFilesTitle')}</h3>
                <span className="lh-drawer__count">{files.length}</span>
            </div>
            {files.length === 0 ? <p className="lh-drawer__empty">{t('legalHub.taskFilesEmpty')}</p> : (
                <ul className="lh-drawer__files">
                    {files.map((file) => (
                        <li key={file.id}>
                            <span className={`lh-drawer__file-mark lh-drawer__file-mark--${file.kind}`}>{file.kind === 'pdf' ? 'PDF' : 'DOC'}</span>
                            <span className="lh-drawer__file-body">
                                <strong>{file.name}</strong>
                                <small>{file.size} · {file.when}</small>
                            </span>
                            <button
                                type="button"
                                aria-label={t('legalHub.taskCheckClearFile')}
                                onClick={() => setFiles((current) => current.filter((row) => row.id !== file.id))}
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

    return createPortal(
        <div className="lh-drawer" role="presentation" onMouseDown={onClose}>
            <div
                className="lh-drawer__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${formId}-title`}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="lh-drawer__head">
                    <span className={`lh-drawer__project lh-tasks__project--${task.project}`}>
                        <IconFolder />
                        <span>{PROJECT_LABEL[task.project]}</span>
                    </span>
                    <button type="button" className="lh-drawer__close" aria-label={t('legalHub.taskDrawerClose')} onClick={onClose}>
                        <IconClose />
                    </button>
                </header>
                <div className="lh-drawer__intro">
                    <div className="lh-drawer__kicker">
                        <span>{task.workstream}</span>
                        <span className={`lh-tasks__pill lh-tasks__pill--priority-${priority}`}>{t(PRIORITY_LABEL[priority])}</span>
                    </div>
                    <h2 id={`${formId}-title`}>{task.title}</h2>
                    <div className="lh-drawer__badges">
                        <span className={`lh-tasks__pill lh-tasks__pill--${status}`}>{t(STATUS_LABEL[status])}</span>
                        {seed.important ? (
                            <span className="lh-drawer__important">
                                <IconStar />
                                {t('legalHub.taskImportant')}
                            </span>
                        ) : null}
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
                            {item.count != null ? <span>{item.count}</span> : null}
                        </button>
                    ))}
                </div>
                <div className={`lh-drawer__body${tab === 'comments' ? ' lh-drawer__body--chat' : ''}`}>
                    {tab === 'details' ? (
                        <>
                            <div className="lh-drawer__grid">
                                <Field label={t('legalHub.taskFieldOwner')} value={ownerName} />
                                <Field label={t('legalHub.taskFieldReviewer')} value={reviewerName} muted={!task.reviewer} />
                                <DateField id={`${formId}-internal`} label={t('legalHub.taskFieldInternal')} value={internalOn} onChange={setInternalOn} />
                                <DateField id={`${formId}-review`} label={t('legalHub.taskFieldReview')} value={reviewOn} onChange={setReviewOn} />
                                <DateField id={`${formId}-client`} label={t('legalHub.taskFieldClient')} value={clientOn} onChange={setClientOn} />
                                <Field label={t('legalHub.taskFieldApproval')} value={seed.approval === 'required' ? t('legalHub.taskApprovalRequired') : t('legalHub.taskApprovalNo')} />
                                <label className="lh-drawer__field">
                                    <span>{t('legalHub.taskColPriority')}</span>
                                    <SearchableSelect
                                        portalDropdown
                                        portalZIndex={6000}
                                        buttonClassName="lh-drawer__pick"
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
                                    />
                                </label>
                                <label className="lh-drawer__field">
                                    <span>{t('legalHub.taskFieldMinutes')}</span>
                                    <input
                                        className="lh-drawer__input"
                                        inputMode="numeric"
                                        value={minutes}
                                        onChange={(event) => setMinutes(event.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                                    />
                                </label>
                            </div>
                            <label className="lh-drawer__field lh-drawer__field--stack">
                                <span>{t('legalHub.taskFieldInstructions')}</span>
                                <textarea className="lh-drawer__area" rows={4} value={instructions} onChange={(event) => setInstructions(event.target.value)} />
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
                                                <button
                                                    type="button"
                                                    className="lh-drawer__check"
                                                    aria-pressed={item.done}
                                                    onClick={() => setChecks((current) => current.map((row) => row.id === item.id ? { ...row, done: !row.done } : row))}
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
                                                {notesOpen ? (
                                                    <div className="lh-drawer__check-panel">
                                                        {notes.map((note) => (
                                                            <div key={note.id} className="lh-drawer__chip">
                                                                <p>{note.text}</p>
                                                                <button
                                                                    type="button"
                                                                    aria-label={t('legalHub.taskCheckClearNote')}
                                                                    onClick={() => setChecks((current) => current.map((row) => row.id === item.id ? { ...row, notes: (row.notes ?? []).filter((entry) => entry.id !== note.id) } : row))}
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
                                                                setChecks((current) => current.map((row) => row.id === item.id ? {
                                                                    ...row,
                                                                    notes: [...(row.notes ?? []), { id: `${item.id}-n-${Date.now()}`, text }],
                                                                } : row));
                                                                setNoteDraft('');
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
                                                                <span>{file.name}</span>
                                                                <button
                                                                    type="button"
                                                                    aria-label={t('legalHub.taskCheckClearFile')}
                                                                    onClick={() => setChecks((current) => current.map((row) => row.id === item.id ? { ...row, files: (row.files ?? []).filter((entry) => entry.id !== file.id) } : row))}
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
                                        if (mode === 'task') {
                                            setFiles((current) => [...current, ...rememberFiles(picked)]);
                                            return;
                                        }
                                        if (!targetId)
                                            return;
                                        setChecks((current) => current.map((row) => {
                                            if (row.id !== targetId)
                                                return row;
                                            const next = picked.map((file, index) => ({
                                                id: `${targetId}-f-${Date.now()}-${index}`,
                                                name: file.name,
                                            }));
                                            return { ...row, files: [...(row.files ?? []), ...next] };
                                        }));
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
                                <button type="submit" aria-label={t('legalHub.taskCommentSend')} disabled={commentDraft.trim().length === 0}>
                                    <IconSend />
                                </button>
                            </form>
                        </div>
                    ) : null}
                    {tab === 'history' ? (
                        <ul className="lh-drawer__history">
                            {seed.history.map((event, index) => (
                                <li key={event.id} style={{ ['--lh-delay' as string]: `${index * 70}ms` }}>
                                    <span className={`lh-drawer__history-dot lh-drawer__history-dot--${event.kind}`} aria-hidden />
                                    <div>
                                        <strong>{t(HISTORY_LABEL[event.kind])}</strong>
                                        <span>{ownerName} · {event.when} · {event.time}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
                <footer className="lh-drawer__foot">
                    <button type="button" className="lh-drawer__send" onClick={() => setStatus('partner')}>
                        <IconSend />
                        {t('legalHub.taskSendReview')}
                    </button>
                    <div className="lh-drawer__foot-row">
                        <button type="button" onClick={() => setStatus('wait')}>{t('legalHub.taskMarkWaiting')}</button>
                        <button type="button" onClick={() => setTab('comments')}>{t('legalHub.taskAddComment')}</button>
                    </div>
                </footer>
            </div>
        </div>,
        document.body,
    );
}

function Field({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
    return (
        <div className="lh-drawer__field">
            <span>{label}</span>
            <strong className={muted ? 'is-muted' : ''}>{value}</strong>
        </div>
    );
}

function DateField({ id, label, value, onChange }: {
    id: string;
    label: string;
    value: string;
    onChange: (iso: string) => void;
}) {
    return (
        <div className="lh-drawer__field">
            <span id={id}>{label}</span>
            <DatePicker
                portal
                portalZIndex={6000}
                className="lh-drawer__calendar"
                buttonClassName="lh-drawer__date"
                aria-labelledby={id}
                title={label}
                emptyLabel="—"
                value={value}
                onChange={onChange}
            />
        </div>
    );
}
