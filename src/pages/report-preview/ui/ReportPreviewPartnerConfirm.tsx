import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { routes } from '@shared/config';
import { useAppDialog } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { formatIsoRangeTitle } from '@entities/time-tracking/lib/reportsPeriodRange';
import { PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT } from '@entities/time-tracking/model/partnerConfirmedReports';
import {
    listPartnerUsersWithProjectAccessToProject,
    listPartnerReportConfirmationsPendingItems,
    listPartnerReportConfirmationsConfirmed,
    confirmPartnerReportConfirmation,
    submitPartnerReportConfirmationFromPreview,
    parsePartnerReportConfirmationRequest,
    notifyPartnerConfirmedReportsListInvalidate,
    type ProjectPartnerAccessRow,
    type PartnerReportConfirmationRequest,
} from '@entities/time-tracking';
import { clearReportPreviewTransfer } from '@entities/time-tracking/model/reportPreviewTransfer';

const REPORTS_TAB_URL = `${routes.timeTracking}?tab=reports`;

function leaveReportPreview(navigate: NavigateFunction, returnTo?: string | null): void {
    void clearReportPreviewTransfer();
    const target = (returnTo ?? '').trim() || REPORTS_TAB_URL;
    navigate(target, { replace: true });
}
function rpPartnerConfirmPeriodMatches(req: {
    dateFrom: string;
    dateTo: string;
}, from: string, to: string): boolean {
    return req.dateFrom === from.slice(0, 10) && req.dateTo === to.slice(0, 10);
}
function rpPartnerConfirmSessionKey(projectId: string, from: string, to: string): string {
    return `tt-partner-confirm:${projectId.trim()}:${from.slice(0, 10)}:${to.slice(0, 10)}`;
}
function rpLoadPartnerConfirmSession(projectId: string, from: string, to: string): PartnerReportConfirmationRequest | null {
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
function rpSavePartnerConfirmSession(projectId: string, from: string, to: string, req: PartnerReportConfirmationRequest): void {
    try {
        sessionStorage.setItem(rpPartnerConfirmSessionKey(projectId, from, to), JSON.stringify(req));
    }
    catch {

    }
}
export function ReportPreviewManagerSubmitBar({ projectId, dateFrom, dateTo }: {
    projectId: string;
    dateFrom: string;
    dateTo: string;
}) {
    const { showAlert, showConfirm } = useAppDialog();
    const { t } = useI18n();
    const [pendingReqs, setPendingReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [confirmedReqs, setConfirmedReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [listsLoad, setListsLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
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
    return (<button type="button" className="tt-rp-preview__manager-submit" disabled={submitBusy || listsLoad !== 'ok' || alreadySent || fullyConfirmed} onClick={() => void handleSubmit()} title={labelLong} aria-label={labelLong}>
        <span className="tt-rp-preview__manager-submit-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
        </span>
        <span className="tt-rp-preview__manager-submit-label tt-rp-preview__manager-submit-label--long">{labelLong}</span>
        <span className="tt-rp-preview__manager-submit-label tt-rp-preview__manager-submit-label--short">{labelShort}</span>
    </button>);
}
export function ReportPreviewPartnerSignFooter({ projectId, dateFrom, dateTo, userId, returnTo, }: {
    projectId: string;
    dateFrom: string;
    dateTo: string;
    userId: number | null;
    returnTo?: string | null;
}) {
    const { showAlert } = useAppDialog();
    const navigate = useNavigate();
    const [pendingReqs, setPendingReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [confirmedReqs, setConfirmedReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [listsLoad, setListsLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [sessionSnapshot, setSessionSnapshot] = useState<PartnerReportConfirmationRequest | null>(null);
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
        const hit = (req: PartnerReportConfirmationRequest | null | undefined) => req?.signatures.find((s) => s.partnerAuthUserId === userId);
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
    return (<div className="tt-rp-preview__partner-sign-aside" role="group" aria-label="Подпись отчёта">
        <span className="tt-rp-preview__partner-sign-status">
          <span className="tt-rp-preview__partner-sign-status-ico" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" fill="#22c55e"/>
              <path d="M8.5 12.5l2.2 2.2 4.8-5" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          Готово к подписи
        </span>
        <button type="button" className="tt-rp-preview__partner-sign-btn" onClick={() => void handlePartnerConfirmSubmit()} disabled={confirmBusy || listsLoad !== 'ok'}>
            {confirmBusy ? 'Отправка…' : listsLoad !== 'ok' ? 'Загрузка…' : 'Подписать отчёт'}
        </button>
    </div>);
}
export function ReportPreviewPartnerBar({ projectId, dateFrom, dateTo, userId, sharedPartners, sharedPartnersLoading, returnTo, }: {
    projectId: string;
    dateFrom: string;
    dateTo: string;
    userId: number | null;
    sharedPartners?: ProjectPartnerAccessRow[];
    sharedPartnersLoading?: boolean;
    returnTo?: string | null;
}) {
    const { showAlert } = useAppDialog();
    const navigate = useNavigate();
    const [partnerModalOpen, setPartnerModalOpen] = useState(false);
    const partnerModalPanelRef = useRef<HTMLDivElement>(null);
    const [fetchedPartners, setFetchedPartners] = useState<ProjectPartnerAccessRow[]>([]);
    const [fetchedPartnersLoad, setFetchedPartnersLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const useSharedPartners = sharedPartners != null;
    const partners = useSharedPartners ? sharedPartners : fetchedPartners;
    const partnersLoad = useSharedPartners
        ? (sharedPartnersLoading ? 'loading' : 'ok')
        : fetchedPartnersLoad;
    const [pendingReqs, setPendingReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [confirmedReqs, setConfirmedReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [listsLoad, setListsLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [sessionSnapshot, setSessionSnapshot] = useState<PartnerReportConfirmationRequest | null>(null);
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
        const hit = (req: PartnerReportConfirmationRequest | null | undefined) => req?.signatures.find((s) => s.partnerAuthUserId === userId);
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
    const fmtConfirmed = (iso: string) => {
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
            const closeBtn = root?.querySelector<HTMLButtonElement>('.tt-rp-preview__partner-modal-close');
            closeBtn?.focus();
        };
        const t = window.requestAnimationFrame(focusFirst);
        const onKey = (e: KeyboardEvent) => {
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
            ? (<span className="tt-rp-preview__partner-trigger-badge">Нужна подпись</span>)
            : fullyConfirmed && mySig
                ? (<span className="tt-rp-preview__partner-trigger-badge tt-rp-preview__partner-trigger-badge--success">Готово</span>)
                : fullyConfirmed && !mySig
                    ? (<span className="tt-rp-preview__partner-trigger-badge tt-rp-preview__partner-trigger-badge--neutral">Подтверждено</span>)
                    : listsLoad === 'ok' && !fullyConfirmed && !pendingForProject && mySig
                        ? (<span className="tt-rp-preview__partner-trigger-badge tt-rp-preview__partner-trigger-badge--wait">Ожидание партнёров</span>)
                        : null;
    const modal = partnerModalOpen
        ? createPortal(<div className="tt-rp-preview__partner-modal-overlay" role="presentation" onClick={() => setPartnerModalOpen(false)}>
            <div ref={partnerModalPanelRef} className="tt-rp-preview__partner-modal-panel" role="dialog" aria-modal="true" aria-labelledby={partnerModalTitleId} onClick={(e) => e.stopPropagation()}>
                <div className="tt-rp-preview__partner-modal-head">
                    <div className="tt-rp-preview__partner-modal-head-text">
                        <span className="tt-rp-preview__partner-modal-kicker">Партнёрский статус</span>
                        <h2 id={partnerModalTitleId} className="tt-rp-preview__partner-modal-title">
                            Подтверждение отчёта
                        </h2>
                    </div>
                    <button type="button" className="tt-rp-preview__partner-modal-close" onClick={() => setPartnerModalOpen(false)} aria-label="Закрыть">
                        ×
                    </button>
                </div>
                <p className="tt-rp-preview__partner-modal-period">
                    Период: <strong>{periodLabel}</strong>
                </p>
                <p className="tt-rp-preview__partner-modal-lead">
                    Вы фиксируете принятие отчётности по проекту как партнёр. После подписей всех партнёров запись попадает в список подтверждённых отчётов.
                </p>
                {partners.length > 0 ? (<div className="tt-rp-preview__partner-modal-partners-block">
                    <span className="tt-rp-preview__partner-modal-label">Партнёры проекта</span>
                    <ul className="tt-rp-preview__partner-modal-partners">
                        {partners.map((p) => (<li key={p.authUserId} className={`tt-rp-preview__partner-modal-partner${userId === p.authUserId ? ' tt-rp-preview__partner-modal-partner--you' : ''}`}>
                            <span className="tt-rp-preview__partner-modal-partner-name">{p.displayName.trim() || `ID ${p.authUserId}`}</span>
                            {p.position ? (<span className="tt-rp-preview__partner-modal-partner-pos">{p.position}</span>) : null}
                            {userId === p.authUserId ? (<span className="tt-rp-preview__partner-modal-you">Вы</span>) : null}
                        </li>))}
                    </ul>
                </div>) : null}
                <div className="tt-rp-preview__partner-modal-status">
                    {listsLoad === 'loading' ? (<p className="tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--muted">Загрузка статуса подтверждений…</p>) : null}
                    {listsLoad === 'error' ? (<p className="tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--err" role="alert">
                        Не удалось загрузить статус подтверждений.
                    </p>) : null}
                    {listsLoad === 'ok' && fullyConfirmed && mySig ? (<p className="tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--ok">
                        Все партнёры подтвердили отчёт. Ваша подпись: {fmtConfirmed(mySig.confirmedAt)}.
                    </p>) : null}
                    {listsLoad === 'ok' && fullyConfirmed && !mySig ? (<p className="tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--ok">
                        Отчёт за этот период полностью подтверждён партнёрами.
                    </p>) : null}
                    {listsLoad === 'ok' && !fullyConfirmed && !pendingForProject && mySig ? (<p className="tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--ok">
                        Вы подтвердили ({fmtConfirmed(mySig.confirmedAt)}). Ожидаются другие партнёры.
                    </p>) : null}
                </div>
                <div className="tt-rp-preview__partner-modal-footer">
                    <button type="button" className="tt-rp-preview__partner-modal-btn tt-rp-preview__partner-modal-btn--ghost" onClick={() => setPartnerModalOpen(false)}>
                        Закрыть
                    </button>
                    {showPartnerConfirmBtn ? (<button type="button" className="tt-rp-preview__partner-modal-btn tt-rp-preview__partner-modal-btn--primary" onClick={() => void handlePartnerConfirmSubmit()} disabled={confirmBusy}>
                        {confirmBusy ? 'Отправка…' : 'Подтвердить принятие отчёта'}
                    </button>) : null}
                </div>
            </div>
        </div>, document.body)
        : null;
    return (<>
        <div className="tt-rp-preview__partner-trigger-wrap">
            <button type="button" className="tt-rp-preview__partner-trigger" title="Статус партнёрского подтверждения отчёта по проекту и периоду" aria-label="Подтверждение отчёта — статус партнёрского согласования" onClick={() => setPartnerModalOpen(true)} aria-haspopup="dialog" aria-expanded={partnerModalOpen}>
                <span className="tt-rp-preview__partner-trigger-icon" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                        <path d="m9 12 2 2 4-4" />
                    </svg>
                </span>
                <span className="tt-rp-preview__partner-trigger-label">Подтверждение отчёта</span>
                {triggerBadge}
            </button>
        </div>
        {modal}
    </>);
}
