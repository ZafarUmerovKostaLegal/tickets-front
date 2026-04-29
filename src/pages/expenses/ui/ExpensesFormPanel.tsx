import { useState, useCallback, useRef, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { type ExpenseRequest, type ExpenseFormValues, type ExpenseFormErrors, type ExpenseFilesByKind, type AttachmentItem, EXPENSE_ATTACHMENT_MAX_BYTES, } from '@entities/expenses/model/types';
import { EXPENSE_CURRENCIES, EXPENSE_TYPES, PARTNER_EXPENSE_CATEGORIES, getPartnerExpenseSubtypeLabel, PAYMENT_METHODS, STATUS_META, } from '@entities/expenses/model/constants';
import { computeUsdEquivalent, needsForeignUsdRate } from '@entities/expenses/model/expenseCurrency';
import { fetchCbuParsedForDate, foreignUnitsPerUsd, type CbuParsed } from '@entities/expenses/model/cbuRates';
import type { ExpenseAmountCurrency } from '@entities/expenses/model/types';
import { approveExpense, rejectExpense, reviseExpense, deleteAttachment, fetchExpenseAttachmentBlob, openExpenseAttachmentInNewTab, payExpense, closeExpense, withdrawExpense, } from '@entities/expenses/model/expensesApi';
import { buildAttachmentPreview, type AttachmentPreviewModel } from '@entities/expenses/lib/buildAttachmentPreview';
import { ExpenseAttachmentPreviewModal } from './ExpenseAttachmentPreviewModal';
import { getCloseExpenseUi, isModerationBlockedForOwnExpense, showLifecycleModerationRow, showOwnPendingModerationBlockedHint, showPayExpenseAction, showPendingApprovalModeration, showWithdrawExpenseAction, } from '@entities/expenses/model/expenseStatusPolicy';
import { asExpenseNumber } from '@entities/expenses/model/coerceExpense';
import { formatExpenseAuthorLabel, formatExpensePaidByLabel } from '@entities/expenses/model/expenseAuthor';
import { ExpenseConfirmDialog } from './ExpenseConfirmDialog';
import { ExpenseSearchableSelect } from './ExpenseSearchableSelect';
import { listProjectsForExpenses, listProjectExpenseCategories, type TimeManagerClientRow, type TimeManagerClientProjectRow, type TimeTrackingProjectForExpense, type ProjectExpenseCategoryRow, } from '@entities/time-tracking';
type ExpenseClientProjectsGroup = {
    client: TimeManagerClientRow;
    projects: TimeManagerClientProjectRow[];
};
type ExpenseProjectPickRow = {
    client: TimeManagerClientRow;
    project: TimeManagerClientProjectRow;
};
function syntheticClientFromExpense(id: string, name: string): TimeManagerClientRow {
    return {
        id,
        name: name.trim() || '—',
        address: null,
        currency: 'UZS',
        invoice_due_mode: 'custom',
        invoice_due_days_after_issue: null,
        tax_percent: null,
        tax2_percent: null,
        discount_percent: null,
        created_at: '',
        updated_at: null,
    };
}
function ttExpenseProjectToProjectRow(p: TimeTrackingProjectForExpense): TimeManagerClientProjectRow {
    return {
        id: p.id,
        client_id: p.clientId,
        name: p.name,
        code: p.code,
        start_date: null,
        end_date: null,
        notes: null,
        report_visibility: '',
        project_type: 'time_and_materials',
        billable_rate_type: null,
        project_billable_rate_amount: null,
        budget_type: null,
        budget_amount: null,
        budget_hours: null,
        budget_resets_every_month: false,
        budget_includes_expenses: false,
        send_budget_alerts: false,
        budget_alert_threshold_percent: null,
        fixed_fee_amount: null,
        usage_count: 0,
        deletable: false,
        created_at: '',
        updated_at: null,
    };
}
function groupProjectsForExpenseForm(rows: TimeTrackingProjectForExpense[]): ExpenseClientProjectsGroup[] {
    const m = new Map<string, ExpenseClientProjectsGroup>();
    for (const p of rows) {
        if (p.isArchived)
            continue;
        if (!m.has(p.clientId)) {
            m.set(p.clientId, {
                client: syntheticClientFromExpense(p.clientId, p.clientName),
                projects: [],
            });
        }
        m.get(p.clientId)!.projects.push(ttExpenseProjectToProjectRow(p));
    }
    for (const g of m.values()) {
        g.projects.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    }
    return [...m.values()].sort((a, b) => a.client.name.localeCompare(b.client.name, 'ru', { sensitivity: 'base' }));
}
const EXPENSE_PROJECT_TYPE_LABEL: Record<string, string> = {
    time_and_materials: 'T&M',
    fixed_fee: 'Фикс',
    non_billable: 'Не оплачиваемый',
};
function formatExpenseProjectDateShort(iso: string | null | undefined): string {
    if (!iso)
        return '—';
    const s = String(iso).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return '—';
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
}
function ExpenseProjectCardBody({ project }: {
    project: TimeManagerClientProjectRow;
}) {
    return (<div className="exp-project-picker__card-body">
      <div className="exp-project-picker__card-title">
        <span className="exp-project-picker__card-name">{project.name}</span>
        {project.code ? <span className="exp-project-picker__code">{project.code}</span> : null}
      </div>
      <p className="exp-project-picker__meta">
        {EXPENSE_PROJECT_TYPE_LABEL[project.project_type] ?? project.project_type}
        {' · '}
        {formatExpenseProjectDateShort(project.start_date)} — {formatExpenseProjectDateShort(project.end_date)}
        {project.usage_count > 0 ? ` · записей времени: ${project.usage_count}` : ''}
      </p>
    </div>);
}
export type PanelMode = 'create' | 'edit' | 'view';
type PanelConfirmState = null | {
    kind: 'approve';
} | {
    kind: 'pay';
} | {
    kind: 'close';
    message: string;
    confirmLabel: string;
} | {
    kind: 'withdraw';
};
type Props = {
    isOpen: boolean;
    mode: PanelMode;
    editingRequest?: ExpenseRequest | null;
    onClose: () => void;
    onSaveDraft: (values: ExpenseFormValues, files: ExpenseFilesByKind) => void;
    onSubmit: (values: ExpenseFormValues, files: ExpenseFilesByKind) => void;
    saveDraftPending?: boolean;
    submitPending?: boolean;
    onExpenseSnapshotUpdated?: (expense: ExpenseRequest) => void;
    canModerate?: boolean;
    onExpenseUpdated?: (expense: ExpenseRequest) => void;
    emailModerationIntent?: 'approve' | 'reject' | null;
    onEmailModerationIntentConsumed?: () => void;
    allowPaymentReceiptUpload?: boolean;
    onUploadPaymentReceipts?: (files: File[]) => Promise<void>;
    receiptUploadPending?: boolean;
    currentUserId?: number | null;
};
function PanelBtnSpinner({ className }: {
    className?: string;
}) {
    return (<svg className={className ?? 'exp-panel-btn__spinner'} viewBox="0 0 24 24" aria-hidden width={18} height={18}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity={0.2}/>
      <path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M12 3a9 9 0 0 1 9 9"/>
    </svg>);
}
function todayIsoLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function fmtIsoDateRu(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m)
        return iso;
    return `${m[3]}.${m[2]}.${m[1]}`;
}

const EXPENSE_TYPE_CLIENT = 'client_expense';
const EMPTY: ExpenseFormValues = {
    description: '',
    expenseDate: '',
    paymentDeadline: '',
    expenseType: '',
    expenseSubtype: '',
    isReimbursable: false,
    amountCurrency: 'UZS',
    foreignPerUsd: '',
    amountUzs: '',
    exchangeRate: '',
    paymentMethod: '',
    projectId: '',
    expenseCategoryId: '',
    vendor: '',
    businessPurpose: '',
    comment: '',
};
type ValidateOpts = {
    forSubmit?: boolean;
    filesPaymentDoc: File[];
    filesReceipt: File[];
    serverAttachments?: AttachmentItem[];
    projectExpenseCategoryCount?: number;
};
function validate(v: ExpenseFormValues, opts?: ValidateOpts): ExpenseFormErrors {
    const e: ExpenseFormErrors = {};
    if (!v.description.trim())
        e.description = 'Обязательное поле';
    if (!v.expenseDate)
        e.expenseDate = 'Укажите дату';
    if (v.paymentDeadline.trim() && v.expenseDate && v.paymentDeadline < v.expenseDate) {
        e.paymentDeadline = 'Срок оплаты не может быть раньше даты расхода';
    }
    if (!v.expenseType)
        e.expenseType = 'Выберите тип расхода';
    if (v.expenseType === 'partner_expense' && !v.expenseSubtype.trim()) {
        e.expenseSubtype = 'Выберите категорию расхода партнёра';
    }
    const amt = parseFloat(v.amountUzs);
    if (!v.amountUzs || isNaN(amt) || amt <= 0)
        e.amountUzs = 'Укажите сумму больше 0';
    const rate = parseFloat(v.exchangeRate);
    if (!v.exchangeRate || isNaN(rate) || rate <= 0)
        e.exchangeRate = 'Укажите курс больше 0';
    if (needsForeignUsdRate(v.amountCurrency)) {
        const fx = parseFloat(v.foreignPerUsd);
        if (!v.foreignPerUsd || isNaN(fx) || fx <= 0) {
            e.foreignPerUsd = 'Укажите, сколько единиц валюты за 1 USD (например, 90 для рубля)';
        }
    }
    if (opts?.forSubmit && v.isReimbursable === true && v.expenseType !== 'partner_expense') {
        const s = opts.serverAttachments ?? [];
        const pd = opts.filesPaymentDoc.length + s.filter(a => a.attachmentKind === 'payment_document').length;
        const hasTypedDoc = opts.filesPaymentDoc.length > 0 || s.some(a => a.attachmentKind === 'payment_document');
        const legacyOnly = s.length > 0 && s.every(a => !a.attachmentKind);
        if (hasTypedDoc) {
            if (pd < 1)
                e.attachmentsPaymentDoc = 'Прикрепите документ для оплаты';
        }
        else if (legacyOnly) {
        }
        else if (s.length + opts.filesPaymentDoc.length < 1) {
            e.attachmentsPaymentDoc = 'Для возмещаемого расхода приложите документ для оплаты';
        }
    }
    if (opts?.forSubmit && v.isReimbursable === true && v.expenseType === 'client_expense') {
        if (!v.projectId?.trim()) {
            e.projectId = 'Выберите проект';
        }
        const catCount = opts.projectExpenseCategoryCount ?? 0;
        if (v.projectId?.trim() && catCount > 0 && !v.expenseCategoryId?.trim()) {
            e.expenseCategoryId = 'Выберите категорию расхода';
        }
    }
    if (opts?.forSubmit && v.isReimbursable === true && v.expenseType === 'other' && !v.comment.trim()) {
        e.comment = 'Для типа «Прочее» укажите комментарий';
    }
    return e;
}
function appendFilesChecked(incoming: FileList | null, setList: Dispatch<SetStateAction<File[]>>, onOversize: (fileName: string) => void) {
    if (!incoming?.length)
        return;
    const added: File[] = [];
    for (const f of Array.from(incoming)) {
        if (f.size > EXPENSE_ATTACHMENT_MAX_BYTES) {
            onOversize(f.name);
            continue;
        }
        added.push(f);
    }
    if (!added.length)
        return;
    setList(prev => [...prev, ...added]);
}
function formatForeignFp(n: number): string {
    const x = Math.round(n * 1e6) / 1e6;
    return x.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}
export function ExpensesFormPanel({ isOpen, mode, editingRequest, onClose, onSaveDraft, onSubmit, saveDraftPending = false, submitPending = false, onExpenseSnapshotUpdated, canModerate = false, onExpenseUpdated, emailModerationIntent = null, onEmailModerationIntentConsumed, allowPaymentReceiptUpload = false, onUploadPaymentReceipts, receiptUploadPending = false, currentUserId = null, }: Props) {
    const [values, setValues] = useState<ExpenseFormValues>(EMPTY);
    const valuesRef = useRef(values);
    valuesRef.current = values;
    const [errors, setErrors] = useState<ExpenseFormErrors>({});
    const [filesPaymentDoc, setFilesPaymentDoc] = useState<File[]>([]);
    const [filesReceipt, setFilesReceipt] = useState<File[]>([]);
    const [fileSizeHint, setFileSizeHint] = useState<string | null>(null);
    const [attachmentOpenErr, setAttachmentOpenErr] = useState<string | null>(null);
    type AttachPreviewState = {
        fileName: string;
        loading: boolean;
        error: string | null;
        model: AttachmentPreviewModel | null;
        previewObjectUrl: string | null;
        server: {
            expenseId: string;
            attId: string;
        } | null;
        localFile: File | null;
    };
    const [attachPreview, setAttachPreview] = useState<AttachPreviewState | null>(null);
    const [cbuParsed, setCbuParsed] = useState<CbuParsed | null>(null);
    const [cbuLoading, setCbuLoading] = useState(false);
    const [cbuError, setCbuError] = useState<string | null>(null);
    const [moderationBusy, setModerationBusy] = useState(false);
    const [lifecycleBusy, setLifecycleBusy] = useState(false);
    const [moderationErr, setModerationErr] = useState<string | null>(null);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [reviseOpen, setReviseOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [reviseComment, setReviseComment] = useState('');
    const [panelConfirm, setPanelConfirm] = useState<PanelConfirmState>(null);
    const fileInputPaymentRef = useRef<HTMLInputElement>(null);
    const fileInputReceiptRef = useRef<HTMLInputElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const [expenseClientsProjects, setExpenseClientsProjects] = useState<ExpenseClientProjectsGroup[]>([]);
    const [expenseProjectClientId, setExpenseProjectClientId] = useState('');
    const [expenseProjectsLoading, setExpenseProjectsLoading] = useState(false);
    const [expenseProjectsError, setExpenseProjectsError] = useState<string | null>(null);
    const [expenseProjectCategories, setExpenseProjectCategories] = useState<ProjectExpenseCategoryRow[]>([]);
    const [expenseCategoriesLoading, setExpenseCategoriesLoading] = useState(false);
    const [expenseCategoriesError, setExpenseCategoriesError] = useState<string | null>(null);
    const equivUsd = useMemo(() => computeUsdEquivalent(values.amountCurrency, values.amountUzs, values.exchangeRate, values.foreignPerUsd), [values.amountCurrency, values.amountUzs, values.exchangeRate, values.foreignPerUsd]);
    const equiv = equivUsd != null ? asExpenseNumber(equivUsd).toFixed(2) : '';
    const viewEquivFromServer = useMemo(() => {
        const n = asExpenseNumber(editingRequest?.equivalentAmount);
        return n > 0 ? n.toFixed(2) : '';
    }, [editingRequest]);
    const equivHint = useMemo(() => {
        let line = '';
        if (values.amountCurrency === 'UZS') {
            line = 'Рассчитывается автоматически: сумма в сумах ÷ курс UZS/USD = USD';
        }
        else if (values.amountCurrency === 'USD') {
            line = 'Сумма уже в долларах США';
        }
        else {
            line = 'Пересчёт в USD по кросс-курсу через сум (курс ЦБ РУз)';
        }
        if (cbuParsed?.rateDateRu) {
            line += ` Курс ЦБ РУз на ${cbuParsed.rateDateRu} (cbu.uz).`;
        }
        return line;
    }, [values.amountCurrency, cbuParsed?.rateDateRu]);
    const showForeignRate = needsForeignUsdRate(values.amountCurrency);
    const foreignLocked = mode === 'create' &&
        cbuParsed != null &&
        !cbuError &&
        !cbuLoading &&
        showForeignRate &&
        values.foreignPerUsd.trim() !== '';
    useEffect(() => {
        if (!isOpen || mode !== 'create')
            return;
        setCbuParsed(null);
        setCbuError(null);
        setCbuLoading(false);
        setValues({ ...EMPTY, expenseDate: todayIsoLocal() });
        setFilesPaymentDoc([]);
        setFilesReceipt([]);
        setFileSizeHint(null);
        setErrors({});
    }, [isOpen, mode]);
    useEffect(() => {
        if (!isOpen || (mode !== 'edit' && mode !== 'view'))
            return;
        if (!editingRequest)
            return;
        setCbuParsed(null);
        setCbuError(null);
        setCbuLoading(false);
        setValues({
            description: editingRequest.description,
            expenseDate: editingRequest.expenseDate?.slice(0, 10) ?? '',
            paymentDeadline: editingRequest.paymentDeadline?.slice(0, 10) ?? '',
            expenseType: editingRequest.expenseType,
            expenseSubtype: editingRequest.expenseSubtype ?? '',
            isReimbursable: editingRequest.isReimbursable,
            amountCurrency: 'UZS',
            foreignPerUsd: '',
            amountUzs: String(editingRequest.amountUzs),
            exchangeRate: String(editingRequest.exchangeRate),
            paymentMethod: editingRequest.paymentMethod ?? '',
            projectId: editingRequest.projectId ?? '',
            expenseCategoryId: editingRequest.expenseCategoryId?.trim() ?? '',
            vendor: editingRequest.vendor ?? '',
            businessPurpose: editingRequest.businessPurpose ?? '',
            comment: editingRequest.comment ?? '',
        });
        setFilesPaymentDoc([]);
        setFilesReceipt([]);
        setFileSizeHint(null);
        setErrors({});
    }, [isOpen, mode, editingRequest]);
    useEffect(() => {
        if (!isOpen || mode !== 'create')
            return;
        const iso = todayIsoLocal();
        let cancelled = false;
        setCbuLoading(true);
        setCbuError(null);
        fetchCbuParsedForDate(iso)
            .then((parsed) => {
            if (cancelled)
                return;
            setCbuParsed(parsed);
            setCbuLoading(false);
            setValues((prev) => {
                const er = parsed.uzsPerUsd.toFixed(2);
                let fr = '';
                if (needsForeignUsdRate(prev.amountCurrency)) {
                    const fp = foreignUnitsPerUsd(parsed, prev.amountCurrency);
                    if (fp != null && fp > 0)
                        fr = formatForeignFp(fp);
                }
                return { ...prev, expenseDate: iso, exchangeRate: er, foreignPerUsd: fr };
            });
        })
            .catch((err) => {
            if (cancelled)
                return;
            setCbuParsed(null);
            setCbuLoading(false);
            setCbuError(err instanceof Error ? err.message : 'Не удалось загрузить курс ЦБ');
        });
        return () => { cancelled = true; };
    }, [isOpen, mode]);
    useEffect(() => {
        if (!isOpen) {
            setExpenseClientsProjects([]);
            setExpenseProjectClientId('');
            setExpenseProjectsError(null);
            setExpenseProjectsLoading(false);
            setExpenseProjectCategories([]);
            setExpenseCategoriesError(null);
            setExpenseCategoriesLoading(false);
            return;
        }
        let cancelled = false;
        setExpenseProjectsLoading(true);
        setExpenseProjectsError(null);
        void (async () => {
            try {
                const flat = await listProjectsForExpenses();
                const grouped = groupProjectsForExpenseForm(flat);
                if (!cancelled) {
                    setExpenseClientsProjects(grouped);
                    const pid = valuesRef.current.projectId.trim();
                    let nextClientId = grouped[0]?.client.id ?? '';
                    if (pid) {
                        const owner = grouped.find(g => g.projects.some(p => p.id === pid));
                        if (owner)
                            nextClientId = owner.client.id;
                    }
                    setExpenseProjectClientId(nextClientId);
                }
            }
            catch (e) {
                if (!cancelled) {
                    setExpenseClientsProjects([]);
                    setExpenseProjectClientId('');
                    setExpenseProjectsError(e instanceof Error ? e.message : 'Не удалось загрузить проекты');
                }
            }
            finally {
                if (!cancelled)
                    setExpenseProjectsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen]);
    useEffect(() => {
        if (!isOpen)
            return;
        const pid = values.projectId.trim();
        if (!pid) {
            setExpenseProjectCategories([]);
            setExpenseCategoriesError(null);
            setExpenseCategoriesLoading(false);
            return;
        }
        let cancelled = false;
        setExpenseCategoriesLoading(true);
        setExpenseCategoriesError(null);
        void listProjectExpenseCategories(pid)
            .then((rows) => {
            if (cancelled)
                return;
            const active = rows.filter((r) => !r.isArchived);
            setExpenseProjectCategories(active);
            setValues((prev) => {
                const cur = prev.expenseCategoryId.trim();
                if (!cur)
                    return prev;
                return active.some((r) => r.id === cur) ? prev : { ...prev, expenseCategoryId: '' };
            });
        })
            .catch((e) => {
            if (!cancelled) {
                setExpenseProjectCategories([]);
                setExpenseCategoriesError(e instanceof Error ? e.message : 'Не удалось загрузить категории');
            }
        })
            .finally(() => {
            if (!cancelled)
                setExpenseCategoriesLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [isOpen, values.projectId]);
    useEffect(() => {
        if (!isOpen || expenseClientsProjects.length === 0)
            return;
        const pid = values.projectId.trim();
        if (!pid)
            return;
        const owner = expenseClientsProjects.find(g => g.projects.some(p => p.id === pid));
        if (!owner)
            return;
        setExpenseProjectClientId(prev => (prev === owner.client.id ? prev : owner.client.id));
    }, [isOpen, expenseClientsProjects, values.projectId]);
    useEffect(() => {
        if (!isOpen || mode !== 'create' || !cbuParsed)
            return;
        if (!needsForeignUsdRate(values.amountCurrency)) {
            setValues(prev => (prev.foreignPerUsd === '' ? prev : { ...prev, foreignPerUsd: '' }));
            return;
        }
        const fp = foreignUnitsPerUsd(cbuParsed, values.amountCurrency);
        if (fp == null || fp <= 0)
            return;
        const s = formatForeignFp(fp);
        setValues(prev => (prev.foreignPerUsd === s ? prev : { ...prev, foreignPerUsd: s }));
    }, [isOpen, mode, cbuParsed, values.amountCurrency]);
    const formAsyncBusy = saveDraftPending || submitPending || receiptUploadPending || lifecycleBusy;
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !formAsyncBusy)
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose, formAsyncBusy]);
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);
    const set = useCallback((field: keyof Omit<ExpenseFormValues, 'isReimbursable'>, val: string) => {
        if (field === 'expenseType' && val !== EXPENSE_TYPE_CLIENT) {
            setExpenseProjectClientId('');
        }
        setValues(prev => {
            const next: ExpenseFormValues = { ...prev, [field]: val };
            if (field === 'expenseType' && val !== 'partner_expense') {
                next.expenseSubtype = '';
            }
            if (field === 'expenseType' && val !== EXPENSE_TYPE_CLIENT) {
                next.projectId = '';
                next.expenseCategoryId = '';
                next.vendor = '';
                next.comment = '';
            }
            return next;
        });
        setErrors(prev => ({
            ...prev,
            [field]: undefined,
            ...(field === 'expenseType'
                ? { expenseSubtype: undefined, projectId: undefined, expenseCategoryId: undefined, comment: undefined, vendor: undefined }
                : {}),
        }));
    }, []);
    const handleExpenseClientPick = useCallback((client: TimeManagerClientRow) => {
        setExpenseProjectClientId(client.id);
        setValues(prev => {
            const gid = expenseClientsProjects.find(g => g.client.id === client.id);
            const keep = gid?.projects.some(p => p.id === prev.projectId) ?? false;
            return {
                ...prev,
                vendor: client.name,
                projectId: keep ? prev.projectId : '',
                expenseCategoryId: keep ? prev.expenseCategoryId : '',
            };
        });
        setErrors(prev => ({ ...prev, projectId: undefined }));
    }, [expenseClientsProjects]);
    const handleExpenseProjectPick = useCallback((row: ExpenseProjectPickRow) => {
        setExpenseProjectClientId(row.client.id);
        setValues(prev => ({
            ...prev,
            projectId: row.project.id,
            vendor: row.client.name,
            expenseCategoryId: '',
        }));
        setErrors(prev => ({ ...prev, projectId: undefined, expenseCategoryId: undefined }));
    }, []);
    const filterExpenseProjectRows = useCallback((rows: readonly ExpenseProjectPickRow[], q: string) => {
        if (q) {
            return rows.filter(r => `${r.client.name} ${r.project.name} ${r.project.code ?? ''}`.toLowerCase().includes(q));
        }
        if (!expenseProjectClientId)
            return [...rows];
        return rows.filter(r => r.client.id === expenseProjectClientId);
    }, [expenseProjectClientId]);
    const setCurrency = useCallback((c: ExpenseAmountCurrency) => {
        setValues(prev => ({
            ...prev,
            amountCurrency: c,
            foreignPerUsd: '',
        }));
        setErrors(prev => ({ ...prev, foreignPerUsd: undefined }));
    }, []);
    const setReimb = useCallback((val: boolean) => {
        if (val === false) {
            setExpenseProjectClientId('');
        }
        setValues(prev => ({
            ...prev,
            isReimbursable: val,
            ...(val === false
                ? { projectId: '', expenseCategoryId: '', vendor: '', comment: '' }
                : {}),
        }));
        if (val === false) {
            setFilesPaymentDoc([]);
            setFilesReceipt([]);
        }
        setErrors(prev => ({
            ...prev,
            isReimbursable: undefined,
            ...(val === false
                ? {
                    projectId: undefined,
                    expenseCategoryId: undefined,
                    comment: undefined,
                    attachmentsPaymentDoc: undefined,
                    attachmentsReceipt: undefined,
                }
                : {}),
        }));
    }, []);
    const filesByKind: ExpenseFilesByKind = useMemo(() => ({ payment_document: filesPaymentDoc, payment_receipt: filesReceipt }), [filesPaymentDoc, filesReceipt]);
    const valuesForSave = useCallback((): ExpenseFormValues => {
        if (mode === 'create')
            return { ...values, expenseDate: todayIsoLocal() };
        return values;
    }, [mode, values]);
    const handleSaveDraft = useCallback(() => {
        const v = valuesForSave();
        const errs = validate(v, {
            forSubmit: false,
            filesPaymentDoc,
            filesReceipt,
            serverAttachments: editingRequest?.attachments,
            projectExpenseCategoryCount: expenseProjectCategories.length,
        });
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            setTimeout(() => {
                bodyRef.current?.querySelector('[data-err]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
            return;
        }
        onSaveDraft(v, filesByKind);
    }, [
        valuesForSave,
        filesByKind,
        filesPaymentDoc,
        filesReceipt,
        editingRequest?.attachments,
        expenseProjectCategories.length,
        onSaveDraft,
    ]);
    const handleSubmit = useCallback(() => {
        const v = valuesForSave();
        const errs = validate(v, {
            forSubmit: true,
            filesPaymentDoc,
            filesReceipt,
            serverAttachments: editingRequest?.attachments,
            projectExpenseCategoryCount: expenseProjectCategories.length,
        });
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            setTimeout(() => {
                bodyRef.current?.querySelector('[data-err]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
            return;
        }
        onSubmit(v, filesByKind);
    }, [
        valuesForSave,
        filesByKind,
        filesPaymentDoc,
        filesReceipt,
        editingRequest?.attachments,
        expenseProjectCategories.length,
        onSubmit,
    ]);
    const closeAttachPreview = useCallback(() => {
        setAttachPreview(prev => {
            if (prev?.previewObjectUrl)
                URL.revokeObjectURL(prev.previewObjectUrl);
            return null;
        });
    }, []);
    useEffect(() => {
        if (!isOpen) {
            setRejectOpen(false);
            setReviseOpen(false);
            setRejectReason('');
            setReviseComment('');
            setPanelConfirm(null);
            setModerationErr(null);
            setModerationBusy(false);
            setLifecycleBusy(false);
            setAttachmentOpenErr(null);
            closeAttachPreview();
        }
    }, [isOpen, closeAttachPreview]);
    const isView = mode === 'view';
    const expenseClientsFlat = useMemo(() => expenseClientsProjects.map(g => g.client), [expenseClientsProjects]);
    const expenseProjectRowsFlat = useMemo((): ExpenseProjectPickRow[] => {
        const out: ExpenseProjectPickRow[] = [];
        for (const g of expenseClientsProjects) {
            for (const p of g.projects)
                out.push({ client: g.client, project: p });
        }
        return out;
    }, [expenseClientsProjects]);
    const selectedExpenseProjectMeta = useMemo(() => {
        const pid = values.projectId.trim();
        if (!pid)
            return null;
        for (const g of expenseClientsProjects) {
            const p = g.projects.find(x => x.id === pid);
            if (p)
                return { client: g.client, project: p };
        }
        return null;
    }, [values.projectId, expenseClientsProjects]);
    const showAdditionalSection = useMemo(() => values.expenseType === EXPENSE_TYPE_CLIENT, [values.expenseType]);
    const handleDeleteServerAttachment = useCallback(async (attId: string) => {
        if (!editingRequest || !onExpenseSnapshotUpdated)
            return;
        if (isView) {
            if (!allowPaymentReceiptUpload)
                return;
            const att = editingRequest.attachments?.find(a => a.id === attId);
            if (att?.attachmentKind !== 'payment_receipt')
                return;
        }
        try {
            const r = await deleteAttachment(editingRequest.id, attId);
            onExpenseSnapshotUpdated(r);
        }
        catch {
        }
    }, [editingRequest, isView, allowPaymentReceiptUpload, onExpenseSnapshotUpdated]);
    const openServerAttachmentPreview = useCallback(async (attId: string, fileName: string) => {
        if (!editingRequest)
            return;
        setAttachmentOpenErr(null);
        const expenseId = editingRequest.id;
        setAttachPreview(prev => {
            if (prev?.previewObjectUrl)
                URL.revokeObjectURL(prev.previewObjectUrl);
            return {
                fileName,
                loading: true,
                error: null,
                model: null,
                previewObjectUrl: null,
                server: { expenseId, attId },
                localFile: null,
            };
        });
        try {
            const { blob, contentType } = await fetchExpenseAttachmentBlob(expenseId, attId);
            const { model, objectUrl } = await buildAttachmentPreview(blob, fileName, contentType);
            setAttachPreview(prev => prev?.server?.attId === attId && prev.server.expenseId === expenseId
                ? { ...prev, loading: false, model, previewObjectUrl: objectUrl, error: null }
                : prev);
        }
        catch (e) {
            setAttachPreview(prev => prev?.server?.attId === attId && prev.server.expenseId === expenseId
                ? {
                    ...prev,
                    loading: false,
                    error: e instanceof Error ? e.message : 'Не удалось загрузить файл',
                    model: null,
                    previewObjectUrl: null,
                }
                : prev);
        }
    }, [editingRequest]);
    const openLocalAttachmentPreview = useCallback(async (file: File) => {
        setAttachmentOpenErr(null);
        setAttachPreview(prev => {
            if (prev?.previewObjectUrl)
                URL.revokeObjectURL(prev.previewObjectUrl);
            return {
                fileName: file.name,
                loading: true,
                error: null,
                model: null,
                previewObjectUrl: null,
                server: null,
                localFile: file,
            };
        });
        try {
            const { model, objectUrl } = await buildAttachmentPreview(file, file.name, file.type || null);
            setAttachPreview({
                fileName: file.name,
                loading: false,
                error: null,
                model,
                previewObjectUrl: objectUrl,
                server: null,
                localFile: file,
            });
        }
        catch (e) {
            setAttachPreview({
                fileName: file.name,
                loading: false,
                error: e instanceof Error ? e.message : 'Не удалось подготовить превью',
                model: null,
                previewObjectUrl: null,
                server: null,
                localFile: file,
            });
        }
    }, []);
    const openAttachmentExternal = useCallback(() => {
        if (!attachPreview)
            return;
        setAttachmentOpenErr(null);
        if (attachPreview.server) {
            void openExpenseAttachmentInNewTab(attachPreview.server.expenseId, attachPreview.server.attId).catch(err => {
                setAttachmentOpenErr(err instanceof Error ? err.message : 'Не удалось открыть файл');
            });
            return;
        }
        if (attachPreview.localFile) {
            const u = URL.createObjectURL(attachPreview.localFile);
            const w = window.open(u, '_blank', 'noopener,noreferrer');
            if (!w) {
                URL.revokeObjectURL(u);
                setAttachmentOpenErr('Браузер заблокировал новую вкладку.');
            }
            else {
                window.setTimeout(() => URL.revokeObjectURL(u), 120000);
            }
            return;
        }
        if (attachPreview.previewObjectUrl) {
            const w = window.open(attachPreview.previewObjectUrl, '_blank', 'noopener,noreferrer');
            if (!w)
                setAttachmentOpenErr('Браузер заблокировал новую вкладку.');
        }
    }, [attachPreview]);
    const handleConfirmReceiptUpload = useCallback(async () => {
        if (!onUploadPaymentReceipts || filesReceipt.length === 0)
            return;
        try {
            await onUploadPaymentReceipts(filesReceipt);
            setFilesReceipt([]);
            setErrors(prev => ({ ...prev, attachmentsReceipt: undefined }));
        }
        catch {
        }
    }, [onUploadPaymentReceipts, filesReceipt]);
    const blockedModerationOwn = Boolean(editingRequest &&
        isModerationBlockedForOwnExpense(Boolean(canModerate), currentUserId, editingRequest));
    const showOwnModerationBlockedHint = Boolean(isView &&
        editingRequest &&
        showOwnPendingModerationBlockedHint(editingRequest, Boolean(canModerate), blockedModerationOwn));
    const showModerationActions = Boolean(isView &&
        editingRequest &&
        showPendingApprovalModeration(editingRequest, Boolean(canModerate), blockedModerationOwn));
    const showPayAction = Boolean(isView && canModerate && editingRequest && showPayExpenseAction(editingRequest, blockedModerationOwn));
    const closeExpenseUi = isView && canModerate && editingRequest ? getCloseExpenseUi(editingRequest, blockedModerationOwn) : null;
    const showLifecycleRow = Boolean(isView &&
        editingRequest &&
        showLifecycleModerationRow(editingRequest, Boolean(canModerate), blockedModerationOwn));
    const showWithdrawAction = Boolean(isView && editingRequest && showWithdrawExpenseAction(editingRequest, currentUserId));
    const openApproveConfirm = useCallback(() => {
        if (!editingRequest || moderationBusy || lifecycleBusy)
            return;
        setModerationErr(null);
        setPanelConfirm({ kind: 'approve' });
    }, [editingRequest, moderationBusy, lifecycleBusy]);
    const handleRejectConfirm = useCallback(async () => {
        if (!editingRequest || moderationBusy)
            return;
        const t = rejectReason.trim();
        if (!t) {
            setModerationErr('Укажите причину отклонения');
            return;
        }
        setModerationErr(null);
        setModerationBusy(true);
        try {
            const r = await rejectExpense(editingRequest.id, t);
            setRejectOpen(false);
            setRejectReason('');
            onExpenseUpdated?.(r);
            onClose();
        }
        catch (e) {
            setModerationErr(e instanceof Error ? e.message : 'Не удалось отклонить заявку');
        }
        finally {
            setModerationBusy(false);
        }
    }, [editingRequest, moderationBusy, rejectReason, onExpenseUpdated, onClose]);
    const handleReviseConfirm = useCallback(async () => {
        if (!editingRequest || moderationBusy)
            return;
        const t = reviseComment.trim();
        if (!t) {
            setModerationErr('Укажите комментарий для автора');
            return;
        }
        setModerationErr(null);
        setModerationBusy(true);
        try {
            const r = await reviseExpense(editingRequest.id, t);
            setReviseOpen(false);
            setReviseComment('');
            onExpenseUpdated?.(r);
            onClose();
        }
        catch (e) {
            setModerationErr(e instanceof Error ? e.message : 'Не удалось вернуть заявку на доработку');
        }
        finally {
            setModerationBusy(false);
        }
    }, [editingRequest, moderationBusy, reviseComment, onExpenseUpdated, onClose]);
    const openPayConfirm = useCallback(() => {
        if (!editingRequest || lifecycleBusy || moderationBusy)
            return;
        setModerationErr(null);
        setPanelConfirm({ kind: 'pay' });
    }, [editingRequest, lifecycleBusy, moderationBusy]);
    const openCloseLifecycleConfirm = useCallback(() => {
        if (!editingRequest || lifecycleBusy || moderationBusy || !closeExpenseUi)
            return;
        setModerationErr(null);
        setPanelConfirm({
            kind: 'close',
            message: closeExpenseUi.confirmMessage,
            confirmLabel: closeExpenseUi.label,
        });
    }, [editingRequest, lifecycleBusy, moderationBusy, closeExpenseUi]);
    const openWithdrawConfirm = useCallback(() => {
        if (!editingRequest || lifecycleBusy || moderationBusy)
            return;
        setModerationErr(null);
        setPanelConfirm({ kind: 'withdraw' });
    }, [editingRequest, lifecycleBusy, moderationBusy]);
    const handlePanelConfirmSubmit = useCallback(async () => {
        if (!editingRequest || !panelConfirm)
            return;
        const fail = (msg: string) => {
            setPanelConfirm(null);
            setModerationErr(msg);
        };
        if (panelConfirm.kind === 'approve') {
            if (moderationBusy)
                return;
            setModerationErr(null);
            setModerationBusy(true);
            try {
                const r = await approveExpense(editingRequest.id);
                setPanelConfirm(null);
                if (onExpenseSnapshotUpdated) {
                    onExpenseSnapshotUpdated(r);
                }
                else {
                    onExpenseUpdated?.(r);
                    onClose();
                }
            }
            catch (e) {
                fail(e instanceof Error ? e.message : 'Не удалось одобрить заявку');
            }
            finally {
                setModerationBusy(false);
            }
            return;
        }
        if (panelConfirm.kind === 'pay') {
            if (lifecycleBusy || moderationBusy)
                return;
            setModerationErr(null);
            setLifecycleBusy(true);
            try {
                const r = await payExpense(editingRequest.id);
                setPanelConfirm(null);
                onExpenseUpdated?.(r);
            }
            catch (e) {
                fail(e instanceof Error
                    ? e.message
                    : 'Не удалось отметить оплату');
            }
            finally {
                setLifecycleBusy(false);
            }
            return;
        }
        if (panelConfirm.kind === 'close') {
            if (lifecycleBusy || moderationBusy)
                return;
            setModerationErr(null);
            setLifecycleBusy(true);
            try {
                const r = await closeExpense(editingRequest.id);
                setPanelConfirm(null);
                onExpenseUpdated?.(r);
            }
            catch (e) {
                fail(e instanceof Error ? e.message : 'Не удалось выполнить закрытие');
            }
            finally {
                setLifecycleBusy(false);
            }
            return;
        }
        if (lifecycleBusy || moderationBusy)
            return;
        setModerationErr(null);
        setLifecycleBusy(true);
        try {
            const r = await withdrawExpense(editingRequest.id);
            setPanelConfirm(null);
            onExpenseUpdated?.(r);
        }
        catch (e) {
            fail(e instanceof Error ? e.message : 'Не удалось отозвать заявку');
        }
        finally {
            setLifecycleBusy(false);
        }
    }, [
        panelConfirm,
        editingRequest,
        moderationBusy,
        lifecycleBusy,
        onExpenseSnapshotUpdated,
        onExpenseUpdated,
        onClose,
    ]);
    const emailIntentHandledRef = useRef<string | null>(null);
    useEffect(() => {
        if (!isOpen) {
            emailIntentHandledRef.current = null;
            return;
        }
        if (!emailModerationIntent || !editingRequest)
            return;
        const key = `${editingRequest.id}:${emailModerationIntent}`;
        if (emailIntentHandledRef.current === key)
            return;
        const canEmailModerate = showPendingApprovalModeration(editingRequest, Boolean(canModerate), isModerationBlockedForOwnExpense(Boolean(canModerate), currentUserId, editingRequest));
        if (!canEmailModerate) {
            const cannotApply = !canModerate || editingRequest.status !== 'pending_approval';
            if (cannotApply) {
                emailIntentHandledRef.current = key;
                onEmailModerationIntentConsumed?.();
            }
            return;
        }
        emailIntentHandledRef.current = key;
        onEmailModerationIntentConsumed?.();
        if (emailModerationIntent === 'reject') {
            setRejectOpen(true);
            return;
        }
        setPanelConfirm({ kind: 'approve' });
    }, [
        isOpen,
        emailModerationIntent,
        editingRequest,
        currentUserId,
        canModerate,
        onEmailModerationIntentConsumed,
    ]);
    const title = mode === 'create' ? 'Новая заявка' : mode === 'edit' ? 'Редактировать заявку' : 'Просмотр заявки';
    const scrollLockActive = isOpen || rejectOpen || reviseOpen || Boolean(panelConfirm);
    useEffect(() => {
        if (!scrollLockActive)
            return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [scrollLockActive]);
    const portalLayer = (<>
      {rejectOpen && editingRequest && (<div className="exp-mod-backdrop" role="presentation">
          <div className="exp-mod-dialog" role="dialog" aria-modal aria-labelledby="exp-mod-reject-title" onClick={e => e.stopPropagation()}>
            <h3 id="exp-mod-reject-title" className="exp-mod-dialog__title">Отклонить заявку</h3>
            <p className="exp-mod-dialog__sub">Заявка {editingRequest.id}. Укажите причину — автор её увидит в истории.</p>
            <textarea className="exp-mod-dialog__textarea" rows={4} placeholder="Причина отклонения" value={rejectReason} onChange={e => setRejectReason(e.target.value)} disabled={moderationBusy}/>
            {moderationErr && rejectOpen && <p className="exp-mod-err" role="alert">{moderationErr}</p>}
            <div className="exp-mod-dialog__ft">
              <button type="button" className="exp-panel-btn exp-panel-btn--ghost" disabled={moderationBusy} onClick={() => { setRejectOpen(false); setModerationErr(null); }}>Отмена</button>
              <button type="button" className="exp-panel-btn exp-panel-btn--primary exp-panel-btn--danger" disabled={moderationBusy} onClick={handleRejectConfirm}>Отклонить</button>
            </div>
          </div>
        </div>)}
      {reviseOpen && editingRequest && (<div className="exp-mod-backdrop" role="presentation">
          <div className="exp-mod-dialog" role="dialog" aria-modal aria-labelledby="exp-mod-revise-title" onClick={e => e.stopPropagation()}>
            <h3 id="exp-mod-revise-title" className="exp-mod-dialog__title">Вернуть на доработку</h3>
            <p className="exp-mod-dialog__sub">Заявка {editingRequest.id}. Автор сможет исправить заявку и отправить снова.</p>
            <textarea className="exp-mod-dialog__textarea" rows={4} placeholder="Что нужно исправить или дополнить" value={reviseComment} onChange={e => setReviseComment(e.target.value)} disabled={moderationBusy}/>
            {moderationErr && reviseOpen && <p className="exp-mod-err" role="alert">{moderationErr}</p>}
            <div className="exp-mod-dialog__ft">
              <button type="button" className="exp-panel-btn exp-panel-btn--ghost" disabled={moderationBusy} onClick={() => { setReviseOpen(false); setModerationErr(null); }}>Отмена</button>
              <button type="button" className="exp-panel-btn exp-panel-btn--primary" disabled={moderationBusy} onClick={handleReviseConfirm}>Вернуть</button>
            </div>
          </div>
        </div>)}
      {panelConfirm && (<ExpenseConfirmDialog isOpen title={panelConfirm.kind === 'approve'
                ? 'Одобрить заявку?'
                : panelConfirm.kind === 'pay'
                    ? 'Отметить оплату?'
                    : panelConfirm.kind === 'close'
                        ? 'Подтверждение'
                        : 'Отозвать заявку?'} message={panelConfirm.kind === 'approve' ? (<>
                <p className="exp-mod-dialog__sub">Статус станет «Одобрено».</p>
                {editingRequest?.isReimbursable ? (<p className="exp-mod-dialog__sub">
                    После одобрения, когда компания оплатит расход, нажмите «Оплачено».
                  </p>) : null}
              </>) : panelConfirm.kind === 'pay' ? (<p className="exp-mod-dialog__sub">Заявка будет переведена в статус «Выплачено».</p>) : panelConfirm.kind === 'close' ? (<p className="exp-mod-dialog__sub">{panelConfirm.message}</p>) : (<p className="exp-mod-dialog__sub">Статус заявки станет «Отозвана».</p>)} confirmLabel={panelConfirm.kind === 'approve'
                ? 'Одобрить'
                : panelConfirm.kind === 'pay'
                    ? 'Оплачено'
                    : panelConfirm.kind === 'close'
                        ? panelConfirm.confirmLabel
                        : 'Отозвать'} confirmVariant={panelConfirm.kind === 'withdraw' ? 'danger' : 'primary'} busy={panelConfirm.kind === 'approve' ? moderationBusy : lifecycleBusy} onClose={() => {
                const busy = panelConfirm.kind === 'approve' ? moderationBusy : lifecycleBusy;
                if (!busy)
                    setPanelConfirm(null);
            }} onConfirm={handlePanelConfirmSubmit}/>)}
      <ExpenseAttachmentPreviewModal isOpen={attachPreview != null} fileName={attachPreview?.fileName ?? ''} loading={attachPreview?.loading ?? false} error={attachPreview?.error ?? null} model={attachPreview?.model ?? null} canOpenExternal={Boolean(attachPreview &&
            (attachPreview.server || attachPreview.localFile || attachPreview.previewObjectUrl))} onClose={closeAttachPreview} onOpenExternal={openAttachmentExternal}/>
      <div className={`exp-panel-overlay${isOpen ? ' exp-panel-overlay--open' : ''}`} aria-hidden/>
      <aside className={`exp-panel${isOpen ? ' exp-panel--open' : ''}${formAsyncBusy ? ' exp-panel--async-busy' : ''}`} aria-modal aria-busy={formAsyncBusy} aria-label={title}>
        
        <div className="exp-panel__hd">
          <div className="exp-panel__hd-left">
            {isView && editingRequest && (<span className={`exp-status exp-status--${editingRequest.status}`}>
                {STATUS_META[editingRequest.status]?.label ?? editingRequest.status}
              </span>)}
            <h2 className="exp-panel__title">{title}</h2>
          </div>
          <button type="button" className="exp-panel__close" onClick={onClose} aria-label="Закрыть" disabled={formAsyncBusy}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        
        <div className="exp-panel__body" ref={bodyRef}>

          
          <div className="exp-form-block">
            <p className="exp-form-block__title">Основная информация</p>

            {editingRequest && (<div className="exp-form-field">
                <div className="exp-form-label">Автор заявки</div>
                <p className="exp-form-static">{formatExpenseAuthorLabel(editingRequest)}</p>
                {editingRequest.createdBy?.position && (<p className="exp-form-static exp-form-static--muted">{editingRequest.createdBy.position}</p>)}
                {editingRequest.createdBy?.displayName && editingRequest.createdBy?.email && (<p className="exp-form-static exp-form-static--muted">{editingRequest.createdBy.email}</p>)}
              </div>)}

            {editingRequest?.status === 'paid' && (<div className="exp-form-field">
                <div className="exp-form-label">Оплату отметил(а)</div>
                <p className="exp-form-static">{formatExpensePaidByLabel(editingRequest)}</p>
                {editingRequest.paidBy?.email && (<p className="exp-form-static exp-form-static--muted">{editingRequest.paidBy.email}</p>)}
              </div>)}

            <div className={`exp-form-field${errors.expenseType ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">Тип расхода <span className="exp-form-req">*</span></label>
              <select className="exp-form-select" value={values.expenseType} onChange={e => set('expenseType', e.target.value)} disabled={isView}>
                <option value="">Выберите тип</option>
                {EXPENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {errors.expenseType && <p className="exp-form-err-msg" data-err>{errors.expenseType}</p>}
            </div>

            {values.expenseType === 'partner_expense' && (<div className={`exp-form-field${errors.expenseSubtype ? ' exp-form-field--err' : ''}`}>
                <label className="exp-form-label">
                  Категория расхода партнёра <span className="exp-form-req">*</span>
                </label>
                {isView ? (<p className="exp-form-static">
                    {values.expenseSubtype
                    ? getPartnerExpenseSubtypeLabel(values.expenseSubtype) || values.expenseSubtype
                    : '—'}
                  </p>) : (<select className="exp-form-select" value={values.expenseSubtype} onChange={e => set('expenseSubtype', e.target.value)}>
                    <option value="">Выберите категорию</option>
                    {PARTNER_EXPENSE_CATEGORIES.map(c => (<option key={c.value} value={c.value}>
                        {c.label}
                      </option>))}
                  </select>)}
                {!isView && (<p className="exp-form-hint" style={{ marginTop: '0.35rem' }}>
                    Расход партнёра записывается сразу в статус <strong>«Одобрено»</strong> — цепочки согласования нет, уходит информационное письмо.
                  </p>)}
                {errors.expenseSubtype && <p className="exp-form-err-msg" data-err>{errors.expenseSubtype}</p>}
              </div>)}

            <div className={`exp-form-field${errors.description ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">Описание расхода <span className="exp-form-req">*</span></label>
              <textarea className="exp-form-textarea" placeholder="Например: оплата такси, покупка канцтоваров, бронь гостиницы" value={values.description} onChange={e => set('description', e.target.value)} disabled={isView} rows={3}/>
              {errors.description && <p className="exp-form-err-msg" data-err>{errors.description}</p>}
            </div>

            {values.expenseType === 'other' && values.isReimbursable && (<div className={`exp-form-field${errors.comment ? ' exp-form-field--err' : ''}`}>
                <label className="exp-form-label">
                  Комментарий к типу «Прочее» <span className="exp-form-req">*</span>
                </label>
                <p className="exp-form-hint" style={{ margin: '0 0 0.4rem' }}>
                  Обязателен при возмещаемом расходе. Поле отдельно от блока «Дополнительно» (он только для типа «За клиента»).
                </p>
                {isView ? (<p className="exp-form-static">
                    {values.comment.trim() ? values.comment : '—'}
                  </p>) : (<textarea className="exp-form-textarea" placeholder="Поясните суть расхода" value={values.comment} onChange={e => {
                set('comment', e.target.value);
                if (errors.comment) {
                    setErrors(prev => ({ ...prev, comment: undefined }));
                }
            }} rows={3} aria-invalid={Boolean(errors.comment)}/>)}
                {errors.comment && <p className="exp-form-err-msg" data-err>{errors.comment}</p>}
              </div>)}
          </div>

          
          <div className="exp-form-block">
            <p className="exp-form-block__title">Финансы</p>

            {mode === 'create' && (<p className="exp-form-hint">
                Дата расхода — сегодняшний день; курс UZS/USD и кросс-курсы подставляются с cbu.uz на эту дату.
              </p>)}

            {(mode === 'edit' || mode === 'view') && values.expenseDate && (<div className="exp-form-field">
                <div className="exp-form-label">Дата расхода</div>
                <p className="exp-form-static">{fmtIsoDateRu(values.expenseDate)}</p>
              </div>)}

            <div className={`exp-form-field${errors.paymentDeadline ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">Конечный срок оплаты</label>
              <input type="date" className="exp-form-input" value={values.paymentDeadline} onChange={e => set('paymentDeadline', e.target.value)} disabled={isView}/>
              <p className="exp-form-hint">Необязательно: крайняя дата, к которой ожидается оплата</p>
              {errors.paymentDeadline && <p className="exp-form-err-msg" data-err>{errors.paymentDeadline}</p>}
            </div>

            <div className={`exp-form-field${errors.exchangeRate ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">Курс UZS / USD <span className="exp-form-req">*</span></label>
              <div className="exp-form-input-wrap">
                <input type="number" min={0} className="exp-form-input" placeholder="12 800" value={values.exchangeRate} onChange={e => set('exchangeRate', e.target.value)} disabled={isView || (mode === 'create' && cbuLoading)}/>
                <span className="exp-form-suffix">UZS</span>
              </div>
              {mode === 'create' && cbuLoading && (<p className="exp-form-hint">Загрузка курса ЦБ РУз…</p>)}
              {mode === 'create' && cbuParsed && !cbuLoading && (<p className="exp-form-hint">Подставлено с ЦБ РУз ({cbuParsed.rateDateRu}); при необходимости скорректируйте вручную</p>)}
              {mode === 'create' && cbuError && !cbuLoading && (<p className="exp-form-err-msg" role="alert">{cbuError}. Укажите курс вручную.</p>)}
              {errors.exchangeRate && <p className="exp-form-err-msg" data-err>{errors.exchangeRate}</p>}
            </div>

            <div className={`exp-form-field${errors.amountUzs ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">Сумма <span className="exp-form-req">*</span></label>
              <div className="exp-form-input-wrap">
                <input type="number" min={0} className="exp-form-input" placeholder="0" value={values.amountUzs} onChange={e => set('amountUzs', e.target.value)} disabled={isView}/>
                <select className="exp-form-currency-select" value={values.amountCurrency} onChange={e => setCurrency(e.target.value as ExpenseAmountCurrency)} disabled={isView} aria-label="Валюта суммы">
                  {EXPENSE_CURRENCIES.map(c => (<option key={c.value} value={c.value}>{c.label}</option>))}
                </select>
              </div>
              {errors.amountUzs && <p className="exp-form-err-msg" data-err>{errors.amountUzs}</p>}
            </div>

            {showForeignRate && (<div className={`exp-form-field${errors.foreignPerUsd ? ' exp-form-field--err' : ''}`}>
                <label className="exp-form-label">
                  Единиц валюты за 1 USD <span className="exp-form-req">*</span>
                </label>
                <div className="exp-form-input-wrap">
                  <input type="number" min={0} step="any" className="exp-form-input" placeholder="Например: 90" value={values.foreignPerUsd} onChange={e => set('foreignPerUsd', e.target.value)} disabled={isView} readOnly={!isView && foreignLocked}/>
                </div>
                <p className="exp-form-hint">
                  {foreignLocked
                ? 'Рассчитано по курсам ЦБ РУз (через сум к USD и к выбранной валюте)'
                : 'Сколько единиц выбранной валюты составляет 1 USD на дату расхода'}
                </p>
                {errors.foreignPerUsd && <p className="exp-form-err-msg" data-err>{errors.foreignPerUsd}</p>}
              </div>)}

            <div className="exp-form-field">
              <label className="exp-form-label">Эквивалентная сумма</label>
              <div className="exp-form-input-wrap">
                <input type="text" className="exp-form-input exp-form-input--calc" value={equiv || (isView ? viewEquivFromServer : '')} readOnly tabIndex={-1} placeholder="—"/>
                <span className="exp-form-suffix">USD</span>
              </div>
              <p className="exp-form-hint">{equivHint}</p>
            </div>

            <div className="exp-form-field">
              <label className="exp-form-label">Способ оплаты</label>
              <select className="exp-form-select" value={values.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} disabled={isView}>
                <option value="">Не указан</option>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div className="exp-form-field">
              <div className="exp-form-switch-row">
                <div className="exp-form-switch-info">
                  <span className="exp-form-label" style={{ marginBottom: 0 }}>
                    Возмещаемый расход
                  </span>
                  <p className="exp-form-hint" style={{ margin: '0.25rem 0 0 0' }}>
                    Включите для заявок с документом для оплаты. Проект, клиент и прочее в блоке «Дополнительно» — только
                    при типе расхода «За клиента».
                  </p>
                </div>
                <button type="button" role="switch" aria-checked={values.isReimbursable === true} className={`exp-form-switch${values.isReimbursable === true ? ' exp-form-switch--on' : ''}${isView ? ' exp-form-switch--disabled' : ''}`} onClick={() => { if (!isView)
        setReimb(values.isReimbursable !== true); }}>
                  <span className="exp-form-switch__thumb"/>
                </button>
              </div>
            </div>
          </div>

          
          {showAdditionalSection && (<div className="exp-form-block">
              <p className="exp-form-block__title">Дополнительно</p>
              <p className="exp-form-hint" style={{ margin: '-0.35rem 0 0.75rem 0' }}>
                Только для типа <strong>«За клиента»</strong>: привязка к клиенту и проекту из учёта времени, контрагент, комментарий
                к заявке.
              </p>
              {values.isReimbursable === false && (<p className="exp-form-hint" style={{ margin: '0 0 0.75rem 0' }}>
                  Для <strong>невозмещаемого</strong> расхода проект, контрагент и комментарий не обязательны, если не нужны для учёта.
                </p>)}
              {values.isReimbursable === true && (<p className="exp-form-hint" style={{ margin: '0 0 0.75rem 0' }}>
                  <strong>Проект</strong> обязателен (справочник учёта времени). В «Контрагент / Поставщик» подставляется клиент
                  проекта. При настроенных категориях у проекта — укажите категорию расхода.
                </p>)}

              <div className={`exp-form-field exp-form-field--project${errors.projectId ? ' exp-form-field--err' : ''}`}>
                {expenseProjectsError && (<p className="exp-form-err-msg" role="alert">
                    {expenseProjectsError}
                  </p>)}

                {isView ? (<>
                    {selectedExpenseProjectMeta ? (<div className="exp-project-picker__card exp-project-picker__card--selected exp-project-picker__card--readonly" aria-label="Выбранный проект">
                        <ExpenseProjectCardBody project={selectedExpenseProjectMeta.project}/>
                        <p className="exp-project-picker__client-line">{selectedExpenseProjectMeta.client.name}</p>
                      </div>) : values.projectId.trim() ? (<p className="exp-form-static">Проект не найден в справочнике (ID сохранён в заявке).</p>) : (<p className="exp-form-static exp-form-static--muted">Не указан</p>)}
                  </>) : (<>
                    {expenseProjectsLoading && (<div className="exp-project-picker__loading" role="status">
                        Загрузка проектов…
                      </div>)}
                    {!expenseProjectsLoading &&
                    !expenseProjectsError &&
                    expenseClientsProjects.length === 0 && (<p className="exp-form-hint">
                          Нет клиентов: добавьте их в разделе «Учёт времени» → «Настройки».
                        </p>)}
                    {!expenseProjectsLoading &&
                    !expenseProjectsError &&
                    expenseClientsProjects.length > 0 && (<div className="exp-project-picker">
                          {selectedExpenseProjectMeta &&
                        selectedExpenseProjectMeta.client.id !== expenseProjectClientId && (<div className="exp-project-picker__banner" role="status">
                                <span className="exp-project-picker__banner-text">
                                  Выбран проект «{selectedExpenseProjectMeta.project.name}» (
                                  {selectedExpenseProjectMeta.client.name}).
                                </span>
                                <button type="button" className="exp-project-picker__banner-action" onClick={() => handleExpenseClientPick(selectedExpenseProjectMeta.client)}>
                                  Выбрать этого клиента
                                </button>
                              </div>)}

                          <div className="exp-project-picker__field">
                            <label className="exp-form-label">Клиент</label>
                            <ExpenseSearchableSelect<TimeManagerClientRow> disabled={expenseClientsFlat.length === 0} placeholder="Выберите клиента" emptyListText="Нет клиентов" noMatchText="Клиент не найден" value={expenseProjectClientId} items={expenseClientsFlat} getOptionValue={c => c.id} getOptionLabel={c => c.name} getSearchText={c => c.name} onSelect={handleExpenseClientPick}/>
                          </div>

                          <p className="exp-form-hint exp-project-picker__combo-hint">
                            Проект: при пустом поле поиска показаны проекты выбранного клиента; начните ввод — поиск по
                            всем проектам (название, код, клиент).
                          </p>

                          <div className="exp-project-picker__field">
                            <label className="exp-form-label">
                              Проект
                              {values.isReimbursable === true && <span className="exp-form-req"> *</span>}
                            </label>
                            <ExpenseSearchableSelect<ExpenseProjectPickRow> disabled={expenseProjectRowsFlat.length === 0} placeholder="Выберите проект" emptyListText="Нет проектов" noMatchText="Проект не найден" value={values.projectId} items={expenseProjectRowsFlat} getOptionValue={r => r.project.id} getOptionLabel={r => `${r.project.name} (${r.client.name})`} getSearchText={r => `${r.client.name} ${r.project.name} ${r.project.code ?? ''}`} filterItems={filterExpenseProjectRows} onSelect={handleExpenseProjectPick} aria-invalid={Boolean(errors.projectId)} renderOption={row => (<span className="exp-searchable__opt-rich">
                                  <ExpenseProjectCardBody project={row.project}/>
                                  <span className="exp-searchable__opt-client">{row.client.name}</span>
                                </span>)}/>
                          </div>
                        </div>)}
                  </>)}

                {!isView &&
                !expenseProjectsLoading &&
                !expenseProjectsError &&
                expenseClientsProjects.length > 0 &&
                expenseClientsProjects.every(g => g.projects.length === 0) && (<p className="exp-form-hint" style={{ margin: '0.35rem 0 0 0' }}>
                      Нет ни одного проекта: создайте их во вкладке «Проекты» учёта времени.
                    </p>)}

                {errors.projectId && (<p className="exp-form-err-msg" data-err>
                    {errors.projectId}
                  </p>)}
              </div>

              {values.expenseType !== 'partner_expense' && values.projectId.trim() !== '' && (<div className={`exp-form-field${errors.expenseCategoryId ? ' exp-form-field--err' : ''}`}>
                  <label className="exp-form-label">
                    Категория расхода
                    {values.isReimbursable === true && expenseProjectCategories.length > 0 ? (<span className="exp-form-req"> *</span>) : null}
                  </label>
                  {isView ? (<p className="exp-form-static">
                      {values.expenseCategoryId.trim()
                        ? expenseProjectCategories.find((c) => c.id === values.expenseCategoryId)?.name ??
                            'Категория сохранена'
                        : 'Не указана'}
                    </p>) : expenseCategoriesLoading ? (<p className="exp-form-hint" role="status">
                      Загрузка категорий…
                    </p>) : expenseCategoriesError ? (<p className="exp-form-err-msg" role="alert">
                      {expenseCategoriesError}
                    </p>) : expenseProjectCategories.length === 0 ? (<p className="exp-form-hint">
                      Для этого проекта не настроены категории расходов — поле можно оставить пустым.
                    </p>) : (<select className="exp-form-input" value={values.expenseCategoryId} onChange={(e) => {
                        const v = e.target.value;
                        setValues((prev) => ({ ...prev, expenseCategoryId: v }));
                        if (errors.expenseCategoryId) {
                            setErrors((prev) => ({ ...prev, expenseCategoryId: undefined }));
                        }
                    }} aria-invalid={Boolean(errors.expenseCategoryId)}>
                      <option value="">Выберите категорию…</option>
                      {expenseProjectCategories.map((c) => (<option key={c.id} value={c.id}>
                          {c.name}
                        </option>))}
                    </select>)}
                  {errors.expenseCategoryId && (<p className="exp-form-err-msg" data-err>
                      {errors.expenseCategoryId}
                    </p>)}
                </div>)}

              <div className="exp-form-field">
                <label className="exp-form-label">Контрагент / Поставщик</label>
                <input type="text" className="exp-form-input" placeholder="Подставляется из клиента проекта" value={values.vendor} onChange={e => set('vendor', e.target.value)} disabled={isView}/>
                {!isView && (<p className="exp-form-hint" style={{ margin: '0.35rem 0 0 0' }}>
                    Автоматически заполняется именем клиента при выборе клиента или проекта; при необходимости замените на
                    поставщика или контрагента по счёту.
                  </p>)}
              </div>

              <div className={`exp-form-field${errors.comment ? ' exp-form-field--err' : ''}`}>
                <label className="exp-form-label">
                  Комментарий
                </label>
                <textarea className="exp-form-textarea" placeholder="Дополнительная информация" value={values.comment} onChange={e => {
                set('comment', e.target.value);
                if (errors.comment)
                    setErrors(prev => ({ ...prev, comment: undefined }));
            }} disabled={isView} rows={3}/>
                {errors.comment && <p className="exp-form-err-msg" data-err>{errors.comment}</p>}
              </div>
            </div>)}

          
          {(() => {
            const allAtt = editingRequest?.attachments ?? [];
            const serverPaymentDoc = allAtt.filter(a => a.attachmentKind === 'payment_document');
            const serverReceipt = allAtt.filter(a => a.attachmentKind === 'payment_receipt');
            const serverLegacy = allAtt.filter(a => !a.attachmentKind);
            const showServerDelete = !isView && Boolean(onExpenseSnapshotUpdated);
            const showPaymentDocSection = true;
            const showReceiptBlock = !isView || serverReceipt.length > 0 || Boolean(allowPaymentReceiptUpload);
            const showReceiptUploadZone = !isView || Boolean(allowPaymentReceiptUpload);
            const showReceiptServerDelete = Boolean(onExpenseSnapshotUpdated) && (!isView || allowPaymentReceiptUpload);
            const fileIcon = (<svg className="exp-form-file-zone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>);
            return (<>
                  <div className="exp-form-block exp-form-block--docs">
                    <p className="exp-form-block__title">
                      Документы
                      {values.isReimbursable === true && !isView && (<span className="exp-form-docs-badge">Нужен документ для оплаты</span>)}
                    </p>
                    {!isView && (!editingRequest || editingRequest.status !== 'paid') && (<p className="exp-form-hint" style={{ margin: '-0.5rem 0 0.25rem 0' }}>
                        {values.isReimbursable === true ? (<>
                            <strong>Документ для оплаты</strong> — загрузите сразу (до отправки и до оплаты компанией).
                            {' '}
                            Подтверждение оплаты (чек) — в блоке ниже; при необходимости можно прикрепить сразу или позже.
                          </>) : (<>
                            При необходимости прикрепите <strong>документ для оплаты</strong> (счёт, накладную и т.п.) — для любой заявки, в том числе невозмещаемой.
                            {' '}
                            Квитанцию об оплате — в следующем блоке (по желанию сразу или после оплаты).
                          </>)}
                      </p>)}
                    {fileSizeHint && (<p className="exp-form-err-msg" role="status">{fileSizeHint}</p>)}
                    {attachmentOpenErr && (<p className="exp-form-err-msg" role="alert">{attachmentOpenErr}</p>)}

                    {showPaymentDocSection && (<div className={`exp-form-field${errors.attachmentsPaymentDoc ? ' exp-form-field--err' : ''}`}>
                    <label className="exp-form-label">Документ для оплаты</label>
                    {!isView && (<div className="exp-form-file-zone" role="button" tabIndex={0} onClick={() => { setFileSizeHint(null); fileInputPaymentRef.current?.click(); }} onKeyDown={e => e.key === 'Enter' && fileInputPaymentRef.current?.click()}>
                        <input ref={fileInputPaymentRef} type="file" multiple style={{ display: 'none' }} onChange={e => {
                            appendFilesChecked(e.target.files, setFilesPaymentDoc, name => { setFileSizeHint(`Файл «${name}» больше 15 МБ`); });
                            setErrors(prev => ({ ...prev, attachmentsPaymentDoc: undefined }));
                            e.target.value = '';
                        }}/>
                        {fileIcon}
                        <p className="exp-form-file-zone__label">Нажмите для загрузки</p>
                        <p className="exp-form-file-zone__hint">Любой формат · до 15 МБ</p>
                      </div>)}
                    {errors.attachmentsPaymentDoc && (<p className="exp-form-err-msg" data-err>{errors.attachmentsPaymentDoc}</p>)}
                    {filesPaymentDoc.length > 0 && (<ul className="exp-form-file-list">
                        {filesPaymentDoc.map((f, i) => (<li key={`pd-${f.name}-${i}`} className="exp-form-file-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="exp-form-file-item__icon">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                              <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <span className="exp-form-file-item__name">{f.name}</span>
                            <span className="exp-form-file-item__size">{(f.size / 1024).toFixed(0)} КБ</span>
                            <button type="button" className="exp-form-file-item__preview" aria-label={`Просмотр «${f.name}»`} onClick={() => void openLocalAttachmentPreview(f)}>
                              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                            </button>
                            {!isView && (<button type="button" aria-label="Удалить" className="exp-form-file-item__del" onClick={() => setFilesPaymentDoc(prev => prev.filter((_, j) => j !== i))}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>)}
                          </li>))}
                      </ul>)}
                    {serverPaymentDoc.length > 0 && (<ul className="exp-form-file-list">
                        {serverPaymentDoc.map(f => (<li key={f.id} className="exp-form-file-item exp-form-file-item--server">
                            <button type="button" className="exp-form-file-item__open" onClick={() => void openServerAttachmentPreview(f.id, f.fileName)} aria-label={`Превью «${f.fileName}»`}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="exp-form-file-item__icon">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                                <polyline points="14 2 14 8 20 8"/>
                              </svg>
                              <span className="exp-form-file-item__name">{f.fileName}</span>
                              <span className="exp-form-file-item__size">{(f.sizeBytes / 1024).toFixed(0)} КБ</span>
                            </button>
                            {showServerDelete && (<button type="button" aria-label="Удалить" className="exp-form-file-item__del" onClick={() => handleDeleteServerAttachment(f.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>)}
                          </li>))}
                      </ul>)}
                  </div>)}
                  </div>

                  <div className="exp-form-block exp-form-block--docs exp-form-block--payment-confirm">
                    <p className="exp-form-block__title">Подтверждение оплаты</p>
                    {!showReceiptBlock && (<>
                        {editingRequest?.status === 'paid' ? (<p className="exp-form-static exp-form-static--muted" style={{ margin: 0 }}>
                            Квитанция об оплате не приложена.
                          </p>) : (<p className="exp-form-static exp-form-static--muted" style={{ margin: 0 }}>
                            Прикрепить квитанцию может автор заявки или модератор, если статус и права это допускают.
                          </p>)}
                      </>)}

                    {showReceiptBlock && (<div className={`exp-form-field${errors.attachmentsReceipt ? ' exp-form-field--err' : ''}`}>
                    <label className="exp-form-label">Квитанция об оплате</label>
                    {showReceiptUploadZone && (<>
                        <p className="exp-form-static exp-form-static--muted" style={{ margin: '0 0 0.5rem 0' }}>
                          Чек, скрин или выписка о факте оплаты. Можно прикрепить заранее или после статуса «Выплачено».
                          {!isView
                            ? ' Файлы уйдут на сервер вместе с сохранением черновика или отправкой заявки.'
                            : ' Загрузить может автор заявки или модератор.'}
                        </p>
                        <div className="exp-form-file-zone" role="button" tabIndex={0} onClick={() => { setFileSizeHint(null); fileInputReceiptRef.current?.click(); }} onKeyDown={e => e.key === 'Enter' && fileInputReceiptRef.current?.click()}>
                          <input ref={fileInputReceiptRef} type="file" multiple style={{ display: 'none' }} onChange={e => {
                            appendFilesChecked(e.target.files, setFilesReceipt, name => { setFileSizeHint(`Файл «${name}» больше 15 МБ`); });
                            setErrors(prev => ({ ...prev, attachmentsReceipt: undefined }));
                            e.target.value = '';
                        }}/>
                          {fileIcon}
                          <p className="exp-form-file-zone__label">Нажмите для загрузки</p>
                          <p className="exp-form-file-zone__hint">Любой формат · до 15 МБ</p>
                        </div>
                      </>)}
                    {errors.attachmentsReceipt && (<p className="exp-form-err-msg" data-err>{errors.attachmentsReceipt}</p>)}
                    {showReceiptUploadZone && filesReceipt.length > 0 && (<ul className="exp-form-file-list">
                        {filesReceipt.map((f, i) => (<li key={`pr-${f.name}-${i}`} className="exp-form-file-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="exp-form-file-item__icon">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                              <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <span className="exp-form-file-item__name">{f.name}</span>
                            <span className="exp-form-file-item__size">{(f.size / 1024).toFixed(0)} КБ</span>
                            <button type="button" className="exp-form-file-item__preview" aria-label={`Просмотр «${f.name}»`} onClick={() => void openLocalAttachmentPreview(f)}>
                              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                            </button>
                            {showReceiptUploadZone && (<button type="button" aria-label="Удалить" className="exp-form-file-item__del" onClick={() => setFilesReceipt(prev => prev.filter((_, j) => j !== i))}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>)}
                          </li>))}
                      </ul>)}
                    {serverReceipt.length > 0 && (<ul className="exp-form-file-list">
                        {serverReceipt.map(f => (<li key={f.id} className="exp-form-file-item exp-form-file-item--server">
                            <button type="button" className="exp-form-file-item__open" onClick={() => void openServerAttachmentPreview(f.id, f.fileName)} aria-label={`Превью «${f.fileName}»`}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="exp-form-file-item__icon">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                                <polyline points="14 2 14 8 20 8"/>
                              </svg>
                              <span className="exp-form-file-item__name">{f.fileName}</span>
                              <span className="exp-form-file-item__size">{(f.sizeBytes / 1024).toFixed(0)} КБ</span>
                            </button>
                            {showReceiptServerDelete && (<button type="button" aria-label="Удалить" className="exp-form-file-item__del" onClick={() => handleDeleteServerAttachment(f.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>)}
                          </li>))}
                      </ul>)}
                  </div>)}
                  </div>

                  {serverLegacy.length > 0 && (<div className="exp-form-field">
                      <label className="exp-form-label">Ранее загруженные вложения</label>
                      <ul className="exp-form-file-list">
                        {serverLegacy.map(f => (<li key={f.id} className="exp-form-file-item exp-form-file-item--server">
                            <button type="button" className="exp-form-file-item__open" onClick={() => void openServerAttachmentPreview(f.id, f.fileName)} aria-label={`Превью «${f.fileName}»`}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="exp-form-file-item__icon">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                                <polyline points="14 2 14 8 20 8"/>
                              </svg>
                              <span className="exp-form-file-item__name">{f.fileName}</span>
                              <span className="exp-form-file-item__size">{(f.sizeBytes / 1024).toFixed(0)} КБ</span>
                            </button>
                            {showServerDelete && (<button type="button" aria-label="Удалить" className="exp-form-file-item__del" onClick={() => handleDeleteServerAttachment(f.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>)}
                          </li>))}
                      </ul>
                    </div>)}
                </>);
        })()}
        </div>

        
          {!isView ? (<div className="exp-panel__ft">
            <button type="button" className="exp-panel-btn exp-panel-btn--ghost" onClick={onClose} disabled={formAsyncBusy}>
              Отмена
            </button>
            <button type="button" className="exp-panel-btn exp-panel-btn--outline" onClick={handleSaveDraft} disabled={formAsyncBusy} aria-busy={saveDraftPending}>
              {saveDraftPending ? (<>
                  <PanelBtnSpinner />
                  Сохранение…
                </>) : ('Сохранить черновик')}
            </button>
            <button type="button" className="exp-panel-btn exp-panel-btn--primary" onClick={handleSubmit} disabled={formAsyncBusy} aria-busy={submitPending}>
              {submitPending ? (<>
                  <PanelBtnSpinner />
                  {values.expenseType === 'partner_expense' ? 'Запись…' : 'Отправка…'}
                </>) : (values.expenseType === 'partner_expense' ? 'Записать расход' : 'Отправить')}
            </button>
          </div>) : (<div className={`exp-panel__ft${showModerationActions ||
                showLifecycleRow ||
                showWithdrawAction ||
                showOwnModerationBlockedHint
                ? ' exp-panel__ft--moderate'
                : ''}`}>
            {moderationErr && !rejectOpen && !reviseOpen && (<p className="exp-mod-err exp-mod-err--inline" role="alert">{moderationErr}</p>)}
            {showOwnModerationBlockedHint && (<p className="exp-panel__ft-hint" role="status">
                Свою заявку согласовать нельзя — обратитесь к другому модератору.
              </p>)}
            {showModerationActions && (<div className="exp-panel__ft-moderate">
                <div className="exp-panel__ft-moderate-btns">
                  <button type="button" className="exp-panel-btn exp-panel-btn--primary" disabled={moderationBusy || lifecycleBusy} onClick={openApproveConfirm}>
                    Одобрить
                  </button>
                  <button type="button" className="exp-panel-btn exp-panel-btn--outline" disabled={moderationBusy || lifecycleBusy} onClick={() => { setModerationErr(null); setReviseOpen(true); }}>
                    На доработку
                  </button>
                  <button type="button" className="exp-panel-btn exp-panel-btn--outline exp-panel-btn--danger-outline" disabled={moderationBusy || lifecycleBusy} onClick={() => { setModerationErr(null); setRejectOpen(true); }}>
                    Отклонить
                  </button>
                </div>
              </div>)}
            {showPayAction && editingRequest?.status === 'approved' && (<p className="exp-panel__ft-hint" role="status">
                {editingRequest.expenseType === 'partner_expense' ? (<>
                    Расход партнёра учтён без согласования. Дальнейшие действия по оплате — по внутренним правилам; ожидание
                    решения модератора не требуется.
                  </>) : editingRequest.isReimbursable ? (<>Заявка одобрена. После оплаты со стороны компании нажмите «Оплачено» — статус станет «Выплачено».</>) : (<>Заявка одобрена (невозмещаемая). «Оплачено» — компания оплатила расход; «Не оплачено» — завершить без оплаты со стороны компании.</>)}
              </p>)}
            {showLifecycleRow && (<div className="exp-panel__ft-moderate">
                <div className="exp-panel__ft-moderate-btns">
                  {showPayAction && editingRequest && (<button type="button" className="exp-panel-btn exp-panel-btn--primary" disabled={moderationBusy || lifecycleBusy} onClick={openPayConfirm}>
                      Оплачено
                    </button>)}
                  {closeExpenseUi && (<button type="button" className="exp-panel-btn exp-panel-btn--outline" disabled={moderationBusy || lifecycleBusy} onClick={openCloseLifecycleConfirm}>
                      {closeExpenseUi.label}
                    </button>)}
                </div>
              </div>)}
            {showWithdrawAction && (<div className="exp-panel__ft-moderate">
                <button type="button" className="exp-panel-btn exp-panel-btn--outline exp-panel-btn--danger-outline" disabled={moderationBusy || lifecycleBusy} onClick={openWithdrawConfirm}>
                  Отозвать заявку
                </button>
              </div>)}
            {isView &&
                editingRequest?.status === 'approved' &&
                editingRequest.expenseType === 'partner_expense' &&
                !showPayAction && (<p className="exp-panel__ft-hint" role="status">
                  Расход партнёра сразу в статусе «Одобрено» — этап согласования с модератором не используется.
                </p>)}
            {allowPaymentReceiptUpload && onUploadPaymentReceipts && filesReceipt.length > 0 && (<button type="button" className="exp-panel-btn exp-panel-btn--primary" onClick={() => void handleConfirmReceiptUpload()} disabled={receiptUploadPending || lifecycleBusy} aria-busy={receiptUploadPending}>
                {receiptUploadPending ? (<>
                    <PanelBtnSpinner />
                    Загрузка…
                  </>) : ('Прикрепить квитанцию')}
              </button>)}
            <button type="button" className="exp-panel-btn exp-panel-btn--outline" onClick={onClose} disabled={formAsyncBusy}>
              Закрыть
            </button>
          </div>)}
        {formAsyncBusy && (<div className="exp-panel__async-busy-layer" role="status" aria-live="polite">
            <PanelBtnSpinner className="exp-panel__async-busy-spinner"/>
            <span className="exp-panel__async-busy-label">
              {submitPending
                ? valuesRef.current.expenseType === 'partner_expense'
                    ? 'Запись расхода…'
                    : 'Отправка заявки…'
                : receiptUploadPending
                    ? 'Загрузка квитанции…'
                    : lifecycleBusy
                        ? 'Смена статуса…'
                        : 'Сохранение черновика…'}
            </span>
          </div>)}
      </aside>
    </>);
    return typeof document !== 'undefined' ? createPortal(portalLayer, document.body) : null;
}
