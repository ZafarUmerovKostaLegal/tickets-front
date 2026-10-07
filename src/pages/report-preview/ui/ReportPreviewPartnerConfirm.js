import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useAppDialog } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { formatIsoRangeTitle } from '@entities/time-tracking/lib/reportsPeriodRange';
import { PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT } from '@entities/time-tracking/model/partnerConfirmedReports';
import { listPartnerUsersWithProjectAccessToProject, listPartnerReportConfirmationsPendingItems, listPartnerReportConfirmationsConfirmed, confirmPartnerReportConfirmation, submitPartnerReportConfirmationFromPreview, parsePartnerReportConfirmationRequest, notifyPartnerConfirmedReportsListInvalidate, } from '@entities/time-tracking';
import { clearReportPreviewTransfer } from '@entities/time-tracking/model/reportPreviewTransfer';
const REPORTS_TAB_URL = `${routes.timeTracking}?tab=reports`;
function leaveReportPreview(navigate, returnTo) {
    void clearReportPreviewTransfer();
    const target = (returnTo ?? '').trim() || REPORTS_TAB_URL;
    navigate(target, { replace: true });
}
function rpPartnerConfirmPeriodMatches(req, from, to) {
    return req.dateFrom === from.slice(0, 10) && req.dateTo === to.slice(0, 10);
}
function rpPartnerConfirmSessionKey(projectId, from, to) {
    return `tt-partner-confirm:${projectId.trim()}:${from.slice(0, 10)}:${to.slice(0, 10)}`;
}
function rpLoadPartnerConfirmSession(projectId, from, to) {
    try {
        const raw = sessionStorage.getItem(rpPartnerConfirmSessionKey(projectId, from, to));
        if (!raw)
            return null;
        return parsePartnerReportConfirmationRequest(JSON.parse(raw));
    }
    catch {
        return null;
    }
}
function rpSavePartnerConfirmSession(projectId, from, to, req) {
    try {
        sessionStorage.setItem(rpPartnerConfirmSessionKey(projectId, from, to), JSON.stringify(req));
    }
    catch {
    }
}
export function ReportPreviewManagerSubmitBar({ projectId, dateFrom, dateTo }) {
    const { showAlert, showConfirm } = useAppDialog();
    const { t } = useI18n();
    const [pendingReqs, setPendingReqs] = useState([]);
    const [confirmedReqs, setConfirmedReqs] = useState([]);
    const [listsLoad, setListsLoad] = useState('idle');
    const [submitBusy, setSubmitBusy] = useState(false);
    const df = dateFrom.slice(0, 10);
    const dt = dateTo.slice(0, 10);
    const pid = projectId.trim();
    const reloadLists = useCallback(async () => {
        const [p, c] = await Promise.all([
            listPartnerReportConfirmationsPendingItems(),
            listPartnerReportConfirmationsConfirmed(),
        ]);
        setPendingReqs(p);
        setConfirmedReqs(c);
    }, []);
    useEffect(() => {
        if (!pid || !df || !dt) {
            setListsLoad('idle');
            return;
        }
        let cancelled = false;
        setListsLoad('loading');
        void reloadLists().then(() => {
            if (!cancelled)
                setListsLoad('ok');
        }).catch(() => {
            if (!cancelled) {
                setPendingReqs([]);
                setConfirmedReqs([]);
                setListsLoad('error');
            }
        });
        return () => {
            cancelled = true;
        };
    }, [pid, df, dt, reloadLists]);
    useEffect(() => {
        const onInv = () => {
            void reloadLists().catch(() => undefined);
        };
        window.addEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, onInv);
        return () => window.removeEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, onInv);
    }, [reloadLists]);
    const pendingForProject = useMemo(() => pendingReqs.find((r) => r.projectId === pid && rpPartnerConfirmPeriodMatches(r, df, dt)), [pendingReqs, pid, df, dt]);
    const confirmedForProject = useMemo(() => confirmedReqs.find((r) => r.projectId === pid && rpPartnerConfirmPeriodMatches(r, df, dt)), [confirmedReqs, pid, df, dt]);
    const fullyConfirmed = confirmedForProject?.status === 'fully_confirmed';
    const alreadySent = Boolean(pendingForProject);
    const handleSubmit = async () => {
        if (submitBusy || alreadySent || fullyConfirmed || !pid)
            return;
        const confirmed = await showConfirm({
            title: t('timeTrackingPage.reports.submitForReview.confirmTitle'),
            message: t('timeTrackingPage.reports.submitForReview.confirmMessage'),
            confirmLabel: t('timeTrackingPage.reports.submitForReview.confirmLabel'),
        });
        if (!confirmed)
            return;
        setSubmitBusy(true);
        try {
            await submitPartnerReportConfirmationFromPreview({
                projectId: pid,
                dateFrom: df,
                dateTo: dt,
            });
            notifyPartnerConfirmedReportsListInvalidate();
            await reloadLists();
            await showAlert({ message: t('timeTrackingPage.reports.submitForReview.done') });
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : t('timeTrackingPage.reports.submitForReview.failed'),
            });
        }
        finally {
            setSubmitBusy(false);
        }
    };
    if (!pid)
        return null;
    const labelLong = fullyConfirmed
        ? t('timeTrackingPage.reports.submitForReview.confirmed')
        : alreadySent
            ? t('timeTrackingPage.reports.submitForReview.sent')
            : submitBusy
                ? t('timeTrackingPage.reports.submitForReview.busy')
                : t('timeTrackingPage.reports.submitForReview.action');
    const labelShort = fullyConfirmed
        ? t('timeTrackingPage.reports.submitForReview.confirmedShort')
        : alreadySent
            ? t('timeTrackingPage.reports.submitForReview.sentShort')
            : submitBusy
                ? t('timeTrackingPage.reports.submitForReview.busy')
                : t('timeTrackingPage.reports.submitForReview.actionShort');
    return (_jsxs("button", { type: "button", className: "tt-rp-preview__manager-submit", disabled: submitBusy || listsLoad !== 'ok' || alreadySent || fullyConfirmed, onClick: () => void handleSubmit(), title: labelLong, "aria-label": labelLong, children: [_jsx("span", { className: "tt-rp-preview__manager-submit-icon", "aria-hidden": true, children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "22", y1: "2", x2: "11", y2: "13" }), _jsx("polygon", { points: "22 2 15 22 11 13 2 9 22 2" })] }) }), _jsx("span", { className: "tt-rp-preview__manager-submit-label tt-rp-preview__manager-submit-label--long", children: labelLong }), _jsx("span", { className: "tt-rp-preview__manager-submit-label tt-rp-preview__manager-submit-label--short", children: labelShort })] }));
}
export function ReportPreviewPartnerSignFooter({ projectId, dateFrom, dateTo, userId, returnTo, }) {
    const { showAlert } = useAppDialog();
    const navigate = useNavigate();
    const [pendingReqs, setPendingReqs] = useState([]);
    const [confirmedReqs, setConfirmedReqs] = useState([]);
    const [listsLoad, setListsLoad] = useState('idle');
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [sessionSnapshot, setSessionSnapshot] = useState(null);
    const df = dateFrom.slice(0, 10);
    const dt = dateTo.slice(0, 10);
    const pid = projectId.trim();
    useEffect(() => {
        setSessionSnapshot(rpLoadPartnerConfirmSession(pid, df, dt));
    }, [pid, df, dt]);
    useEffect(() => {
        let cancelled = false;
        if (userId == null || !pid || !df || !dt) {
            setListsLoad('idle');
            return;
        }
        setListsLoad('loading');
        void Promise.all([
            listPartnerReportConfirmationsPendingItems(),
            listPartnerReportConfirmationsConfirmed(),
        ]).then(([p, c]) => {
            if (!cancelled) {
                setPendingReqs(p);
                setConfirmedReqs(c);
                setListsLoad('ok');
            }
        }).catch(() => {
            if (!cancelled) {
                setPendingReqs([]);
                setConfirmedReqs([]);
                setListsLoad('error');
            }
        });
        return () => {
            cancelled = true;
        };
    }, [pid, df, dt, userId]);
    const pendingForProject = useMemo(() => pendingReqs.find((r) => r.projectId === pid && rpPartnerConfirmPeriodMatches(r, df, dt)), [pendingReqs, pid, df, dt]);
    const confirmedForProject = useMemo(() => confirmedReqs.find((r) => r.projectId === pid && rpPartnerConfirmPeriodMatches(r, df, dt)), [confirmedReqs, pid, df, dt]);
    const mySig = useMemo(() => {
        if (userId == null)
            return undefined;
        const hit = (req) => req?.signatures.find((s) => s.partnerAuthUserId === userId);
        return hit(confirmedForProject) ?? hit(pendingForProject) ?? hit(sessionSnapshot);
    }, [userId, confirmedForProject, pendingForProject, sessionSnapshot]);
    const fullyConfirmed = confirmedForProject?.status === 'fully_confirmed';
    const canPartnerSign = !fullyConfirmed && !mySig;
    const handlePartnerConfirmSubmit = async () => {
        if (confirmBusy || userId == null || !canPartnerSign || listsLoad !== 'ok')
            return;
        setConfirmBusy(true);
        try {
            let requestId = pendingForProject?.id;
            if (!requestId) {
                const created = await submitPartnerReportConfirmationFromPreview({
                    projectId: pid,
                    dateFrom: df,
                    dateTo: dt,
                });
                requestId = created.id;
            }
            if (!requestId) {
                await showAlert({ message: 'Не удалось получить запрос подтверждения.' });
                return;
            }
            const out = await confirmPartnerReportConfirmation(requestId);
            rpSavePartnerConfirmSession(pid, df, dt, out);
            setSessionSnapshot(out);
            const [p, c] = await Promise.all([
                listPartnerReportConfirmationsPendingItems(),
                listPartnerReportConfirmationsConfirmed(),
            ]);
            setPendingReqs(p);
            setConfirmedReqs(c);
            if (out.status === 'fully_confirmed')
                notifyPartnerConfirmedReportsListInvalidate();
            leaveReportPreview(navigate, returnTo);
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : 'Не удалось отправить подтверждение.',
            });
        }
        finally {
            setConfirmBusy(false);
        }
    };
    if (userId == null || !pid || !canPartnerSign)
        return null;
    return (_jsxs("div", { className: "tt-rp-preview__partner-sign-aside", role: "group", "aria-label": "\u041F\u043E\u0434\u043F\u0438\u0441\u044C \u043E\u0442\u0447\u0451\u0442\u0430", children: [_jsxs("span", { className: "tt-rp-preview__partner-sign-status", children: [_jsx("span", { className: "tt-rp-preview__partner-sign-status-ico", "aria-hidden": true, children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "10", fill: "#22c55e" }), _jsx("path", { d: "M8.5 12.5l2.2 2.2 4.8-5", stroke: "#fff", strokeWidth: "2.25", strokeLinecap: "round", strokeLinejoin: "round" })] }) }), "\u0413\u043E\u0442\u043E\u0432\u043E \u043A \u043F\u043E\u0434\u043F\u0438\u0441\u0438"] }), _jsx("button", { type: "button", className: "tt-rp-preview__partner-sign-btn", onClick: () => void handlePartnerConfirmSubmit(), disabled: confirmBusy || listsLoad !== 'ok', children: confirmBusy ? 'Отправка…' : listsLoad !== 'ok' ? 'Загрузка…' : 'Подписать отчёт' })] }));
}
export function ReportPreviewPartnerBar({ projectId, dateFrom, dateTo, userId, sharedPartners, sharedPartnersLoading, returnTo, }) {
    const { showAlert } = useAppDialog();
    const navigate = useNavigate();
    const [partnerModalOpen, setPartnerModalOpen] = useState(false);
    const partnerModalPanelRef = useRef(null);
    const [fetchedPartners, setFetchedPartners] = useState([]);
    const [fetchedPartnersLoad, setFetchedPartnersLoad] = useState('idle');
    const useSharedPartners = sharedPartners != null;
    const partners = useSharedPartners ? sharedPartners : fetchedPartners;
    const partnersLoad = useSharedPartners
        ? (sharedPartnersLoading ? 'loading' : 'ok')
        : fetchedPartnersLoad;
    const [pendingReqs, setPendingReqs] = useState([]);
    const [confirmedReqs, setConfirmedReqs] = useState([]);
    const [listsLoad, setListsLoad] = useState('idle');
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [sessionSnapshot, setSessionSnapshot] = useState(null);
    const df = dateFrom.slice(0, 10);
    const dt = dateTo.slice(0, 10);
    const pid = projectId.trim();
    useEffect(() => {
        if (useSharedPartners)
            return;
        let cancelled = false;
        setFetchedPartnersLoad('loading');
        void listPartnerUsersWithProjectAccessToProject(projectId).then((rows) => {
            if (!cancelled) {
                setFetchedPartners(rows);
                setFetchedPartnersLoad('ok');
            }
        }).catch(() => {
            if (!cancelled) {
                setFetchedPartners([]);
                setFetchedPartnersLoad('ok');
            }
        });
        return () => {
            cancelled = true;
        };
    }, [projectId, useSharedPartners]);
    useEffect(() => {
        setSessionSnapshot(rpLoadPartnerConfirmSession(pid, df, dt));
    }, [pid, df, dt]);
    useEffect(() => {
        let cancelled = false;
        if (userId == null) {
            setPendingReqs([]);
            setConfirmedReqs([]);
            setListsLoad('idle');
            return;
        }
        if (partnersLoad !== 'ok') {
            setListsLoad('idle');
            return;
        }
        if (!partners.some((p) => p.authUserId === userId)) {
            setPendingReqs([]);
            setConfirmedReqs([]);
            setListsLoad('idle');
            return;
        }
        setListsLoad('loading');
        void Promise.all([
            listPartnerReportConfirmationsPendingItems(),
            listPartnerReportConfirmationsConfirmed(),
        ]).then(([p, c]) => {
            if (!cancelled) {
                setPendingReqs(p);
                setConfirmedReqs(c);
                setListsLoad('ok');
            }
        }).catch(() => {
            if (!cancelled) {
                setPendingReqs([]);
                setConfirmedReqs([]);
                setListsLoad('error');
            }
        });
        return () => {
            cancelled = true;
        };
    }, [projectId, df, dt, userId, partnersLoad, partners]);
    const pendingForProject = useMemo(() => pendingReqs.find((r) => r.projectId === pid && rpPartnerConfirmPeriodMatches(r, df, dt)), [pendingReqs, pid, df, dt]);
    const confirmedForProject = useMemo(() => confirmedReqs.find((r) => r.projectId === pid && rpPartnerConfirmPeriodMatches(r, df, dt)), [confirmedReqs, pid, df, dt]);
    const mySig = useMemo(() => {
        if (userId == null)
            return undefined;
        const hit = (req) => req?.signatures.find((s) => s.partnerAuthUserId === userId);
        return hit(confirmedForProject) ?? hit(pendingForProject) ?? hit(sessionSnapshot);
    }, [userId, confirmedForProject, pendingForProject, sessionSnapshot]);
    const fullyConfirmed = confirmedForProject?.status === 'fully_confirmed';
    const refreshLists = async () => {
        const [p, c] = await Promise.all([
            listPartnerReportConfirmationsPendingItems(),
            listPartnerReportConfirmationsConfirmed(),
        ]);
        setPendingReqs(p);
        setConfirmedReqs(c);
    };
    const fmtConfirmed = (iso) => {
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime()))
                return iso;
            return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
        }
        catch {
            return iso;
        }
    };
    const periodLabel = formatIsoRangeTitle(df, dt);
    const showPartnerConfirmBtn = listsLoad === 'ok' && !fullyConfirmed && !mySig;
    const handlePartnerConfirmSubmit = async () => {
        if (confirmBusy || userId == null || !showPartnerConfirmBtn)
            return;
        setConfirmBusy(true);
        try {
            let requestId = pendingForProject?.id;
            if (!requestId) {
                const created = await submitPartnerReportConfirmationFromPreview({
                    projectId: pid,
                    dateFrom: df,
                    dateTo: dt,
                });
                requestId = created.id;
                await refreshLists();
            }
            if (!requestId) {
                await showAlert({ message: 'Не удалось получить запрос подтверждения.' });
                return;
            }
            const out = await confirmPartnerReportConfirmation(requestId);
            rpSavePartnerConfirmSession(pid, df, dt, out);
            setSessionSnapshot(out);
            await refreshLists();
            if (out.status === 'fully_confirmed')
                notifyPartnerConfirmedReportsListInvalidate();
            setPartnerModalOpen(false);
            leaveReportPreview(navigate, returnTo);
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : 'Не удалось отправить подтверждение.',
            });
        }
        finally {
            setConfirmBusy(false);
        }
    };
    const partnerModalTitleId = useId();
    useEffect(() => {
        if (!partnerModalOpen)
            return;
        const focusFirst = () => {
            const root = partnerModalPanelRef.current;
            const closeBtn = root?.querySelector('.tt-rp-preview__partner-modal-close');
            closeBtn?.focus();
        };
        const t = window.requestAnimationFrame(focusFirst);
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setPartnerModalOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.cancelAnimationFrame(t);
            window.removeEventListener('keydown', onKey);
        };
    }, [partnerModalOpen]);
    if (userId == null)
        return null;
    if (partnersLoad === 'idle' || partnersLoad === 'loading')
        return null;
    if (partnersLoad === 'error')
        return null;
    if (!partners.some((p) => p.authUserId === userId))
        return null;
    const triggerBadge = listsLoad !== 'ok'
        ? null
        : showPartnerConfirmBtn
            ? (_jsx("span", { className: "tt-rp-preview__partner-trigger-badge", children: "\u041D\u0443\u0436\u043D\u0430 \u043F\u043E\u0434\u043F\u0438\u0441\u044C" }))
            : fullyConfirmed && mySig
                ? (_jsx("span", { className: "tt-rp-preview__partner-trigger-badge tt-rp-preview__partner-trigger-badge--success", children: "\u0413\u043E\u0442\u043E\u0432\u043E" }))
                : fullyConfirmed && !mySig
                    ? (_jsx("span", { className: "tt-rp-preview__partner-trigger-badge tt-rp-preview__partner-trigger-badge--neutral", children: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E" }))
                    : listsLoad === 'ok' && !fullyConfirmed && !pendingForProject && mySig
                        ? (_jsx("span", { className: "tt-rp-preview__partner-trigger-badge tt-rp-preview__partner-trigger-badge--wait", children: "\u041E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432" }))
                        : null;
    const modal = partnerModalOpen
        ? createPortal(_jsx("div", { className: "tt-rp-preview__partner-modal-overlay", role: "presentation", onClick: () => setPartnerModalOpen(false), children: _jsxs("div", { ref: partnerModalPanelRef, className: "tt-rp-preview__partner-modal-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": partnerModalTitleId, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "tt-rp-preview__partner-modal-head", children: [_jsxs("div", { className: "tt-rp-preview__partner-modal-head-text", children: [_jsx("span", { className: "tt-rp-preview__partner-modal-kicker", children: "\u041F\u0430\u0440\u0442\u043D\u0451\u0440\u0441\u043A\u0438\u0439 \u0441\u0442\u0430\u0442\u0443\u0441" }), _jsx("h2", { id: partnerModalTitleId, className: "tt-rp-preview__partner-modal-title", children: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043E\u0442\u0447\u0451\u0442\u0430" })] }), _jsx("button", { type: "button", className: "tt-rp-preview__partner-modal-close", onClick: () => setPartnerModalOpen(false), "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsxs("p", { className: "tt-rp-preview__partner-modal-period", children: ["\u041F\u0435\u0440\u0438\u043E\u0434: ", _jsx("strong", { children: periodLabel })] }), _jsx("p", { className: "tt-rp-preview__partner-modal-lead", children: "\u0412\u044B \u0444\u0438\u043A\u0441\u0438\u0440\u0443\u0435\u0442\u0435 \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u0435 \u043E\u0442\u0447\u0451\u0442\u043D\u043E\u0441\u0442\u0438 \u043F\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0443 \u043A\u0430\u043A \u043F\u0430\u0440\u0442\u043D\u0451\u0440. \u041F\u043E\u0441\u043B\u0435 \u043F\u043E\u0434\u043F\u0438\u0441\u0435\u0439 \u0432\u0441\u0435\u0445 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432 \u0437\u0430\u043F\u0438\u0441\u044C \u043F\u043E\u043F\u0430\u0434\u0430\u0435\u0442 \u0432 \u0441\u043F\u0438\u0441\u043E\u043A \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0445 \u043E\u0442\u0447\u0451\u0442\u043E\u0432." }), partners.length > 0 ? (_jsxs("div", { className: "tt-rp-preview__partner-modal-partners-block", children: [_jsx("span", { className: "tt-rp-preview__partner-modal-label", children: "\u041F\u0430\u0440\u0442\u043D\u0451\u0440\u044B \u043F\u0440\u043E\u0435\u043A\u0442\u0430" }), _jsx("ul", { className: "tt-rp-preview__partner-modal-partners", children: partners.map((p) => (_jsxs("li", { className: `tt-rp-preview__partner-modal-partner${userId === p.authUserId ? ' tt-rp-preview__partner-modal-partner--you' : ''}`, children: [_jsx("span", { className: "tt-rp-preview__partner-modal-partner-name", children: p.displayName.trim() || `ID ${p.authUserId}` }), p.position ? (_jsx("span", { className: "tt-rp-preview__partner-modal-partner-pos", children: p.position })) : null, userId === p.authUserId ? (_jsx("span", { className: "tt-rp-preview__partner-modal-you", children: "\u0412\u044B" })) : null] }, p.authUserId))) })] })) : null, _jsxs("div", { className: "tt-rp-preview__partner-modal-status", children: [listsLoad === 'loading' ? (_jsx("p", { className: "tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--muted", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0439\u2026" })) : null, listsLoad === 'error' ? (_jsx("p", { className: "tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--err", role: "alert", children: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0439." })) : null, listsLoad === 'ok' && fullyConfirmed && mySig ? (_jsxs("p", { className: "tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--ok", children: ["\u0412\u0441\u0435 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u044B \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B\u0438 \u043E\u0442\u0447\u0451\u0442. \u0412\u0430\u0448\u0430 \u043F\u043E\u0434\u043F\u0438\u0441\u044C: ", fmtConfirmed(mySig.confirmedAt), "."] })) : null, listsLoad === 'ok' && fullyConfirmed && !mySig ? (_jsx("p", { className: "tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--ok", children: "\u041E\u0442\u0447\u0451\u0442 \u0437\u0430 \u044D\u0442\u043E\u0442 \u043F\u0435\u0440\u0438\u043E\u0434 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430\u043C\u0438." })) : null, listsLoad === 'ok' && !fullyConfirmed && !pendingForProject && mySig ? (_jsxs("p", { className: "tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--ok", children: ["\u0412\u044B \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B\u0438 (", fmtConfirmed(mySig.confirmedAt), "). \u041E\u0436\u0438\u0434\u0430\u044E\u0442\u0441\u044F \u0434\u0440\u0443\u0433\u0438\u0435 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u044B."] })) : null] }), _jsxs("div", { className: "tt-rp-preview__partner-modal-footer", children: [_jsx("button", { type: "button", className: "tt-rp-preview__partner-modal-btn tt-rp-preview__partner-modal-btn--ghost", onClick: () => setPartnerModalOpen(false), children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" }), showPartnerConfirmBtn ? (_jsx("button", { type: "button", className: "tt-rp-preview__partner-modal-btn tt-rp-preview__partner-modal-btn--primary", onClick: () => void handlePartnerConfirmSubmit(), disabled: confirmBusy, children: confirmBusy ? 'Отправка…' : 'Подтвердить принятие отчёта' })) : null] })] }) }), document.body)
        : null;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "tt-rp-preview__partner-trigger-wrap", children: _jsxs("button", { type: "button", className: "tt-rp-preview__partner-trigger", title: "\u0421\u0442\u0430\u0442\u0443\u0441 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0441\u043A\u043E\u0433\u043E \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F \u043E\u0442\u0447\u0451\u0442\u0430 \u043F\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0443 \u0438 \u043F\u0435\u0440\u0438\u043E\u0434\u0443", "aria-label": "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043E\u0442\u0447\u0451\u0442\u0430 \u2014 \u0441\u0442\u0430\u0442\u0443\u0441 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0441\u043A\u043E\u0433\u043E \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F", onClick: () => setPartnerModalOpen(true), "aria-haspopup": "dialog", "aria-expanded": partnerModalOpen, children: [_jsx("span", { className: "tt-rp-preview__partner-trigger-icon", "aria-hidden": true, children: _jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" }), _jsx("path", { d: "m9 12 2 2 4-4" })] }) }), _jsx("span", { className: "tt-rp-preview__partner-trigger-label", children: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043E\u0442\u0447\u0451\u0442\u0430" }), triggerBadge] }) }), modal] }));
}
