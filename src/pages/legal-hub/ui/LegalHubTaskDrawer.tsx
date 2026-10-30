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
    const [noteFor, setNoteFor] = useState<string | null>(null);
    const fileTargetRef = useRef<string | null>(null);
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
        setChecks((current) => [...current, { id: `${task.id}-extra-${current.length}`, label, done: false, note: '', fileName: null }]);
        setCheckDraft('');
    };
    const addFile = () => {
        const next = files.length + 1;
        setFiles((current) => [...current, {
            id: `${task.id}-added-${next}`,
            name: `Attachment_${next}.pdf`,
            kind: 'pdf',
            size: '24 KB',
            when: t('legalHub.taskFileToday'),
        }]);
    };
    const addComment = () => {
        const text = commentDraft.trim();
        if (!text)
            return;
        setComments((current) => [...current, {
            id: `${task.id}-comment-${current.length}`,
            author: t('legalHub.taskYou'),
            text,
            when: t('legalHub.taskFileToday'),
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
                <span>{t('legalHub.taskFilesCount').replace('{count}', String(files.length))}</span>
            </div>
            <ul className="lh-drawer__files">
                {files.map((file) => (
                    <li key={file.id}>
                        <span className={`lh-drawer__file-mark lh-drawer__file-mark--${file.kind}`}>{file.kind === 'pdf' ? 'PDF' : 'DOC'}</span>
                        <span>
                            <strong>{file.name}</strong>
                            <small>{file.size} · {file.when}</small>
                        </span>
                    </li>
                ))}
            </ul>
            <button type="button" className="lh-drawer__add-file" onClick={addFile}>
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
                <div className="lh-drawer__body">
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
                                    {checks.map((item) => (
                                        <li key={item.id}>
                                            <div className="lh-drawer__check-row">
                                                <button
                                                    type="button"
                                                    className="lh-drawer__check"
                                                    aria-pressed={item.done}
                                                    onClick={() => setChecks((current) => current.map((row) => row.id === item.id ? { ...row, done: !row.done } : row))}
                                                >
                                                    <span className={item.done ? 'is-on' : ''} aria-hidden />
                                                    <span className={item.done ? 'is-done' : ''}>{item.label}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`lh-drawer__check-tool${noteFor === item.id || item.note ? ' is-on' : ''}`}
                                                    aria-expanded={noteFor === item.id}
                                                    onClick={() => setNoteFor((current) => current === item.id ? null : item.id)}
                                                >
                                                    {t('legalHub.taskCheckComment')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`lh-drawer__check-tool${item.fileName ? ' is-on' : ''}`}
                                                    onClick={() => {
                                                        fileTargetRef.current = item.id;
                                                        fileInputRef.current?.click();
                                                    }}
                                                >
                                                    {t('legalHub.taskCheckFile')}
                                                </button>
                                            </div>
                                            {noteFor === item.id || item.note ? (
                                                <input
                                                    className="lh-drawer__check-note"
                                                    value={item.note ?? ''}
                                                    placeholder={t('legalHub.taskCheckNote')}
                                                    aria-label={t('legalHub.taskCheckNote')}
                                                    onChange={(event) => {
                                                        const note = event.target.value;
                                                        setChecks((current) => current.map((row) => row.id === item.id ? { ...row, note } : row));
                                                    }}
                                                />
                                            ) : null}
                                            {item.fileName ? (
                                                <span className="lh-drawer__check-file">
                                                    <span>{item.fileName}</span>
                                                    <button
                                                        type="button"
                                                        aria-label={t('legalHub.taskCheckClearFile')}
                                                        onClick={() => setChecks((current) => current.map((row) => row.id === item.id ? { ...row, fileName: null } : row))}
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ) : null}
                                        </li>
                                    ))}
                                </ul>
                                <input
                                    ref={fileInputRef}
                                    className="lh-drawer__file-input"
                                    type="file"
                                    tabIndex={-1}
                                    aria-hidden
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        const targetId = fileTargetRef.current;
                                        event.target.value = '';
                                        if (!file || !targetId)
                                            return;
                                        setChecks((current) => current.map((row) => row.id === targetId ? { ...row, fileName: file.name } : row));
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
                        <section className="lh-drawer__block">
                            {comments.length === 0 ? <p className="lh-drawer__empty">{t('legalHub.taskCommentsEmpty')}</p> : null}
                            <ul className="lh-drawer__comments">
                                {comments.map((comment) => (
                                    <li key={comment.id}>
                                        <strong>{comment.author}</strong>
                                        <span>{comment.when}</span>
                                        <p>{comment.text}</p>
                                    </li>
                                ))}
                            </ul>
                            <form
                                className="lh-drawer__add"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    addComment();
                                }}
                            >
                                <input
                                    value={commentDraft}
                                    onChange={(event) => setCommentDraft(event.target.value)}
                                    placeholder={t('legalHub.taskCommentPlaceholder')}
                                    aria-label={t('legalHub.taskCommentPlaceholder')}
                                />
                                <button type="submit">{t('legalHub.taskCommentSend')}</button>
                            </form>
                        </section>
                    ) : null}
                    {tab === 'history' ? (
                        <ul className="lh-drawer__history">
                            {seed.history.map((event) => (
                                <li key={event.id}>
                                    <span>{event.when}</span>
                                    <p>
                                        {event.kind === 'created'
                                            ? t('legalHub.taskHistCreated')
                                            : t('legalHub.taskHistStatus').replace('{status}', t(STATUS_LABEL[task.status]))}
                                    </p>
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
