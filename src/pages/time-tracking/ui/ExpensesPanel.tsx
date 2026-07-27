import { useState, useMemo, useRef, useEffect, useLayoutEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCurrentUser } from '@shared/hooks';
import { listProjectExpenseCategories, type ProjectExpenseCategoryRow, } from '@entities/time-tracking';
import { createExpense, fetchExpenses, submitExpense, uploadAttachment, } from '@entities/expenses/model/expensesApi';
import type { ExpenseRequest, ListParams } from '@entities/expenses/model/types';
import { asExpenseNumber } from '@entities/expenses/model/coerceExpense';
import { computeAmountUzsForApi } from '@entities/expenses/model/expenseCurrency';
import { fetchCbuParsedForDate, foreignUnitsPerUsd, type CbuParsed } from '@entities/expenses/model/cbuRates';
import { EXPENSE_STATUS_META, EXPENSE_CATEGORY_META } from '@entities/time-tracking/model/constants';
import type { ExpenseCategory, ExpenseStatus, ExpenseRow } from '@entities/time-tracking/model/types';
import { hasFullTimeTrackingTabs } from '@entities/time-tracking/model/timeTrackingAccess';
import { ExpensesSkeleton } from './ExpensesSkeleton';
import { loadTimesheetProjectOptions, type ProjectOption } from './timesheetProjectLoader';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { useI18n, ttExpenseCategoryLabel, ttExpenseStatusLabel, type TimeTrackingT } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
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
function sortProjectExpenseCategories(a: ProjectExpenseCategoryRow, b: ProjectExpenseCategoryRow): number {
    return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
}
const todayStr = new Date().toISOString().slice(0, 10);
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
function projectBookHintFromUzs(parsed: CbuParsed | null, uzsInput: string, projectCurRaw: string, locale: 'ru' | 'en', t: TimeTrackingT): string | null {
    if (!parsed || !(parsed.uzsPerUsd > 0))
        return null;
    const amt = parseFloat(String(uzsInput).replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(amt) || amt <= 0)
        return null;
    const tag = localeTag(locale);
    const p = projectCurRaw.trim().toUpperCase() || 'USD';
    const equivUsd = amt / parsed.uzsPerUsd;
    if (p === 'UZS') {
        return t('timeTrackingPage.expenses.form.bookHints.journalUzs')
            .replace('{amount}', Math.round(amt).toLocaleString(tag));
    }
    if (p === 'USD') {
        return t('timeTrackingPage.expenses.form.bookHints.projectUsd')
            .replace('{amount}', equivUsd.toLocaleString(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
    const k = foreignUnitsPerUsd(parsed, p);
    if (k == null || k <= 0) {
        return t('timeTrackingPage.expenses.form.bookHints.cbuNoRate')
            .replace('{amount}', equivUsd.toLocaleString(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
            .replace('{currency}', p);
    }
    const inProj = equivUsd * k;
    return t('timeTrackingPage.expenses.form.bookHints.projectCurrency')
        .replace('{amount}', inProj.toLocaleString(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
        .replace('{currency}', p);
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
const IcoCheck = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>);
const IcoPaperclip = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>);
const IcoLock = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>);
export type ExpensesPanelProps = {
    managedExpenseAuthorId?: number | null;
};
export function ExpensesPanel({ managedExpenseAuthorId = null }: ExpensesPanelProps = {}) {
    const { t, locale } = useI18n();
    const scopeFieldId = useId();
    const journalFieldId = useId();
    const expenseFormAmountFieldId = useId();
    const journalProjectHintId = `${journalFieldId}-hint`;
    const { user: currentUser, loading: userLoading } = useCurrentUser();
    const [projectOpts, setProjectOpts] = useState<ProjectOption[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsErr, setProjectsErr] = useState<string | null>(null);
    const [listRows, setListRows] = useState<ExpenseRow[]>([]);
    const [listErr, setListErr] = useState<string | null>(null);
    const [listLoading, setListLoading] = useState(true);
    const [journalProjectId, setJournalProjectId] = useState('');
    const isTtManager = Boolean(currentUser && hasFullTimeTrackingTabs(currentUser));
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
    const [showForm, setShowForm] = useState(false);
    const [formDate, setFormDate] = useState(todayStr);
    const [formProject, setFormProject] = useState('');
    const [formCat, setFormCat] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [formAmount, setFormAmount] = useState('');
    const [formBillable, setFormBillable] = useState(true);
    const [formFile, setFormFile] = useState<File | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [expenseCategories, setExpenseCategories] = useState<ProjectExpenseCategoryRow[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [categoriesErr, setCategoriesErr] = useState<string | null>(null);
    const [detailExp, setDetailExp] = useState<ExpenseRow | null>(null);
    const [listVersion, setListVersion] = useState(0);
    const [formBusy, setFormBusy] = useState(false);
    const [formErr, setFormErr] = useState<string | null>(null);
    const [formCbu, setFormCbu] = useState<CbuParsed | null>(null);
    const [formCbuErr, setFormCbuErr] = useState<string | null>(null);
    const [formCbuLoading, setFormCbuLoading] = useState(false);
    useEffect(() => {
        if (!formProject) {
            setExpenseCategories([]);
            setCategoriesErr(null);
            setCategoriesLoading(false);
            return;
        }
        let cancelled = false;
        setCategoriesLoading(true);
        setCategoriesErr(null);
        void listProjectExpenseCategories(formProject)
            .then((rows) => {
            if (cancelled)
                return;
            setExpenseCategories(rows.filter((c) => !c.isArchived).sort(sortProjectExpenseCategories));
        })
            .catch((e) => {
            if (!cancelled) {
                setExpenseCategories([]);
                setCategoriesErr(e instanceof Error ? e.message : t('timeTrackingPage.expenses.errors.loadCategoriesFailed'));
            }
        })
            .finally(() => {
            if (!cancelled)
                setCategoriesLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [formProject, t]);
    useEffect(() => {
        if (formCat && !expenseCategories.some((c) => c.id === formCat)) {
            setFormCat('');
        }
    }, [formCat, expenseCategories]);
    useEffect(() => {
        if (userLoading || !currentUser) {
            setListRows([]);
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
            const rows = res.items
                .filter((r) => r.projectId === pid)
                .map((r) => expenseRequestToExpenseRow(r, projectLineById.get(r.projectId ?? '') ||
                (r.projectId ? t('timeTrackingPage.expenses.errors.projectFallback').replace('{id}', String(r.projectId).slice(0, 8)) : '—'), journalCurrencyCode, t));
            setListRows(rows);
        })
            .catch((e: unknown) => {
            if (cancelled)
                return;
            setListRows([]);
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
    const cancelForm = useCallback(() => {
        if (formBusy)
            return;
        setFormErr(null);
        setShowForm(false);
    }, [formBusy]);
    useEffect(() => {
        if (!showForm)
            return;
        const h = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !formBusy)
                cancelForm();
        };
        document.addEventListener('keydown', h);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', h);
            document.body.style.overflow = '';
        };
    }, [showForm, formBusy, cancelForm]);
    useEffect(() => {
        if (!detailExp)
            return;
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape')
            setDetailExp(null); };
        document.addEventListener('keydown', h);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', h);
            document.body.style.overflow = '';
        };
    }, [detailExp]);
    useEffect(() => {
        if (!showForm || !formDate.trim()) {
            setFormCbu(null);
            setFormCbuErr(null);
            setFormCbuLoading(false);
            return;
        }
        let cancelled = false;
        setFormCbuLoading(true);
        setFormCbuErr(null);
        void fetchCbuParsedForDate(formDate.trim().slice(0, 10))
            .then((parsed) => {
                if (!cancelled)
                    setFormCbu(parsed);
            })
            .catch((e: unknown) => {
                if (!cancelled) {
                    setFormCbu(null);
                    setFormCbuErr(e instanceof Error ? e.message : t('timeTrackingPage.expenses.errors.loadCbuFailed'));
                }
            })
            .finally(() => {
                if (!cancelled)
                    setFormCbuLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [showForm, formDate, t]);
    function openForm() {
        setFormErr(null);
        setFormDate(todayStr);
        setFormProject(journalProjectId);
        setFormCat('');
        setFormNotes('');
        setFormAmount('');
        setFormBillable(true);
        setFormFile(null);
        setShowForm(true);
    }
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    function toggleWeek(key: string) {
        setCollapsed(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }
    async function saveForm(e: React.FormEvent) {
        e.preventDefault();
        setFormErr(null);
        if (!currentUser) {
            setFormErr(t('timeTrackingPage.expenses.errors.noUser'));
            return;
        }
        if (!formProject.trim()) {
            setFormErr(t('timeTrackingPage.expenses.errors.selectProject'));
            return;
        }
        if (!formDate.trim()) {
            setFormErr(t('timeTrackingPage.expenses.errors.dateRequired'));
            return;
        }
        const amt = parseFloat(formAmount.replace(',', '.'));
        if (!formAmount.trim() || Number.isNaN(amt) || amt <= 0) {
            setFormErr(t('timeTrackingPage.expenses.errors.amountRequired'));
            return;
        }
        if (formBillable && expenseCategories.length > 0 && !formCat.trim()) {
            setFormErr(t('timeTrackingPage.expenses.errors.categoryRequired'));
            return;
        }
        if (formBillable && !formFile) {
            setFormErr(t('timeTrackingPage.expenses.errors.documentRequired'));
            return;
        }
        if (formCbuLoading) {
            setFormErr(t('timeTrackingPage.expenses.errors.cbuLoading'));
            return;
        }
        if (!formCbu || !(formCbu.uzsPerUsd > 0)) {
            setFormErr(formCbuErr ?? t('timeTrackingPage.expenses.errors.cbuFailed'));
            return;
        }
        setFormBusy(true);
        try {
            const amountNorm = formAmount.replace(/\s/g, '').replace(',', '.').trim();
            const amountUzsForApi = Math.round(computeAmountUzsForApi('UZS', amountNorm, String(formCbu.uzsPerUsd), ''));
            if (!amountUzsForApi || amountUzsForApi <= 0) {
                setFormErr(t('timeTrackingPage.expenses.errors.uzsAmountInvalid'));
                return;
            }
            const description = formNotes.trim() || t('timeTrackingPage.expenses.errors.defaultDescription');
            const expenseType = formBillable ? 'client_expense' : 'purchase';
            const body = {
                description,
                expenseDate: formDate,
                paymentDeadline: null as string | null,
                amountUzs: amountUzsForApi,
                exchangeRate: formCbu.uzsPerUsd,
                expenseType,
                isReimbursable: formBillable,
                projectId: formProject.trim(),
                expenseCategoryId: formBillable && formCat.trim() ? formCat.trim() : undefined,
                comment: formNotes.trim() || undefined,
            };
            let saved = await createExpense(body);
            if (formFile) {
                saved = await uploadAttachment(saved.id, formFile, formBillable ? 'payment_document' : 'payment_receipt');
            }
            if (saved.status !== 'approved') {
                await submitExpense(saved.id);
            }
            setListVersion((v) => v + 1);
            setShowForm(false);
            setFormFile(null);
        }
        catch (err) {
            setFormErr(err instanceof Error ? err.message : t('timeTrackingPage.expenses.errors.saveFailed'));
        }
        finally {
            setFormBusy(false);
        }
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
    const formProjectCurrency = useMemo(() => (projectOpts.find((p) => p.id === formProject)?.currency ?? 'USD').trim().toUpperCase() || 'USD', [projectOpts, formProject]);
    const formPaymentBookHint = useMemo(() => projectBookHintFromUzs(formCbu, formAmount, formProjectCurrency, locale, t), [formCbu, formAmount, formProjectCurrency, locale, t]);
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
              <div className="exp__week-head-right" onClick={e => e.stopPropagation()}>
                {isCollapsed && (<span className="exp__week-head-total">{fmtAmt(group.total, group.currency)}</span>)}
                {group.status === 'approved' && (<button type="button" className="exp__week-withdraw">
                    {t('timeTrackingPage.expenses.journalWeek.withdrawApproval')}
                  </button>)}
              </div>
            </div>

            {!isCollapsed && group.exps.map(exp => {
                        const { weekday, dayMonth } = fmtRowDate(exp.date, locale);
                        return (<div key={exp.id} className="exp__item" onClick={() => setDetailExp(exp)} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setDetailExp(exp)}>
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
                    </div>
                    {exp.description && (<div className="exp__item-notes">{exp.description}</div>)}
                  </div>

                  <div className="exp__item-right" onClick={e => e.stopPropagation()}>
                    <span className="exp__item-amount">{fmtAmt(exp.amount, exp.currency)}</span>
                    <button type="button" className="exp__item-icon" title={t('timeTrackingPage.expenses.detail.attachment')} aria-label={t('timeTrackingPage.expenses.detail.attachment')}>
                      <IcoPaperclip />
                    </button>
                    <button type="button" className="exp__item-icon" title={t('timeTrackingPage.expenses.detail.locked')} aria-label={t('timeTrackingPage.expenses.detail.locked')}>
                      <IcoLock />
                    </button>
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

      {showForm &&
            createPortal(<div className="exp__modal-overlay">
            <form className="exp__form" onSubmit={saveForm} onClick={(e) => e.stopPropagation()}>
              <div className="exp__form-header">
                <h2 className="exp__form-title">{t('timeTrackingPage.expenses.form.newExpenseTitle')}</h2>
                <button type="button" className="exp__form-close" onClick={cancelForm} disabled={formBusy} aria-label={t('timeTrackingPage.common.close')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="exp__form-top">
                <div className="exp__form-col exp__form-col--date">
                  <label className="exp__form-label">{t('timeTrackingPage.expenses.form.date')}</label>
                  <input type="date" className="exp__form-input" value={formDate} disabled={formBusy} onChange={(e) => setFormDate(e.target.value)}/>
                  {formCbuLoading && (<p className="exp__form-hint">{t('timeTrackingPage.expenses.form.cbuLoadingHint')}</p>)}
                  {formCbuErr && !formCbuLoading && (<p className="exp__form-hint exp__form-hint--err" role="status">{formCbuErr}</p>)}
                  {formCbu != null && !formCbuLoading && !formCbuErr && (<p className="exp__form-hint">{t('timeTrackingPage.expenses.form.cbuUsedHint')}</p>)}
                </div>

                <div className="exp__form-col exp__form-col--middle">
                  <label className="exp__form-label">{t('timeTrackingPage.expenses.form.projectCategoryLabel')}</label>
                  <div className="exp__form-select-wrap">
                    <SearchableSelect<ProjectOption> className="exp__form-srch" buttonClassName="exp__form-srch-btn" portalDropdown aria-label={t('timeTrackingPage.common.project')} disabled={formBusy || projectsLoading || projectOpts.length === 0} placeholder={projectsLoading
                    ? t('timeTrackingPage.expenses.journal.loadingProjects')
                    : projectOpts.length === 0
                        ? t('timeTrackingPage.expenses.journal.noProjects')
                        : t('timeTrackingPage.common.selectProject')} emptyListText={projectsLoading ? t('timeTrackingPage.common.loading') : t('timeTrackingPage.expenses.journal.noProjects')} noMatchText={t('timeTrackingPage.common.projectNotFound')} value={formProject} items={projectOpts} getOptionValue={(p) => p.id} getOptionLabel={expenseJournalProjectLabel} getSearchText={(p) => `${p.name} ${p.client}`.replace(/\s+/g, ' ').trim()} onSelect={(p) => {
                    setFormProject(p.id);
                    setFormCat('');
                }}/>
                  </div>
                  {projectsErr && (<p className="exp__form-hint exp__form-hint--err" role="alert">
                      {projectsErr}
                    </p>)}
                  {!projectsLoading &&
                    !projectsErr &&
                    projectOpts.length === 0 &&
                    currentUser && (<p className="exp__form-hint">
                        {t('timeTrackingPage.expenses.form.noProjectAccessHint')}
                      </p>)}
                  <div className="exp__form-select-wrap">
                    <select className="exp__form-select" value={formCat} onChange={(e) => setFormCat(e.target.value)} disabled={formBusy ||
                    !formProject ||
                    categoriesLoading ||
                    Boolean(categoriesErr) ||
                    expenseCategories.length === 0} aria-busy={categoriesLoading}>
                      <option value="">
                        {!formProject
                    ? t('timeTrackingPage.expenses.form.selectProjectFirst')
                    : categoriesLoading
                        ? t('timeTrackingPage.expenses.form.loadingCategories')
                        : categoriesErr
                            ? t('timeTrackingPage.expenses.form.categoriesLoadError')
                            : expenseCategories.length === 0
                                ? t('timeTrackingPage.expenses.form.noCategories')
                                : t('timeTrackingPage.expenses.form.selectCategory')}
                      </option>
                      {expenseCategories.map((c) => (<option key={c.id} value={c.id}>
                          {c.name}
                        </option>))}
                    </select>
                    <span className="exp__form-select-icon">
                      <IcoChevron />
                    </span>
                  </div>
                  {categoriesErr && (<p className="exp__form-hint exp__form-hint--err" role="alert">
                      {categoriesErr}
                    </p>)}
                  {formProject &&
                    !categoriesLoading &&
                    !categoriesErr &&
                    expenseCategories.length === 0 && (<p className="exp__form-hint">
                        {t('timeTrackingPage.expenses.form.noActiveCategoriesHint')}
                      </p>)}
                  <textarea className="exp__form-textarea" placeholder={t('timeTrackingPage.expenses.form.notesPlaceholder')} value={formNotes} disabled={formBusy} onChange={(e) => setFormNotes(e.target.value)} rows={3}/>
                </div>
              </div>

              <div className="exp__form-attach">
                <label className="exp__form-label">{t('timeTrackingPage.expenses.form.attachReceipt')}</label>
                <div className="exp__form-file-row">
                  <button type="button" className="exp__form-file-btn" disabled={formBusy} onClick={() => fileRef.current?.click()}>
                    {t('timeTrackingPage.expenses.form.chooseFile')}
                  </button>
                  <span className="exp__form-file-name">{formFile ? formFile.name : t('timeTrackingPage.expenses.form.fileNotSelected')}</span>
                </div>
                <input ref={fileRef} type="file" className="exp__form-file-hidden" disabled={formBusy} onChange={(e) => setFormFile(e.target.files?.[0] ?? null)}/>
              </div>

              <label className="exp__form-billable">
                <span className={`exp__form-checkbox${formBillable ? ' exp__form-checkbox--on' : ''}`} onClick={() => {
                    if (!formBusy)
                        setFormBillable((v) => !v);
                }} role="checkbox" aria-checked={formBillable} tabIndex={0} onKeyDown={(e) => e.key === ' ' && !formBusy && setFormBillable((v) => !v)}>
                  {formBillable && <IcoCheck />}
                </span>
                <input type="checkbox" checked={formBillable} disabled={formBusy} onChange={(e) => setFormBillable(e.target.checked)} tabIndex={-1}/>
                {t('timeTrackingPage.expenses.form.billableCheckbox')}
              </label>

              <div className="exp__form-amount-bottom">
                <label className="exp__form-label" htmlFor={expenseFormAmountFieldId}>{t('timeTrackingPage.expenses.form.amountUzsLabel')}</label>
                <div className="exp__form-amount-wrap">
                  <span className="exp__form-amount-cur">UZS</span>
                  <input id={expenseFormAmountFieldId} type="number" className="exp__form-amount-input" placeholder={t('timeTrackingPage.expenses.form.amountPlaceholder')} min="0" step="1" value={formAmount} disabled={formBusy} onChange={(e) => setFormAmount(e.target.value)}/>
                </div>
                {formPaymentBookHint ? (<p className="exp__form-hint">{formPaymentBookHint}</p>) : (<p className="exp__form-hint">{t('timeTrackingPage.expenses.form.equivalentDefaultHint').replace('{currency}', formProjectCurrency)}</p>)}
              </div>

              {formErr && (<p className="exp__form-hint exp__form-hint--err" role="alert">
                  {formErr}
                </p>)}

              <div className="exp__form-actions">
                <button type="submit" className="exp__form-save" disabled={formBusy || formCbuLoading || !formCbu}>
                  {formBusy ? t('timeTrackingPage.expenses.form.submitting') : t('timeTrackingPage.expenses.form.submit')}
                </button>
                <button type="button" className="exp__form-cancel" onClick={cancelForm} disabled={formBusy}>
                  {t('timeTrackingPage.common.cancel')}
                </button>
              </div>
            </form>
          </div>, document.body)}

      {detailExp &&
            createPortal(<div className="exp__detail-overlay">
          <div className="exp__detail" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">

            <div className="exp__detail-head">
              <div className="exp__detail-head-left">
                <div className="exp__detail-cat-icon" style={{
                    color: EXPENSE_CATEGORY_META[detailExp.category]?.color ?? '#6b7280',
                    background: EXPENSE_CATEGORY_META[detailExp.category]?.bg ?? 'rgba(107,114,128,0.08)',
                }}>
                  <IcoPaperclip />
                </div>
                <div>
                  <h2 className="exp__detail-title">{detailExp.project ?? t('timeTrackingPage.expenses.detail.noProject')}</h2>
                  {detailExp.client && <p className="exp__detail-client">{detailExp.client}</p>}
                </div>
              </div>
              <button type="button" className="exp__detail-close" onClick={() => setDetailExp(null)} aria-label={t('timeTrackingPage.common.close')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="exp__detail-amount-hero">
              <div className="exp__detail-amount-stack">
                <span className="exp__detail-amount">{fmtAmt(detailExp.amount, detailExp.currency)}</span>
                {detailExp.paidInUzs != null ? (<span className="exp__detail-amount-caption">{t('timeTrackingPage.expenses.detail.actualPayment').replace('{amount}', detailExp.paidInUzs.toLocaleString(localeTag(locale)))}</span>) : null}
              </div>
              <span className="exp__detail-status" style={{
                    color: EXPENSE_STATUS_META[detailExp.status].color,
                    background: EXPENSE_STATUS_META[detailExp.status].bg,
                }}>
                {ttExpenseStatusLabel(detailExp.status, t)}
              </span>
            </div>

            <div className="exp__detail-body">
              <div className="exp__detail-row">
                <span className="exp__detail-label">{t('timeTrackingPage.expenses.form.date')}</span>
                <span className="exp__detail-val">
                  {new Date(detailExp.date + 'T00:00:00').toLocaleDateString(localeTag(locale), {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
                </span>
              </div>
              <div className="exp__detail-row">
                <span className="exp__detail-label">{t('timeTrackingPage.expenses.form.category')}</span>
                <span className="exp__detail-val">
                  <span className="exp__detail-cat-tag" style={{
                    color: EXPENSE_CATEGORY_META[detailExp.category]?.color,
                    background: EXPENSE_CATEGORY_META[detailExp.category]?.bg,
                }}>
                    {ttExpenseCategoryLabel(detailExp.category, t)}
                  </span>
                </span>
              </div>
              <div className="exp__detail-row">
                <span className="exp__detail-label">{t('timeTrackingPage.expenses.detail.employee')}</span>
                <span className="exp__detail-val">
                  <span className="exp__detail-employee">
                    <span className="exp__detail-avatar">{detailExp.initials}</span>
                    {detailExp.employee}
                  </span>
                </span>
              </div>
              {detailExp.description && (<div className="exp__detail-row">
                  <span className="exp__detail-label">{t('timeTrackingPage.expenses.detail.description')}</span>
                  <span className="exp__detail-val">{detailExp.description}</span>
                </div>)}
              <div className="exp__detail-row">
                <span className="exp__detail-label">{t('timeTrackingPage.expenses.detail.billableToClient')}</span>
                <span className="exp__detail-val">
                  <span className={`exp__detail-billable${detailExp.billable ? ' exp__detail-billable--yes' : ''}`}>
                    {detailExp.billable ? t('timeTrackingPage.expenses.detail.billableYes') : t('timeTrackingPage.expenses.detail.billableNo')}
                  </span>
                </span>
              </div>
            </div>

            <div className="exp__detail-foot">
              <button type="button" className="exp__detail-close-btn" onClick={() => setDetailExp(null)}>
                {t('timeTrackingPage.common.close')}
              </button>
            </div>
          </div>
        </div>, document.body)}
    </div>);
}
