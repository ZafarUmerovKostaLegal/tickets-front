import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useParams } from 'react-router-dom';
import { AppBackButton, AppHomeLogo, AppPageSettings, useAppDialog } from '@shared/ui';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { apiFetch } from '@shared/api';
import { getTicket, getComments, addComment, addCommentWs, subscribeTicketsWsPush, connectTicketsWsWhenReady, getStatuses, getPriorities, updateTicket, getAttachmentUrl, type Ticket, type Comment, type StatusItem, type PriorityItem, type UpdateTicketData, } from '@entities/ticket';
import { ticketAttachmentFileName } from '@entities/ticket/lib/attachmentFileName';
import type { AttachmentPreviewModel } from '@entities/expenses/lib/buildAttachmentPreview';
import { TicketAttachmentPreviewModal } from './TicketAttachmentPreviewModal';
import { getUser, type User } from '@entities/user';
import {
    useI18n,
    formatDateInfoLocalized,
    formatPriorityLabel,
    formatUserRef,
    ticketErrorMessage,
    translateTicketCategory,
} from '@shared/i18n';
import { hasFullTicketAccessRole } from '@shared/lib/orgRoles';
import { TICKET_CATEGORIES } from '@entities/ticket/lib/constants';
import './TicketDetailPage.css';
const IconUser = memo(function IconUser() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>);
});
const IconCalendar = memo(function IconCalendar() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>);
});
const IconPaperclip = memo(function IconPaperclip() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>);
});
const IconComment = memo(function IconComment() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>);
});
const IconEnvelope = memo(function IconEnvelope() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>);
});
const IconSend = memo(function IconSend() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>);
});
const IconTag = memo(function IconTag() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>);
});
const IconFlag = memo(function IconFlag() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
    </svg>);
});
const IconFolder = memo(function IconFolder() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>);
});
const IconDownload = memo(function IconDownload() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>);
});
const IconEye = memo(function IconEye() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>);
});
function getStatusColor(status: string): string {
    const s = status?.toLowerCase() || '';
    if (s === 'closed')
        return 'closed';
    if (s === 'in_progress')
        return 'progress';
    return 'open';
}
function getPriorityColor(priority: string): string {
    const p = priority?.toLowerCase() || '';
    if (p === 'high')
        return 'high';
    if (p === 'low')
        return 'low';
    return 'medium';
}
function TicketDetailPageNav() {
    const { t } = useI18n();
    return (<header className="td-page__header">
        <div className="td-page__header-inner">
            <div className="td-page__header-start">
                <AppBackButton to={routes.tickets} className="app-back-btn" hideLabelOnMobile />
                <AppHomeLogo withSeparator />
                <div>
                    <h1 className="td-page__title">{t('nav.tickets')}</h1>
                </div>
            </div>
            <div className="app-page-header-end">
                <AppPageSettings />
            </div>
        </div>
    </header>);
}
export function TicketDetailPage() {
    const { uuid } = useParams<{
        uuid: string;
    }>();
    const { t, locale } = useI18n();
    const { user: currentUser } = useCurrentUser();
    const { showAlert } = useAppDialog();
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [creator, setCreator] = useState<User | null>(null);
    const [creatorLoading, setCreatorLoading] = useState(false);
    const [statuses, setStatuses] = useState<StatusItem[]>([]);
    const [priorities, setPriorities] = useState<PriorityItem[]>([]);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [commentText, setCommentText] = useState('');
    const [commentSubmitting, setCommentSubmitting] = useState(false);
    const [commentError, setCommentError] = useState<string | null>(null);
    const [attachmentLoading, setAttachmentLoading] = useState(false);
    const [attachPreview, setAttachPreview] = useState<{
        fileName: string;
        loading: boolean;
        error: string | null;
        model: AttachmentPreviewModel | null;
        previewObjectUrl: string | null;
    } | null>(null);
    const [editingTicket, setEditingTicket] = useState(false);
    const [draftTheme, setDraftTheme] = useState('');
    const [draftDescription, setDraftDescription] = useState('');
    const [draftCategory, setDraftCategory] = useState('');
    const [draftPriority, setDraftPriority] = useState('');
    const [draftAttachmentFile, setDraftAttachmentFile] = useState<File | null>(null);
    const [draftRemoveAttachment, setDraftRemoveAttachment] = useState(false);
    const [isDraggingAttachment, setIsDraggingAttachment] = useState(false);
    const [savePending, setSavePending] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);
    const statusDropdownRef = useRef<HTMLDivElement>(null);
    const editAttachmentInputRef = useRef<HTMLInputElement>(null);
    const previewObjectUrlRef = useRef<string | null>(null);
    const loadData = useCallback(async () => {
        if (!uuid)
            return;
        setLoading(true);
        setError(null);
        try {
            const [ticketData, commentsData] = await Promise.all([getTicket(uuid), getComments(uuid)]);
            setTicket(ticketData);
            setComments(commentsData);
        }
        catch (err) {
            setError(ticketErrorMessage(err, 'ticketDetailPage.errLoad', 'ticketDetailPage.errNoAccess', t));
        }
        finally {
            setLoading(false);
        }
    }, [uuid, t]);
    useEffect(() => {
        setEditingTicket(false);
        setSaveError(null);
        setStatusError(null);
    }, [uuid]);
    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => {
        if (!currentUser)
            return;
        connectTicketsWsWhenReady().catch(() => { });
    }, [currentUser]);
    useEffect(() => {
        if (!uuid)
            return;
        const off = subscribeTicketsWsPush((msg) => {
            const ticketU = typeof msg.ticket_uuid === 'string' ? msg.ticket_uuid : '';
            if (ticketU !== uuid)
                return;
            const ev = typeof msg.event === 'string' ? msg.event : '';
            if (ev === 'ticket_created' || ev === 'ticket_updated' || ev === 'ticket_archived') {
                getTicket(uuid).then(setTicket).catch(() => { });
            }
            if (ev.startsWith('comment_')) {
                getComments(uuid).then(setComments).catch(() => { });
            }
        });
        return off;
    }, [uuid]);
    useEffect(() => {
        getStatuses().then(setStatuses).catch(() => setStatuses([]));
        getPriorities().then(setPriorities).catch(() => setPriorities([]));
    }, []);
    useEffect(() => {
        if (!statusDropdownOpen)
            return;
        const handleClickOutside = (e: MouseEvent) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node))
                setStatusDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [statusDropdownOpen]);
    const handleStatusChange = useCallback(async (newStatus: string) => {
        if (!uuid || !ticket || statusUpdating)
            return;
        setStatusUpdating(true);
        setStatusDropdownOpen(false);
        setStatusError(null);
        try {
            const updated = await updateTicket(uuid, { status: newStatus });
            setTicket(updated);
        }
        catch (err) {
            setStatusError(ticketErrorMessage(err, 'ticketDetailPage.errStatus', 'ticketDetailPage.errStatusForbidden', t));
        }
        finally {
            setStatusUpdating(false);
        }
    }, [uuid, ticket, statusUpdating, t]);
    const openTicketEditor = useCallback(() => {
        if (!ticket)
            return;
        setDraftTheme(ticket.theme);
        setDraftDescription(ticket.description ?? '');
        setDraftCategory(ticket.category);
        setDraftPriority(ticket.priority);
        setDraftAttachmentFile(null);
        setDraftRemoveAttachment(false);
        setIsDraggingAttachment(false);
        setSaveError(null);
        setEditingTicket(true);
    }, [ticket]);
    const cancelTicketEditor = useCallback(() => {
        setEditingTicket(false);
        setDraftAttachmentFile(null);
        setDraftRemoveAttachment(false);
        setIsDraggingAttachment(false);
        setSaveError(null);
    }, []);
    const handleDraftAttachmentPick = useCallback((file: File | null) => {
        setDraftAttachmentFile(file);
        if (file) {
            setDraftRemoveAttachment(false);
        }
    }, []);
    const handleRemoveCurrentAttachment = useCallback(() => {
        setDraftAttachmentFile(null);
        setDraftRemoveAttachment(true);
        if (editAttachmentInputRef.current)
            editAttachmentInputRef.current.value = '';
    }, []);
    const handleSaveTicketEdit = useCallback(async () => {
        if (!uuid || !ticket || savePending)
            return;
        const theme = draftTheme.trim();
        if (!theme) {
            setSaveError(t('ticketDetailPage.errThemeRequired'));
            return;
        }
        const payload: UpdateTicketData = {};
        if (theme !== ticket.theme)
            payload.theme = theme;
        if (draftDescription !== (ticket.description ?? ''))
            payload.description = draftDescription;
        if (draftCategory !== ticket.category)
            payload.category = draftCategory;
        if (draftPriority !== ticket.priority)
            payload.priority = draftPriority;
        if (draftAttachmentFile)
            payload.attachment = draftAttachmentFile;
        else if (draftRemoveAttachment && ticket.attachment_path)
            payload.attachment_path = null;
        const hasChanges = Object.keys(payload).length > 0;
        if (!hasChanges) {
            setEditingTicket(false);
            return;
        }
        setSavePending(true);
        setSaveError(null);
        try {
            const updated = await updateTicket(uuid, payload);
            setTicket(updated);
            setDraftAttachmentFile(null);
            setDraftRemoveAttachment(false);
            setEditingTicket(false);
        }
        catch (err) {
            setSaveError(ticketErrorMessage(err, 'ticketDetailPage.errSave', 'ticketDetailPage.errSaveForbidden', t));
        }
        finally {
            setSavePending(false);
        }
    }, [uuid, ticket, savePending, draftTheme, draftDescription, draftCategory, draftPriority, draftAttachmentFile, draftRemoveAttachment, t]);
    const isTicketAuthor = currentUser != null &&
        ticket != null &&
        Number(ticket.created_by_user_id) === Number(currentUser.id);
    const canManageTicket = hasFullTicketAccessRole(currentUser?.role) || isTicketAuthor;
    const canChangeStatus = canManageTicket;
    const categorySelectOptions = useMemo((): string[] => {
        const base: string[] = [...TICKET_CATEGORIES];
        const c = ticket?.category?.trim();
        if (c && !base.includes(c))
            base.unshift(c);
        return base;
    }, [ticket?.category]);
    const prioritySelectOptions = useMemo(() => {
        const p = ticket?.priority;
        if (priorities.length === 0 && p)
            return [{ value: p, label: p }];
        const list = [...priorities];
        if (p && !list.some((x) => x.value === p))
            list.unshift({ value: p, label: p });
        return list;
    }, [priorities, ticket?.priority]);
    useEffect(() => {
        if (!canManageTicket || !ticket?.created_by_user_id) {
            setCreator(null);
            setCreatorLoading(false);
            return;
        }
        let cancelled = false;
        setCreatorLoading(true);
        setCreator(null);
        getUser(ticket.created_by_user_id)
            .then((u) => { if (!cancelled)
            setCreator(u); })
            .catch(() => { if (!cancelled)
            setCreator(null); })
            .finally(() => { if (!cancelled)
            setCreatorLoading(false); });
        return () => { cancelled = true; };
    }, [canManageTicket, ticket?.created_by_user_id]);
    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uuid || !commentText.trim() || commentSubmitting)
            return;
        setCommentSubmitting(true);
        setCommentError(null);
        const text = commentText.trim();
        try {
            let newComment: Comment;
            try {
                newComment = await addCommentWs(uuid, text);
            }
            catch {
                newComment = await addComment(uuid, text);
            }
            setComments((prev) => (prev.some((x) => x.id === newComment.id) ? prev : [...prev, newComment]));
            setCommentText('');
        }
        catch (err) {
            setCommentError(err instanceof Error ? err.message : t('ticketDetailPage.errComment'));
        }
        finally {
            setCommentSubmitting(false);
        }
    };
    useEffect(() => {
        return () => {
            if (previewObjectUrlRef.current) {
                URL.revokeObjectURL(previewObjectUrlRef.current);
                previewObjectUrlRef.current = null;
            }
        };
    }, []);
    const fetchAttachmentBlob = useCallback(async (attachmentPath: string) => {
        const url = getAttachmentUrl(attachmentPath);
        const res = await apiFetch(url);
        if (!res.ok)
            throw new Error(t('ticketDetailPage.errFileLoad'));
        return {
            blob: await res.blob(),
            contentType: res.headers.get('Content-Type'),
        };
    }, [t]);
    const downloadAttachment = useCallback(async (attachmentPath: string) => {
        setAttachmentLoading(true);
        try {
            const { blob } = await fetchAttachmentBlob(attachmentPath);
            const fileName = ticketAttachmentFileName(attachmentPath);
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        }
        catch (err) {
            await showAlert({ message: err instanceof Error ? err.message : t('ticketDetailPage.errFileOpen') });
        }
        finally {
            setAttachmentLoading(false);
        }
    }, [fetchAttachmentBlob, showAlert, t]);
    const closeAttachmentPreview = useCallback(() => {
        if (previewObjectUrlRef.current) {
            URL.revokeObjectURL(previewObjectUrlRef.current);
            previewObjectUrlRef.current = null;
        }
        setAttachPreview(null);
    }, []);
    const previewAttachment = useCallback(async (attachmentPath: string) => {
        const fileName = ticketAttachmentFileName(attachmentPath);
        if (previewObjectUrlRef.current) {
            URL.revokeObjectURL(previewObjectUrlRef.current);
            previewObjectUrlRef.current = null;
        }
        setAttachPreview({
            fileName,
            loading: true,
            error: null,
            model: null,
            previewObjectUrl: null,
        });
        try {
            const { blob, contentType } = await fetchAttachmentBlob(attachmentPath);
            const { buildAttachmentPreview } = await import('@entities/expenses/lib/buildAttachmentPreview');
            const { model, objectUrl } = await buildAttachmentPreview(blob, fileName, contentType);
            previewObjectUrlRef.current = objectUrl;
            setAttachPreview({
                fileName,
                loading: false,
                error: null,
                model,
                previewObjectUrl: objectUrl,
            });
        }
        catch (err) {
            setAttachPreview({
                fileName,
                loading: false,
                error: err instanceof Error ? err.message : t('ticketDetailPage.errFileOpen'),
                model: null,
                previewObjectUrl: null,
            });
        }
    }, [fetchAttachmentBlob, t]);
    const openAttachmentPreviewExternal = useCallback(() => {
        if (previewObjectUrlRef.current)
            window.open(previewObjectUrlRef.current, '_blank', 'noopener');
    }, []);
    if (!uuid) {
        return (<div className="td-page">
        <main className="td-page__main">
            <TicketDetailPageNav />
            <div className="td-page__content">
                <p className="td__error-banner">{t('ticketDetailPage.errNoUuid')}</p>
            </div>
        </main>
      </div>);
    }
    if (loading) {
        return (<div className="td-page">
        <main className="td-page__main">
            <TicketDetailPageNav />
            <div className="td-page__content">
            <div className="td__skel-header">
              <div className="td__skel td__skel--title"/>
            </div>
            <div className="td__layout">
              <div className="td__primary">
                <div className="td__panel">
                  <div className="td__skel td__skel--label"/>
                  <div className="td__skel td__skel--text-full"/>
                  <div className="td__skel td__skel--text-full"/>
                  <div className="td__skel td__skel--text-mid"/>
                </div>
                <div className="td__panel">
                  <div className="td__skel td__skel--label"/>
                  <div className="td__skel td__skel--text-full"/>
                  <div className="td__skel td__skel--text-mid"/>
                </div>
              </div>
              <div className="td__secondary">
                <div className="td__panel">
                  <div className="td__skel td__skel--label"/>
                  <div className="td__skel td__skel--badge"/>
                  <div className="td__skel td__skel--text-mid"/>
                  <div className="td__skel td__skel--text-mid"/>
                  <div className="td__skel td__skel--text-mid"/>
                </div>
              </div>
            </div>
            </div>
        </main>
      </div>);
    }
    if (error || !ticket) {
        return (<div className="td-page">
        <main className="td-page__main">
            <TicketDetailPageNav />
            <div className="td-page__content">
                <div className="td__error-banner">{error || t('ticketDetailPage.notFound')}</div>
            </div>
        </main>
      </div>);
    }
    const statusColor = getStatusColor(ticket.status);
    const priorityColor = getPriorityColor(ticket.priority);
    const attachmentName = ticket.attachment_path ? ticketAttachmentFileName(ticket.attachment_path) : null;
    const showAttachmentPanel = Boolean(ticket.attachment_path) || (editingTicket && canManageTicket);
    const showCurrentAttachmentInEdit = editingTicket && canManageTicket && Boolean(ticket.attachment_path) && !draftRemoveAttachment && !draftAttachmentFile;
    const showAttachmentDropzone = editingTicket && canManageTicket && !draftAttachmentFile;
    return (<div className="td-page">
      <TicketAttachmentPreviewModal
        isOpen={attachPreview != null}
        fileName={attachPreview?.fileName ?? ''}
        loading={attachPreview?.loading ?? false}
        error={attachPreview?.error ?? null}
        model={attachPreview?.model ?? null}
        canOpenExternal={Boolean(attachPreview?.previewObjectUrl)}
        onClose={closeAttachmentPreview}
        onOpenExternal={openAttachmentPreviewExternal}
      />
      <main className="td-page__main">
        <TicketDetailPageNav />

        <div className="td-page__content">
          <header className="td__header">
            {editingTicket && canManageTicket ? (<input type="text" className="td__title-input" value={draftTheme} onChange={(e) => setDraftTheme(e.target.value)} aria-label={t('ticketDetailPage.themeAria')} disabled={savePending}/>) : (<h1 className="td__title">{ticket.theme}</h1>)}
            <div className="td__header-chips">
              {editingTicket && canManageTicket ? (<>
                  <span className={`td__chip td__chip--priority-${getPriorityColor(draftPriority)}`}>
                    <IconFlag />
                    {formatPriorityLabel(draftPriority, priorities.find((p) => p.value === draftPriority)?.label, t)}
                  </span>
                  <span className="td__chip td__chip--category">
                    <IconFolder />
                    {translateTicketCategory(draftCategory, t)}
                  </span>
                </>) : (<>
                  <span className={`td__chip td__chip--priority-${priorityColor}`}>
                    <IconFlag />
                    {formatPriorityLabel(ticket.priority, priorities.find((p) => p.value === ticket.priority)?.label, t)}
                  </span>
                  <span className="td__chip td__chip--category">
                    <IconFolder />
                    {translateTicketCategory(ticket.category, t)}
                  </span>
                </>)}
              <span className="td__chip td__chip--date">
                <IconCalendar />
                {formatDateInfoLocalized(ticket.created_at, locale)}
              </span>
            </div>
          </header>

          <div className="td__layout">
            <div className="td__primary">
              <section className="td__panel td__panel--desc">
                <div className="td__panel-head td__panel-head--row">
                  <h2 className="td__panel-title">{t('ticketDetailPage.description')}</h2>
                  {canManageTicket && !editingTicket && (<button type="button" className="td__edit-btn" onClick={openTicketEditor}>
                      {t('ticketDetailPage.edit')}
                    </button>)}
                </div>
                <div className="td__desc-body">
                  {editingTicket && canManageTicket ? (<>
                      <textarea className="td__desc-textarea" value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} rows={10} disabled={savePending} placeholder={t('ticketDetailPage.descriptionPlaceholder')}/>
                      {saveError && <p className="td__edit-error" role="alert">{saveError}</p>}
                      <div className="td__edit-actions">
                        <button type="button" className="td__edit-actions-save" onClick={() => void handleSaveTicketEdit()} disabled={savePending}>
                          {savePending ? t('ticketDetailPage.saving') : t('ticketDetailPage.save')}
                        </button>
                        <button type="button" className="td__edit-actions-cancel" onClick={cancelTicketEditor} disabled={savePending}>
                          {t('common.cancel')}
                        </button>
                      </div>
                    </>) : ticket.description ? (<p className="td__desc-text">{ticket.description}</p>) : (<p className="td__desc-empty">{t('ticketDetailPage.descriptionEmpty')}</p>)}
                </div>
              </section>

              {showAttachmentPanel && (<section className="td__panel td__panel--attachment">
                  {editingTicket && canManageTicket ? (<div className="td__attachment-edit">
                      <div className="td__panel-head td__panel-head--row">
                        <h2 className="td__panel-title">{t('ticketDetailPage.attachment')}</h2>
                        <span className="td__attachment-edit-hint">{t('ticketsPage.create.attachmentHint')}</span>
                      </div>
                      {showCurrentAttachmentInEdit && (<div className="td__attachment-row td__attachment-row--edit-current">
                          <div className="td__attachment-info">
                            <span className="td__attachment-icon"><IconPaperclip /></span>
                            <div className="td__attachment-edit-meta">
                              <span className="td__attachment-edit-label">{t('ticketDetailPage.attachmentCurrent')}</span>
                              <span className="td__attachment-name">{attachmentName}</span>
                            </div>
                          </div>
                          <div className="td__attachment-actions">
                            <button type="button" className="td__attachment-btn td__attachment-btn--ghost" onClick={() => void previewAttachment(ticket.attachment_path!)} disabled={savePending || attachmentLoading}>
                              <IconEye />
                              <span>{t('ticketDetailPage.preview')}</span>
                            </button>
                            <button type="button" className="td__attachment-btn td__attachment-btn--danger" onClick={handleRemoveCurrentAttachment} disabled={savePending}>
                              <span>{t('ticketDetailPage.removeAttachment')}</span>
                            </button>
                          </div>
                        </div>)}
                      {draftAttachmentFile && (<div className="td__attachment-row td__attachment-row--edit-current">
                          <div className="td__attachment-info">
                            <span className="td__attachment-icon"><IconPaperclip /></span>
                            <div className="td__attachment-edit-meta">
                              <span className="td__attachment-edit-label">{t('ticketDetailPage.attachmentNew')}</span>
                              <span className="td__attachment-name">{draftAttachmentFile.name}</span>
                            </div>
                          </div>
                          <div className="td__attachment-actions">
                            <button type="button" className="td__attachment-btn td__attachment-btn--danger" onClick={() => handleDraftAttachmentPick(null)} disabled={savePending}>
                              <span>{t('ticketDetailPage.removeAttachment')}</span>
                            </button>
                          </div>
                        </div>)}
                      {showAttachmentDropzone && (<div className={`td__dropzone${isDraggingAttachment ? ' td__dropzone--drag' : ''}${draftAttachmentFile ? ' td__dropzone--file' : ''}`} onDragOver={(e) => { e.preventDefault(); setIsDraggingAttachment(true); }} onDragLeave={() => setIsDraggingAttachment(false)} onDrop={(e) => {
                e.preventDefault();
                setIsDraggingAttachment(false);
                const f = e.dataTransfer.files?.[0];
                if (f)
                    handleDraftAttachmentPick(f);
            }} onClick={() => editAttachmentInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && editAttachmentInputRef.current?.click()}>
                          <input ref={editAttachmentInputRef} type="file" className="td__dropzone-input" onChange={(e) => handleDraftAttachmentPick(e.target.files?.[0] ?? null)} accept="*/*" tabIndex={-1} disabled={savePending}/>
                          <div className="td__dropzone-empty">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            <span>{t('ticketsPage.create.dropzonePrefix')} <u>{t('ticketsPage.create.dropzoneLink')}</u></span>
                          </div>
                        </div>)}
                    </div>) : ticket.attachment_path ? (<div className="td__attachment-row">
                      <div className="td__attachment-info">
                        <span className="td__attachment-icon"><IconPaperclip /></span>
                        <span className="td__attachment-name">{attachmentName ?? t('ticketDetailPage.attachment')}</span>
                      </div>
                      <div className="td__attachment-actions">
                        <button type="button" className="td__attachment-btn td__attachment-btn--ghost" onClick={() => void previewAttachment(ticket.attachment_path!)} disabled={attachmentLoading}>
                          <IconEye />
                          <span>{t('ticketDetailPage.preview')}</span>
                        </button>
                        <button type="button" className="td__attachment-btn" onClick={() => void downloadAttachment(ticket.attachment_path!)} disabled={attachmentLoading}>
                          <IconDownload />
                          <span>{attachmentLoading ? t('ticketDetailPage.loading') : t('ticketDetailPage.download')}</span>
                        </button>
                      </div>
                    </div>) : null}
                </section>)}

              <section className="td__panel td__panel--comments">
                <div className="td__panel-head">
                  <h2 className="td__panel-title">
                    <span className="td__panel-title-icon"><IconComment /></span>
                    {t('ticketDetailPage.comments')}
                    <span className="td__comment-count">{comments.length}</span>
                  </h2>
                </div>

                {comments.length === 0 ? (<div className="td__comments-empty">
                    <span className="td__comments-empty-icon" aria-hidden>
                      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M38 30a3 3 0 0 1-3 3H13l-6 6V13a3 3 0 0 1 3-3h25a3 3 0 0 1 3 3z"/>
                        <line x1="17" y1="18" x2="31" y2="18" opacity=".4"/>
                        <line x1="17" y1="23" x2="27" y2="23" opacity=".4"/>
                      </svg>
                    </span>
                    <p className="td__comments-empty-text">{t('ticketDetailPage.commentsEmpty')}</p>
                  </div>) : (<ul className="td__comments-list">
                    {comments.map((c) => (<li key={c.id} className="td__comment">
                        <div className="td__comment-avatar">
                          <IconUser />
                        </div>
                        <div className="td__comment-body">
                          <div className="td__comment-head">
                            <span className="td__comment-author">{formatUserRef(c.user_id, t)}</span>
                            <span className="td__comment-time">{formatDateInfoLocalized(c.created_at, locale)}</span>
                          </div>
                          <p className="td__comment-text">{c.content}</p>
                        </div>
                      </li>))}
                  </ul>)}

                <form className="td__comment-form" onSubmit={handleSubmitComment}>
                  <div className="td__comment-input-wrap">
                    <textarea className="td__comment-input" placeholder={t('ticketDetailPage.commentPlaceholder')} value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={3} disabled={commentSubmitting}/>
                  </div>
                  {commentError && <p className="td__comment-error">{commentError}</p>}
                  <button type="submit" className="td__comment-submit" disabled={commentSubmitting || !commentText.trim()}>
                    <IconSend />
                    <span>{commentSubmitting ? t('ticketDetailPage.commentSubmitting') : t('ticketDetailPage.commentSubmit')}</span>
                  </button>
                </form>
              </section>
            </div>

            <aside className="td__secondary">
              <section className="td__info-panel">
                <h2 className="td__info-heading">{t('ticketDetailPage.info')}</h2>

                <div className="td__info-block" ref={canChangeStatus ? statusDropdownRef : undefined}>
                  <span className="td__info-label">{t('ticketDetailPage.labelStatus')}</span>
                  {canChangeStatus && statuses.length > 0 ? (<div className="td__status-select">
                      <button type="button" className={`td__status-trigger ${statusDropdownOpen ? 'td__status-trigger--open' : ''}`} onClick={() => setStatusDropdownOpen((v) => !v)} disabled={statusUpdating} aria-haspopup="listbox" aria-expanded={statusDropdownOpen}>
                        <span className={`td__status-dot td__status-dot--${statusColor}`}/>
                        <span>{statuses.find((s) => s.value === ticket.status)?.label ?? ticket.status}</span>
                        <span className="td__status-arrow">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                        </span>
                      </button>
                      <div className={`td__status-dropdown ${statusDropdownOpen ? 'td__status-dropdown--open' : ''}`} role="listbox">
                        {statuses.map((s) => (<button key={s.value} type="button" role="option" aria-selected={ticket.status === s.value} className={`td__status-option ${ticket.status === s.value ? 'td__status-option--active' : ''}`} onClick={() => handleStatusChange(s.value)}>
                            <span className={`td__status-dot td__status-dot--${getStatusColor(s.value)}`}/>
                            {s.label}
                          </button>))}
                      </div>
                    </div>) : (<span className={`td__info-badge td__info-badge--${statusColor}`}>
                      {statuses.find((s) => s.value === ticket.status)?.label ?? ticket.status}
                    </span>)}
                  {statusError && <p className="td__edit-error td__edit-error--inline" role="alert">{statusError}</p>}
                </div>

                <div className="td__info-block">
                  <span className="td__info-label"><IconFlag /> {t('ticketDetailPage.labelPriority')}</span>
                  {editingTicket && canManageTicket ? (<select className="td__info-select" value={draftPriority} onChange={(e) => setDraftPriority(e.target.value)} disabled={savePending} aria-label={t('ticketDetailPage.priorityAria')}>
                      {prioritySelectOptions.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                    </select>) : (<span className={`td__info-badge td__info-badge--priority-${priorityColor}`}>
                      {formatPriorityLabel(ticket.priority, priorities.find((p) => p.value === ticket.priority)?.label, t)}
                    </span>)}
                </div>

                <div className="td__info-block">
                  <span className="td__info-label"><IconTag /> {t('ticketDetailPage.labelCategory')}</span>
                  {editingTicket && canManageTicket ? (<select className="td__info-select" value={draftCategory} onChange={(e) => setDraftCategory(e.target.value)} disabled={savePending} aria-label={t('ticketDetailPage.categoryAria')}>
                      {categorySelectOptions.map((c) => (<option key={c} value={c}>{translateTicketCategory(c, t)}</option>))}
                    </select>) : (<span className="td__info-value">{translateTicketCategory(ticket.category, t)}</span>)}
                </div>

                {canManageTicket && (<div className="td__info-block td__info-block--creator">
                    <span className="td__info-label"><IconUser /> {t('ticketDetailPage.labelAuthor')}</span>
                    {creatorLoading ? (<span className="td__info-value td__info-value--loading">{t('ticketDetailPage.loading')}</span>) : creator ? (<div className="td__creator">
                        <div className="td__creator-avatar"><IconUser /></div>
                        <div className="td__creator-details">
                          <span className="td__creator-name">{creator.display_name || t('ticketsPage.noName')}</span>
                          {creator.email && (<a href={`mailto:${creator.email}`} className="td__creator-email">
                              <IconEnvelope /> {creator.email}
                            </a>)}
                        </div>
                      </div>) : (<div className="td__creator">
                        <span className="td__info-value">{formatUserRef(ticket.created_by_user_id, t)}</span>
                      </div>)}
                  </div>)}

                <div className="td__info-block">
                  <span className="td__info-label"><IconCalendar /> {t('ticketDetailPage.labelCreated')}</span>
                  <span className="td__info-value">{formatDateInfoLocalized(ticket.created_at, locale)}</span>
                </div>

                {showAttachmentPanel && (editingTicket && canManageTicket ? (<div className="td__info-block">
                    <span className="td__info-label"><IconPaperclip /> {t('ticketDetailPage.attachment')}</span>
                    <span className="td__info-value">
                      {draftAttachmentFile
            ? draftAttachmentFile.name
            : showCurrentAttachmentInEdit
                ? attachmentName
                : draftRemoveAttachment
                    ? '—'
                    : attachmentName ?? '—'}
                    </span>
                  </div>) : ticket.attachment_path ? (<div className="td__info-block">
                    <span className="td__info-label"><IconPaperclip /> {t('ticketDetailPage.attachment')}</span>
                    <div className="td__info-attachment-actions">
                      <button type="button" className="td__info-file-btn" onClick={() => void previewAttachment(ticket.attachment_path!)} disabled={attachmentLoading}>
                        <IconEye />
                        <span>{t('ticketDetailPage.preview')}</span>
                      </button>
                      <button type="button" className="td__info-file-btn td__info-file-btn--secondary" onClick={() => void downloadAttachment(ticket.attachment_path!)} disabled={attachmentLoading}>
                        <IconDownload />
                        <span>{attachmentLoading ? t('ticketDetailPage.loading') : t('ticketDetailPage.download')}</span>
                      </button>
                    </div>
                  </div>) : null)}
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>);
}
