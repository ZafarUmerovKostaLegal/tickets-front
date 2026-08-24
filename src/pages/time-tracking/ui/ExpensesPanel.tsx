import { useState, useMemo, useRef, useEffect, useLayoutEffect, useId, useCallback, lazy, Suspense } from 'react';
import { useCurrentUser } from '@shared/hooks';
import { fetchExpenseById, fetchExpenses, uploadAttachment } from '@entities/expenses/model/expensesApi';
import type { ExpenseFilesByKind, ExpenseFormValues, ExpenseRequest, ListParams } from '@entities/expenses/model/types';
import { asExpenseNumber } from '@entities/expenses/model/coerceExpense';
import { saveExpenseFromForm } from '@entities/expenses/model/saveExpenseFromForm';
import { canViewExpensesRequestsAndReport } from '@entities/expenses/model/expenseModeration';
import { expenseStatusLabel } from '@entities/expenses/model/expenseStatusLabels';
import { isModerationBlockedForOwnExpense, isReceiptUploadAllowedForExpenseStatus, resolveExpensePanelMode, } from '@entities/expenses/model/expenseStatusPolicy';
import { EXPENSE_STATUS_META } from '@entities/time-tracking/model/constants';
import type { ExpenseCategory, ExpenseStatus, ExpenseRow } from '@entities/time-tracking/model/types';
import { hasFullTimeTrackingTabs } from '@entities/time-tracking/model/timeTrackingAccess';
import { ExpensesSkeleton } from './ExpensesSkeleton';
import { loadTimesheetProjectOptions, type ProjectOption } from './timesheetProjectLoader';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { useI18n, ttExpenseCategoryLabel, ttExpenseStatusLabel, type TimeTrackingT } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';

const ExpensesFormPanel = lazy(() => import('@pages/expenses/ui/ExpensesFormPanel').then((m) => ({ default: m.ExpensesFormPanel })));
function expenseJournalProjectLabel(p: Pick<ProjectOption, 'name' | 'client'>): string {
    const c = (p.client || '').trim();
    return c ? `${p.name.trim()} (${c})` : p.name.trim();
}
function mapApiExpenseStatusToTt(status: string): ExpenseStatus {
    if (status === 'approved' || status === 'paid' || status === 'closed' || status === 'not_reimbursable') {
        return 'approved';
    }
    if (status === 'rejected' || status === 'withdrawn')
        return 'rejected';
    return 'pending';
}
function mapExpenseTypeToCategory(t: string): ExpenseCategory {
    const u = t.toLowerCase();
    if (u.includes('transport'))
        return 'Транспорт';
    if (u.includes('food'))
        return 'Питание';
    if (u.includes('accommodation') || u.includes('travel'))
        return 'Командировка';
    if (u.includes('office') || u.includes('purchase'))
        return 'Офис';
    if (u.includes('service'))
        return 'ПО и сервисы';
    if (u.includes('entertain'))
        return 'Представительские';
    if (u.includes('client_expense'))
        return 'Прочее';
    return 'Прочее';
}
function expenseRequestToExpenseRow(req: ExpenseRequest, projectLine: string, projectCurrencyCode: string, t: TimeTrackingT): ExpenseRow {
    const author = req.createdBy?.displayName?.trim() ||
        req.createdBy?.email?.trim() ||
        t('timeTrackingPage.expenses.errors.userFallback').replace('{id}', String(req.createdByUserId));
    const parts = author.split(/\s+/).filter(Boolean);
    const initials = parts.length >= 2
        ? `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase()
        : (parts[0]?.charAt(0).toUpperCase() ?? '?');
    const uzsAmt = asExpenseNumber(req.amountUzs);
    const eqBook = asExpenseNumber(req.equivalentAmount);
    const rate = asExpenseNumber(req.exchangeRate);

    const bookFallbackUsd = rate > 0 ? uzsAmt / rate : uzsAmt;
    const cur = (projectCurrencyCode || 'USD').trim().toUpperCase() || 'USD';
    const uzsRounded = uzsAmt > 0 ? Math.round(uzsAmt) : 0;
    const amountBookNonUzs = eqBook > 0 ? eqBook : bookFallbackUsd;

    return {
        id: req.id,
        date: req.expenseDate.slice(0, 10),
        employee: author,
        initials,
        category: mapExpenseTypeToCategory(req.expenseType),
        description: req.description?.trim() || req.businessPurpose?.trim() || '—',
        amount: cur === 'UZS' ? (uzsRounded > 0 ? uzsRounded : amountBookNonUzs) : amountBookNonUzs,
        currency: cur,
        paidInUzs: cur !== 'UZS' ? (uzsRounded > 0 ? uzsRounded : undefined) : undefined,
        status: mapApiExpenseStatusToTt(req.status),
        billable: req.isReimbursable,
        project: projectLine || undefined,
    };
}
const JOURNAL_PROJECT_STORAGE = 'tt_expenses_journal_project_id';
function readStoredJournalProjectId(): string {
    try {
        const raw = sessionStorage.getItem(JOURNAL_PROJECT_STORAGE)?.trim();
        return raw && raw.length > 0 ? raw : '';
    }
    catch {
        return '';
    }
}
function pickDefaultJournalProjectId(opts: ProjectOption[]): string {
    const sorted = [...opts].sort((a, b) => {
        const ca = (a.client || '').localeCompare(b.client || '', 'ru', { sensitivity: 'base' });
        if (ca !== 0)
            return ca;
        return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
    });
    return sorted[0]?.id ?? '';
}
function getWeekMonday(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
}
function fmtWeekRange(mondayStr: string, locale: 'ru' | 'en'): string {
    const tag = localeTag(locale);
    const start = new Date(mondayStr + 'T00:00:00');
    const end = new Date(mondayStr + 'T00:00:00');
    end.setDate(end.getDate() + 6);
    const s = start.toLocaleDateString(tag, { day: 'numeric', month: 'short' });
    const e = end.toLocaleDateString(tag, { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
}
function fmtRowDate(dateStr: string, locale: 'ru' | 'en') {
    const tag = localeTag(locale);
    const d = new Date(dateStr + 'T00:00:00');
    return {
        weekday: d.toLocaleDateString(tag, { weekday: 'short' }),
        dayMonth: d.toLocaleDateString(tag, { day: 'numeric', month: 'short' }),
    };
}
function fmtAmt(n: number, cur = 'UZS') {
    const c = cur.trim().toUpperCase();
    const useDecimals = /^USD|EUR|GBP|RUB$/.test(c);
    const opts = useDecimals
        ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const
        : { maximumFractionDigits: 2 } as const;
    return `${n.toLocaleString('ru-RU', opts)} ${cur}`;
}
function weekStatus(statuses: ExpenseStatus[]): ExpenseStatus {
    if (statuses.some(s => s === 'pending'))
        return 'pending';
    if (statuses.some(s => s === 'rejected'))
        return 'rejected';
    return 'approved';
}
const IcoPlus = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>);
const IcoChevron = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M6 9l6 6 6-6"/>
  </svg>);
const IcoPaperclip = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>);
export type ExpensesPanelProps = {
    managedExpenseAuthorId?: number | null;
};
export function ExpensesPanel({ managedExpenseAuthorId = null }: ExpensesPanelProps = {}) {
    const { t, locale } = useI18n();
    const scopeFieldId = useId();
    const journalFieldId = useId();
    const journalProjectHintId = `${journalFieldId}-hint`;
    const { user: currentUser, loading: userLoading } = useCurrentUser();
    const [projectOpts, setProjectOpts] = useState<ProjectOption[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsErr, setProjectsErr] = useState<string | null>(null);
    const [listRows, setListRows] = useState<ExpenseRow[]>([]);
    const [rawById, setRawById] = useState<Map<string, ExpenseRequest>>(new Map());
    const [listErr, setListErr] = useState<string | null>(null);
    const [listLoading, setListLoading] = useState(true);
    const [journalProjectId, setJournalProjectId] = useState('');
    const isTtManager = Boolean(currentUser && hasFullTimeTrackingTabs(currentUser));
    const canModerateExpenses = canViewExpensesRequestsAndReport(currentUser?.role);
    const projectLineById = useMemo(() => {
        const m = new Map<string, string>();
        for (const p of projectOpts) {
            m.set(p.id, expenseJournalProjectLabel(p));
        }
        return m;
    }, [projectOpts]);
    const journalCurrencyCode = useMemo(() => (projectOpts.find((x) => x.id === journalProjectId)?.currency ?? 'USD').trim(), [projectOpts, journalProjectId]);
    useEffect(() => {
        if (userLoading || !currentUser) {
            setProjectOpts([]);
            setProjectsErr(null);
            setProjectsLoading(false);
            return;
        }
        let cancelled = false;
        setProjectsLoading(true);
        setProjectsErr(null);
        void loadTimesheetProjectOptions(currentUser, locale).then(({ items, error }) => {
            if (cancelled)
                return;
            setProjectOpts(items);
            setProjectsErr(error);
            setProjectsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [currentUser, userLoading, locale]);
    useLayoutEffect(() => {
        if (userLoading || !currentUser || projectsLoading)
            return;
        if (projectOpts.length === 0) {
            setJournalProjectId((prev) => (prev === '' ? prev : ''));
            return;
        }
        const ids = new Set(projectOpts.map((p) => p.id));
        setJournalProjectId((prev) => {
            if (prev && ids.has(prev))
                return prev;
            const stored = readStoredJournalProjectId();
            if (stored && ids.has(stored))
                return stored;
            return pickDefaultJournalProjectId(projectOpts);
        });
    }, [userLoading, currentUser, projectsLoading, projectOpts]);
    useEffect(() => {
        try {
            if (!journalProjectId)
                sessionStorage.removeItem(JOURNAL_PROJECT_STORAGE);
            else
                sessionStorage.setItem(JOURNAL_PROJECT_STORAGE, journalProjectId);
        }
        catch {
        }
    }, [journalProjectId]);
    const [panelOpen, setPanelOpen] = useState(false);
    const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
    const [panelExpense, setPanelExpense] = useState<ExpenseRequest | null>(null);
    const [panelSavePending, setPanelSavePending] = useState(false);
    const [panelSubmitPending, setPanelSubmitPending] = useState(false);
    const [receiptUploadPending, setReceiptUploadPending] = useState(false);
    const [actionErr, setActionErr] = useState<string | null>(null);
    const panelActionRef = useRef<'idle' | 'save' | 'submit'>('idle');
    const [listVersion, setListVersion] = useState(0);
    useEffect(() => {
        if (userLoading || !currentUser) {
            setListRows([]);
            setRawById(new Map());
            setListErr(null);
            setListLoading(false);
            return;
        }
        if (projectsLoading) {
            setListLoading(true);
            return;
        }
        if (!journalProjectId) {
            setListRows([]);
            setRawById(new Map());
            setListErr(null);
            setListLoading(false);
            return;
        }
        let cancelled = false;
        setListLoading(true);
        setListErr(null);
        const params: ListParams = {
            limit: 200,
            sortBy: 'createdAt',
            sortOrder: 'desc',
            projectId: journalProjectId,
        };
        const emp = managedExpenseAuthorId;
        if (isTtManager &&
            emp != null &&
            emp > 0 &&
            emp !== currentUser.id) {
            params.employeeUserId = emp;
        }
        void fetchExpenses(params)
            .then((res) => {
            if (cancelled)
                return;
            const pid = journalProjectId;
            const items = res.items.filter((r) => r.projectId === pid);
            setListRows(items.map((r) => expenseRequestToExpenseRow(r, projectLineById.get(r.projectId ?? '') ||
                (r.projectId ? t('timeTrackingPage.expenses.errors.projectFallback').replace('{id}', String(r.projectId).slice(0, 8)) : '—'), journalCurrencyCode, t)));
            setRawById(new Map(items.map((r) => [r.id, r])));
        })
            .catch((e: unknown) => {
            if (cancelled)
                return;
            setListRows([]);
            setRawById(new Map());
            const msg = e instanceof Error ? e.message : t('timeTrackingPage.expenses.errors.loadFailed');
            setListErr(/403|forbidden|недостаточно|запрещ/i.test(msg)
                ? `${msg}${t('timeTrackingPage.expenses.errors.listAccessSuffix')}`
                : msg);
        })
            .finally(() => {
            if (!cancelled)
                setListLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [
        userLoading,
        currentUser,
        projectsLoading,
        journalProjectId,
        projectLineById,
        journalCurrencyCode,
        managedExpenseAuthorId,
        isTtManager,
        listVersion,
        t,
    ]);
    const refreshList = useCallback(() => {
        setListVersion((v) => v + 1);
    }, []);
    const openForm = useCallback(() => {
        setActionErr(null);
        setPanelExpense(null);
        setPanelMode('create');
        setPanelOpen(true);
    }, []);
    const openExpense = useCallback((expense: ExpenseRequest) => {
        setActionErr(null);
        const mode = resolveExpensePanelMode(expense.status);
        setPanelExpense(expense);
        setPanelMode(mode);
        setPanelOpen(true);
        // The list payload omits the card number; the edit form needs the full record.
        if (mode === 'edit' && expense.reimbursementCardNumber === undefined) {
            void fetchExpenseById(expense.id)
                .then((full) => setPanelExpense(full))
                .catch(() => undefined);
        }
    }, []);
    const closePanel = useCallback(() => {
        setPanelOpen(false);
        setPanelExpense(null);
    }, []);
    const persistFromPanel = useCallback(async (values: ExpenseFormValues, files: ExpenseFilesByKind, submit: boolean) => {
        if (panelActionRef.current !== 'idle')
            return;
        panelActionRef.current = submit ? 'submit' : 'save';
        const setPending = submit ? setPanelSubmitPending : setPanelSavePending;
        setPending(true);
        setActionErr(null);
        try {
            await saveExpenseFromForm({
                values,
                files,
                expenseId: panelExpense?.id ?? null,
                submit,
            });
            refreshList();
            closePanel();
        }
        catch (err) {
            setActionErr(err instanceof Error ? err.message : t('timeTrackingPage.expenses.errors.saveFailed'));
        }
        finally {
            panelActionRef.current = 'idle';
            setPending(false);
        }
    }, [panelExpense, refreshList, closePanel, t]);
    const handleSaveDraft = useCallback((values: ExpenseFormValues, files: ExpenseFilesByKind) => {
        void persistFromPanel(values, files, false);
    }, [persistFromPanel]);
    const handleSubmitExpense = useCallback((values: ExpenseFormValues, files: ExpenseFilesByKind) => {
        void persistFromPanel(values, files, true);
    }, [persistFromPanel]);
    const applyPanelExpenseSnapshot = useCallback((expense: ExpenseRequest) => {
        setPanelExpense(expense);
        refreshList();
    }, [refreshList]);
    const handleExpenseDeleted = useCallback(() => {
        closePanel();
        refreshList();
    }, [closePanel, refreshList]);
    const allowPaymentReceiptUpload = useMemo(() => {
        if (!panelExpense || !currentUser)
            return false;
        if (!isReceiptUploadAllowedForExpenseStatus(panelExpense.status))
            return false;
        if (currentUser.id === panelExpense.createdByUserId)
            return true;
        if (!canModerateExpenses)
            return false;
        return !isModerationBlockedForOwnExpense(canModerateExpenses, currentUser.id, panelExpense);
    }, [panelExpense, currentUser, canModerateExpenses]);
    const handleUploadPaymentReceipts = useCallback(async (files: File[]) => {
        if (!panelExpense || files.length === 0)
            return;
        setReceiptUploadPending(true);
        setActionErr(null);
        try {
            let last = panelExpense;
            for (const file of files) {
                last = await uploadAttachment(last.id, file, 'payment_receipt');
            }
            setPanelExpense(last);
            refreshList();
        }
        catch (err) {
            setActionErr(err instanceof Error ? err.message : t('timeTrackingPage.expenses.errors.saveFailed'));
            throw err;
        }
        finally {
            setReceiptUploadPending(false);
        }
    }, [panelExpense, refreshList, t]);
    const panelPresetValues = useMemo(() => ({
        expenseType: 'client_expense',
        isReimbursable: true,
        projectId: journalProjectId,
    }), [journalProjectId]);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    function toggleWeek(key: string) {
        setCollapsed(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }
    const grouped = useMemo(() => {
        const map = new Map<string, ExpenseRow[]>();
        for (const exp of listRows) {
            const key = getWeekMonday(exp.date);
            if (!map.has(key))
                map.set(key, []);
            map.get(key)!.push(exp);
        }
        return Array.from(map.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([weekKey, exps]) => ({
            weekKey,
            label: fmtWeekRange(weekKey, locale),
            exps: exps.sort((a, b) => b.date.localeCompare(a.date)),
            total: exps.reduce((s, e) => s + e.amount, 0),
            status: weekStatus(exps.map(e => e.status)),
            currency: exps[0]?.currency ?? 'UZS',
        }));
    }, [listRows, locale]);
    const journalOptionsSorted = useMemo(() => {
        return [...projectOpts].sort((a, b) => {
            const ca = (a.client || '').localeCompare(b.client || '', 'ru', { sensitivity: 'base' });
            if (ca !== 0)
                return ca;
            return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
        });
    }, [projectOpts]);
    const journalHeadingLine = useMemo(() => {
        if (!journalProjectId)
            return '';
        const p = projectOpts.find((x) => x.id === journalProjectId);
        if (!p)
            return '';
        return expenseJournalProjectLabel(p);
    }, [journalProjectId, projectOpts]);
    const journalProjectHue = useMemo(() => {
        const p = projectOpts.find((x) => x.id === journalProjectId);
        return p?.color ?? 'var(--app-accent, #4f46e5)';
    }, [journalProjectId, projectOpts]);
    const isEmpty = listRows.length === 0;
    const showListSkeleton = userLoading || projectsLoading || (Boolean(journalProjectId) && listLoading);
    const canPickProject = !projectsLoading && projectOpts.length > 0;
    const canAddExpense = Boolean(journalProjectId) && canPickProject;
    if (showListSkeleton)
        return <ExpensesSkeleton />;
    const sectionTitleId = `${scopeFieldId}-section`;
    return (<div className="time-page__panel tt-exp-panel">
      <div className="tt-exp-panel__shell">
        <div className="tt-exp-panel__toolbar">
          <div className="tt-exp-panel__toolbar-left">
            <h1 className="tt-exp-panel__heading">{t('timeTrackingPage.expenses.title')}</h1>
          </div>
          <div className="tt-exp-panel__toolbar-right">
            <button type="button" className="tt-exp-panel__add-btn" disabled={!canAddExpense} title={!canAddExpense ? t('timeTrackingPage.expenses.journal.selectProjectFirst') : undefined} onClick={openForm}>
              <IcoPlus />
              {t('timeTrackingPage.expenses.addExpense')}
            </button>
          </div>
        </div>

        <div className="tt-exp-panel__sections">
          <section className="tt-exp-panel__section" aria-labelledby={sectionTitleId}>
            <div className="tt-exp-panel__section-head tt-exp-panel__section-head--journal">
              <div className="tt-exp-panel__journal-head-text">
                <h2 id={sectionTitleId} className="tt-exp-panel__section-title">
                  {t('timeTrackingPage.expenses.journal.title')}
                </h2>
                {journalHeadingLine ? (<p className="tt-exp-panel__section-subtitle">{journalHeadingLine}</p>) : (<p className="tt-exp-panel__section-subtitle tt-exp-panel__section-subtitle--muted">
                    {t('timeTrackingPage.expenses.journal.subtitleMuted')}
                  </p>)}
              </div>
              <div className="tt-exp-panel__journal-project">
                <div className="tt-exp-panel__journal-project-line">
                  <label className="tt-exp-panel__journal-project-label" htmlFor={journalFieldId}>
                    {t('timeTrackingPage.common.project')}
                  </label>
                  <span className="tt-exp-panel__project-scope-dot" style={{ background: journalProjectHue }} title={journalHeadingLine || undefined} aria-hidden/>
                </div>
                <div className="tt-exp-panel__project-scope-select-wrap">
                  <SearchableSelect<ProjectOption> className="tt-exp-panel__project-scope-srch" buttonClassName="tt-exp-panel__project-scope-srch-btn" buttonId={journalFieldId} disabled={!canPickProject} placeholder={projectsLoading
            ? t('timeTrackingPage.expenses.journal.loadingProjects')
            : projectOpts.length === 0
                ? t('timeTrackingPage.expenses.journal.noProjects')
                : t('timeTrackingPage.common.selectProject')} emptyListText={projectsLoading ? t('timeTrackingPage.common.loading') : t('timeTrackingPage.expenses.journal.noProjects')} noMatchText={t('timeTrackingPage.common.projectNotFound')} value={canPickProject ? journalProjectId : ''} items={canPickProject ? journalOptionsSorted : []} getOptionValue={(p) => p.id} getOptionLabel={expenseJournalProjectLabel} getSearchText={(p) => `${p.name} ${p.client}`.replace(/\s+/g, ' ').trim()} onSelect={(p) => setJournalProjectId(p.id)} aria-describedby={journalProjectHintId}/>
                </div>
                <p id={journalProjectHintId} className="tt-exp-panel__project-scope-hint">
                  {t('timeTrackingPage.expenses.journal.projectHint')}
                </p>
                {projectsErr && (<p className="tt-exp-panel__project-scope-err" role="alert">
                    {projectsErr}
                  </p>)}
              </div>
            </div>
            {listErr && (<div className="tt-exp-panel__list-err" role="alert">
                {listErr}
              </div>)}
            {actionErr && (<div className="tt-exp-panel__list-err" role="alert">
                {actionErr}
              </div>)}
            <div className="tt-exp-panel__section-body">
              {!canPickProject && !projectsLoading ? (<div className="tt-exp-panel__list-empty">
                  <div className="tt-exp-panel__empty-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  </div>
                  <p className="tt-exp-panel__empty-title">{t('timeTrackingPage.expenses.empty.noProjectTitle')}</p>
                  <p className="tt-exp-panel__empty-desc">
                    {t('timeTrackingPage.expenses.empty.noProjectDesc')}
                  </p>
                </div>) : isEmpty ? (<div className="tt-exp-panel__list-empty">
                  <div className="tt-exp-panel__empty-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <line x1="10" y1="9" x2="8" y2="9"/>
                    </svg>
                  </div>
                  <p className="tt-exp-panel__empty-title">{t('timeTrackingPage.expenses.empty.noExpensesTitle')}</p>
                  <p className="tt-exp-panel__empty-desc">
                    {t('timeTrackingPage.expenses.empty.noExpensesDesc')}
                  </p>
                  <p className="tt-exp-panel__empty-hint">
                    {t('timeTrackingPage.expenses.empty.noExpensesHint')}
                  </p>
                </div>) : (<div className="tt-exp-panel__weeks">
                  {grouped.map((group) => {
                const statusMeta = EXPENSE_STATUS_META[group.status];
                const isCollapsed = collapsed.has(group.weekKey);
                return (<div key={group.weekKey} className={`exp__week${isCollapsed ? ' exp__week--collapsed' : ''}`}>

            <div className="exp__week-head" onClick={() => toggleWeek(group.weekKey)} role="button" tabIndex={0} aria-expanded={!isCollapsed} onKeyDown={e => e.key === 'Enter' || e.key === ' ' ? toggleWeek(group.weekKey) : undefined}>
              <div className="exp__week-head-left">
                <span className={`exp__week-chevron${isCollapsed ? '' : ' exp__week-chevron--open'}`}>
                  <IcoChevron />
                </span>
                <span className="exp__week-range">{group.label}</span>
                <span className={`exp__week-badge exp__week-badge--${group.status}`} style={{ color: statusMeta.color, background: statusMeta.bg }}>
                  {ttExpenseStatusLabel(group.status, t)}
                </span>
              </div>
              <div className="exp__week-head-right">
                {isCollapsed && (<span className="exp__week-head-total">{fmtAmt(group.total, group.currency)}</span>)}
              </div>
            </div>

            {!isCollapsed && group.exps.map(exp => {
                        const { weekday, dayMonth } = fmtRowDate(exp.date, locale);
                        const raw = rawById.get(exp.id);
                        const openRow = () => {
                            if (raw)
                                openExpense(raw);
                        };
                        return (<div key={exp.id} className="exp__item" onClick={openRow} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openRow()}>
                  <span className="exp__item-date">
                    <span className="exp__item-weekday">{weekday},</span>
                    <span className="exp__item-day">{dayMonth}</span>
                  </span>

                  <div className="exp__item-info">
                    <div className="exp__item-line1">
                      <span className="exp__item-proj">{exp.project ?? '—'}</span>
                      {exp.client && (<span className="exp__item-client">({exp.client})</span>)}
                    </div>
                    <div className="exp__item-line2">
                      <span className="exp__item-cat">{ttExpenseCategoryLabel(exp.category, t)}</span>
                      {exp.billable && (<span className="exp__item-billable-badge">{t('timeTrackingPage.common.billable')}</span>)}
                      {raw && (<span className="exp__item-status" style={{
                            color: EXPENSE_STATUS_META[exp.status].color,
                            background: EXPENSE_STATUS_META[exp.status].bg,
                        }}>
                          {expenseStatusLabel(raw)}
                        </span>)}
                    </div>
                    {exp.description && (<div className="exp__item-notes">{exp.description}</div>)}
                  </div>

                  <div className="exp__item-right">
                    <span className="exp__item-amount">{fmtAmt(exp.amount, exp.currency)}</span>
                    {(raw?.attachmentsCount ?? 0) > 0 && (<span className="exp__item-icon" title={t('timeTrackingPage.expenses.detail.attachment')} aria-label={t('timeTrackingPage.expenses.detail.attachment')}>
                      <IcoPaperclip />
                    </span>)}
                  </div>
                </div>);
                    })}

            {!isCollapsed && (<div className="exp__week-total">
                <span className="exp__week-total-label">{t('timeTrackingPage.expenses.journalWeek.total')}</span>
                <span className="exp__week-total-val">{fmtAmt(group.total, group.currency)}</span>
              </div>)}
          </div>);
            })}
                </div>)}
            </div>
          </section>
        </div>
      </div>

      {panelOpen && (<Suspense fallback={null}>
        <ExpensesFormPanel
          isOpen
          mode={panelMode}
          editingRequest={panelExpense}
          onClose={closePanel}
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmitExpense}
          saveDraftPending={panelSavePending}
          submitPending={panelSubmitPending}
          onExpenseSnapshotUpdated={applyPanelExpenseSnapshot}
          canModerate={canModerateExpenses}
          onExpenseUpdated={applyPanelExpenseSnapshot}
          onExpenseDeleted={handleExpenseDeleted}
          allowPaymentReceiptUpload={allowPaymentReceiptUpload}
          onUploadPaymentReceipts={handleUploadPaymentReceipts}
          receiptUploadPending={receiptUploadPending}
          currentUserId={currentUser?.id ?? null}
          currentUserRole={currentUser?.role ?? null}
          currentUserEmail={currentUser?.email ?? null}
          presetValues={panelPresetValues}
        />
      </Suspense>)}
    </div>);
}
