import { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef, type ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { routes, getExpensesOpenUrl } from '@shared/config';
import { useCurrentUser, useMediaQuery } from '@shared/hooks';
import { AppBackButton, AppHomeLogo, AppPageSettings, Pagination } from '@shared/ui';
import { ExpensesFormPanel, type PanelMode } from './ExpensesFormPanel';
import { ExpenseConfirmDialog } from './ExpenseConfirmDialog';
import { ExpensesReportModal } from '@features/expense-report';
import type { ExpenseRequest, ExpenseFormValues, ExpenseFilesByKind, ExpenseStatus, ExpenseType, ExpenseCreatedBy, } from '@entities/expenses/model/types';
import { EXPENSE_REGISTRY_STATUSES, EXPENSE_REGISTRY_STATUS_SET, STATUS_META, TYPE_META, REIMBURSABLE_META, } from '@entities/expenses/model/constants';
import { approveExpense, payExpense, closeExpense, deleteExpense, fetchExpenses, fetchExpenseById, createExpense, updateExpense, submitExpense, uploadAttachment, rejectExpense, reviseExpense, } from '@entities/expenses/model/expensesApi';
import { computeAmountUzsForApi } from '@entities/expenses/model/expenseCurrency';
import { buildExpensesListParams, EXPENSES_LIST_PAGE_SIZE, } from '@entities/expenses/model/expensesListParams';
import { asExpenseNumber, normalizeExpenseRequest } from '@entities/expenses/model/coerceExpense';
import { getUser } from '@entities/user';
import { formatExpenseAuthorLabel, mergeExpenseAuthorFromCache, needsAuthorEnrichment, formatPartnerUserLabel, } from '@entities/expenses/model/expenseAuthor';
import { canViewExpensesRequestsAndReport } from '@entities/expenses/model/expenseModeration';
import { getCloseExpenseUi, isModerationBlockedForOwnExpense, isReceiptUploadAllowedForExpenseStatus, showOwnPendingModerationBlockedHint, resolveExpensePanelMode, showPayExpenseAction, showPendingApprovalModeration, showDeleteExpenseAction, } from '@entities/expenses/model/expenseStatusPolicy';
import { ExpensesPageBoundary } from './ExpensesPageBoundary';
import '@pages/time-tracking/ui/TimeTrackingForms.css';
import './ExpensesPage.css';
export type ExpensesPageVariant = 'default' | 'moderationQueue';
export type ExpensesPageProps = {
    variant?: ExpensesPageVariant;
};
type TableConfirmState = null | {
    kind: 'approve';
    req: ExpenseRequest;
} | {
    kind: 'pay';
    req: ExpenseRequest;
} | {
    kind: 'close';
    req: ExpenseRequest;
    message: string;
    confirmLabel: string;
} | {
    kind: 'delete';
    req: ExpenseRequest;
};
type FilterPeriod = 'all' | 'today' | 'week' | 'month';
type ActiveFilter = 'status' | 'type' | 'reimbursable' | 'period' | null;
function fmtDate(iso: string) {
    if (!iso)
        return '—';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
}
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function expenseDateKey(raw: unknown): string {
    const s = String(raw ?? '').slice(0, 10);
    return ISO_DATE_RE.test(s) ? s : '';
}
function fmtExpenseDateCell(raw: unknown): string {
    const k = expenseDateKey(raw);
    return k ? fmtDate(k) : '—';
}
function paymentDeadlineCell(raw: unknown): string {
    if (raw == null || raw === '')
        return '—';
    const s = typeof raw === 'string' ? raw : String(raw);
    const prefix = s.slice(0, 10);
    return ISO_DATE_RE.test(prefix) ? fmtDate(prefix) : '—';
}
function fmtUzs(raw: unknown) {
    return asExpenseNumber(raw).toLocaleString('ru-RU');
}
function ruExpenseRequestUnit(n: number): string {
    const m = n % 10;
    const m100 = n % 100;
    if (m100 >= 11 && m100 <= 14)
        return 'заявок';
    if (m === 1)
        return 'заявка';
    if (m >= 2 && m <= 4)
        return 'заявки';
    return 'заявок';
}
function formValuesToApiBody(values: ExpenseFormValues) {
    const paymentDeadline = values.paymentDeadline.trim() ? values.paymentDeadline : null;
    const expenseSubtype = values.expenseType === 'partner_expense'
        ? values.expenseSubtype.trim() || null
        : null;
    const isPartner = values.expenseType === 'partner_expense';
    const partnerUserIdRaw = values.partnerUserId.trim();
    const partnerUserId = isPartner && partnerUserIdRaw ? Number(partnerUserIdRaw) : undefined;
    const isClient = values.expenseType === 'client_expense';
    return {
        description: values.description,
        expenseDate: values.expenseDate,
        paymentDeadline,
        amountUzs: computeAmountUzsForApi(values.amountCurrency, values.amountUzs, values.exchangeRate, values.foreignPerUsd),
        exchangeRate: parseFloat(values.exchangeRate) || 0,
        expenseType: values.expenseType,
        expenseSubtype,
        isReimbursable: values.isReimbursable,
        paymentMethod: values.paymentMethod || undefined,
        projectId: isPartner || !isClient ? undefined : values.projectId || undefined,
        expenseCategoryId: isPartner || !isClient || !values.expenseCategoryId?.trim()
            ? undefined
            : values.expenseCategoryId.trim(),
        vendor: isClient && values.vendor ? values.vendor : undefined,
        businessPurpose: values.businessPurpose || undefined,
        comment: values.comment || undefined,
        ...(partnerUserId != null && Number.isFinite(partnerUserId) && partnerUserId > 0
            ? { partnerUserId }
            : {}),
    };
}
function StatusBadge({ status }: {
    status: ExpenseStatus;
}) {
    const meta = STATUS_META[status];
    return <span className={`exp-status exp-status--${status}`}>{meta?.label ?? status}</span>;
}
function IconDotsVertical() {
    return (<svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.85"/>
      <circle cx="12" cy="12" r="1.85"/>
      <circle cx="12" cy="19" r="1.85"/>
    </svg>);
}
function ExpenseTableRow({ req, onOpen, canModerate, currentUserId, currentUserRole, moderationBusyId, onApprove, onRejectClick, onReviseClick, onPay, onCloseLifecycle, onDeleteClick, isActionMenuOpen, onToggleActionMenu, onCloseActionMenu, }: {
    req: ExpenseRequest;
    onOpen: (r: ExpenseRequest, opts?: { mode?: 'view' | 'edit' }) => void;
    canModerate: boolean;
    currentUserId: number | null;
    currentUserRole: string | null;
    moderationBusyId: string | null;
    onApprove: (r: ExpenseRequest) => void;
    onRejectClick: (r: ExpenseRequest) => void;
    onReviseClick: (r: ExpenseRequest) => void;
    onPay: (r: ExpenseRequest) => void;
    onCloseLifecycle: (r: ExpenseRequest) => void;
    onDeleteClick: (r: ExpenseRequest) => void;
    isActionMenuOpen: boolean;
    onToggleActionMenu: () => void;
    onCloseActionMenu: () => void;
}) {
    const typeLabel = TYPE_META[req.expenseType as ExpenseType]?.label ?? req.expenseType;
    const partnerLabel = req.expenseType === 'partner_expense' ? formatPartnerUserLabel(req) : '';
    const reimbLabel = req.isReimbursable
        ? REIMBURSABLE_META['reimbursable'].label
        : REIMBURSABLE_META['non_reimbursable'].label;
    const reimbKey = req.isReimbursable ? 'reimbursable' : 'non_reimbursable';
    const uzsAmt = asExpenseNumber(req.amountUzs);
    const equivUsd = asExpenseNumber(req.equivalentAmount);
    const rate = asExpenseNumber(req.exchangeRate);
    const payDueLabel = paymentDeadlineCell(req.paymentDeadline);
    const blockedOwn = isModerationBlockedForOwnExpense(canModerate, currentUserId, req);
    const showMod = showPendingApprovalModeration(req, canModerate, blockedOwn);
    const showOwnModHint = showOwnPendingModerationBlockedHint(req, canModerate, blockedOwn);
    const showPay = canModerate && showPayExpenseAction(req, blockedOwn);
    const closeUi = canModerate ? getCloseExpenseUi(req, blockedOwn) : null;
    const showDelete = showDeleteExpenseAction(req, currentUserId, currentUserRole);
    const busy = moderationBusyId === req.id;
    const canEditFromList = resolveExpensePanelMode(req.status) === 'edit';
    const actionsModeration = showMod;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuFixedStyle, setMenuFixedStyle] = useState<{
        top: number;
        left: number;
        minWidth: number;
    } | null>(null);
    useLayoutEffect(() => {
        if (!isActionMenuOpen || !triggerRef.current) {
            setMenuFixedStyle(null);
            return;
        }
        const r = triggerRef.current.getBoundingClientRect();
        const minWidth = Math.max(200, r.width);
        let left = r.right - minWidth;
        const maxLeft = typeof window !== 'undefined' ? window.innerWidth - minWidth - 8 : left;
        left = Math.max(8, Math.min(left, maxLeft));
        const top = r.bottom + 6;
        setMenuFixedStyle({ top, left, minWidth });
    }, [isActionMenuOpen]);
    useEffect(() => {
        if (!isActionMenuOpen)
            return;
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (triggerRef.current?.contains(t) || menuRef.current?.contains(t))
                return;
            onCloseActionMenu();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onCloseActionMenu();
        };
        const onReposition = () => {
            if (!triggerRef.current)
                return;
            const r = triggerRef.current.getBoundingClientRect();
            const minWidth = Math.max(200, r.width);
            let left = r.right - minWidth;
            const maxLeft = window.innerWidth - minWidth - 8;
            left = Math.max(8, Math.min(left, maxLeft));
            setMenuFixedStyle({ top: r.bottom + 6, left, minWidth });
        };
        document.addEventListener('mousedown', onDoc);
        window.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onReposition, true);
        window.addEventListener('resize', onReposition);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onReposition, true);
            window.removeEventListener('resize', onReposition);
        };
    }, [isActionMenuOpen, onCloseActionMenu]);
    const usdTitle = equivUsd > 0 && rate > 0
        ? `Курс: ${rate.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 4 })} UZS за 1 USD`
        : undefined;
    return (<div className="exp-table__row" role="row" onClick={() => onOpen(req)}>
      <div className="exp-table__td exp-table__td--num" role="cell">
        <span className="exp-table__num">{req.id}</span>
      </div>
      <div className="exp-table__td exp-table__td--desc" role="cell">
        <span className="exp-table__desc">{String(req.description ?? '')}</span>
      </div>
      <div className="exp-table__td exp-table__td--author" role="cell">
        <span className="exp-table__author">{formatExpenseAuthorLabel(req)}</span>
      </div>
      <div className="exp-table__td exp-table__td--expdate" role="cell">
        {fmtExpenseDateCell(req.expenseDate)}
      </div>
      <div className="exp-table__td exp-table__td--paydue" role="cell">
        {payDueLabel}
      </div>
      <div className="exp-table__td exp-table__td--type" role="cell" title={partnerLabel ? `${typeLabel} · ${partnerLabel}` : typeLabel}>
        {typeLabel}
        {partnerLabel ? (<span className="exp-table__partner-sub">{partnerLabel}</span>) : null}
      </div>
      <div className="exp-table__td exp-table__td--reimb" role="cell">
        <span className={`exp-reimb exp-reimb--${reimbKey}`}>{reimbLabel}</span>
      </div>
      <div className="exp-table__td exp-table__td--status" role="cell">
        <div className="exp-table__status-tags">
          <StatusBadge status={req.status}/>
          {req.expenseType === 'partner_expense' && (<span className="exp-card__partner-pill exp-card__partner-pill--table" title="Расход партнёра · без согласования модератором">
              Расход партнёра
            </span>)}
        </div>
      </div>
      <div className="exp-table__td exp-table__td--uzs" role="cell">
        <span className="exp-table__money-uzs">{fmtUzs(uzsAmt)}</span>
      </div>
      <div className="exp-table__td exp-table__td--usd" role="cell" title={usdTitle}>
        {equivUsd > 0 ? (<span className="exp-table__usd-one-line">
            <span className="exp-table__usd-num">
              {equivUsd.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="exp-table__usd-suffix">USD</span>
          </span>) : (<span className="exp-table__money-empty">—</span>)}
      </div>
      <div className="exp-table__td exp-table__td--action" role="cell" onClick={e => e.stopPropagation()}>
        <div className="exp-table__action-trigger-wrap">
          <button ref={triggerRef} type="button" className={`exp-table__actions-trigger${isActionMenuOpen ? ' exp-table__actions-trigger--open' : ''}`} aria-haspopup="menu" aria-expanded={isActionMenuOpen} aria-label="Действия по заявке" disabled={busy} onClick={e => {
                    e.stopPropagation();
                    onToggleActionMenu();
                }}>
            <IconDotsVertical />
          </button>
        </div>
        {isActionMenuOpen && menuFixedStyle && typeof document !== 'undefined' && createPortal(<div ref={menuRef} className="exp-table__actions-menu exp-table__actions-menu--portal" style={{
                position: 'fixed',
                top: menuFixedStyle.top,
                left: menuFixedStyle.left,
                minWidth: menuFixedStyle.minWidth,
                zIndex: 12040,
            }} role="menu" onClick={e => e.stopPropagation()}>
            {showOwnModHint && (<p className="exp-table__menu-hint" role="note">
                Свою заявку согласовать нельзя — обратитесь к другому модератору.
              </p>)}
            {actionsModeration && (<>
                <button type="button" className="exp-table__menu-item exp-table__menu-item--accent" role="menuitem" disabled={busy} onClick={() => {
                        onCloseActionMenu();
                        onApprove(req);
                    }}>
                  Одобрить
                </button>
                <button type="button" className="exp-table__menu-item exp-table__menu-item--danger" role="menuitem" disabled={busy} onClick={() => {
                        onCloseActionMenu();
                        onRejectClick(req);
                    }}>
                  Отклонить
                </button>
                <button type="button" className="exp-table__menu-item" role="menuitem" disabled={busy} onClick={() => {
                        onCloseActionMenu();
                        onReviseClick(req);
                    }}>
                  На доработку
                </button>
                <div className="exp-table__menu-sep" role="separator"/>
              </>)}
            {(showPay || closeUi) && (<>
                {showPay && (<button type="button" className="exp-table__menu-item" role="menuitem" disabled={busy} onClick={() => {
                        onCloseActionMenu();
                        onPay(req);
                    }}>
                    Оплачено
                  </button>)}
                {closeUi && (<button type="button" className="exp-table__menu-item" role="menuitem" disabled={busy} onClick={() => {
                        onCloseActionMenu();
                        onCloseLifecycle(req);
                    }}>
                    {closeUi.label}
                  </button>)}
                <div className="exp-table__menu-sep" role="separator"/>
              </>)}
            <button type="button" className="exp-table__menu-item" role="menuitem" onClick={() => {
                    onCloseActionMenu();
                    onOpen(req, { mode: 'view' });
                }}>
              Сведения
            </button>
            {canEditFromList && (<button type="button" className="exp-table__menu-item" role="menuitem" onClick={() => {
                    onCloseActionMenu();
                    onOpen(req, { mode: 'edit' });
                }}>
                Редактировать
              </button>)}
            {showDelete && (<button type="button" className="exp-table__menu-item exp-table__menu-item--danger" role="menuitem" disabled={busy} onClick={() => {
                    onCloseActionMenu();
                    onDeleteClick(req);
                }}>
                Удалить
              </button>)}
            <button type="button" className="exp-table__menu-item exp-table__menu-item--primary" role="menuitem" disabled={busy} onClick={() => {
                    onCloseActionMenu();
                    onOpen(req);
                }}>
              Открыть
            </button>
          </div>, document.body)}
      </div>
    </div>);
}
function EmptyState({ hasFilters, onCreate, moderationQueue, }: {
    hasFilters: boolean;
    onCreate: () => void;
    moderationQueue?: boolean;
}) {
    if (moderationQueue) {
        return (<div className="exp-empty">
        <div className="exp-empty__icon">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="10" width="32" height="36" rx="3"/>
            <line x1="16" y1="20" x2="32" y2="20"/>
            <line x1="16" y1="27" x2="28" y2="27"/>
            <line x1="16" y1="34" x2="24" y2="34"/>
          </svg>
        </div>
        {hasFilters ? (<>
            <p className="exp-empty__title">Заявок не найдено</p>
            <p className="exp-empty__desc">Попробуйте изменить поиск или фильтры</p>
          </>) : (<>
            <p className="exp-empty__title">Нет заявок на согласовании</p>
            <p className="exp-empty__desc">
              Отправленные сотрудниками заявки появятся в этом списке. Расходы партнёра сразу в статусе «Одобрено» и
              сюда не попадают.
            </p>
          </>)}
      </div>);
    }
    return (<div className="exp-empty">
      <div className="exp-empty__icon">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="10" width="32" height="36" rx="3"/>
          <line x1="16" y1="20" x2="32" y2="20"/>
          <line x1="16" y1="27" x2="28" y2="27"/>
          <line x1="16" y1="34" x2="24" y2="34"/>
          <circle cx="38" cy="10" r="8" fill="var(--app-accent)" stroke="none"/>
          <line x1="38" y1="7" x2="38" y2="13" stroke="white" strokeWidth="2"/>
          <line x1="35" y1="10" x2="41" y2="10" stroke="white" strokeWidth="2"/>
        </svg>
      </div>
      {hasFilters ? (<>
          <p className="exp-empty__title">Заявок не найдено</p>
          <p className="exp-empty__desc">Попробуйте изменить фильтры или поисковый запрос</p>
        </>) : (<>
          <p className="exp-empty__title">Заявок пока нет</p>
          <p className="exp-empty__desc">Создайте первую заявку на расход</p>
          <button type="button" className="exp-empty__btn" onClick={onCreate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Создать заявку
          </button>
        </>)}
    </div>);
}
type FilterDropProps = {
    label: string;
    active: boolean;
    isOpen: boolean;
    onToggle: () => void;
    children: ReactNode;
};
function FilterDrop({ label, active, isOpen, onToggle, children }: FilterDropProps) {
    const ref = useRef<HTMLDivElement>(null);
    return (<div className={`exp-filter${active ? ' exp-filter--active' : ''}`} ref={ref}>
      <button type="button" className="exp-filter__btn" onClick={onToggle}>
        <span className="exp-filter__btn-text">{label}</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <polyline points={isOpen ? '4 10 8 6 12 10' : '4 6 8 10 12 6'}/>
        </svg>
      </button>
      {isOpen && <div className="exp-filter__drop">{children}</div>}
    </div>);
}
function ServiceUnavailable({ message, onRetry }: {
    message: string;
    onRetry: () => void;
}) {
    const isServiceDown = /unavailable|503|недоступ/i.test(message);
    return (<div className="exp-service-err">
      <div className="exp-service-err__icon">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="32" r="28"/>
          <path d="M20 26c0-6.627 5.373-12 12-12s12 5.373 12 12c0 4-2 7-5 9l-1 7H26l-1-7c-3-2-5-5-5-9z"/>
          <line x1="32" y1="50" x2="32" y2="52"/>
        </svg>
      </div>
      <h2 className="exp-service-err__title">
        {isServiceDown ? 'Сервис временно недоступен' : 'Не удалось загрузить данные'}
      </h2>
      <p className="exp-service-err__desc">
        {isServiceDown
            ? 'Сервис расходов сейчас не отвечает. Попробуйте обновить страницу или повторите попытку через несколько минут.'
            : message}
      </p>
      <button type="button" className="exp-service-err__btn" onClick={onRetry}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Повторить попытку
      </button>
    </div>);
}
function SkeletonCell({ w, h = 14, style }: {
    w: string | number;
    h?: number;
    style?: CSSProperties;
}) {
    return <span className="exp-skel" style={{ width: w, height: h, ...style }}/>;
}
function SkeletonStatsTiles() {
    return (<div className="exp-stats-row exp-stats-row--skel" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (<div key={i} className="exp-stats-tile exp-stats-tile--skel">
          <SkeletonCell w="55%" h={10}/>
          <SkeletonCell w="75%" h={20}/>
          <SkeletonCell w={32} h={10}/>
        </div>))}
    </div>);
}
function SkeletonTableBody({ rowCount = 10 }: {
    rowCount?: number;
}) {
    return (<div className="exp-table" aria-busy>
      <div className="exp-table__body">
        {Array.from({ length: rowCount }).map((_, i) => (<div key={i} className="exp-table__row exp-table__row--skel" aria-hidden>
            <div className="exp-table__td exp-table__td--num">
              <SkeletonCell w={52} h={13}/>
            </div>
            <div className="exp-table__td exp-table__td--desc">
              <SkeletonCell w="92%" h={12}/>
              <SkeletonCell w="70%" h={12}/>
            </div>
            <div className="exp-table__td exp-table__td--author">
              <SkeletonCell w="88%" h={12}/>
            </div>
            <div className="exp-table__td exp-table__td--expdate">
              <SkeletonCell w={54} h={12}/>
            </div>
            <div className="exp-table__td exp-table__td--paydue">
              <SkeletonCell w={54} h={12}/>
            </div>
            <div className="exp-table__td exp-table__td--type">
              <SkeletonCell w="90%" h={12}/>
            </div>
            <div className="exp-table__td exp-table__td--reimb">
              <SkeletonCell w={72} h={20} style={{ borderRadius: 20 }}/>
            </div>
            <div className="exp-table__td exp-table__td--status">
              <SkeletonCell w={76} h={22} style={{ borderRadius: 20 }}/>
            </div>
            <div className="exp-table__td exp-table__td--uzs">
              <SkeletonCell w={72} h={12} style={{ marginLeft: 'auto' }}/>
            </div>
            <div className="exp-table__td exp-table__td--usd">
              <SkeletonCell w={80} h={12} style={{ marginLeft: 'auto' }}/>
            </div>
            <div className="exp-table__td exp-table__td--action">
              <SkeletonCell w={32} h={32} style={{ borderRadius: 8, marginLeft: 'auto' }}/>
            </div>
          </div>))}
      </div>
    </div>);
}
const PERIOD_LABELS: Record<FilterPeriod, string> = {
    all: 'Весь период', today: 'Сегодня', week: 'Эта неделя', month: 'Этот месяц',
};
function ExpensesPageInner({ variant = 'default' }: ExpensesPageProps) {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const navigate = useNavigate();
    const { expenseId: pathExpenseId } = useParams<{
        expenseId?: string;
    }>();
    const [searchParams] = useSearchParams();
    const { user } = useCurrentUser();
    const canModerate = canViewExpensesRequestsAndReport(user?.role);
    const [isLoading, setIsLoading] = useState(true);
    const [listFetchPending, setListFetchPending] = useState(false);
    const isFirstListFetchRef = useRef(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [requests, setRequests] = useState<ExpenseRequest[]>([]);
    const [authorCache, setAuthorCache] = useState<Record<number, ExpenseCreatedBy>>({});
    const authorFetchStartedRef = useRef(new Set<number>());
    const [loadKey, setLoadKey] = useState(0);
    const [expenseTableMenuForId, setExpenseTableMenuForId] = useState<string | null>(null);
    const isModerationQueue = variant === 'moderationQueue';
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<ExpenseStatus | ''>('');
    const [filterType, setFilterType] = useState<ExpenseType | ''>('');
    const [filterReimb, setFilterReimb] = useState<'reimbursable' | 'non_reimbursable' | ''>('');
    const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
    const [openFilter, setOpenFilter] = useState<ActiveFilter>(null);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    useEffect(() => {
        if (!isMobile)
            setMobileFiltersOpen(false);
    }, [isMobile]);
    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 320);
        return () => window.clearTimeout(t);
    }, [search]);
    const [listTotal, setListTotal] = useState<number | null>(null);
    const [listPage, setListPage] = useState(1);
    const filterDepsKey = useMemo(() => [debouncedSearch, filterStatus, filterType, filterReimb, filterPeriod, isModerationQueue].join('\0'), [debouncedSearch, filterStatus, filterType, filterReimb, filterPeriod, isModerationQueue]);
    useEffect(() => {
        setExpenseTableMenuForId(null);
    }, [listPage, filterDepsKey, loadKey]);
    const filterDepsKeyRef = useRef<string | null>(null);
    useLayoutEffect(() => {
        if (filterDepsKeyRef.current === null) {
            filterDepsKeyRef.current = filterDepsKey;
            return;
        }
        if (filterDepsKeyRef.current !== filterDepsKey) {
            filterDepsKeyRef.current = filterDepsKey;
            setListPage(1);
        }
    }, [filterDepsKey]);
    const listPageScrollRef = useRef(true);
    useEffect(() => {
        if (listPageScrollRef.current) {
            listPageScrollRef.current = false;
            return;
        }
        const content = document.querySelector<HTMLElement>('.expenses-page__content');
        const main = document.querySelector<HTMLElement>('.expenses-page__main');
        const behavior: ScrollBehavior = 'smooth';
        content?.scrollTo({ top: 0, left: 0, behavior });
        main?.scrollTo({ top: 0, left: 0, behavior });
        if (window.scrollY > 0)
            window.scrollTo({ top: 0, left: 0, behavior });
    }, [listPage]);
    useEffect(() => {
        let cancelled = false;
        setLoadError(null);
        if (isFirstListFetchRef.current)
            setIsLoading(true);
        setListFetchPending(true);
        const params = buildExpensesListParams({
            isModerationQueue,
            search: debouncedSearch,
            filterStatus,
            filterType,
            filterReimb,
            filterPeriod,
            page: listPage,
            pageSize: EXPENSES_LIST_PAGE_SIZE,
        });
        fetchExpenses(params)
            .then(data => {
            if (cancelled)
                return;
            isFirstListFetchRef.current = false;
            setRequests(Array.isArray(data.items) ? data.items : []);
            setListTotal(typeof data.total === 'number' ? data.total : null);
            setIsLoading(false);
            setListFetchPending(false);
        })
            .catch(err => {
            if (cancelled)
                return;
            setListTotal(null);
            setLoadError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
            isFirstListFetchRef.current = false;
            setIsLoading(false);
            setListFetchPending(false);
        });
        return () => {
            cancelled = true;
        };
    }, [
        loadKey,
        listPage,
        isModerationQueue,
        debouncedSearch,
        filterStatus,
        filterType,
        filterReimb,
        filterPeriod,
    ]);
    useEffect(() => {
        if (isModerationQueue)
            setFilterStatus('');
    }, [isModerationQueue]);
    useEffect(() => {
        if (!isModerationQueue && filterStatus && !EXPENSE_REGISTRY_STATUS_SET.has(filterStatus)) {
            setFilterStatus('');
        }
    }, [isModerationQueue, filterStatus]);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [panelMode, setPanelMode] = useState<PanelMode>('create');
    const [editingReq, setEditingReq] = useState<ExpenseRequest | null>(null);
    const [panelSavePending, setPanelSavePending] = useState(false);
    const [panelSubmitPending, setPanelSubmitPending] = useState(false);
    const [receiptUploadPending, setReceiptUploadPending] = useState(false);
    const panelFormActionRef = useRef<'idle' | 'save' | 'submit'>('idle');
    const [emailModerationIntent, setEmailModerationIntent] = useState<'approve' | 'reject' | null>(null);
    const openedExpensePathRef = useRef<string | null>(null);
    useEffect(() => {
        if (!isPanelOpen) {
            panelFormActionRef.current = 'idle';
            setPanelSavePending(false);
            setPanelSubmitPending(false);
            setReceiptUploadPending(false);
        }
    }, [isPanelOpen]);
    useEffect(() => {
        const candidates: ExpenseRequest[] = [];
        if (Array.isArray(requests))
            candidates.push(...requests);
        if (editingReq)
            candidates.push(editingReq);
        if (candidates.length === 0)
            return;
        const pending: number[] = [];
        for (const r of candidates) {
            if (r == null || typeof r !== 'object')
                continue;
            try {
                const n = normalizeExpenseRequest(r as ExpenseRequest);
                if (!needsAuthorEnrichment(n))
                    continue;
                const id = n.createdByUserId;
                if (authorFetchStartedRef.current.has(id))
                    continue;
                authorFetchStartedRef.current.add(id);
                pending.push(id);
            }
            catch {
            }
        }
        if (pending.length === 0)
            return;
        let cancelled = false;
        Promise.all(pending.map(id => getUser(id)
            .then((u): ExpenseCreatedBy => ({
            id: u.id,
            displayName: u.display_name,
            email: u.email,
            picture: u.picture,
            position: u.position,
        }))
            .catch(() => {
            authorFetchStartedRef.current.delete(id);
            return null;
        }))).then(entries => {
            if (cancelled)
                return;
            const next: Record<number, ExpenseCreatedBy> = {};
            for (const e of entries) {
                if (e)
                    next[e.id] = e;
            }
            if (Object.keys(next).length > 0) {
                setAuthorCache(prev => ({ ...prev, ...next }));
            }
        });
        return () => { cancelled = true; };
    }, [requests, editingReq]);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [tableModerationBusyId, setTableModerationBusyId] = useState<string | null>(null);
    const [tableReject, setTableReject] = useState<ExpenseRequest | null>(null);
    const [tableRevise, setTableRevise] = useState<ExpenseRequest | null>(null);
    const [tableRejectReason, setTableRejectReason] = useState('');
    const [tableReviseComment, setTableReviseComment] = useState('');
    const [tableModErr, setTableModErr] = useState<string | null>(null);
    const [tableConfirm, setTableConfirm] = useState<TableConfirmState>(null);
    useEffect(() => {
        if (!openFilter)
            return;
        const handler = () => setOpenFilter(null);
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [openFilter]);
    const toggleFilter = useCallback((f: ActiveFilter) => {
        setOpenFilter(prev => prev === f ? null : f);
    }, []);
    const handleCreate = useCallback(() => {
        setEditingReq(null);
        setPanelMode('create');
        setIsPanelOpen(true);
    }, []);
    const handleOpenReq = useCallback((req: ExpenseRequest, opts?: { mode?: 'view' | 'edit' }) => {
        setExpenseTableMenuForId(null);
        const auto = resolveExpensePanelMode(req.status) === 'edit' ? 'edit' : 'view';
        const mode = opts?.mode ?? auto;
        setEditingReq(req);
        setPanelMode(mode);
        setIsPanelOpen(true);
        if (mode === 'view') {
            fetchExpenseById(req.id)
                .then(full => { setEditingReq(prev => (prev?.id === full.id ? full : prev)); })
                .catch(() => { });
        }
    }, []);
    useEffect(() => {
        if (!pathExpenseId) {
            openedExpensePathRef.current = null;
        }
    }, [pathExpenseId]);
    useEffect(() => {
        if (!pathExpenseId || isLoading)
            return;
        if (openedExpensePathRef.current === pathExpenseId)
            return;
        let cancelled = false;
        const intentRaw = searchParams.get('intent');
        const intentParsed = intentRaw === 'approve' || intentRaw === 'reject' ? intentRaw : null;
        const stripSearch = searchParams.toString().length > 0;
        (async () => {
            try {
                const req = await fetchExpenseById(pathExpenseId);
                if (cancelled)
                    return;
                openedExpensePathRef.current = pathExpenseId;
                if (intentParsed && canModerate && req.status === 'pending_approval') {
                    setEmailModerationIntent(intentParsed);
                }
                else {
                    setEmailModerationIntent(null);
                }
                handleOpenReq(req);
                if (stripSearch) {
                    navigate({ pathname: getExpensesOpenUrl(pathExpenseId), search: '' }, { replace: true });
                }
            }
            catch {
                if (!cancelled) {
                    setActionError('Не удалось открыть заявку по ссылке');
                    navigate(routes.expenses, { replace: true });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [pathExpenseId, isLoading, searchParams, navigate, handleOpenReq, canModerate]);
    const handleClosePanel = useCallback(() => {
        setIsPanelOpen(false);
        setEmailModerationIntent(null);
    }, []);
    const applyModerationToList = useCallback((r: ExpenseRequest) => {
        setRequests(prev => {
            if (isModerationQueue && r.status !== 'pending_approval') {
                return prev.filter(x => x.id !== r.id);
            }
            if (!isModerationQueue && !EXPENSE_REGISTRY_STATUS_SET.has(r.status)) {
                return prev.filter(x => x.id !== r.id);
            }
            return prev.map(x => (x.id === r.id ? r : x));
        });
        setEditingReq(prev => (prev?.id === r.id ? r : prev));
    }, [isModerationQueue]);
    const handleExpenseUpdated = useCallback((r: ExpenseRequest) => {
        applyModerationToList(r);
        setIsPanelOpen(false);
    }, [applyModerationToList]);
    const handleTableApprove = useCallback((req: ExpenseRequest) => {
        if (tableModerationBusyId)
            return;
        setTableConfirm({ kind: 'approve', req });
    }, [tableModerationBusyId]);
    const handleTablePay = useCallback((req: ExpenseRequest) => {
        if (tableModerationBusyId)
            return;
        setTableConfirm({ kind: 'pay', req });
    }, [tableModerationBusyId]);
    const handleTableCloseLifecycle = useCallback((req: ExpenseRequest) => {
        if (tableModerationBusyId)
            return;
        const blockedOwn = isModerationBlockedForOwnExpense(canModerate, user?.id ?? null, req);
        const ui = getCloseExpenseUi(req, blockedOwn);
        if (!ui)
            return;
        setTableConfirm({ kind: 'close', req, message: ui.confirmMessage, confirmLabel: ui.label });
    }, [tableModerationBusyId, canModerate, user?.id]);
    const handleTableDeleteClick = useCallback((req: ExpenseRequest) => {
        if (tableModerationBusyId)
            return;
        setTableConfirm({ kind: 'delete', req });
    }, [tableModerationBusyId]);
    const handleExpenseDeleted = useCallback((id: string) => {
        setRequests(prev => prev.filter(x => x.id !== id));
        setEditingReq(prev => (prev?.id === id ? null : prev));
        setIsPanelOpen(false);
        setExpenseTableMenuForId(null);
    }, []);
    const runTableConfirm = useCallback(async () => {
        if (!tableConfirm || tableModerationBusyId)
            return;
        const { req } = tableConfirm;
        setTableModerationBusyId(req.id);
        setActionError(null);
        try {
            let r: ExpenseRequest;
            if (tableConfirm.kind === 'approve') {
                r = await approveExpense(req.id);
            }
            else if (tableConfirm.kind === 'pay') {
                r = await payExpense(req.id);
            }
            else if (tableConfirm.kind === 'close') {
                r = await closeExpense(req.id);
            }
            else {
                await deleteExpense(req.id);
                handleExpenseDeleted(req.id);
                setTableConfirm(null);
                return;
            }
            applyModerationToList(r);
            setTableConfirm(null);
        }
        catch (e) {
            const fallback = tableConfirm.kind === 'approve'
                ? 'Не удалось одобрить заявку'
                : tableConfirm.kind === 'pay'
                    ? 'Не удалось отметить оплату'
                    : tableConfirm.kind === 'close'
                        ? 'Не удалось выполнить закрытие'
                        : 'Не удалось удалить заявку';
            setActionError(e instanceof Error ? e.message : fallback);
            setTableConfirm(null);
        }
        finally {
            setTableModerationBusyId(null);
        }
    }, [tableConfirm, tableModerationBusyId, applyModerationToList, handleExpenseDeleted]);
    const openTableReject = useCallback((req: ExpenseRequest) => {
        setTableReject(req);
        setTableRejectReason('');
        setTableModErr(null);
    }, []);
    const openTableRevise = useCallback((req: ExpenseRequest) => {
        setTableRevise(req);
        setTableReviseComment('');
        setTableModErr(null);
    }, []);
    const confirmTableReject = useCallback(async () => {
        if (!tableReject || tableModerationBusyId)
            return;
        const t = tableRejectReason.trim();
        if (!t) {
            setTableModErr('Укажите причину отклонения');
            return;
        }
        setTableModerationBusyId(tableReject.id);
        setTableModErr(null);
        try {
            const r = await rejectExpense(tableReject.id, t);
            applyModerationToList(r);
            setTableReject(null);
            setTableRejectReason('');
        }
        catch (e) {
            setTableModErr(e instanceof Error ? e.message : 'Не удалось отклонить заявку');
        }
        finally {
            setTableModerationBusyId(null);
        }
    }, [tableReject, tableRejectReason, tableModerationBusyId, applyModerationToList]);
    const confirmTableRevise = useCallback(async () => {
        if (!tableRevise || tableModerationBusyId)
            return;
        const t = tableReviseComment.trim();
        if (!t) {
            setTableModErr('Укажите комментарий для автора');
            return;
        }
        setTableModerationBusyId(tableRevise.id);
        setTableModErr(null);
        try {
            const r = await reviseExpense(tableRevise.id, t);
            applyModerationToList(r);
            setTableRevise(null);
            setTableReviseComment('');
        }
        catch (e) {
            setTableModErr(e instanceof Error ? e.message : 'Не удалось вернуть заявку на доработку');
        }
        finally {
            setTableModerationBusyId(null);
        }
    }, [tableRevise, tableReviseComment, tableModerationBusyId, applyModerationToList]);
    const tableModBusy = tableModerationBusyId !== null;
    const tableOverlayOpen = Boolean(tableReject || tableRevise || tableConfirm);
    useEffect(() => {
        if (!tableOverlayOpen)
            return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [tableOverlayOpen]);
    const handleSaveDraft = useCallback(async (values: ExpenseFormValues, filesByKind: ExpenseFilesByKind) => {
        if (panelFormActionRef.current !== 'idle')
            return;
        panelFormActionRef.current = 'save';
        setPanelSavePending(true);
        setActionError(null);
        try {
            const body = formValuesToApiBody(values);
            let saved: ExpenseRequest;
            if (editingReq) {
                saved = await updateExpense(editingReq.id, body);
            }
            else {
                saved = await createExpense(body);
            }
            let last: ExpenseRequest = saved;
            for (const file of filesByKind.payment_document) {
                last = await uploadAttachment(last.id, file, 'payment_document');
            }
            for (const file of filesByKind.payment_receipt) {
                last = await uploadAttachment(last.id, file, 'payment_receipt');
            }
            setListPage(1);
            setLoadKey(k => k + 1);
            setIsPanelOpen(false);
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : 'Ошибка при сохранении');
        }
        finally {
            panelFormActionRef.current = 'idle';
            setPanelSavePending(false);
        }
    }, [editingReq]);
    const handleSubmit = useCallback(async (values: ExpenseFormValues, filesByKind: ExpenseFilesByKind) => {
        if (panelFormActionRef.current !== 'idle')
            return;
        panelFormActionRef.current = 'submit';
        setPanelSubmitPending(true);
        setActionError(null);
        try {
            const body = formValuesToApiBody(values);
            let saved: ExpenseRequest;
            if (editingReq) {
                saved = await updateExpense(editingReq.id, body);
            }
            else {
                saved = await createExpense(body);
            }
            let last: ExpenseRequest = saved;
            for (const file of filesByKind.payment_document) {
                last = await uploadAttachment(last.id, file, 'payment_document');
            }
            for (const file of filesByKind.payment_receipt) {
                last = await uploadAttachment(last.id, file, 'payment_receipt');
            }
            if (last.status !== 'approved')
                await submitExpense(last.id);
            setListPage(1);
            setLoadKey(k => k + 1);
            setIsPanelOpen(false);
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : 'Ошибка при отправке');
        }
        finally {
            panelFormActionRef.current = 'idle';
            setPanelSubmitPending(false);
        }
    }, [editingReq]);
    const resetFilters = useCallback(() => {
        setFilterStatus('');
        setFilterType('');
        setFilterReimb('');
        setFilterPeriod('all');
        setSearch('');
    }, []);
    const requestsForUi = useMemo(() => {
        if (!Array.isArray(requests))
            return [];
        return requests
            .filter((r): r is ExpenseRequest => r != null && typeof r === 'object')
            .map(r => {
            try {
                const n = normalizeExpenseRequest(r);
                return mergeExpenseAuthorFromCache(n, authorCache);
            }
            catch {
                return null;
            }
        })
            .filter((r): r is ExpenseRequest => r !== null);
    }, [requests, authorCache]);
    const editingRequestForPanel = useMemo(() => {
        if (!editingReq)
            return null;
        try {
            return mergeExpenseAuthorFromCache(normalizeExpenseRequest(editingReq), authorCache);
        }
        catch {
            return mergeExpenseAuthorFromCache(editingReq, authorCache);
        }
    }, [editingReq, authorCache]);
    const allowPaymentReceiptUpload = useMemo(() => {
        if (!editingReq || user == null)
            return false;
        if (!isReceiptUploadAllowedForExpenseStatus(editingReq.status))
            return false;
        if (user.id === editingReq.createdByUserId)
            return true;
        if (!canModerate)
            return false;
        return !isModerationBlockedForOwnExpense(canModerate, user.id, editingReq);
    }, [editingReq, user, canModerate]);
    const handleUploadPaymentReceipts = useCallback(async (files: File[]) => {
        if (!editingReq || files.length === 0)
            return;
        setReceiptUploadPending(true);
        setActionError(null);
        try {
            let last = editingReq;
            for (const file of files) {
                last = await uploadAttachment(last.id, file, 'payment_receipt');
            }
            setEditingReq(last);
            setRequests(prev => prev.map(r => (r.id === last.id ? last : r)));
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : 'Не удалось загрузить квитанцию');
            throw err;
        }
        finally {
            setReceiptUploadPending(false);
        }
    }, [editingReq]);
    const filtered = useMemo(() => requestsForUi.filter(r => {
        const st = r.status as ExpenseStatus;
        return EXPENSE_REGISTRY_STATUS_SET.has(st);
    }), [requestsForUi]);
    const filteredTotals = useMemo(() => filtered.reduce((acc, r) => ({
        uzs: acc.uzs + asExpenseNumber(r.amountUzs),
        usd: acc.usd + asExpenseNumber(r.equivalentAmount),
    }), { uzs: 0, usd: 0 }), [filtered]);
    const hasFilters = isModerationQueue
        ? !!(filterType || filterReimb || filterPeriod !== 'all' || search)
        : !!(filterStatus || filterType || filterReimb || filterPeriod !== 'all' || search);
    const activeFilterChipCount = useMemo(() => {
        let n = 0;
        if (!isModerationQueue && filterStatus)
            n++;
        if (filterType)
            n++;
        if (filterReimb)
            n++;
        if (filterPeriod !== 'all')
            n++;
        return n;
    }, [isModerationQueue, filterStatus, filterType, filterReimb, filterPeriod]);
    const statuses: ExpenseStatus[] = EXPENSE_REGISTRY_STATUSES;
    const types: ExpenseType[] = [
        'transport',
        'food',
        'accommodation',
        'purchase',
        'services',
        'entertainment',
        'client_expense',
        'partner_expense',
        'other',
    ];
    return (<div className="expenses-page">
      <main className="expenses-page__main">
        <header className="expenses-page__header">
          <div className="expenses-page__header-inner">
            <div className="expenses-page__header-start">
              <AppBackButton className="app-back-btn" />
              <AppHomeLogo withSeparator />
              <div className="expenses-page__header-titles">
                <h1 className="expenses-page__title">
                  {isModerationQueue ? 'Заявки на согласование' : 'Расходы компании'}
                </h1>
                {((canModerate && !isModerationQueue) || isModerationQueue) && (<div className="exp-header-queue-wrap">
                    {canModerate && !isModerationQueue && (<>
                        <NavLink to={routes.expensesRequests} className="exp-queue-nav">
                          На согласование
                        </NavLink>
                        <NavLink to={routes.expensesReport} className="exp-queue-nav">
                          Аналитика
                        </NavLink>
                      </>)}
                    {isModerationQueue && (<NavLink to={routes.expenses} className="exp-queue-nav">
                        Утверждённые расходы
                      </NavLink>)}
                  </div>)}
              </div>
            </div>
            <div className="app-page-header-end">
              <AppPageSettings />
            </div>
          </div>
        </header>

        <div className="expenses-page__content">
          {actionError && (<div className="exp-error-banner" role="alert">
              <span>{actionError}</span>
              <button type="button" className="exp-error-banner__close" onClick={() => setActionError(null)} aria-label="Закрыть">✕</button>
            </div>)}

          
          <div className={`tt-settings__actions-row tt-settings__actions-row--clients exp-tt-toolbar${isLoading || listFetchPending ? ' exp-tt-toolbar--loading' : ''}`}>
            <div className="tt-settings__toolbar-left tt-settings__toolbar-left--inline">
              {!isModerationQueue && (<button type="button" className="tt-settings__btn tt-settings__btn--primary" onClick={handleCreate}>
                  + Создать заявку
                </button>)}
              {canModerate && (<button type="button" className="tt-settings__btn tt-settings__btn--outline" onClick={() => setIsReportOpen(true)} title="Создать отчёт Excel" aria-label="Создать отчёт Excel">
                  Отчёт Excel
                </button>)}
            </div>
            <div className="tt-settings__actions-end">
              <div className="tt-settings__search-wrap">
                <span className="tt-settings__search-icon" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </span>
                <input type="search" className="tt-settings__search" placeholder="По описанию, номеру заявки или автору" value={search} onChange={e => setSearch(e.target.value)} aria-label="Поиск по заявкам"/>
              </div>
              {isMobile && (<button type="button" className={`exp-filters-toggle${activeFilterChipCount > 0 ? ' exp-filters-toggle--active' : ''}`} aria-expanded={mobileFiltersOpen} onClick={() => {
                    setMobileFiltersOpen(v => {
                        const next = !v;
                        if (!next)
                            setOpenFilter(null);
                        return next;
                    });
                }}>
                  <svg className="exp-filters-toggle__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                  </svg>
                  <span>Фильтры</span>
                  {activeFilterChipCount > 0 && (<span className="exp-filters-toggle__badge" aria-hidden>
                      {activeFilterChipCount}
                    </span>)}
                </button>)}
            </div>
          </div>

          <div className="exp-tt-filters-outer" onMouseDown={e => e.stopPropagation()}>
            <div className={`exp-filters${isMobile && !mobileFiltersOpen ? ' exp-filters--mobile-collapsed' : ''}`}>
              {!isModerationQueue && (<FilterDrop label={filterStatus ? STATUS_META[filterStatus].label : 'Статус'} active={!!filterStatus} isOpen={openFilter === 'status'} onToggle={() => toggleFilter('status')}>
                  <button className={`exp-filter__opt${!filterStatus ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterStatus(''); setOpenFilter(null); }}>
                    Все статусы
                  </button>
                  {statuses.map(s => (<button key={s} className={`exp-filter__opt${filterStatus === s ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterStatus(s); setOpenFilter(null); }}>
                      <span className={`exp-filter__dot exp-filter__dot--${s}`}/>
                      {STATUS_META[s].label}
                    </button>))}
                </FilterDrop>)}

              
              <FilterDrop label={filterType ? TYPE_META[filterType].label : 'Тип расхода'} active={!!filterType} isOpen={openFilter === 'type'} onToggle={() => toggleFilter('type')}>
                <button className={`exp-filter__opt${!filterType ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterType(''); setOpenFilter(null); }}>
                  Все типы
                </button>
                {types.map(t => (<button key={t} className={`exp-filter__opt${filterType === t ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterType(t); setOpenFilter(null); }}>
                    {TYPE_META[t].label}
                  </button>))}
              </FilterDrop>

              
              <FilterDrop label={filterReimb ? REIMBURSABLE_META[filterReimb].label : 'Возмещение'} active={!!filterReimb} isOpen={openFilter === 'reimbursable'} onToggle={() => toggleFilter('reimbursable')}>
                <button className={`exp-filter__opt${!filterReimb ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterReimb(''); setOpenFilter(null); }}>
                  Любое
                </button>
                <button className={`exp-filter__opt${filterReimb === 'reimbursable' ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterReimb('reimbursable'); setOpenFilter(null); }}>
                  Возмещаемый
                </button>
                <button className={`exp-filter__opt${filterReimb === 'non_reimbursable' ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterReimb('non_reimbursable'); setOpenFilter(null); }}>
                  Невозмещаемый
                </button>
              </FilterDrop>

              
              <FilterDrop label={PERIOD_LABELS[filterPeriod]} active={filterPeriod !== 'all'} isOpen={openFilter === 'period'} onToggle={() => toggleFilter('period')}>
                {(Object.keys(PERIOD_LABELS) as FilterPeriod[]).map(p => (<button key={p} className={`exp-filter__opt${filterPeriod === p ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterPeriod(p); setOpenFilter(null); }}>
                    {PERIOD_LABELS[p]}
                  </button>))}
              </FilterDrop>

              {hasFilters && (<button type="button" className="exp-filters-reset" onClick={resetFilters}>
                  Сбросить
                </button>)}
            </div>
          </div>

          
          {isLoading ? (<>
              <SkeletonStatsTiles/>
              <SkeletonTableBody rowCount={10}/>
            </>) : loadError ? (<ServiceUnavailable message={loadError} onRetry={() => setLoadKey(k => k + 1)}/>) : (<>
              <div className="exp-stats-row" role="region" aria-label="Сводка по списку">
                <div className="exp-stats-tile">
                  <span className="exp-stats-tile__label">Заявок по фильтру</span>
                  <span className="exp-stats-tile__value">{listTotal ?? filtered.length}</span>
                  {listTotal != null && (listTotal > EXPENSES_LIST_PAGE_SIZE || listPage > 1) && (<span className="exp-stats-tile__sub" role="status">
                    Стр. {listPage} — на экране {filtered.length}
                  </span>)}
                  <span className="exp-stats-tile__unit">{ruExpenseRequestUnit(listTotal ?? filtered.length)}</span>
                </div>
                <div className="exp-stats-tile" title="Суммы по заявкам на текущей странице списка">
                  <span className="exp-stats-tile__label">Сумма, UZS</span>
                  <span className="exp-stats-tile__value exp-stats-tile__value--uzs">{fmtUzs(filteredTotals.uzs)}</span>
                  <span className="exp-stats-tile__unit">UZS</span>
                </div>
                <div className="exp-stats-tile" title="Эквивалент по заявкам на текущей странице списка">
                  <span className="exp-stats-tile__label">Эквивалент</span>
                  <span className="exp-stats-tile__value exp-stats-tile__value--usd">
                    {filteredTotals.usd > 0
                ? filteredTotals.usd.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '—'}
                  </span>
                  {filteredTotals.usd > 0 && <span className="exp-stats-tile__unit">USD</span>}
                </div>
              </div>

              {filtered.length === 0 ? (<EmptyState hasFilters={hasFilters} onCreate={handleCreate} moderationQueue={isModerationQueue}/>) : (<>
                  <div className="exp-table" role="region" aria-label="Список заявок на расход">
                      <div className="exp-table__body">
                        <div className="exp-table__row exp-table__row--head" role="row">
                          <div className="exp-table__th exp-table__th--num" role="columnheader">
                            №
                          </div>
                          <div className="exp-table__th exp-table__th--desc" role="columnheader">
                            Описание
                          </div>
                          <div className="exp-table__th exp-table__th--author" role="columnheader">
                            Автор
                          </div>
                          <div className="exp-table__th exp-table__th--expdate" role="columnheader">
                            Дата расхода
                          </div>
                          <div className="exp-table__th exp-table__th--paydue" role="columnheader">
                            Срок оплаты
                          </div>
                          <div className="exp-table__th exp-table__th--type" role="columnheader">
                            Тип
                          </div>
                          <div className="exp-table__th exp-table__th--reimb" role="columnheader">
                            Возмещение
                          </div>
                          <div className="exp-table__th exp-table__th--status" role="columnheader">
                            Статус
                          </div>
                          <div className="exp-table__th exp-table__th--uzs" role="columnheader">
                            Сумма, UZS
                          </div>
                          <div className="exp-table__th exp-table__th--usd exp-table__th--rate" role="columnheader">
                            Эквивалент, USD
                          </div>
                          <div className="exp-table__th exp-table__th--action" role="columnheader">
                            <span className="exp-table__sr-only">Действия</span>
                          </div>
                        </div>
                        {filtered.map(r => (<ExpenseTableRow key={r.id} req={r} onOpen={handleOpenReq} canModerate={canModerate} currentUserId={user?.id ?? null} currentUserRole={user?.role ?? null} moderationBusyId={tableModerationBusyId} onApprove={handleTableApprove} onRejectClick={openTableReject} onReviseClick={openTableRevise} onPay={handleTablePay} onCloseLifecycle={handleTableCloseLifecycle} onDeleteClick={handleTableDeleteClick} isActionMenuOpen={expenseTableMenuForId === r.id} onToggleActionMenu={() => setExpenseTableMenuForId(prev => prev === r.id ? null : r.id)} onCloseActionMenu={() => setExpenseTableMenuForId(null)}/>))}
                      </div>
                    </div>
                  {listTotal != null && listTotal > 0 ? (<Pagination className="exp-cards-pager" page={listPage} totalCount={listTotal} pageSize={EXPENSES_LIST_PAGE_SIZE} onPageChange={setListPage} loading={listFetchPending}/>) : null}
                </>)}
            </>)}
        </div>
      </main>

      {tableOverlayOpen &&
            typeof document !== 'undefined' &&
            createPortal(<>
            {tableReject && (<div className="exp-mod-backdrop" role="presentation">
                <div className="exp-mod-dialog" role="dialog" aria-modal aria-labelledby="exp-table-reject-title" onClick={e => e.stopPropagation()}>
                  <h3 id="exp-table-reject-title" className="exp-mod-dialog__title">Отклонить заявку</h3>
                  <p className="exp-mod-dialog__sub">Заявка {tableReject.id}. Укажите причину — автор её увидит в истории.</p>
                  <textarea className="exp-mod-dialog__textarea" rows={4} placeholder="Причина отклонения" value={tableRejectReason} onChange={e => setTableRejectReason(e.target.value)} disabled={tableModBusy}/>
                  {tableModErr && <p className="exp-mod-err" role="alert">{tableModErr}</p>}
                  <div className="exp-mod-dialog__ft">
                    <button type="button" className="exp-panel-btn exp-panel-btn--ghost" disabled={tableModBusy} onClick={() => { setTableReject(null); setTableModErr(null); }}>Отмена</button>
                    <button type="button" className="exp-panel-btn exp-panel-btn--primary exp-panel-btn--danger" disabled={tableModBusy} onClick={confirmTableReject}>Отклонить</button>
                  </div>
                </div>
              </div>)}
            {tableRevise && (<div className="exp-mod-backdrop" role="presentation">
                <div className="exp-mod-dialog" role="dialog" aria-modal aria-labelledby="exp-table-revise-title" onClick={e => e.stopPropagation()}>
                  <h3 id="exp-table-revise-title" className="exp-mod-dialog__title">Вернуть на доработку</h3>
                  <p className="exp-mod-dialog__sub">Заявка {tableRevise.id}. Автор сможет исправить заявку и отправить снова.</p>
                  <textarea className="exp-mod-dialog__textarea" rows={4} placeholder="Что нужно исправить или дополнить" value={tableReviseComment} onChange={e => setTableReviseComment(e.target.value)} disabled={tableModBusy}/>
                  {tableModErr && <p className="exp-mod-err" role="alert">{tableModErr}</p>}
                  <div className="exp-mod-dialog__ft">
                    <button type="button" className="exp-panel-btn exp-panel-btn--ghost" disabled={tableModBusy} onClick={() => { setTableRevise(null); setTableModErr(null); }}>Отмена</button>
                    <button type="button" className="exp-panel-btn exp-panel-btn--primary" disabled={tableModBusy} onClick={confirmTableRevise}>Вернуть</button>
                  </div>
                </div>
              </div>)}
            {tableConfirm && (<ExpenseConfirmDialog isOpen title={tableConfirm.kind === 'approve'
                        ? 'Одобрить заявку?'
                        : tableConfirm.kind === 'pay'
                            ? 'Отметить оплату?'
                            : tableConfirm.kind === 'delete'
                                ? 'Удалить заявку?'
                                : 'Подтверждение'} message={tableConfirm.kind === 'approve' ? (<>
                      <p className="exp-mod-dialog__sub">Статус станет «Одобрено».</p>
                      {tableConfirm.req.isReimbursable ? (<p className="exp-mod-dialog__sub">
                          После одобрения, когда компания оплатит расход, откройте заявку и нажмите «Оплачено».
                        </p>) : null}
                    </>) : tableConfirm.kind === 'pay' ? (<p className="exp-mod-dialog__sub">Заявка будет переведена в статус «Выплачено».</p>) : tableConfirm.kind === 'delete' ? (<p className="exp-mod-dialog__sub">
                      Заявка {tableConfirm.req.id} будет удалена безвозвратно вместе с вложениями.
                    </p>) : (<p className="exp-mod-dialog__sub">{tableConfirm.message}</p>)} confirmLabel={tableConfirm.kind === 'approve'
                        ? 'Одобрить'
                        : tableConfirm.kind === 'pay'
                            ? 'Оплачено'
                            : tableConfirm.kind === 'delete'
                                ? 'Удалить'
                                : tableConfirm.confirmLabel} confirmVariant={tableConfirm.kind === 'delete' ? 'danger' : 'primary'} busy={tableModBusy} onClose={() => {
                        if (!tableModBusy)
                            setTableConfirm(null);
                    }} onConfirm={runTableConfirm}/>)}
          </>, document.body)}

      <ExpensesFormPanel isOpen={isPanelOpen} mode={panelMode} editingRequest={editingRequestForPanel} onClose={handleClosePanel} onSaveDraft={handleSaveDraft} onSubmit={handleSubmit} saveDraftPending={panelSavePending} submitPending={panelSubmitPending} onExpenseSnapshotUpdated={r => {
            setEditingReq(r);
            setRequests(prev => prev.map(x => (x.id === r.id ? r : x)));
        }} canModerate={canModerate} onExpenseUpdated={handleExpenseUpdated} onExpenseDeleted={handleExpenseDeleted} emailModerationIntent={emailModerationIntent} onEmailModerationIntentConsumed={() => setEmailModerationIntent(null)} allowPaymentReceiptUpload={allowPaymentReceiptUpload} onUploadPaymentReceipts={handleUploadPaymentReceipts} receiptUploadPending={receiptUploadPending} currentUserId={user?.id ?? null} currentUserRole={user?.role ?? null}/>

      <ExpensesReportModal isOpen={canModerate && isReportOpen} requests={requestsForUi} onClose={() => setIsReportOpen(false)}/>
    </div>);
}
export function ExpensesPage(props: ExpensesPageProps) {
    return (<ExpensesPageBoundary>
      <ExpensesPageInner {...props}/>
    </ExpensesPageBoundary>);
}
