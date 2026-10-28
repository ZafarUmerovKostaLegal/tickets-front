import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useParams } from 'react-router-dom';
import { AppBackButton, AppHomeLogo, AppPageSettings, useAppDialog } from '@shared/ui';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { apiFetch } from '@shared/api';
import { getTicket, getComments, addComment, addCommentWs, subscribeTicketsWsPush, connectTicketsWsWhenReady, getStatuses, getPriorities, updateTicket, getAttachmentUrl, submitTicketForApproval, approveTicket, rejectTicket, isTicketOnApprovalStatus, TICKET_STATUS_ON_APPROVAL, } from '@entities/ticket';
import { ticketAttachmentFileName } from '@entities/ticket/lib/attachmentFileName';
import { TicketAttachmentPreviewModal } from './TicketAttachmentPreviewModal';
import { TicketSubmitApprovalModal } from './TicketSubmitApprovalModal';
import { getUser } from '@entities/user';
import { useI18n, formatDateInfoLocalized, formatPriorityLabel, formatUserRef, ticketErrorMessage, translateTicketCategory, } from '@shared/i18n';
import { hasFullTicketAccessRole } from '@shared/lib/orgRoles';
import { createCoalescedRequest } from '@shared/lib/coalescedRequest';
import { TICKET_CATEGORIES } from '@entities/ticket/lib/constants';
import './TicketDetailPage.css';
const IconUser = memo(function IconUser() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "12", cy: "8", r: "4" }), _jsx("path", { d: "M20 21a8 8 0 1 0-16 0" })] }));
});
const IconCalendar = memo(function IconCalendar() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }), _jsx("line", { x1: "16", y1: "2", x2: "16", y2: "6" }), _jsx("line", { x1: "8", y1: "2", x2: "8", y2: "6" }), _jsx("line", { x1: "3", y1: "10", x2: "21", y2: "10" })] }));
});
const IconPaperclip = memo(function IconPaperclip() {
    return (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" }) }));
});
const IconComment = memo(function IconComment() {
    return (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }) }));
});
const IconEnvelope = memo(function IconEnvelope() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" }), _jsx("polyline", { points: "22,6 12,13 2,6" })] }));
});
const IconSend = memo(function IconSend() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "22", y1: "2", x2: "11", y2: "13" }), _jsx("polygon", { points: "22 2 15 22 11 13 2 9 22 2" })] }));
});
const IconTag = memo(function IconTag() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" }), _jsx("line", { x1: "7", y1: "7", x2: "7.01", y2: "7" })] }));
});
const IconFlag = memo(function IconFlag() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" }), _jsx("line", { x1: "4", y1: "22", x2: "4", y2: "15" })] }));
});
const IconFolder = memo(function IconFolder() {
    return (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }) }));
});
const IconDownload = memo(function IconDownload() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "7 10 12 15 17 10" }), _jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })] }));
});
const IconEye = memo(function IconEye() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] }));
});
function getStatusColor(status) {
    const s = status?.toLowerCase() || '';
    if (s === 'closed' || s.includes('закрыт'))
        return 'closed';
    if (s === 'in_progress' || s.includes('работе'))
        return 'progress';
    if (isTicketOnApprovalStatus(status))
        return 'approval';
    if (s.includes('невозмож'))
        return 'impossible';
    return 'open';
}
function getPriorityColor(priority) {
    const p = priority?.toLowerCase() || '';
    if (p === 'high')
        return 'high';
    if (p === 'low')
        return 'low';
    return 'medium';
}
function TicketDetailPageNav() {
    const { t } = useI18n();
    return (_jsx("header", { className: "td-page__header", children: _jsxs("div", { className: "td-page__header-inner", children: [_jsxs("div", { className: "td-page__header-start", children: [_jsx(AppBackButton, { to: routes.tickets, className: "app-back-btn", hideLabelOnMobile: true }), _jsx(AppHomeLogo, { withSeparator: true }), _jsx("div", { children: _jsx("h1", { className: "td-page__title", children: t('nav.tickets') }) })] }), _jsx("div", { className: "app-page-header-end", children: _jsx(AppPageSettings, {}) })] }) }));
}
export function TicketDetailPage() {
    const { uuid } = useParams();
    const { t, locale } = useI18n();
    const { user: currentUser } = useCurrentUser();
    const { showAlert } = useAppDialog();
    const [ticket, setTicket] = useState(null);
    const [comments, setComments] = useState([]);
    const [creator, setCreator] = useState(null);
    const [creatorLoading, setCreatorLoading] = useState(false);
    const [statuses, setStatuses] = useState([]);
    const [priorities, setPriorities] = useState([]);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [commentText, setCommentText] = useState('');
    const [commentSubmitting, setCommentSubmitting] = useState(false);
    const [commentError, setCommentError] = useState(null);
    const [attachmentLoading, setAttachmentLoading] = useState(false);
    const [attachPreview, setAttachPreview] = useState(null);
    const [editingTicket, setEditingTicket] = useState(false);
    const [draftTheme, setDraftTheme] = useState('');
    const [draftDescription, setDraftDescription] = useState('');
    const [draftCategory, setDraftCategory] = useState('');
    const [draftPriority, setDraftPriority] = useState('');
    const [draftAttachmentFile, setDraftAttachmentFile] = useState(null);
    const [draftRemoveAttachment, setDraftRemoveAttachment] = useState(false);
    const [isDraggingAttachment, setIsDraggingAttachment] = useState(false);
    const [savePending, setSavePending] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [statusError, setStatusError] = useState(null);
    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [approvalSubmitting, setApprovalSubmitting] = useState(false);
    const [decisionPending, setDecisionPending] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectComment, setRejectComment] = useState('');
    const [decisionError, setDecisionError] = useState(null);
    const statusDropdownRef = useRef(null);
    const editAttachmentInputRef = useRef(null);
    const previewObjectUrlRef = useRef(null);
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
        let live = true;
        const ticketRefresh = createCoalescedRequest(async () => {
            const next = await getTicket(uuid);
            if (live)
                setTicket(next);
        }, 100);
        const commentsRefresh = createCoalescedRequest(async () => {
            const next = await getComments(uuid);
            if (live)
                setComments(next);
        }, 100);
        const off = subscribeTicketsWsPush((msg) => {
            const ticketU = typeof msg.ticket_uuid === 'string' ? msg.ticket_uuid : '';
            if (ticketU !== uuid)
                return;
            const ev = typeof msg.event === 'string' ? msg.event : '';
            if (ev === 'ticket_created' || ev === 'ticket_updated' || ev === 'ticket_archived') {
                ticketRefresh.schedule();
            }
            if (ev.startsWith('comment_')) {
                commentsRefresh.schedule();
            }
        });
        return () => {
            live = false;
            ticketRefresh.cancel();
            commentsRefresh.cancel();
            off();
        };
    }, [uuid]);
    useEffect(() => {
        getStatuses().then(setStatuses).catch(() => setStatuses([]));
        getPriorities().then(setPriorities).catch(() => setPriorities([]));
    }, []);
    useEffect(() => {
        if (!statusDropdownOpen)
            return;
        const handleClickOutside = (e) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target))
                setStatusDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [statusDropdownOpen]);
    const handleStatusChange = useCallback(async (newStatus) => {
        if (!uuid || !ticket || statusUpdating)
            return;
        if (isTicketOnApprovalStatus(newStatus) || newStatus === TICKET_STATUS_ON_APPROVAL) {
            setStatusDropdownOpen(false);
            setStatusError(null);
            setApprovalModalOpen(true);
            return;
        }
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
    const handleSubmitApproval = useCallback(async (partnerUserId) => {
        if (!uuid || approvalSubmitting)
            return;
        setApprovalSubmitting(true);
        setStatusError(null);
        try {
            const updated = await submitTicketForApproval(uuid, partnerUserId);
            setTicket(updated);
            setApprovalModalOpen(false);
        }
        catch (err) {
            setStatusError(ticketErrorMessage(err, 'ticketDetailPage.errApprovalSubmit', 'ticketDetailPage.errStatusForbidden', t));
        }
        finally {
            setApprovalSubmitting(false);
        }
    }, [uuid, approvalSubmitting, t]);
    const handleApproveTicket = useCallback(async () => {
        if (!uuid || decisionPending)
            return;
        setDecisionPending(true);
        setDecisionError(null);
        try {
            const updated = await approveTicket(uuid);
            setTicket(updated);
            setRejectOpen(false);
            setRejectComment('');
        }
        catch (err) {
            setDecisionError(ticketErrorMessage(err, 'ticketDetailPage.errApprovalDecide', 'ticketDetailPage.errStatusForbidden', t));
        }
        finally {
            setDecisionPending(false);
        }
    }, [uuid, decisionPending, t]);
    const handleRejectTicket = useCallback(async () => {
        if (!uuid || decisionPending)
            return;
        const comment = rejectComment.trim();
        if (!comment) {
            setDecisionError(t('ticketDetailPage.approvalRejectCommentRequired'));
            return;
        }
        setDecisionPending(true);
        setDecisionError(null);
        try {
            const updated = await rejectTicket(uuid, comment);
            setTicket(updated);
            setRejectOpen(false);
            setRejectComment('');
        }
        catch (err) {
            setDecisionError(ticketErrorMessage(err, 'ticketDetailPage.errApprovalDecide', 'ticketDetailPage.errStatusForbidden', t));
        }
        finally {
            setDecisionPending(false);
        }
    }, [uuid, decisionPending, rejectComment, t]);
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
    const handleDraftAttachmentPick = useCallback((file) => {
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
        const payload = {};
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
    const canDecideApproval = Boolean(ticket
        && isTicketOnApprovalStatus(ticket.status)
        && currentUser?.id != null
        && ticket.partner_user_id != null
        && Number(ticket.partner_user_id) === Number(currentUser.id));
    const categorySelectOptions = useMemo(() => {
        const base = [...TICKET_CATEGORIES];
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
            .then((u) => {
            if (!cancelled)
                setCreator(u);
        })
            .catch(() => {
            if (!cancelled)
                setCreator(null);
        })
            .finally(() => {
            if (!cancelled)
                setCreatorLoading(false);
        });
        return () => { cancelled = true; };
    }, [canManageTicket, ticket?.created_by_user_id]);
    const handleSubmitComment = async (e) => {
        e.preventDefault();
        if (!uuid || !commentText.trim() || commentSubmitting)
            return;
        setCommentSubmitting(true);
        setCommentError(null);
        const text = commentText.trim();
        try {
            let newComment;
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
    const fetchAttachmentBlob = useCallback(async (attachmentPath) => {
        const url = getAttachmentUrl(attachmentPath);
        const res = await apiFetch(url);
        if (!res.ok)
            throw new Error(t('ticketDetailPage.errFileLoad'));
        return {
            blob: await res.blob(),
            contentType: res.headers.get('Content-Type'),
        };
    }, [t]);
    const downloadAttachment = useCallback(async (attachmentPath) => {
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
    const previewAttachment = useCallback(async (attachmentPath) => {
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
        return (_jsx("div", { className: "td-page", children: _jsxs("main", { className: "td-page__main", children: [_jsx(TicketDetailPageNav, {}), _jsx("div", { className: "td-page__content", children: _jsx("p", { className: "td__error-banner", children: t('ticketDetailPage.errNoUuid') }) })] }) }));
    }
    if (loading) {
        return (_jsx("div", { className: "td-page", children: _jsxs("main", { className: "td-page__main", children: [_jsx(TicketDetailPageNav, {}), _jsxs("div", { className: "td-page__content", children: [_jsx("div", { className: "td__skel-header", children: _jsx("div", { className: "td__skel td__skel--title" }) }), _jsxs("div", { className: "td__layout", children: [_jsxs("div", { className: "td__primary", children: [_jsxs("div", { className: "td__panel", children: [_jsx("div", { className: "td__skel td__skel--label" }), _jsx("div", { className: "td__skel td__skel--text-full" }), _jsx("div", { className: "td__skel td__skel--text-full" }), _jsx("div", { className: "td__skel td__skel--text-mid" })] }), _jsxs("div", { className: "td__panel", children: [_jsx("div", { className: "td__skel td__skel--label" }), _jsx("div", { className: "td__skel td__skel--text-full" }), _jsx("div", { className: "td__skel td__skel--text-mid" })] })] }), _jsx("div", { className: "td__secondary", children: _jsxs("div", { className: "td__panel", children: [_jsx("div", { className: "td__skel td__skel--label" }), _jsx("div", { className: "td__skel td__skel--badge" }), _jsx("div", { className: "td__skel td__skel--text-mid" }), _jsx("div", { className: "td__skel td__skel--text-mid" }), _jsx("div", { className: "td__skel td__skel--text-mid" })] }) })] })] })] }) }));
    }
    if (error || !ticket) {
        return (_jsx("div", { className: "td-page", children: _jsxs("main", { className: "td-page__main", children: [_jsx(TicketDetailPageNav, {}), _jsx("div", { className: "td-page__content", children: _jsx("div", { className: "td__error-banner", children: error || t('ticketDetailPage.notFound') }) })] }) }));
    }
    const statusColor = getStatusColor(ticket.status);
    const priorityColor = getPriorityColor(ticket.priority);
    const attachmentName = ticket.attachment_path ? ticketAttachmentFileName(ticket.attachment_path) : null;
    const showAttachmentPanel = Boolean(ticket.attachment_path) || (editingTicket && canManageTicket);
    const showCurrentAttachmentInEdit = editingTicket && canManageTicket && Boolean(ticket.attachment_path) && !draftRemoveAttachment && !draftAttachmentFile;
    const showAttachmentDropzone = editingTicket && canManageTicket && !draftAttachmentFile;
    return (_jsxs("div", { className: "td-page", children: [_jsx(TicketAttachmentPreviewModal, { isOpen: attachPreview != null, fileName: attachPreview?.fileName ?? '', loading: attachPreview?.loading ?? false, error: attachPreview?.error ?? null, model: attachPreview?.model ?? null, canOpenExternal: Boolean(attachPreview?.previewObjectUrl), onClose: closeAttachmentPreview, onOpenExternal: openAttachmentPreviewExternal }), _jsx(TicketSubmitApprovalModal, { open: approvalModalOpen, onClose: () => {
                    if (!approvalSubmitting)
                        setApprovalModalOpen(false);
                }, onSubmit: handleSubmitApproval, submitPending: approvalSubmitting }), _jsxs("main", { className: "td-page__main", children: [_jsx(TicketDetailPageNav, {}), _jsxs("div", { className: "td-page__content", children: [_jsxs("header", { className: "td__header", children: [editingTicket && canManageTicket ? (_jsx("input", { type: "text", className: "td__title-input", value: draftTheme, onChange: (e) => setDraftTheme(e.target.value), "aria-label": t('ticketDetailPage.themeAria'), disabled: savePending })) : (_jsx("h1", { className: "td__title", children: ticket.theme })), _jsxs("div", { className: "td__header-chips", children: [editingTicket && canManageTicket ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: `td__chip td__chip--priority-${getPriorityColor(draftPriority)}`, children: [_jsx(IconFlag, {}), formatPriorityLabel(draftPriority, priorities.find((p) => p.value === draftPriority)?.label, t)] }), _jsxs("span", { className: "td__chip td__chip--category", children: [_jsx(IconFolder, {}), translateTicketCategory(draftCategory, t)] })] })) : (_jsxs(_Fragment, { children: [_jsxs("span", { className: `td__chip td__chip--priority-${priorityColor}`, children: [_jsx(IconFlag, {}), formatPriorityLabel(ticket.priority, priorities.find((p) => p.value === ticket.priority)?.label, t)] }), _jsxs("span", { className: "td__chip td__chip--category", children: [_jsx(IconFolder, {}), translateTicketCategory(ticket.category, t)] })] })), _jsxs("span", { className: "td__chip td__chip--date", children: [_jsx(IconCalendar, {}), formatDateInfoLocalized(ticket.created_at, locale)] })] })] }), _jsxs("div", { className: "td__layout", children: [_jsxs("div", { className: "td__primary", children: [_jsxs("section", { className: "td__panel td__panel--desc", children: [_jsxs("div", { className: "td__panel-head td__panel-head--row", children: [_jsx("h2", { className: "td__panel-title", children: t('ticketDetailPage.description') }), canManageTicket && !editingTicket && (_jsx("button", { type: "button", className: "td__edit-btn", onClick: openTicketEditor, children: t('ticketDetailPage.edit') }))] }), _jsx("div", { className: "td__desc-body", children: editingTicket && canManageTicket ? (_jsxs(_Fragment, { children: [_jsx("textarea", { className: "td__desc-textarea", value: draftDescription, onChange: (e) => setDraftDescription(e.target.value), rows: 10, disabled: savePending, placeholder: t('ticketDetailPage.descriptionPlaceholder') }), saveError && _jsx("p", { className: "td__edit-error", role: "alert", children: saveError }), _jsxs("div", { className: "td__edit-actions", children: [_jsx("button", { type: "button", className: "td__edit-actions-save", onClick: () => void handleSaveTicketEdit(), disabled: savePending, children: savePending ? t('ticketDetailPage.saving') : t('ticketDetailPage.save') }), _jsx("button", { type: "button", className: "td__edit-actions-cancel", onClick: cancelTicketEditor, disabled: savePending, children: t('common.cancel') })] })] })) : ticket.description ? (_jsx("p", { className: "td__desc-text", children: ticket.description })) : (_jsx("p", { className: "td__desc-empty", children: t('ticketDetailPage.descriptionEmpty') })) })] }), showAttachmentPanel && (_jsx("section", { className: "td__panel td__panel--attachment", children: editingTicket && canManageTicket ? (_jsxs("div", { className: "td__attachment-edit", children: [_jsxs("div", { className: "td__panel-head td__panel-head--row", children: [_jsx("h2", { className: "td__panel-title", children: t('ticketDetailPage.attachment') }), _jsx("span", { className: "td__attachment-edit-hint", children: t('ticketsPage.create.attachmentHint') })] }), showCurrentAttachmentInEdit && (_jsxs("div", { className: "td__attachment-row td__attachment-row--edit-current", children: [_jsxs("div", { className: "td__attachment-info", children: [_jsx("span", { className: "td__attachment-icon", children: _jsx(IconPaperclip, {}) }), _jsxs("div", { className: "td__attachment-edit-meta", children: [_jsx("span", { className: "td__attachment-edit-label", children: t('ticketDetailPage.attachmentCurrent') }), _jsx("span", { className: "td__attachment-name", children: attachmentName })] })] }), _jsxs("div", { className: "td__attachment-actions", children: [_jsxs("button", { type: "button", className: "td__attachment-btn td__attachment-btn--ghost", onClick: () => void previewAttachment(ticket.attachment_path), disabled: savePending || attachmentLoading, children: [_jsx(IconEye, {}), _jsx("span", { children: t('ticketDetailPage.preview') })] }), _jsx("button", { type: "button", className: "td__attachment-btn td__attachment-btn--danger", onClick: handleRemoveCurrentAttachment, disabled: savePending, children: _jsx("span", { children: t('ticketDetailPage.removeAttachment') }) })] })] })), draftAttachmentFile && (_jsxs("div", { className: "td__attachment-row td__attachment-row--edit-current", children: [_jsxs("div", { className: "td__attachment-info", children: [_jsx("span", { className: "td__attachment-icon", children: _jsx(IconPaperclip, {}) }), _jsxs("div", { className: "td__attachment-edit-meta", children: [_jsx("span", { className: "td__attachment-edit-label", children: t('ticketDetailPage.attachmentNew') }), _jsx("span", { className: "td__attachment-name", children: draftAttachmentFile.name })] })] }), _jsx("div", { className: "td__attachment-actions", children: _jsx("button", { type: "button", className: "td__attachment-btn td__attachment-btn--danger", onClick: () => handleDraftAttachmentPick(null), disabled: savePending, children: _jsx("span", { children: t('ticketDetailPage.removeAttachment') }) }) })] })), showAttachmentDropzone && (_jsxs("div", { className: `td__dropzone${isDraggingAttachment ? ' td__dropzone--drag' : ''}${draftAttachmentFile ? ' td__dropzone--file' : ''}`, onDragOver: (e) => { e.preventDefault(); setIsDraggingAttachment(true); }, onDragLeave: () => setIsDraggingAttachment(false), onDrop: (e) => {
                                                                e.preventDefault();
                                                                setIsDraggingAttachment(false);
                                                                const f = e.dataTransfer.files?.[0];
                                                                if (f)
                                                                    handleDraftAttachmentPick(f);
                                                            }, onClick: () => editAttachmentInputRef.current?.click(), role: "button", tabIndex: 0, onKeyDown: (e) => e.key === 'Enter' && editAttachmentInputRef.current?.click(), children: [_jsx("input", { ref: editAttachmentInputRef, type: "file", className: "td__dropzone-input", onChange: (e) => handleDraftAttachmentPick(e.target.files?.[0] ?? null), accept: "*/*", tabIndex: -1, disabled: savePending }), _jsxs("div", { className: "td__dropzone-empty", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "17 8 12 3 7 8" }), _jsx("line", { x1: "12", y1: "3", x2: "12", y2: "15" })] }), _jsxs("span", { children: [t('ticketsPage.create.dropzonePrefix'), " ", _jsx("u", { children: t('ticketsPage.create.dropzoneLink') })] })] })] }))] })) : ticket.attachment_path ? (_jsxs("div", { className: "td__attachment-row", children: [_jsxs("div", { className: "td__attachment-info", children: [_jsx("span", { className: "td__attachment-icon", children: _jsx(IconPaperclip, {}) }), _jsx("span", { className: "td__attachment-name", children: attachmentName ?? t('ticketDetailPage.attachment') })] }), _jsxs("div", { className: "td__attachment-actions", children: [_jsxs("button", { type: "button", className: "td__attachment-btn td__attachment-btn--ghost", onClick: () => void previewAttachment(ticket.attachment_path), disabled: attachmentLoading, children: [_jsx(IconEye, {}), _jsx("span", { children: t('ticketDetailPage.preview') })] }), _jsxs("button", { type: "button", className: "td__attachment-btn", onClick: () => void downloadAttachment(ticket.attachment_path), disabled: attachmentLoading, children: [_jsx(IconDownload, {}), _jsx("span", { children: attachmentLoading ? t('ticketDetailPage.loading') : t('ticketDetailPage.download') })] })] })] })) : null })), _jsxs("section", { className: "td__panel td__panel--comments", children: [_jsx("div", { className: "td__panel-head", children: _jsxs("h2", { className: "td__panel-title", children: [_jsx("span", { className: "td__panel-title-icon", children: _jsx(IconComment, {}) }), t('ticketDetailPage.comments'), _jsx("span", { className: "td__comment-count", children: comments.length })] }) }), comments.length === 0 ? (_jsxs("div", { className: "td__comments-empty", children: [_jsx("span", { className: "td__comments-empty-icon", "aria-hidden": true, children: _jsxs("svg", { viewBox: "0 0 48 48", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", children: [_jsx("path", { d: "M38 30a3 3 0 0 1-3 3H13l-6 6V13a3 3 0 0 1 3-3h25a3 3 0 0 1 3 3z" }), _jsx("line", { x1: "17", y1: "18", x2: "31", y2: "18", opacity: ".4" }), _jsx("line", { x1: "17", y1: "23", x2: "27", y2: "23", opacity: ".4" })] }) }), _jsx("p", { className: "td__comments-empty-text", children: t('ticketDetailPage.commentsEmpty') })] })) : (_jsx("ul", { className: "td__comments-list", children: comments.map((c) => (_jsxs("li", { className: "td__comment", children: [_jsx("div", { className: "td__comment-avatar", children: _jsx(IconUser, {}) }), _jsxs("div", { className: "td__comment-body", children: [_jsxs("div", { className: "td__comment-head", children: [_jsx("span", { className: "td__comment-author", children: formatUserRef(c.user_id, t) }), _jsx("span", { className: "td__comment-time", children: formatDateInfoLocalized(c.created_at, locale) })] }), _jsx("p", { className: "td__comment-text", children: c.content })] })] }, c.id))) })), _jsxs("form", { className: "td__comment-form", onSubmit: handleSubmitComment, children: [_jsx("div", { className: "td__comment-input-wrap", children: _jsx("textarea", { className: "td__comment-input", placeholder: t('ticketDetailPage.commentPlaceholder'), value: commentText, onChange: (e) => setCommentText(e.target.value), rows: 3, disabled: commentSubmitting }) }), commentError && _jsx("p", { className: "td__comment-error", children: commentError }), _jsxs("button", { type: "submit", className: "td__comment-submit", disabled: commentSubmitting || !commentText.trim(), children: [_jsx(IconSend, {}), _jsx("span", { children: commentSubmitting ? t('ticketDetailPage.commentSubmitting') : t('ticketDetailPage.commentSubmit') })] })] })] })] }), _jsx("aside", { className: "td__secondary", children: _jsxs("section", { className: "td__info-panel", children: [_jsx("h2", { className: "td__info-heading", children: t('ticketDetailPage.info') }), _jsxs("div", { className: "td__info-block", ref: canChangeStatus ? statusDropdownRef : undefined, children: [_jsx("span", { className: "td__info-label", children: t('ticketDetailPage.labelStatus') }), canChangeStatus && statuses.length > 0 ? (_jsxs("div", { className: "td__status-select", children: [_jsxs("button", { type: "button", className: `td__status-trigger ${statusDropdownOpen ? 'td__status-trigger--open' : ''}`, onClick: () => setStatusDropdownOpen((v) => !v), disabled: statusUpdating, "aria-haspopup": "listbox", "aria-expanded": statusDropdownOpen, children: [_jsx("span", { className: `td__status-dot td__status-dot--${statusColor}` }), _jsx("span", { children: statuses.find((s) => s.value === ticket.status)?.label ?? ticket.status }), _jsx("span", { className: "td__status-arrow", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M6 9l6 6 6-6" }) }) })] }), _jsx("div", { className: `td__status-dropdown ${statusDropdownOpen ? 'td__status-dropdown--open' : ''}`, role: "listbox", children: statuses.map((s) => (_jsxs("button", { type: "button", role: "option", "aria-selected": ticket.status === s.value, className: `td__status-option ${ticket.status === s.value ? 'td__status-option--active' : ''}`, onClick: () => handleStatusChange(s.value), children: [_jsx("span", { className: `td__status-dot td__status-dot--${getStatusColor(s.value)}` }), s.label] }, s.value))) })] })) : (_jsx("span", { className: `td__info-badge td__info-badge--${statusColor}`, children: statuses.find((s) => s.value === ticket.status)?.label ?? ticket.status })), statusError && _jsx("p", { className: "td__edit-error td__edit-error--inline", role: "alert", children: statusError })] }), isTicketOnApprovalStatus(ticket.status) && (_jsxs("div", { className: "td__info-block td__info-block--approval", children: [_jsx("span", { className: "td__info-label", children: t('ticketDetailPage.approvalWaitingLabel') }), _jsx("p", { className: "td__approval-hint", children: canDecideApproval
                                                                ? t('ticketDetailPage.approvalWaitingForYou')
                                                                : t('ticketDetailPage.approvalWaitingForPartner') }), canDecideApproval && (_jsxs("div", { className: "td__approval-actions", children: [_jsx("button", { type: "button", className: "td__approval-btn td__approval-btn--approve", onClick: () => void handleApproveTicket(), disabled: decisionPending, children: decisionPending ? t('ticketDetailPage.approvalDeciding') : t('ticketDetailPage.approvalApprove') }), _jsx("button", { type: "button", className: "td__approval-btn td__approval-btn--reject", onClick: () => {
                                                                        setRejectOpen((v) => !v);
                                                                        setDecisionError(null);
                                                                    }, disabled: decisionPending, children: t('ticketDetailPage.approvalReject') })] })), canDecideApproval && rejectOpen && (_jsxs("div", { className: "td__approval-reject", children: [_jsx("textarea", { className: "td__approval-reject-input", value: rejectComment, onChange: (e) => setRejectComment(e.target.value), rows: 3, disabled: decisionPending, placeholder: t('ticketDetailPage.approvalRejectPlaceholder') }), _jsx("button", { type: "button", className: "td__approval-btn td__approval-btn--reject-confirm", onClick: () => void handleRejectTicket(), disabled: decisionPending, children: t('ticketDetailPage.approvalRejectConfirm') })] })), decisionError && _jsx("p", { className: "td__edit-error td__edit-error--inline", role: "alert", children: decisionError })] })), ticket.rejection_comment?.trim() && !isTicketOnApprovalStatus(ticket.status) && (_jsxs("div", { className: "td__info-block", children: [_jsx("span", { className: "td__info-label", children: t('ticketDetailPage.approvalRejectionLabel') }), _jsx("p", { className: "td__approval-rejection", children: ticket.rejection_comment })] })), _jsxs("div", { className: "td__info-block", children: [_jsxs("span", { className: "td__info-label", children: [_jsx(IconFlag, {}), " ", t('ticketDetailPage.labelPriority')] }), editingTicket && canManageTicket ? (_jsx("select", { className: "td__info-select", value: draftPriority, onChange: (e) => setDraftPriority(e.target.value), disabled: savePending, "aria-label": t('ticketDetailPage.priorityAria'), children: prioritySelectOptions.map((p) => (_jsx("option", { value: p.value, children: p.label }, p.value))) })) : (_jsx("span", { className: `td__info-badge td__info-badge--priority-${priorityColor}`, children: formatPriorityLabel(ticket.priority, priorities.find((p) => p.value === ticket.priority)?.label, t) }))] }), _jsxs("div", { className: "td__info-block", children: [_jsxs("span", { className: "td__info-label", children: [_jsx(IconTag, {}), " ", t('ticketDetailPage.labelCategory')] }), editingTicket && canManageTicket ? (_jsx("select", { className: "td__info-select", value: draftCategory, onChange: (e) => setDraftCategory(e.target.value), disabled: savePending, "aria-label": t('ticketDetailPage.categoryAria'), children: categorySelectOptions.map((c) => (_jsx("option", { value: c, children: translateTicketCategory(c, t) }, c))) })) : (_jsx("span", { className: "td__info-value", children: translateTicketCategory(ticket.category, t) }))] }), canManageTicket && (_jsxs("div", { className: "td__info-block td__info-block--creator", children: [_jsxs("span", { className: "td__info-label", children: [_jsx(IconUser, {}), " ", t('ticketDetailPage.labelAuthor')] }), creatorLoading ? (_jsx("span", { className: "td__info-value td__info-value--loading", children: t('ticketDetailPage.loading') })) : creator ? (_jsxs("div", { className: "td__creator", children: [_jsx("div", { className: "td__creator-avatar", children: _jsx(IconUser, {}) }), _jsxs("div", { className: "td__creator-details", children: [_jsx("span", { className: "td__creator-name", children: creator.display_name || t('ticketsPage.noName') }), creator.email && (_jsxs("a", { href: `mailto:${creator.email}`, className: "td__creator-email", children: [_jsx(IconEnvelope, {}), " ", creator.email] }))] })] })) : (_jsx("div", { className: "td__creator", children: _jsx("span", { className: "td__info-value", children: formatUserRef(ticket.created_by_user_id, t) }) }))] })), _jsxs("div", { className: "td__info-block", children: [_jsxs("span", { className: "td__info-label", children: [_jsx(IconCalendar, {}), " ", t('ticketDetailPage.labelCreated')] }), _jsx("span", { className: "td__info-value", children: formatDateInfoLocalized(ticket.created_at, locale) })] }), showAttachmentPanel && (editingTicket && canManageTicket ? (_jsxs("div", { className: "td__info-block", children: [_jsxs("span", { className: "td__info-label", children: [_jsx(IconPaperclip, {}), " ", t('ticketDetailPage.attachment')] }), _jsx("span", { className: "td__info-value", children: draftAttachmentFile
                                                                ? draftAttachmentFile.name
                                                                : showCurrentAttachmentInEdit
                                                                    ? attachmentName
                                                                    : draftRemoveAttachment
                                                                        ? '—'
                                                                        : attachmentName ?? '—' })] })) : ticket.attachment_path ? (_jsxs("div", { className: "td__info-block", children: [_jsxs("span", { className: "td__info-label", children: [_jsx(IconPaperclip, {}), " ", t('ticketDetailPage.attachment')] }), _jsxs("div", { className: "td__info-attachment-actions", children: [_jsxs("button", { type: "button", className: "td__info-file-btn", onClick: () => void previewAttachment(ticket.attachment_path), disabled: attachmentLoading, children: [_jsx(IconEye, {}), _jsx("span", { children: t('ticketDetailPage.preview') })] }), _jsxs("button", { type: "button", className: "td__info-file-btn td__info-file-btn--secondary", onClick: () => void downloadAttachment(ticket.attachment_path), disabled: attachmentLoading, children: [_jsx(IconDownload, {}), _jsx("span", { children: attachmentLoading ? t('ticketDetailPage.loading') : t('ticketDetailPage.download') })] })] })] })) : null)] }) })] })] })] })] }));
}
