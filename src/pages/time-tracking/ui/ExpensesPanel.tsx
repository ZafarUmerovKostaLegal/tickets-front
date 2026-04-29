import { useState, useMemo, useRef, useEffect, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { useCurrentUser } from '@shared/hooks';
import { listProjectExpenseCategories, type ProjectExpenseCategoryRow, } from '@entities/time-tracking';
import { createExpense, fetchExchangeRate, fetchExpenses, submitExpense, uploadAttachment, } from '@entities/expenses/model/expensesApi';
import type { ExpenseRequest, ListParams } from '@entities/expenses/model/types';
import { EXPENSE_STATUS_META, EXPENSE_CATEGORY_META } from '@entities/time-tracking/model/constants';
import type { ExpenseCategory, ExpenseStatus, ExpenseRow } from '@entities/time-tracking/model/types';
import { hasFullTimeTrackingTabs } from '@entities/time-tracking/model/timeTrackingAccess';
import { ExpensesSkeleton } from './ExpensesSkeleton';
import { loadExpenseJournalProjectOptions, type ProjectOption } from './timesheetProjectLoader';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
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
function expenseRequestToExpenseRow(req: ExpenseRequest, projectLine: string): ExpenseRow {
    const author = req.createdBy?.displayName?.trim() ||
        req.createdBy?.email?.trim() ||
        `Пользователь ${req.createdByUserId}`;
    const parts = author.split(/\s+/).filter(Boolean);
    const initials = parts.length >= 2
        ? `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase()
        : (parts[0]?.charAt(0).toUpperCase() ?? '?');
    return {
        id: req.id,
        date: req.expenseDate.slice(0, 10),
        employee: author,
        initials,
        category: mapExpenseTypeToCategory(req.expenseType),
        description: req.description?.trim() || req.businessPurpose?.trim() || '—',
        amount: req.amountUzs,
        currency: 'UZS',
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
function fmtWeekRange(mondayStr: string): string {
    const start = new Date(mondayStr + 'T00:00:00');
    const end = new Date(mondayStr + 'T00:00:00');
    end.setDate(end.getDate() + 6);
    const s = start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const e = end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
}
function fmtRowDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return {
        weekday: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
        dayMonth: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    };
}
function fmtAmt(n: number, cur = 'UZS') {
    return `${n.toLocaleString('ru-RU')} ${cur}`;
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
        void loadExpenseJournalProjectOptions(currentUser).then(({ items, error }) => {
            if (cancelled)
                return;
            setProjectOpts(items);
            setProjectsErr(error);
            setProjectsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [currentUser, userLoading]);
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
                setCategoriesErr(e instanceof Error ? e.message : 'Не удалось загрузить категории расходов');
            }
        })
            .finally(() => {
            if (!cancelled)
                setCategoriesLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [formProject]);
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
                (r.projectId ? `Проект ${String(r.projectId).slice(0, 8)}…` : '—')));
            setListRows(rows);
        })
            .catch((e: unknown) => {
            if (cancelled)
                return;
            setListRows([]);
            const msg = e instanceof Error ? e.message : 'Не удалось загрузить расходы';
            setListErr(/403|forbidden|недостаточно|запрещ/i.test(msg)
                ? `${msg} (нет доступа к заявкам этого сотрудника — проверьте общие проекты.)`
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
        managedExpenseAuthorId,
        isTtManager,
        listVersion,
    ]);
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
    }, [showForm, formBusy]);
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
    function cancelForm() {
        if (formBusy)
            return;
        setFormErr(null);
        setShowForm(false);
    }
    async function saveForm(e: React.FormEvent) {
        e.preventDefault();
        setFormErr(null);
        if (!currentUser) {
            setFormErr('Нет данных пользователя');
            return;
        }
        if (!formProject.trim()) {
            setFormErr('Выберите проект');
            return;
        }
        if (!formDate.trim()) {
            setFormErr('Укажите дату');
            return;
        }
        const amt = parseFloat(formAmount.replace(',', '.'));
        if (!formAmount.trim() || Number.isNaN(amt) || amt <= 0) {
            setFormErr('Укажите сумму больше 0');
            return;
        }
        if (formBillable && expenseCategories.length > 0 && !formCat.trim()) {
            setFormErr('Выберите категорию расхода проекта');
            return;
        }
        if (formBillable && !formFile) {
            setFormErr('Для возмещаемого расхода приложите документ для оплаты');
            return;
        }
        setFormBusy(true);
        try {
            const { rate } = await fetchExchangeRate(formDate);
            if (!rate || rate <= 0) {
                setFormErr('Не удалось получить курс UZS/USD на выбранную дату');
                return;
            }
            const description = formNotes.trim() || 'Расход (учёт времени)';
            const expenseType = formBillable ? 'client_expense' : 'purchase';
            const body = {
                description,
                expenseDate: formDate,
                paymentDeadline: null as string | null,
                amountUzs: Math.round(amt),
                exchangeRate: rate,
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
            setFormErr(err instanceof Error ? err.message : 'Не удалось сохранить расход');
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
            label: fmtWeekRange(weekKey),
            exps: exps.sort((a, b) => b.date.localeCompare(a.date)),
            total: exps.reduce((s, e) => s + e.amount, 0),
            status: weekStatus(exps.map(e => e.status)),
            currency: exps[0]?.currency ?? 'UZS',
        }));
    }, [listRows]);
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
            <h1 className="tt-exp-panel__heading">Расходы</h1>
          </div>
          <div className="tt-exp-panel__toolbar-right">
            <button type="button" className="tt-exp-panel__add-btn" disabled={!canAddExpense} title={!canAddExpense ? 'Сначала выберите проект с доступом' : undefined} onClick={openForm}>
              <IcoPlus />
              Добавить расход
            </button>
          </div>
        </div>

        <div className="tt-exp-panel__sections">
          <section className="tt-exp-panel__section" aria-labelledby={sectionTitleId}>
            <div className="tt-exp-panel__section-head tt-exp-panel__section-head--journal">
              <div className="tt-exp-panel__journal-head-text">
                <h2 id={sectionTitleId} className="tt-exp-panel__section-title">
                  Журнал по проекту
                </h2>
                {journalHeadingLine ? (<p className="tt-exp-panel__section-subtitle">{journalHeadingLine}</p>) : (<p className="tt-exp-panel__section-subtitle tt-exp-panel__section-subtitle--muted">
                    Выберите проект ниже — здесь показываются заявки только по одному проекту.
                  </p>)}
              </div>
              <div className="tt-exp-panel__journal-project">
                <div className="tt-exp-panel__journal-project-line">
                  <label className="tt-exp-panel__journal-project-label" htmlFor={journalFieldId}>
                    Проект
                  </label>
                  <span className="tt-exp-panel__project-scope-dot" style={{ background: journalProjectHue }} title={journalHeadingLine || undefined} aria-hidden/>
                </div>
                <div className="tt-exp-panel__project-scope-select-wrap">
                  <SearchableSelect<ProjectOption> className="tt-exp-panel__project-scope-srch" buttonClassName="tt-exp-panel__project-scope-srch-btn" buttonId={journalFieldId} disabled={!canPickProject} placeholder={projectsLoading
            ? 'Загрузка проектов…'
            : projectOpts.length === 0
                ? 'Нет доступных проектов'
                : 'Выберите проект…'} emptyListText={projectsLoading ? 'Загрузка…' : 'Нет доступных проектов'} noMatchText="Проект не найден" value={canPickProject ? journalProjectId : ''} items={canPickProject ? journalOptionsSorted : []} getOptionValue={(p) => p.id} getOptionLabel={expenseJournalProjectLabel} getSearchText={(p) => `${p.name} ${p.client}`.replace(/\s+/g, ' ').trim()} onSelect={(p) => setJournalProjectId(p.id)} aria-describedby={journalProjectHintId}/>
                </div>
                <p id={journalProjectHintId} className="tt-exp-panel__project-scope-hint">
                  Список и новая заявка привязаны к выбранному проекту; категории расхода берутся из учёта времени по этому
                  проекту. В выпадающем списке есть поиск по названию проекта и клиенту.
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
                  <p className="tt-exp-panel__empty-title">Нет проекта для журнала</p>
                  <p className="tt-exp-panel__empty-desc">
                    Расходы здесь привязаны к проекту из вашего доступа в учёте времени. Если список пуст, проверьте
                    назначение проектов в разделе «Проекты» или обратитесь к администратору.
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
                  <p className="tt-exp-panel__empty-title">Пока нет расходов по этому проекту</p>
                  <p className="tt-exp-panel__empty-desc">
                    Здесь отображаются только заявки, привязанные к выбранному проекту. Общий реестр заявок доступен в
                    разделе «Расходы» в меню, если у вас есть к нему доступ.
                  </p>
                  <p className="tt-exp-panel__empty-hint">
                    Нажмите «Добавить расход» в шапке справа — проект в заявке подставится из списка в этой карточке.
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
                  {statusMeta.label}
                </span>
              </div>
              <div className="exp__week-head-right" onClick={e => e.stopPropagation()}>
                {isCollapsed && (<span className="exp__week-head-total">{fmtAmt(group.total, group.currency)}</span>)}
                {group.status === 'approved' && (<button type="button" className="exp__week-withdraw">
                    Отозвать одобрение
                  </button>)}
              </div>
            </div>

            {!isCollapsed && group.exps.map(exp => {
                        const { weekday, dayMonth } = fmtRowDate(exp.date);
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
                      <span className="exp__item-cat">{exp.category}</span>
                      {exp.billable && (<span className="exp__item-billable-badge">Billable</span>)}
                    </div>
                    {exp.description && (<div className="exp__item-notes">{exp.description}</div>)}
                  </div>

                  <div className="exp__item-right" onClick={e => e.stopPropagation()}>
                    <span className="exp__item-amount">{fmtAmt(exp.amount, exp.currency)}</span>
                    <button type="button" className="exp__item-icon" title="Вложение" aria-label="Вложение">
                      <IcoPaperclip />
                    </button>
                    <button type="button" className="exp__item-icon" title="Заблокировано" aria-label="Заблокировано">
                      <IcoLock />
                    </button>
                  </div>
                </div>);
                    })}

            {!isCollapsed && (<div className="exp__week-total">
                <span className="exp__week-total-label">Итого:</span>
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
            createPortal(<div className="exp__modal-overlay" onClick={cancelForm}>
            <form className="exp__form" onSubmit={saveForm} onClick={(e) => e.stopPropagation()}>
              <div className="exp__form-header">
                <h2 className="exp__form-title">Новый расход</h2>
                <button type="button" className="exp__form-close" onClick={cancelForm} disabled={formBusy} aria-label="Закрыть">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="exp__form-top">
                <div className="exp__form-col exp__form-col--date">
                  <label className="exp__form-label">Дата</label>
                  <input type="date" className="exp__form-input" value={formDate} disabled={formBusy} onChange={(e) => setFormDate(e.target.value)}/>
                </div>

                <div className="exp__form-col exp__form-col--middle">
                  <label className="exp__form-label">Проект / Категория</label>
                  <div className="exp__form-select-wrap">
                    <SearchableSelect<ProjectOption> className="exp__form-srch" buttonClassName="exp__form-srch-btn" portalDropdown aria-label="Проект" disabled={formBusy || projectsLoading || projectOpts.length === 0} placeholder={projectsLoading
                    ? 'Загрузка проектов…'
                    : projectOpts.length === 0
                        ? 'Нет доступных проектов'
                        : 'Выберите проект…'} emptyListText={projectsLoading ? 'Загрузка…' : 'Нет доступных проектов'} noMatchText="Проект не найден" value={formProject} items={projectOpts} getOptionValue={(p) => p.id} getOptionLabel={expenseJournalProjectLabel} getSearchText={(p) => `${p.name} ${p.client}`.replace(/\s+/g, ' ').trim()} onSelect={(p) => {
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
                        У вас нет доступа к проектам для расходов. Администратор может выдать доступ во вкладке
                        «Пользователи» учёта времени (кнопка «Доступ к проектам» в строке сотрудника).
                      </p>)}
                  <div className="exp__form-select-wrap">
                    <select className="exp__form-select" value={formCat} onChange={(e) => setFormCat(e.target.value)} disabled={formBusy ||
                    !formProject ||
                    categoriesLoading ||
                    Boolean(categoriesErr) ||
                    expenseCategories.length === 0} aria-busy={categoriesLoading}>
                      <option value="">
                        {!formProject
                    ? 'Сначала выберите проект…'
                    : categoriesLoading
                        ? 'Загрузка категорий…'
                        : categoriesErr
                            ? 'Ошибка загрузки категорий'
                            : expenseCategories.length === 0
                                ? 'Нет категорий расходов'
                                : 'Выберите категорию…'}
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
                        У проекта нет активных категорий расходов. Настройте категории для клиента проекта в учёте
                        времени.
                      </p>)}
                  <textarea className="exp__form-textarea" placeholder="Заметки (опционально)" value={formNotes} disabled={formBusy} onChange={(e) => setFormNotes(e.target.value)} rows={3}/>
                </div>
              </div>

              <div className="exp__form-attach">
                <label className="exp__form-label">Прикрепить чек</label>
                <div className="exp__form-file-row">
                  <button type="button" className="exp__form-file-btn" disabled={formBusy} onClick={() => fileRef.current?.click()}>
                    Выберите файл
                  </button>
                  <span className="exp__form-file-name">{formFile ? formFile.name : 'Файл не выбран'}</span>
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
                Этот расход выставляется клиенту (Billable)
              </label>

              <div className="exp__form-amount-bottom">
                <label className="exp__form-label" htmlFor={expenseFormAmountFieldId}>Сумма</label>
                <div className="exp__form-amount-wrap">
                  <span className="exp__form-amount-cur">UZS</span>
                  <input id={expenseFormAmountFieldId} type="number" className="exp__form-amount-input" placeholder="0" min="0" step="1" value={formAmount} disabled={formBusy} onChange={(e) => setFormAmount(e.target.value)}/>
                </div>
              </div>

              {formErr && (<p className="exp__form-hint exp__form-hint--err" role="alert">
                  {formErr}
                </p>)}

              <div className="exp__form-actions">
                <button type="submit" className="exp__form-save" disabled={formBusy}>
                  {formBusy ? 'Отправка…' : 'Сохранить расход'}
                </button>
                <button type="button" className="exp__form-cancel" onClick={cancelForm} disabled={formBusy}>
                  Отмена
                </button>
              </div>
            </form>
          </div>, document.body)}

      {detailExp &&
            createPortal(<div className="exp__detail-overlay" onClick={() => setDetailExp(null)}>
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
                  <h2 className="exp__detail-title">{detailExp.project ?? 'Без проекта'}</h2>
                  {detailExp.client && <p className="exp__detail-client">{detailExp.client}</p>}
                </div>
              </div>
              <button type="button" className="exp__detail-close" onClick={() => setDetailExp(null)} aria-label="Закрыть">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="exp__detail-amount-hero">
              <span className="exp__detail-amount">{fmtAmt(detailExp.amount, detailExp.currency)}</span>
              <span className="exp__detail-status" style={{
                    color: EXPENSE_STATUS_META[detailExp.status].color,
                    background: EXPENSE_STATUS_META[detailExp.status].bg,
                }}>
                {EXPENSE_STATUS_META[detailExp.status].label}
              </span>
            </div>

            <div className="exp__detail-body">
              <div className="exp__detail-row">
                <span className="exp__detail-label">Дата</span>
                <span className="exp__detail-val">
                  {new Date(detailExp.date + 'T00:00:00').toLocaleDateString('ru-RU', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
                </span>
              </div>
              <div className="exp__detail-row">
                <span className="exp__detail-label">Категория</span>
                <span className="exp__detail-val">
                  <span className="exp__detail-cat-tag" style={{
                    color: EXPENSE_CATEGORY_META[detailExp.category]?.color,
                    background: EXPENSE_CATEGORY_META[detailExp.category]?.bg,
                }}>
                    {detailExp.category}
                  </span>
                </span>
              </div>
              <div className="exp__detail-row">
                <span className="exp__detail-label">Сотрудник</span>
                <span className="exp__detail-val">
                  <span className="exp__detail-employee">
                    <span className="exp__detail-avatar">{detailExp.initials}</span>
                    {detailExp.employee}
                  </span>
                </span>
              </div>
              {detailExp.description && (<div className="exp__detail-row">
                  <span className="exp__detail-label">Описание</span>
                  <span className="exp__detail-val">{detailExp.description}</span>
                </div>)}
              <div className="exp__detail-row">
                <span className="exp__detail-label">Выставляется клиенту</span>
                <span className="exp__detail-val">
                  <span className={`exp__detail-billable${detailExp.billable ? ' exp__detail-billable--yes' : ''}`}>
                    {detailExp.billable ? '✓ Да (Billable)' : '— Нет'}
                  </span>
                </span>
              </div>
            </div>

            <div className="exp__detail-foot">
              <button type="button" className="exp__detail-close-btn" onClick={() => setDetailExp(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>, document.body)}
    </div>);
}
