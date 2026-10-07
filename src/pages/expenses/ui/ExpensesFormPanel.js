import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { EXPENSE_ATTACHMENT_MAX_BYTES, EXPENSE_ATTACHMENT_MAX_COUNT, EXPENSE_ATTACHMENT_COUNT_LIMIT_MSG, } from '@entities/expenses/model/types';
import { EXPENSE_CURRENCIES, EXPENSE_TYPES, PARTNER_EXPENSE_CATEGORIES, getPartnerExpenseSubtypeLabel, PAYMENT_METHODS, COMPANY_PRIVATE_EXPENSE_TYPE, canManageCompanyExpense, } from '@entities/expenses/model/constants';
import { computeAmountUzsForApi, computeUsdEquivalent, formatExchangeRate, needsForeignUsdRate, parseExpenseMoney, roundMoney2 } from '@entities/expenses/model/expenseCurrency';
import { formatReimbursementCardNumber, isEmployeePersonalFundsPayout, isValidReimbursementCardNumber, reimbursementCardDigits } from '@entities/expenses/model/expensePaymentDetails';
import { fetchCbuParsedForDate, foreignUnitsPerUsd } from '@entities/expenses/model/cbuRates';
import { approveExpense, rejectExpense, reviseExpense, deleteAttachment, deleteExpense, fetchExpenseAttachmentBlob, openExpenseAttachmentInNewTab, payExpense, unpayExpense, unapproveExpense, withdrawExpense, fetchApprovalRoutingMeta, } from '@entities/expenses/model/expensesApi';
import { ExpenseAttachmentPreviewModal } from './ExpenseAttachmentPreviewModal';
import { isModerationBlockedForOwnExpense, showLifecycleModerationRow, showOwnPendingModerationBlockedHint, showPayExpenseAction, showUnpayExpenseAction, showUnapproveExpenseAction, showPendingApprovalModeration, showWithdrawExpenseAction, showDeleteExpenseAction, } from '@entities/expenses/model/expenseStatusPolicy';
import { expensePayActionLabel, expenseStatusBadgeClass, expenseStatusLabel } from '@entities/expenses/model/expenseStatusLabels';
import { isExpensePaymentConfirmer } from '@entities/expenses/model/expensePaymentConfirmer';
import { asExpenseNumber } from '@entities/expenses/model/coerceExpense';
import { formatExpenseAuthorLabel, formatExpensePaidByLabel } from '@entities/expenses/model/expenseAuthor';
import { ExpenseConfirmDialog } from './ExpenseConfirmDialog';
import { ExpenseSearchableSelect } from './ExpenseSearchableSelect';
import { listPartners } from '@entities/user';
import { listProjectsForExpenses, listProjectExpenseCategories, } from '@entities/time-tracking';
import { useI18n, ttProjectTypeLabel } from '@shared/i18n';
import { showToast } from '@shared/ui/app-toast';
import './ExpensesPage.css';
async function copyTextToClipboard(text) {
    if (!text.trim())
        return false;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    }
    catch {
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    }
    catch {
        return false;
    }
}
function syntheticClientFromExpense(id, name) {
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
function ttExpenseProjectToProjectRow(p) {
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
        progress_budget_amount: null,
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
function groupProjectsForExpenseForm(rows) {
    const m = new Map();
    for (const p of rows) {
        if (p.isArchived)
            continue;
        if (!m.has(p.clientId)) {
            m.set(p.clientId, {
                client: syntheticClientFromExpense(p.clientId, p.clientName),
                projects: [],
            });
        }
        m.get(p.clientId).projects.push(ttExpenseProjectToProjectRow(p));
    }
    for (const g of m.values()) {
        g.projects.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    }
    return [...m.values()].sort((a, b) => a.client.name.localeCompare(b.client.name, 'ru', { sensitivity: 'base' }));
}
function formatExpenseProjectDateShort(iso) {
    if (!iso)
        return '';
    const s = String(iso).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return '';
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
}
function ExpenseProjectCardBody({ project }) {
    const { t } = useI18n();
    const typeLabel = ttProjectTypeLabel(project.project_type, t);
    const dateFrom = formatExpenseProjectDateShort(project.start_date);
    const dateTo = formatExpenseProjectDateShort(project.end_date);
    const dateRange = dateFrom && dateTo
        ? `${dateFrom} — ${dateTo}`
        : (dateFrom || dateTo || '');
    const metaParts = [
        typeLabel,
        dateRange,
        project.usage_count > 0 ? `записей времени: ${project.usage_count}` : '',
    ].filter(Boolean);
    return (_jsxs("div", { className: "exp-project-picker__card-body", children: [_jsxs("div", { className: "exp-project-picker__card-title", children: [_jsx("span", { className: "exp-project-picker__card-name", children: project.name }), project.code ? _jsx("span", { className: "exp-project-picker__code", children: project.code }) : null] }), metaParts.length > 0 ? (_jsx("p", { className: "exp-project-picker__meta", children: metaParts.join(' · ') })) : null] }));
}
function PanelBtnSpinner({ className }) {
    return (_jsxs("svg", { className: className ?? 'exp-panel-btn__spinner', viewBox: "0 0 24 24", "aria-hidden": true, width: 18, height: 18, children: [_jsx("circle", { cx: "12", cy: "12", r: "9", fill: "none", stroke: "currentColor", strokeWidth: "2.5", opacity: 0.2 }), _jsx("path", { fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", d: "M12 3a9 9 0 0 1 9 9" })] }));
}
function todayIsoLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function fmtIsoDateRu(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m)
        return iso;
    return `${m[3]}.${m[2]}.${m[1]}`;
}
const EXPENSE_TYPE_CLIENT = 'client_expense';
const EMPTY = {
    description: '',
    expenseDate: '',
    expenseType: '',
    expenseSubtype: '',
    isReimbursable: false,
    amountCurrency: 'UZS',
    foreignPerUsd: '',
    amountUzs: '',
    lockedAmountUzs: null,
    exchangeRate: '',
    paymentMethod: '',
    reimbursementCardNumber: '',
    projectId: '',
    expenseCategoryId: '',
    vendor: '',
    businessPurpose: '',
    comment: '',
    partnerUserId: '',
};
function validate(v, opts) {
    const e = {};
    if (!v.description.trim())
        e.description = 'Обязательное поле';
    if (!v.expenseDate)
        e.expenseDate = 'Укажите дату';
    if (v.expenseDate && v.expenseType !== EXPENSE_TYPE_CLIENT) {
        const today = todayIsoLocal();
        if (v.expenseDate > today)
            e.expenseDate = 'Дата не может быть в будущем';
    }
    if (v.expenseType === EXPENSE_TYPE_CLIENT && v.expenseDate && v.expenseDate !== todayIsoLocal()) {
        e.expenseDate = 'Для типа «За клиента» дата расхода — сегодняшний день';
    }
    if (!v.expenseType)
        e.expenseType = 'Выберите тип расхода';
    if (v.expenseType === 'partner_expense' && !v.expenseSubtype.trim()) {
        e.expenseSubtype = 'Выберите категорию расхода партнёра';
    }
    const amt = parseExpenseMoney(v.amountUzs);
    if (!v.amountUzs || isNaN(amt) || amt <= 0)
        e.amountUzs = 'Укажите сумму больше 0';
    if (opts?.mode === 'create') {
        if (!opts.cbuReady) {
            e.exchangeRate = opts.cbuError?.trim() || 'Подождите загрузки курса ЦБ РУз';
        }
    }
    else {
        const rate = parseExpenseMoney(v.exchangeRate);
        if (!v.exchangeRate || isNaN(rate) || rate <= 0)
            e.exchangeRate = 'Укажите курс больше 0';
    }
    if (needsForeignUsdRate(v.amountCurrency)) {
        const fx = parseExpenseMoney(v.foreignPerUsd);
        if (!v.foreignPerUsd || isNaN(fx) || fx <= 0) {
            e.foreignPerUsd = 'Укажите, сколько единиц валюты за 1 USD (например, 90 для рубля)';
        }
    }
    if (!v.paymentMethod.trim()) {
        e.paymentMethod = 'Выберите способ оплаты';
    }
    if (v.paymentMethod === 'cash') {
        if (!v.reimbursementCardNumber.trim()) {
            e.reimbursementCardNumber = 'Укажите номер карты для возмещения';
        }
        else if (!isValidReimbursementCardNumber(v.reimbursementCardNumber)) {
            e.reimbursementCardNumber = 'Номер карты должен содержать 16 цифр';
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
            // Legacy attachments are accepted because their kind was not stored.
        }
        else if (s.length + opts.filesPaymentDoc.length < 1) {
            e.attachmentsPaymentDoc = 'Для возмещаемого расхода приложите документ для оплаты';
        }
    }
    if (opts) {
        const totalAtt = (opts.serverAttachments?.length ?? 0) + opts.filesPaymentDoc.length + opts.filesReceipt.length;
        if (totalAtt > EXPENSE_ATTACHMENT_MAX_COUNT)
            e.attachmentsPaymentDoc = EXPENSE_ATTACHMENT_COUNT_LIMIT_MSG;
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
function appendFilesChecked(incoming, setList, onOversize, occupiedOthers, onTooMany) {
    if (!incoming?.length)
        return;
    const added = [];
    for (const f of Array.from(incoming)) {
        if (f.size > EXPENSE_ATTACHMENT_MAX_BYTES) {
            onOversize(f.name);
            continue;
        }
        added.push(f);
    }
    if (!added.length)
        return;
    setList(prev => {
        const room = EXPENSE_ATTACHMENT_MAX_COUNT - occupiedOthers - prev.length;
        if (room <= 0) {
            onTooMany();
            return prev;
        }
        if (added.length > room)
            onTooMany();
        return [...prev, ...added.slice(0, Math.max(0, room))];
    });
}
function formatForeignFp(n) {
    const x = Math.round(n * 1e6) / 1e6;
    return x.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}
export function ExpensesFormPanel({ isOpen, mode, editingRequest, onClose, onExited, onSaveDraft, onSubmit, saveDraftPending = false, submitPending = false, onExpenseSnapshotUpdated, canModerate = false, onExpenseUpdated, onExpenseDeleted, emailModerationIntent = null, onEmailModerationIntentConsumed, allowPaymentReceiptUpload = false, onUploadPaymentReceipts, receiptUploadPending = false, currentUserId = null, currentUserRole = null, currentUserEmail = null, currentUserDisplayName = null, formScope = 'company', presetValues = null, }) {
    const [values, setValues] = useState(EMPTY);
    const valuesRef = useRef(values);
    valuesRef.current = values;
    // Read through a ref: a new object identity from the caller must not reset an open form.
    const presetValuesRef = useRef(presetValues);
    presetValuesRef.current = presetValues;
    const [errors, setErrors] = useState({});
    const [partnerOptions, setPartnerOptions] = useState([]);
    const [partnersLoad, setPartnersLoad] = useState('idle');
    const [partnersLoadErr, setPartnersLoadErr] = useState(null);
    const [filesPaymentDoc, setFilesPaymentDoc] = useState([]);
    const [filesReceipt, setFilesReceipt] = useState([]);
    const [fileSizeHint, setFileSizeHint] = useState(null);
    const [attachmentOpenErr, setAttachmentOpenErr] = useState(null);
    const [deletingAttachmentId, setDeletingAttachmentId] = useState(null);
    const [attachPreview, setAttachPreview] = useState(null);
    const [cbuParsed, setCbuParsed] = useState(null);
    const [cbuLoading, setCbuLoading] = useState(false);
    const [cbuError, setCbuError] = useState(null);
    const [moderationBusy, setModerationBusy] = useState(false);
    const [lifecycleBusy, setLifecycleBusy] = useState(false);
    const [moderationErr, setModerationErr] = useState(null);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [reviseOpen, setReviseOpen] = useState(false);
    const [unpayOpen, setUnpayOpen] = useState(false);
    const [unapproveOpen, setUnapproveOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [reviseComment, setReviseComment] = useState('');
    const [unpayComment, setUnpayComment] = useState('');
    const [unapproveComment, setUnapproveComment] = useState('');
    const [panelConfirm, setPanelConfirm] = useState(null);
    const fileInputPaymentRef = useRef(null);
    const fileInputReceiptRef = useRef(null);
    const bodyRef = useRef(null);
    const [expenseClientsProjects, setExpenseClientsProjects] = useState([]);
    const [expenseProjectClientId, setExpenseProjectClientId] = useState('');
    const [expenseProjectsLoading, setExpenseProjectsLoading] = useState(false);
    const [expenseProjectsError, setExpenseProjectsError] = useState(null);
    const [expenseProjectCategories, setExpenseProjectCategories] = useState([]);
    const [expenseCategoriesLoading, setExpenseCategoriesLoading] = useState(false);
    const [expenseCategoriesError, setExpenseCategoriesError] = useState(null);
    const [approvalRoutingMeta, setApprovalRoutingMeta] = useState(null);
    const equivUsd = useMemo(() => computeUsdEquivalent(values.amountCurrency, values.amountUzs, values.exchangeRate, values.foreignPerUsd), [values.amountCurrency, values.amountUzs, values.exchangeRate, values.foreignPerUsd]);
    const equiv = equivUsd != null ? roundMoney2(asExpenseNumber(equivUsd)).toFixed(2) : '';
    const amountUzsForRouting = useMemo(() => {
        if (values.lockedAmountUzs != null && values.lockedAmountUzs > 0)
            return roundMoney2(values.lockedAmountUzs);
        return computeAmountUzsForApi(values.amountCurrency, values.amountUzs, values.exchangeRate, values.foreignPerUsd);
    }, [values.lockedAmountUzs, values.amountCurrency, values.amountUzs, values.exchangeRate, values.foreignPerUsd]);
    const amountUzsSaveHint = useMemo(() => {
        if (mode === 'view' || values.amountCurrency === 'UZS')
            return '';
        if (!(amountUzsForRouting > 0))
            return '';
        return `К сохранению: ${amountUzsForRouting.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} UZS`;
    }, [mode, values.amountCurrency, amountUzsForRouting]);
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
    const allowExpenseBackdate = mode === 'create' && values.expenseType !== EXPENSE_TYPE_CLIENT;
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
        // Do not touch cbuLoading here — the CBU fetch effect owns it (avoids stuck «Загрузка…»).
        setValues({
            ...EMPTY,
            expenseDate: todayIsoLocal(),
            ...(formScope === 'partner'
                ? { expenseType: 'partner_expense', isReimbursable: false }
                : formScope === 'client'
                    ? { expenseType: EXPENSE_TYPE_CLIENT }
                    : {}),
            ...(presetValuesRef.current ?? {}),
            lockedAmountUzs: presetValuesRef.current?.lockedAmountUzs ?? null,
        });
        setFilesPaymentDoc([]);
        setFilesReceipt([]);
        setFileSizeHint(null);
        setErrors({});
    }, [isOpen, mode, formScope]);
    useEffect(() => {
        if (!isOpen || formScope === 'partner') {
            setApprovalRoutingMeta(null);
            return;
        }
        let cancelled = false;
        void fetchApprovalRoutingMeta()
            .then((meta) => {
            if (!cancelled)
                setApprovalRoutingMeta(meta);
        })
            .catch(() => {
            if (!cancelled)
                setApprovalRoutingMeta(null);
        });
        return () => {
            cancelled = true;
        };
    }, [isOpen, formScope]);
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
            expenseType: editingRequest.expenseType,
            expenseSubtype: editingRequest.expenseSubtype ?? '',
            isReimbursable: editingRequest.isReimbursable,
            amountCurrency: 'UZS',
            foreignPerUsd: '',
            amountUzs: String(editingRequest.amountUzs),
            lockedAmountUzs: (() => {
                const n = asExpenseNumber(editingRequest.amountUzs);
                return n > 0 ? roundMoney2(n) : null;
            })(),
            exchangeRate: String(editingRequest.exchangeRate),
            paymentMethod: editingRequest.paymentMethod ?? '',
            reimbursementCardNumber: formatReimbursementCardNumber(editingRequest.reimbursementCardNumber),
            projectId: editingRequest.projectId ?? '',
            expenseCategoryId: editingRequest.expenseCategoryId?.trim() ?? '',
            vendor: editingRequest.vendor ?? '',
            businessPurpose: editingRequest.businessPurpose ?? '',
            comment: editingRequest.comment ?? '',
            partnerUserId: editingRequest.partnerUserId != null ? String(editingRequest.partnerUserId) : '',
        });
        setFilesPaymentDoc([]);
        setFilesReceipt([]);
        setFileSizeHint(null);
        setErrors({});
    }, [isOpen, mode, editingRequest]);
    const expenseDateKey = allowExpenseBackdate
        ? values.expenseDate.trim().slice(0, 10)
        : '';
    useEffect(() => {
        if (!isOpen || mode !== 'create') {
            setCbuLoading(false);
            return;
        }
        const iso = allowExpenseBackdate && expenseDateKey
            ? expenseDateKey
            : todayIsoLocal();
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
                const er = formatExchangeRate(parsed.uzsPerUsd);
                let fr = '';
                if (needsForeignUsdRate(prev.amountCurrency)) {
                    const fp = foreignUnitsPerUsd(parsed, prev.amountCurrency);
                    if (fp != null && fp > 0)
                        fr = formatForeignFp(fp);
                }
                const nextDate = allowExpenseBackdate && prev.expenseDate.trim()
                    ? prev.expenseDate.trim().slice(0, 10)
                    : iso;
                const rate = parseExpenseMoney(er);
                let nextAmount = prev.amountUzs;
                const locked = prev.lockedAmountUzs;
                if (locked != null && locked > 0 && prev.amountCurrency !== 'UZS' && rate > 0) {
                    if (prev.amountCurrency === 'USD') {
                        nextAmount = roundMoney2(locked / rate).toFixed(2);
                    }
                    else if (needsForeignUsdRate(prev.amountCurrency)) {
                        const fp = parseExpenseMoney(fr);
                        if (fp > 0)
                            nextAmount = roundMoney2((locked / rate) * fp).toFixed(2);
                    }
                }
                if (prev.expenseDate === nextDate
                    && prev.exchangeRate === er
                    && prev.foreignPerUsd === fr
                    && prev.amountUzs === nextAmount)
                    return prev;
                return {
                    ...prev,
                    expenseDate: nextDate,
                    exchangeRate: er,
                    foreignPerUsd: fr,
                    amountUzs: nextAmount,
                };
            });
        })
            .catch((err) => {
            if (cancelled)
                return;
            setCbuParsed(null);
            setCbuLoading(false);
            setCbuError(err instanceof Error ? err.message : 'Не удалось загрузить курс ЦБ');
        });
        return () => {
            cancelled = true;
        };
    }, [isOpen, mode, allowExpenseBackdate, expenseDateKey]);
    useEffect(() => {
        if (!isOpen || values.expenseType !== 'partner_expense') {
            setPartnerOptions([]);
            setPartnersLoad('idle');
            setPartnersLoadErr(null);
            return;
        }
        let cancelled = false;
        setPartnersLoad('loading');
        setPartnersLoadErr(null);
        void listPartners()
            .then((rows) => {
            if (cancelled)
                return;
            setPartnerOptions(rows);
            setPartnersLoad('ok');
        })
            .catch((err) => {
            if (cancelled)
                return;
            setPartnerOptions([]);
            setPartnersLoad('error');
            setPartnersLoadErr(err instanceof Error ? err.message : 'Не удалось загрузить партнёров');
        });
        return () => { cancelled = true; };
    }, [isOpen, values.expenseType]);
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
    const [motionOpen, setMotionOpen] = useState(false);
    const onExitedRef = useRef(onExited);
    onExitedRef.current = onExited;
    useEffect(() => {
        if (!isOpen) {
            setMotionOpen(false);
            return;
        }
        let inner = 0;
        const outer = requestAnimationFrame(() => {
            inner = requestAnimationFrame(() => setMotionOpen(true));
        });
        return () => {
            cancelAnimationFrame(outer);
            cancelAnimationFrame(inner);
        };
    }, [isOpen]);
    useEffect(() => {
        if (isOpen || motionOpen)
            return;
        const timer = window.setTimeout(() => onExitedRef.current?.(), 340);
        return () => window.clearTimeout(timer);
    }, [isOpen, motionOpen]);
    const handlePanelTransitionEnd = useCallback((e) => {
        if (e.target !== e.currentTarget || e.propertyName !== 'transform' || isOpen)
            return;
        onExitedRef.current?.();
    }, [isOpen]);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && isOpen && !formAsyncBusy)
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose, formAsyncBusy]);
    useEffect(() => {
        document.body.style.overflow = isOpen || motionOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen, motionOpen]);
    const set = useCallback((field, val) => {
        if (field === 'expenseType' && val !== EXPENSE_TYPE_CLIENT) {
            setExpenseProjectClientId('');
        }
        setValues(prev => {
            const next = { ...prev, [field]: val };
            if (field === 'expenseType' && val !== 'partner_expense') {
                next.expenseSubtype = '';
                next.partnerUserId = '';
            }
            if (field === 'expenseType' && val !== EXPENSE_TYPE_CLIENT) {
                next.projectId = '';
                next.expenseCategoryId = '';
                next.vendor = '';
                next.comment = '';
            }
            if (field === 'expenseType' && val === EXPENSE_TYPE_CLIENT) {
                next.expenseDate = todayIsoLocal();
            }
            if (field === 'paymentMethod' && val !== 'cash') {
                next.reimbursementCardNumber = '';
            }
            return next;
        });
        setErrors(prev => ({
            ...prev,
            [field]: undefined,
            ...(field === 'expenseType'
                ? { expenseSubtype: undefined, partnerUserId: undefined, projectId: undefined, expenseCategoryId: undefined, comment: undefined, vendor: undefined }
                : {}),
            ...(field === 'paymentMethod'
                ? { reimbursementCardNumber: undefined }
                : {}),
        }));
    }, []);
    const handleCopyDescription = useCallback(async () => {
        const text = values.description.trim();
        if (!text) {
            showToast({ message: 'Нет описания для копирования', variant: 'warning' });
            return;
        }
        const ok = await copyTextToClipboard(text);
        showToast({
            message: ok ? 'Описание скопировано' : 'Не удалось скопировать',
            variant: ok ? 'success' : 'error',
        });
    }, [values.description]);
    const handleCopyCardNumber = useCallback(async () => {
        const digits = reimbursementCardDigits(values.reimbursementCardNumber);
        if (!digits) {
            showToast({ message: 'Нет номера карты для копирования', variant: 'warning' });
            return;
        }
        const ok = await copyTextToClipboard(digits);
        showToast({
            message: ok ? 'Номер карты скопирован' : 'Не удалось скопировать',
            variant: ok ? 'success' : 'error',
        });
    }, [values.reimbursementCardNumber]);
    const handleExpenseClientPick = useCallback((client) => {
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
    const handleExpenseProjectPick = useCallback((row) => {
        setExpenseProjectClientId(row.client.id);
        setValues(prev => ({
            ...prev,
            projectId: row.project.id,
            vendor: row.client.name,
            expenseCategoryId: '',
        }));
        setErrors(prev => ({ ...prev, projectId: undefined, expenseCategoryId: undefined }));
    }, []);
    const filterExpenseProjectRows = useCallback((rows, q) => {
        if (q) {
            return rows.filter(r => `${r.client.name} ${r.project.name} ${r.project.code ?? ''}`.toLowerCase().includes(q));
        }
        if (!expenseProjectClientId)
            return [...rows];
        return rows.filter(r => r.client.id === expenseProjectClientId);
    }, [expenseProjectClientId]);
    const setAmount = useCallback((raw) => {
        setValues(prev => {
            const next = { ...prev, amountUzs: raw };
            if (prev.amountCurrency === 'UZS') {
                const n = parseExpenseMoney(raw);
                next.lockedAmountUzs = Number.isFinite(n) && n > 0 ? roundMoney2(n) : null;
            }
            else {
                // Editing foreign/USD amount: drop UZS lock so save follows the typed currency.
                next.lockedAmountUzs = null;
            }
            return next;
        });
        setErrors(prev => ({ ...prev, amountUzs: undefined }));
    }, []);
    const setCurrency = useCallback((c) => {
        setValues(prev => {
            if (c === prev.amountCurrency) {
                return {
                    ...prev,
                    foreignPerUsd: needsForeignUsdRate(c) ? prev.foreignPerUsd : '',
                };
            }
            const rate = parseExpenseMoney(prev.exchangeRate);
            let lockedUzs = 0;
            if (prev.amountCurrency === 'UZS') {
                const n = parseExpenseMoney(prev.amountUzs);
                if (Number.isFinite(n) && n > 0)
                    lockedUzs = roundMoney2(n);
            }
            else if (prev.lockedAmountUzs != null && prev.lockedAmountUzs > 0) {
                lockedUzs = roundMoney2(prev.lockedAmountUzs);
            }
            else {
                lockedUzs = computeAmountUzsForApi(prev.amountCurrency, prev.amountUzs, prev.exchangeRate, prev.foreignPerUsd);
            }
            let nextForeign = '';
            if (needsForeignUsdRate(c) && cbuParsed) {
                const fp = foreignUnitsPerUsd(cbuParsed, c);
                if (fp != null && fp > 0)
                    nextForeign = formatForeignFp(fp);
            }
            let nextAmount = prev.amountUzs;
            if (c === 'UZS') {
                nextAmount = String(lockedUzs > 0 ? lockedUzs : prev.amountUzs);
            }
            else if (c === 'USD' && rate > 0 && lockedUzs > 0) {
                nextAmount = roundMoney2(lockedUzs / rate).toFixed(2);
            }
            else if (needsForeignUsdRate(c) && rate > 0 && lockedUzs > 0) {
                const fp = parseExpenseMoney(nextForeign);
                if (fp > 0)
                    nextAmount = roundMoney2((lockedUzs / rate) * fp).toFixed(2);
            }
            return {
                ...prev,
                amountCurrency: c,
                amountUzs: nextAmount,
                foreignPerUsd: nextForeign,
                lockedAmountUzs: lockedUzs > 0 ? lockedUzs : null,
            };
        });
        setErrors(prev => ({ ...prev, foreignPerUsd: undefined }));
    }, [cbuParsed]);
    const setReimb = useCallback((val) => {
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
    const filesByKind = useMemo(() => ({ payment_document: filesPaymentDoc, payment_receipt: filesReceipt }), [filesPaymentDoc, filesReceipt]);
    const valuesForSave = useCallback(() => {
        if (mode === 'create') {
            if (values.expenseType !== EXPENSE_TYPE_CLIENT && values.expenseDate.trim()) {
                return { ...values, expenseDate: values.expenseDate.trim().slice(0, 10) };
            }
            return { ...values, expenseDate: todayIsoLocal() };
        }
        return values;
    }, [mode, values]);
    const cbuReady = mode === 'create' && cbuParsed != null && !cbuLoading && !cbuError;
    const validateOptsBase = useMemo(() => ({
        filesPaymentDoc,
        filesReceipt,
        serverAttachments: editingRequest?.attachments,
        projectExpenseCategoryCount: expenseProjectCategories.length,
        mode,
        cbuReady,
        cbuError,
    }), [filesPaymentDoc, filesReceipt, editingRequest?.attachments, expenseProjectCategories.length, mode, cbuReady, cbuError]);
    const handleSaveDraft = useCallback(() => {
        const v = valuesForSave();
        const errs = validate(v, {
            ...validateOptsBase,
            forSubmit: false,
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
        validateOptsBase,
        onSaveDraft,
    ]);
    const handleSubmit = useCallback(() => {
        const v = valuesForSave();
        const errs = validate(v, {
            ...validateOptsBase,
            forSubmit: true,
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
        validateOptsBase,
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
    const approvalRoutingHint = useMemo(() => {
        if (isView || values.expenseType === 'partner_expense')
            return null;
        if (!approvalRoutingMeta?.lowTierEnabled || approvalRoutingMeta.lowLimitUzs == null)
            return null;
        const limit = approvalRoutingMeta.lowLimitUzs;
        const limitLabel = limit.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
        if (!(amountUzsForRouting > 0)) {
            return `До ${limitLabel} UZS включительно заявка уходит согласующим малых расходов; свыше — обычным.`;
        }
        if (amountUzsForRouting <= limit) {
            return `Сумма ≤ ${limitLabel} UZS — на согласование уйдёт согласующим малых расходов.`;
        }
        return `Сумма > ${limitLabel} UZS — на согласование уйдёт обычным согласующим.`;
    }, [isView, values.expenseType, approvalRoutingMeta, amountUzsForRouting]);
    const expenseClientsFlat = useMemo(() => expenseClientsProjects.map(g => g.client), [expenseClientsProjects]);
    const expenseProjectRowsFlat = useMemo(() => {
        const out = [];
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
    const expenseTypeItems = useMemo(() => {
        if (formScope === 'partner')
            return EXPENSE_TYPES.filter(t => t.value === 'partner_expense');
        if (formScope === 'client')
            return EXPENSE_TYPES.filter(t => t.value === 'client_expense');
        // Company create/edit: all types except partner (partners use their own page).
        const company = EXPENSE_TYPES.filter(t => t.value !== 'partner_expense');
        const showPrivate = canManageCompanyExpense(currentUserEmail)
            || editingRequest?.expenseType === 'company_expense';
        const withPrivate = showPrivate ? [...company, COMPANY_PRIVATE_EXPENSE_TYPE] : company;
        if (editingRequest?.expenseType === 'partner_expense')
            return [...withPrivate, ...EXPENSE_TYPES.filter(t => t.value === 'partner_expense')];
        return withPrivate;
    }, [formScope, editingRequest?.expenseType, currentUserEmail]);
    const partnerSubtypeItems = useMemo(() => [...PARTNER_EXPENSE_CATEGORIES], []);
    const partnerUserItems = useMemo(() => {
        const rows = [{ id: '', label: 'Не указан', search: 'не указан' }];
        for (const p of partnerOptions) {
            const label = p.display_name?.trim() || p.email || `User #${p.id}`;
            rows.push({
                id: String(p.id),
                label,
                search: `${label} ${p.email ?? ''} ${p.id}`.toLowerCase(),
            });
        }
        return rows;
    }, [partnerOptions]);
    const paymentMethodItems = useMemo(() => PAYMENT_METHODS.map(m => ({
        value: m.value,
        label: m.label,
        search: m.label.toLowerCase(),
    })), []);
    const currencyItems = useMemo(() => [...EXPENSE_CURRENCIES], []);
    const expenseCategoryItems = useMemo(() => [
        { id: '', name: 'Не указана', search: 'не указана' },
        ...expenseProjectCategories.map(c => ({
            id: c.id,
            name: c.name,
            search: `${c.name} ${c.id}`.toLowerCase(),
        })),
    ], [expenseProjectCategories]);
    const handleDeleteServerAttachment = useCallback(async (attId) => {
        if (!editingRequest || !onExpenseSnapshotUpdated)
            return;
        const att = editingRequest.attachments?.find(a => a.id === attId);
        const isUploader = currentUserId != null && att != null && att.uploadedByUserId === currentUserId;
        const isAuthor = currentUserId != null && currentUserId === editingRequest.createdByUserId;
        if (isView && !allowPaymentReceiptUpload && !isUploader && !isAuthor) {
            setAttachmentOpenErr('Удалить файл в этом статусе нельзя.');
            return;
        }
        const snapshot = editingRequest;
        const optimisticAtt = (snapshot.attachments ?? []).filter(a => a.id !== attId);
        setAttachmentOpenErr(null);
        setDeletingAttachmentId(attId);
        onExpenseSnapshotUpdated({
            ...snapshot,
            attachments: optimisticAtt,
            attachmentsCount: optimisticAtt.length,
        });
        try {
            const r = await deleteAttachment(snapshot.id, attId);
            onExpenseSnapshotUpdated(r);
        }
        catch (e) {
            onExpenseSnapshotUpdated(snapshot);
            setAttachmentOpenErr(e instanceof Error ? e.message : 'Не удалось удалить файл');
        }
        finally {
            setDeletingAttachmentId(null);
        }
    }, [editingRequest, isView, allowPaymentReceiptUpload, onExpenseSnapshotUpdated, currentUserId]);
    const openServerAttachmentPreview = useCallback(async (attId, fileName) => {
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
            const { buildAttachmentPreview } = await import('@entities/expenses/lib/buildAttachmentPreview');
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
    const openLocalAttachmentPreview = useCallback(async (file) => {
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
            const { buildAttachmentPreview } = await import('@entities/expenses/lib/buildAttachmentPreview');
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
        const existing = editingRequest?.attachments?.length ?? 0;
        if (existing + filesReceipt.length > EXPENSE_ATTACHMENT_MAX_COUNT) {
            setFileSizeHint(EXPENSE_ATTACHMENT_COUNT_LIMIT_MSG);
            return;
        }
        try {
            await onUploadPaymentReceipts(filesReceipt);
            setFilesReceipt([]);
            setErrors(prev => ({ ...prev, attachmentsReceipt: undefined }));
        }
        catch {
        }
    }, [onUploadPaymentReceipts, filesReceipt, editingRequest?.attachments?.length]);
    const blockedModerationOwn = Boolean(editingRequest &&
        isModerationBlockedForOwnExpense(Boolean(canModerate), currentUserId, editingRequest));
    const isPaymentConfirmer = isExpensePaymentConfirmer(currentUserEmail, { displayName: currentUserDisplayName });
    const showOwnModerationBlockedHint = Boolean(isView &&
        editingRequest &&
        showOwnPendingModerationBlockedHint(editingRequest, Boolean(canModerate), blockedModerationOwn));
    const showModerationActions = Boolean(isView &&
        editingRequest &&
        showPendingApprovalModeration(editingRequest, Boolean(canModerate), blockedModerationOwn));
    const payActionOpts = useMemo(() => ({
        isPaymentConfirmer,
        canModerate: Boolean(canModerate),
    }), [isPaymentConfirmer, canModerate]);
    const showPayAction = Boolean(isView && editingRequest && showPayExpenseAction(editingRequest, blockedModerationOwn, payActionOpts));
    const showUnpayAction = Boolean(isView && editingRequest && showUnpayExpenseAction(editingRequest, blockedModerationOwn, payActionOpts));
    const showUnapproveAction = Boolean(isView && editingRequest && showUnapproveExpenseAction(editingRequest, Boolean(canModerate), blockedModerationOwn));
    const showLifecycleRow = Boolean(isView &&
        editingRequest &&
        showLifecycleModerationRow(editingRequest, Boolean(canModerate), blockedModerationOwn, payActionOpts));
    const showWithdrawAction = Boolean(isView && editingRequest && showWithdrawExpenseAction(editingRequest, currentUserId));
    const showDeleteAction = Boolean(editingRequest && showDeleteExpenseAction(editingRequest, currentUserId, currentUserRole));
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
    const handleUnpayConfirm = useCallback(async () => {
        if (!editingRequest || lifecycleBusy)
            return;
        const t = unpayComment.trim();
        if (!t) {
            setModerationErr('Укажите причину отмены оплаты');
            return;
        }
        setModerationErr(null);
        setLifecycleBusy(true);
        try {
            const r = await unpayExpense(editingRequest.id, t);
            setUnpayOpen(false);
            setUnpayComment('');
            onExpenseUpdated?.(r);
        }
        catch (e) {
            setModerationErr(e instanceof Error ? e.message : 'Не удалось отменить оплату');
        }
        finally {
            setLifecycleBusy(false);
        }
    }, [editingRequest, lifecycleBusy, unpayComment, onExpenseUpdated]);
    const handleUnapproveConfirm = useCallback(async () => {
        if (!editingRequest || lifecycleBusy)
            return;
        const t = unapproveComment.trim();
        if (!t) {
            setModerationErr('Укажите причину снятия согласования');
            return;
        }
        setModerationErr(null);
        setLifecycleBusy(true);
        try {
            const r = await unapproveExpense(editingRequest.id, t);
            setUnapproveOpen(false);
            setUnapproveComment('');
            onExpenseUpdated?.(r);
        }
        catch (e) {
            setModerationErr(e instanceof Error ? e.message : 'Не удалось снять согласование');
        }
        finally {
            setLifecycleBusy(false);
        }
    }, [editingRequest, lifecycleBusy, unapproveComment, onExpenseUpdated]);
    const openPayConfirm = useCallback(() => {
        if (!editingRequest || lifecycleBusy || moderationBusy)
            return;
        setModerationErr(null);
        setPanelConfirm({ kind: 'pay' });
    }, [editingRequest, lifecycleBusy, moderationBusy]);
    const openUnpayDialog = useCallback(() => {
        if (!editingRequest || lifecycleBusy || moderationBusy)
            return;
        setModerationErr(null);
        setUnpayComment('');
        setUnpayOpen(true);
    }, [editingRequest, lifecycleBusy, moderationBusy]);
    const openUnapproveDialog = useCallback(() => {
        if (!editingRequest || lifecycleBusy || moderationBusy)
            return;
        setModerationErr(null);
        setUnapproveComment('');
        setUnapproveOpen(true);
    }, [editingRequest, lifecycleBusy, moderationBusy]);
    const openWithdrawConfirm = useCallback(() => {
        if (!editingRequest || lifecycleBusy || moderationBusy)
            return;
        setModerationErr(null);
        setPanelConfirm({ kind: 'withdraw' });
    }, [editingRequest, lifecycleBusy, moderationBusy]);
    const openDeleteConfirm = useCallback(() => {
        if (!editingRequest || lifecycleBusy || moderationBusy)
            return;
        setModerationErr(null);
        setPanelConfirm({ kind: 'delete' });
    }, [editingRequest, lifecycleBusy, moderationBusy]);
    const handlePanelConfirmSubmit = useCallback(async () => {
        if (!editingRequest || !panelConfirm)
            return;
        const fail = (msg) => {
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
        if (panelConfirm.kind === 'delete') {
            if (lifecycleBusy || moderationBusy)
                return;
            setModerationErr(null);
            setLifecycleBusy(true);
            try {
                const expenseId = editingRequest.id;
                await deleteExpense(expenseId);
                setPanelConfirm(null);
                onExpenseDeleted?.(expenseId);
                onClose();
            }
            catch (e) {
                fail(e instanceof Error ? e.message : 'Не удалось удалить заявку');
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
        onExpenseDeleted,
        onClose,
    ]);
    const emailIntentHandledRef = useRef(null);
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
        const blockedOwn = isModerationBlockedForOwnExpense(Boolean(canModerate), currentUserId, editingRequest);
        if (emailModerationIntent === 'pay') {
            const canConfirmPayment = showPayExpenseAction(editingRequest, blockedOwn, {
                isPaymentConfirmer: isExpensePaymentConfirmer(currentUserEmail, { displayName: currentUserDisplayName }),
                canModerate: Boolean(canModerate),
            });
            emailIntentHandledRef.current = key;
            onEmailModerationIntentConsumed?.();
            if (canConfirmPayment)
                setPanelConfirm({ kind: 'pay' });
            return;
        }
        const canEmailModerate = showPendingApprovalModeration(editingRequest, Boolean(canModerate), blockedOwn);
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
        currentUserEmail,
        currentUserDisplayName,
        canModerate,
        onEmailModerationIntentConsumed,
    ]);
    const title = mode === 'create' ? 'Новая заявка' : mode === 'edit' ? 'Редактировать заявку' : 'Просмотр заявки';
    const scrollLockActive = isOpen || rejectOpen || reviseOpen || unpayOpen || unapproveOpen || Boolean(panelConfirm);
    useEffect(() => {
        if (!scrollLockActive)
            return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [scrollLockActive]);
    const portalLayer = (_jsxs(_Fragment, { children: [rejectOpen && editingRequest && (_jsx("div", { className: "exp-mod-backdrop", role: "presentation", children: _jsxs("div", { className: "exp-mod-dialog", role: "dialog", "aria-modal": true, "aria-labelledby": "exp-mod-reject-title", onClick: e => e.stopPropagation(), children: [_jsx("h3", { id: "exp-mod-reject-title", className: "exp-mod-dialog__title", children: "\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443" }), _jsxs("p", { className: "exp-mod-dialog__sub", children: ["\u0417\u0430\u044F\u0432\u043A\u0430 ", editingRequest.id, ". \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0440\u0438\u0447\u0438\u043D\u0443 \u2014 \u0430\u0432\u0442\u043E\u0440 \u0435\u0451 \u0443\u0432\u0438\u0434\u0438\u0442 \u0432 \u0438\u0441\u0442\u043E\u0440\u0438\u0438."] }), _jsx("textarea", { className: "exp-mod-dialog__textarea", rows: 4, placeholder: "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F", value: rejectReason, onChange: e => setRejectReason(e.target.value), disabled: moderationBusy }), moderationErr && rejectOpen && _jsx("p", { className: "exp-mod-err", role: "alert", children: moderationErr }), _jsxs("div", { className: "exp-mod-dialog__ft", children: [_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--ghost", disabled: moderationBusy, onClick: () => { setRejectOpen(false); setModerationErr(null); }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--primary exp-panel-btn--danger", disabled: moderationBusy, onClick: handleRejectConfirm, children: "\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C" })] })] }) })), reviseOpen && editingRequest && (_jsx("div", { className: "exp-mod-backdrop", role: "presentation", children: _jsxs("div", { className: "exp-mod-dialog", role: "dialog", "aria-modal": true, "aria-labelledby": "exp-mod-revise-title", onClick: e => e.stopPropagation(), children: [_jsx("h3", { id: "exp-mod-revise-title", className: "exp-mod-dialog__title", children: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043D\u0430 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0443" }), _jsxs("p", { className: "exp-mod-dialog__sub", children: ["\u0417\u0430\u044F\u0432\u043A\u0430 ", editingRequest.id, ". \u0410\u0432\u0442\u043E\u0440 \u0441\u043C\u043E\u0436\u0435\u0442 \u0438\u0441\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443 \u0438 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0441\u043D\u043E\u0432\u0430."] }), _jsx("textarea", { className: "exp-mod-dialog__textarea", rows: 4, placeholder: "\u0427\u0442\u043E \u043D\u0443\u0436\u043D\u043E \u0438\u0441\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0438\u043B\u0438 \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u044C", value: reviseComment, onChange: e => setReviseComment(e.target.value), disabled: moderationBusy }), moderationErr && reviseOpen && _jsx("p", { className: "exp-mod-err", role: "alert", children: moderationErr }), _jsxs("div", { className: "exp-mod-dialog__ft", children: [_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--ghost", disabled: moderationBusy, onClick: () => { setReviseOpen(false); setModerationErr(null); }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--primary", disabled: moderationBusy, onClick: handleReviseConfirm, children: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C" })] })] }) })), panelConfirm && (_jsx(ExpenseConfirmDialog, { isOpen: true, title: panelConfirm.kind === 'approve'
                    ? 'Одобрить заявку?'
                    : panelConfirm.kind === 'pay'
                        ? (editingRequest && String(editingRequest.paymentMethod ?? '').toLowerCase() === 'cash'
                            ? 'Подтвердить возмещение?'
                            : 'Подтвердить оплату?')
                        : panelConfirm.kind === 'delete'
                            ? 'Удалить заявку?'
                            : 'Отозвать заявку?', message: panelConfirm.kind === 'approve' ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "exp-mod-dialog__sub", children: "\u0421\u0442\u0430\u0442\u0443\u0441 \u0441\u0442\u0430\u043D\u0435\u0442 \u00AB\u041E\u0434\u043E\u0431\u0440\u0435\u043D\u043E\u00BB." }), editingRequest && editingRequest.expenseType !== 'partner_expense' ? (_jsx("p", { className: "exp-mod-dialog__sub", children: isEmployeePersonalFundsPayout(editingRequest)
                                ? 'После одобрения заявку нужно компенсировать сотруднику на указанную карту. Подтверждение выплаты выполняет назначенный сотрудник, статус станет «Ожидает компенсацию».'
                                : 'После одобрения заявка уйдёт на оплату (в том числе перечислением). Отметить оплату могут модераторы реестра расходов.' })) : null] })) : panelConfirm.kind === 'pay' ? (_jsx("p", { className: "exp-mod-dialog__sub", children: editingRequest && String(editingRequest.paymentMethod ?? '').toLowerCase() === 'cash'
                        ? 'Статус станет «Возмещено». Убедитесь, что перевод на карту сотрудника выполнен.'
                        : 'Статус станет «Оплачено». Убедитесь, что банковское перечисление выполнено.' })) : panelConfirm.kind === 'delete' ? (_jsxs("p", { className: "exp-mod-dialog__sub", children: ["\u0417\u0430\u044F\u0432\u043A\u0430 ", editingRequest?.id, " \u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043B\u0435\u043D\u0430 \u0431\u0435\u0437\u0432\u043E\u0437\u0432\u0440\u0430\u0442\u043D\u043E \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u044F\u043C\u0438."] })) : (_jsx("p", { className: "exp-mod-dialog__sub", children: "\u0421\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u044F\u0432\u043A\u0438 \u0441\u0442\u0430\u043D\u0435\u0442 \u00AB\u041E\u0442\u043E\u0437\u0432\u0430\u043D\u0430\u00BB." })), confirmLabel: panelConfirm.kind === 'approve'
                    ? 'Одобрить'
                    : panelConfirm.kind === 'pay'
                        ? (editingRequest ? expensePayActionLabel(editingRequest) : 'Оплачено')
                        : panelConfirm.kind === 'delete'
                            ? 'Удалить'
                            : 'Отозвать', confirmVariant: panelConfirm.kind === 'withdraw' || panelConfirm.kind === 'delete' ? 'danger' : 'primary', busy: panelConfirm.kind === 'approve' ? moderationBusy : lifecycleBusy, onClose: () => {
                    const busy = panelConfirm.kind === 'approve' ? moderationBusy : lifecycleBusy;
                    if (!busy)
                        setPanelConfirm(null);
                }, onConfirm: handlePanelConfirmSubmit })), unpayOpen && editingRequest && (_jsx("div", { className: "exp-mod-backdrop", role: "presentation", children: _jsxs("div", { className: "exp-mod-dialog", role: "dialog", "aria-modal": true, "aria-labelledby": "exp-mod-unpay-title", onClick: e => e.stopPropagation(), children: [_jsx("h3", { id: "exp-mod-unpay-title", className: "exp-mod-dialog__title", children: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443" }), _jsxs("p", { className: "exp-mod-dialog__sub", children: ["\u0417\u0430\u044F\u0432\u043A\u0430 ", editingRequest.id, " \u0432\u0435\u0440\u043D\u0451\u0442\u0441\u044F \u0432 \u0441\u0442\u0430\u0442\u0443\u0441 \u00AB\u041E\u0436\u0438\u0434\u0430\u0435\u0442 \u043E\u043F\u043B\u0430\u0442\u044B / \u0432\u043E\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u00BB."] }), _jsx("textarea", { className: "exp-mod-dialog__textarea", rows: 4, placeholder: "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043E\u0442\u043C\u0435\u043D\u044B \u043E\u043F\u043B\u0430\u0442\u044B", value: unpayComment, onChange: e => setUnpayComment(e.target.value), disabled: lifecycleBusy }), moderationErr && unpayOpen && _jsx("p", { className: "exp-mod-err", role: "alert", children: moderationErr }), _jsxs("div", { className: "exp-mod-dialog__ft", children: [_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--ghost", disabled: lifecycleBusy, onClick: () => { setUnpayOpen(false); setModerationErr(null); }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--primary", disabled: lifecycleBusy, onClick: () => void handleUnpayConfirm(), children: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443" })] })] }) })), unapproveOpen && editingRequest && (_jsx("div", { className: "exp-mod-backdrop", role: "presentation", children: _jsxs("div", { className: "exp-mod-dialog", role: "dialog", "aria-modal": true, "aria-labelledby": "exp-mod-unapprove-title", onClick: e => e.stopPropagation(), children: [_jsx("h3", { id: "exp-mod-unapprove-title", className: "exp-mod-dialog__title", children: "\u0421\u043D\u044F\u0442\u044C \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsxs("p", { className: "exp-mod-dialog__sub", children: ["\u0417\u0430\u044F\u0432\u043A\u0430 ", editingRequest.id, " \u0432\u0435\u0440\u043D\u0451\u0442\u0441\u044F \u043D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435. \u0410\u0432\u0442\u043E\u0440 \u0441\u043C\u043E\u0436\u0435\u0442 \u043E\u0442\u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0438 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0441\u043D\u043E\u0432\u0430."] }), _jsx("textarea", { className: "exp-mod-dialog__textarea", rows: 4, placeholder: "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u0441\u043D\u044F\u0442\u0438\u044F \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F", value: unapproveComment, onChange: e => setUnapproveComment(e.target.value), disabled: lifecycleBusy }), moderationErr && unapproveOpen && _jsx("p", { className: "exp-mod-err", role: "alert", children: moderationErr }), _jsxs("div", { className: "exp-mod-dialog__ft", children: [_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--ghost", disabled: lifecycleBusy, onClick: () => { setUnapproveOpen(false); setModerationErr(null); }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--primary", disabled: lifecycleBusy, onClick: () => void handleUnapproveConfirm(), children: "\u0421\u043D\u044F\u0442\u044C \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435" })] })] }) })), _jsx(ExpenseAttachmentPreviewModal, { isOpen: attachPreview != null, fileName: attachPreview?.fileName ?? '', loading: attachPreview?.loading ?? false, error: attachPreview?.error ?? null, model: attachPreview?.model ?? null, canOpenExternal: Boolean(attachPreview &&
                    (attachPreview.server || attachPreview.localFile || attachPreview.previewObjectUrl)), onClose: closeAttachPreview, onOpenExternal: openAttachmentExternal }), _jsx("div", { className: `exp-panel-overlay${motionOpen ? ' exp-panel-overlay--open' : ''}`, "aria-hidden": !motionOpen, onMouseDown: () => {
                    if (!isOpen || !motionOpen || formAsyncBusy)
                        return;
                    onClose();
                } }), _jsxs("aside", { className: `exp-panel${motionOpen ? ' exp-panel--open' : ''}${formAsyncBusy ? ' exp-panel--async-busy' : ''}`, "aria-modal": true, "aria-busy": formAsyncBusy, "aria-label": editingRequest?.id ? `${title}, ${editingRequest.id}` : title, onTransitionEnd: handlePanelTransitionEnd, children: [_jsxs("div", { className: "exp-panel__hd", children: [_jsxs("div", { className: "exp-panel__hd-left", children: [isView && editingRequest && (_jsx("span", { className: expenseStatusBadgeClass(editingRequest), children: expenseStatusLabel(editingRequest) })), _jsx("h2", { className: "exp-panel__title", children: title })] }), _jsx("button", { type: "button", className: "exp-panel__close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", disabled: formAsyncBusy, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsxs("div", { className: "exp-panel__body", ref: bodyRef, children: [(editingRequest?.status === 'rejected' || editingRequest?.status === 'revision_required')
                                && editingRequest.rejectionReason ? (_jsxs("section", { className: `exp-rejection-reason${editingRequest.status === 'revision_required' ? ' exp-rejection-reason--revision' : ''}`, role: "note", "aria-label": editingRequest.status === 'revision_required' ? 'Комментарий к доработке' : 'Причина отказа', children: [_jsx("div", { className: "exp-rejection-reason__icon", "aria-hidden": true, children: "!" }), _jsxs("div", { children: [_jsx("p", { className: "exp-rejection-reason__title", children: editingRequest.status === 'revision_required' ? 'Что исправить' : 'Причина отказа' }), _jsx("p", { className: "exp-rejection-reason__text", children: editingRequest.rejectionReason })] })] })) : null, _jsxs("div", { className: "exp-form-block", children: [_jsx("p", { className: "exp-form-block__title", children: "\u041E\u0441\u043D\u043E\u0432\u043D\u0430\u044F \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F" }), editingRequest?.id ? (_jsxs("div", { className: "exp-form-id", children: [_jsx("span", { className: "exp-form-id__label", children: "\u041D\u043E\u043C\u0435\u0440 \u0437\u0430\u044F\u0432\u043A\u0438" }), _jsx("span", { className: "exp-form-id__value", children: editingRequest.id })] })) : null, editingRequest && (_jsxs("div", { className: "exp-form-field", children: [_jsx("div", { className: "exp-form-label", children: "\u0410\u0432\u0442\u043E\u0440 \u0437\u0430\u044F\u0432\u043A\u0438" }), _jsx("p", { className: "exp-form-static", children: formatExpenseAuthorLabel(editingRequest) }), editingRequest.createdBy?.position && (_jsx("p", { className: "exp-form-static exp-form-static--muted", children: editingRequest.createdBy.position })), editingRequest.createdBy?.displayName && editingRequest.createdBy?.email && (_jsx("p", { className: "exp-form-static exp-form-static--muted", children: editingRequest.createdBy.email }))] })), editingRequest?.status === 'paid' && (_jsxs("div", { className: "exp-form-field", children: [_jsx("div", { className: "exp-form-label", children: "\u041E\u043F\u043B\u0430\u0442\u0443 \u043E\u0442\u043C\u0435\u0442\u0438\u043B(\u0430)" }), _jsx("p", { className: "exp-form-static", children: formatExpensePaidByLabel(editingRequest) }), editingRequest.paidBy?.email && (_jsx("p", { className: "exp-form-static exp-form-static--muted", children: editingRequest.paidBy.email }))] })), _jsxs("div", { className: `exp-form-field${errors.expenseType ? ' exp-form-field--err' : ''}`, children: [_jsxs("label", { className: "exp-form-label", children: ["\u0422\u0438\u043F \u0440\u0430\u0441\u0445\u043E\u0434\u0430 ", _jsx("span", { className: "exp-form-req", children: "*" })] }), isView ? (_jsx("p", { className: "exp-form-static", children: expenseTypeItems.find(t => t.value === values.expenseType)?.label || values.expenseType || '—' })) : (_jsx(ExpenseSearchableSelect, { portalDropdown: true, placeholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0438\u043F", emptyListText: "\u041D\u0435\u0442 \u0442\u0438\u043F\u043E\u0432", noMatchText: "\u0422\u0438\u043F \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", value: values.expenseType, items: expenseTypeItems, getOptionValue: t => t.value, getOptionLabel: t => t.label, getSearchText: t => t.label, onSelect: t => set('expenseType', t.value), "aria-invalid": Boolean(errors.expenseType), "aria-label": "\u0422\u0438\u043F \u0440\u0430\u0441\u0445\u043E\u0434\u0430" })), errors.expenseType && _jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.expenseType })] }), values.expenseType === 'partner_expense' && (_jsxs("div", { className: `exp-form-field${errors.expenseSubtype ? ' exp-form-field--err' : ''}`, children: [_jsxs("label", { className: "exp-form-label", children: ["\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u0440\u0430\u0441\u0445\u043E\u0434\u0430 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430 ", _jsx("span", { className: "exp-form-req", children: "*" })] }), isView ? (_jsx("p", { className: "exp-form-static", children: values.expenseSubtype
                                                    ? getPartnerExpenseSubtypeLabel(values.expenseSubtype) || values.expenseSubtype
                                                    : '—' })) : (_jsx(ExpenseSearchableSelect, { portalDropdown: true, placeholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E", emptyListText: "\u041D\u0435\u0442 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0439", noMatchText: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430", value: values.expenseSubtype, items: partnerSubtypeItems, getOptionValue: c => c.value, getOptionLabel: c => c.label, getSearchText: c => c.label, onSelect: c => set('expenseSubtype', c.value), "aria-invalid": Boolean(errors.expenseSubtype), "aria-label": "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u0440\u0430\u0441\u0445\u043E\u0434\u0430 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430" })), !isView && (_jsxs("p", { className: "exp-form-hint", style: { marginTop: '0.35rem' }, children: ["\u0420\u0430\u0441\u0445\u043E\u0434 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0441\u0440\u0430\u0437\u0443 \u0432 \u0441\u0442\u0430\u0442\u0443\u0441 ", _jsx("strong", { children: "\u00AB\u041E\u0434\u043E\u0431\u0440\u0435\u043D\u043E\u00BB" }), " \u2014 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435 \u043D\u0435 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F. \u041C\u043E\u0436\u043D\u043E \u0443\u043A\u0430\u0437\u0430\u0442\u044C \u0434\u0430\u0442\u0443 \u0437\u0430\u0434\u043D\u0438\u043C \u0447\u0438\u0441\u043B\u043E\u043C."] })), errors.expenseSubtype && _jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.expenseSubtype })] })), values.expenseType === 'partner_expense' && (_jsxs("div", { className: `exp-form-field${errors.partnerUserId ? ' exp-form-field--err' : ''}`, children: [_jsx("label", { className: "exp-form-label", children: "\u041F\u0430\u0440\u0442\u043D\u0451\u0440 (\u0447\u0435\u0439 \u0440\u0430\u0441\u0445\u043E\u0434)" }), isView ? (_jsx("p", { className: "exp-form-static", children: editingRequest?.partnerUser?.displayName?.trim()
                                                    || editingRequest?.partnerUser?.email?.trim()
                                                    || '—' })) : (_jsx(ExpenseSearchableSelect, { portalDropdown: true, placeholder: partnersLoad === 'loading' ? 'Загрузка…' : 'Не указан', emptyListText: "\u041F\u0430\u0440\u0442\u043D\u0451\u0440\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B", noMatchText: "\u041F\u0430\u0440\u0442\u043D\u0451\u0440 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", value: values.partnerUserId, items: partnerUserItems, getOptionValue: p => p.id, getOptionLabel: p => p.label, getSearchText: p => p.search, disabled: partnersLoad === 'loading', onSelect: p => set('partnerUserId', p.id), "aria-invalid": Boolean(errors.partnerUserId), "aria-label": "\u041F\u0430\u0440\u0442\u043D\u0451\u0440" })), !isView && (_jsx("p", { className: "exp-form-hint", style: { marginTop: '0.35rem' }, children: "\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E: \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430, \u0437\u0430 \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u0444\u0438\u043A\u0441\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u0440\u0430\u0441\u0445\u043E\u0434." })), partnersLoad === 'error' && partnersLoadErr ? (_jsx("p", { className: "exp-form-err-msg", role: "alert", children: partnersLoadErr })) : null, errors.partnerUserId && _jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.partnerUserId })] })), _jsxs("div", { className: `exp-form-field${errors.description ? ' exp-form-field--err' : ''}`, children: [_jsxs("div", { className: "exp-form-label-row", children: [_jsxs("label", { className: "exp-form-label", children: ["\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0440\u0430\u0441\u0445\u043E\u0434\u0430 ", _jsx("span", { className: "exp-form-req", children: "*" })] }), _jsx("button", { type: "button", className: "exp-form-copy-btn", onClick: () => void handleCopyDescription(), disabled: !values.description.trim(), title: values.description.trim() ? 'Копировать описание' : 'Нет описания', "aria-label": "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2" }), _jsx("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })] }) })] }), _jsx("textarea", { className: "exp-form-textarea", placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u043E\u043F\u043B\u0430\u0442\u0430 \u0442\u0430\u043A\u0441\u0438, \u043F\u043E\u043A\u0443\u043F\u043A\u0430 \u043A\u0430\u043D\u0446\u0442\u043E\u0432\u0430\u0440\u043E\u0432, \u0431\u0440\u043E\u043D\u044C \u0433\u043E\u0441\u0442\u0438\u043D\u0438\u0446\u044B", value: values.description, onChange: e => set('description', e.target.value), disabled: isView, rows: 3 }), errors.description && _jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.description })] }), values.expenseType === 'other' && values.isReimbursable && (_jsxs("div", { className: `exp-form-field${errors.comment ? ' exp-form-field--err' : ''}`, children: [_jsxs("label", { className: "exp-form-label", children: ["\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043A \u0442\u0438\u043F\u0443 \u00AB\u041F\u0440\u043E\u0447\u0435\u0435\u00BB ", _jsx("span", { className: "exp-form-req", children: "*" })] }), _jsx("p", { className: "exp-form-hint", style: { margin: '0 0 0.4rem' }, children: "\u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D \u043F\u0440\u0438 \u0432\u043E\u0437\u043C\u0435\u0449\u0430\u0435\u043C\u043E\u043C \u0440\u0430\u0441\u0445\u043E\u0434\u0435. \u041F\u043E\u043B\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u043E\u0442 \u0431\u043B\u043E\u043A\u0430 \u00AB\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u00BB (\u043E\u043D \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u0442\u0438\u043F\u0430 \u00AB\u0417\u0430 \u043A\u043B\u0438\u0435\u043D\u0442\u0430\u00BB)." }), isView ? (_jsx("p", { className: "exp-form-static", children: values.comment.trim() ? values.comment : '—' })) : (_jsx("textarea", { className: "exp-form-textarea", placeholder: "\u041F\u043E\u044F\u0441\u043D\u0438\u0442\u0435 \u0441\u0443\u0442\u044C \u0440\u0430\u0441\u0445\u043E\u0434\u0430", value: values.comment, onChange: e => {
                                                    set('comment', e.target.value);
                                                    if (errors.comment) {
                                                        setErrors(prev => ({ ...prev, comment: undefined }));
                                                    }
                                                }, rows: 3, "aria-invalid": Boolean(errors.comment) })), errors.comment && _jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.comment })] }))] }), _jsxs("div", { className: "exp-form-block", children: [_jsx("p", { className: "exp-form-block__title", children: "\u0424\u0438\u043D\u0430\u043D\u0441\u044B" }), mode === 'create' && !allowExpenseBackdate && (_jsx("p", { className: "exp-form-hint", children: "\u0414\u0430\u0442\u0430 \u0440\u0430\u0441\u0445\u043E\u0434\u0430 \u2014 \u0441\u0435\u0433\u043E\u0434\u043D\u044F\u0448\u043D\u0438\u0439 \u0434\u0435\u043D\u044C; \u043A\u0443\u0440\u0441 UZS/USD \u0438 \u043A\u0440\u043E\u0441\u0441-\u043A\u0443\u0440\u0441\u044B \u043F\u043E\u0434\u0441\u0442\u0430\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0441 cbu.uz \u043D\u0430 \u044D\u0442\u0443 \u0434\u0430\u0442\u0443." })), mode === 'create' && allowExpenseBackdate && (_jsxs("div", { className: `exp-form-field${errors.expenseDate ? ' exp-form-field--err' : ''}`, children: [_jsxs("label", { className: "exp-form-label", children: ["\u0414\u0430\u0442\u0430 \u0440\u0430\u0441\u0445\u043E\u0434\u0430 ", _jsx("span", { className: "exp-form-req", children: "*" })] }), _jsx("input", { type: "date", className: "exp-form-input exp-form-input--date", value: values.expenseDate, max: todayIsoLocal(), onChange: e => set('expenseDate', e.target.value), disabled: isView }), _jsx("p", { className: "exp-form-hint", children: "\u041C\u043E\u0436\u043D\u043E \u0443\u043A\u0430\u0437\u0430\u0442\u044C \u043F\u0440\u043E\u0448\u0435\u0434\u0448\u0443\u044E \u0434\u0430\u0442\u0443; \u043A\u0443\u0440\u0441 \u043F\u043E\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0441\u044F \u0441 cbu.uz \u043D\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0434\u0435\u043D\u044C." }), errors.expenseDate && _jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.expenseDate })] })), mode === 'create' && cbuLoading && (_jsx("p", { className: "exp-form-hint", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043A\u0443\u0440\u0441\u0430 \u0426\u0411 \u0420\u0423\u0437\u2026" })), mode === 'create' && cbuParsed && !cbuLoading && (_jsx("p", { className: "exp-form-hint", children: cbuParsed.source === 'market'
                                            ? `Сайт ЦБ не ответил. Подставлен резервный курс USD на ${cbuParsed.rateDateRu || 'выбранную дату'}.`
                                            : `Курс UZS/USD подставлен с ЦБ РУз (${cbuParsed.rateDateRu}).` })), mode === 'create' && (cbuError || errors.exchangeRate) && !cbuLoading && (_jsx("p", { className: "exp-form-err-msg", role: "alert", "data-err": true, children: cbuError || errors.exchangeRate })), (mode === 'edit' || mode === 'view') && values.expenseDate && (_jsxs("div", { className: "exp-form-field", children: [_jsx("div", { className: "exp-form-label", children: "\u0414\u0430\u0442\u0430 \u0440\u0430\u0441\u0445\u043E\u0434\u0430" }), _jsx("p", { className: "exp-form-static", children: fmtIsoDateRu(values.expenseDate) })] })), _jsxs("div", { className: `exp-form-field${errors.amountUzs ? ' exp-form-field--err' : ''}`, children: [_jsxs("label", { className: "exp-form-label", children: ["\u0421\u0443\u043C\u043C\u0430 ", _jsx("span", { className: "exp-form-req", children: "*" })] }), _jsxs("div", { className: "exp-form-input-wrap", children: [_jsx("input", { type: "number", min: 0, step: "any", className: "exp-form-input", placeholder: "0", value: values.amountUzs, onChange: e => setAmount(e.target.value), disabled: isView }), _jsx(ExpenseSearchableSelect, { portalDropdown: true, className: "exp-form-currency-searchable", buttonClassName: "exp-form-currency-select", placeholder: "\u0412\u0430\u043B\u044E\u0442\u0430", value: values.amountCurrency, items: currencyItems, getOptionValue: c => c.value, getOptionLabel: c => c.label, getSearchText: c => `${c.label} ${c.value}`, disabled: isView, onSelect: c => setCurrency(c.value), "aria-label": "\u0412\u0430\u043B\u044E\u0442\u0430 \u0441\u0443\u043C\u043C\u044B" })] }), errors.amountUzs && _jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.amountUzs }), amountUzsSaveHint && _jsx("p", { className: "exp-form-hint", children: amountUzsSaveHint }), approvalRoutingHint && _jsx("p", { className: "exp-form-hint", children: approvalRoutingHint })] }), showForeignRate && (_jsxs("div", { className: `exp-form-field${errors.foreignPerUsd ? ' exp-form-field--err' : ''}`, children: [_jsxs("label", { className: "exp-form-label", children: ["\u0415\u0434\u0438\u043D\u0438\u0446 \u0432\u0430\u043B\u044E\u0442\u044B \u0437\u0430 1 USD ", _jsx("span", { className: "exp-form-req", children: "*" })] }), _jsx("div", { className: "exp-form-input-wrap", children: _jsx("input", { type: "number", min: 0, step: "any", className: "exp-form-input", placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: 90", value: values.foreignPerUsd, onChange: e => set('foreignPerUsd', e.target.value), disabled: isView, readOnly: !isView && foreignLocked }) }), _jsx("p", { className: "exp-form-hint", children: foreignLocked
                                                    ? 'Рассчитано по курсам ЦБ РУз (через сум к USD и к выбранной валюте)'
                                                    : 'Сколько единиц выбранной валюты составляет 1 USD на дату расхода' }), errors.foreignPerUsd && _jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.foreignPerUsd })] })), _jsxs("div", { className: "exp-form-field", children: [_jsx("label", { className: "exp-form-label", children: "\u042D\u043A\u0432\u0438\u0432\u0430\u043B\u0435\u043D\u0442\u043D\u0430\u044F \u0441\u0443\u043C\u043C\u0430" }), _jsxs("div", { className: "exp-form-input-wrap", children: [_jsx("input", { type: "text", className: "exp-form-input exp-form-input--calc", value: equiv || (isView ? viewEquivFromServer : ''), readOnly: true, tabIndex: -1, placeholder: "\u2014" }), _jsx("span", { className: "exp-form-suffix", children: "USD" })] }), _jsx("p", { className: "exp-form-hint", children: equivHint })] }), _jsxs("div", { className: `exp-form-field${errors.paymentMethod ? ' exp-form-field--err' : ''}`, children: [_jsxs("label", { className: "exp-form-label", children: ["\u0421\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B ", _jsx("span", { className: "exp-form-req", children: "*" })] }), isView ? (_jsx("p", { className: "exp-form-static", children: paymentMethodItems.find(m => m.value === values.paymentMethod)?.label || values.paymentMethod || '—' })) : (_jsx(ExpenseSearchableSelect, { portalDropdown: true, placeholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B", emptyListText: "\u041D\u0435\u0442 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432", noMatchText: "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", value: values.paymentMethod, items: paymentMethodItems, getOptionValue: m => m.value, getOptionLabel: m => m.label, getSearchText: m => m.search, onSelect: m => set('paymentMethod', m.value), "aria-invalid": Boolean(errors.paymentMethod), "aria-label": "\u0421\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B" })), errors.paymentMethod && _jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.paymentMethod })] }), (values.paymentMethod === 'cash') && values.expenseType !== 'partner_expense' && (_jsxs("div", { className: `exp-form-field${errors.reimbursementCardNumber ? ' exp-form-field--err' : ''}`, children: [_jsxs("div", { className: "exp-form-label-row", children: [_jsxs("label", { className: "exp-form-label", children: ["\u041D\u043E\u043C\u0435\u0440 \u043A\u0430\u0440\u0442\u044B \u0434\u043B\u044F \u0432\u043E\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F ", _jsx("span", { className: "exp-form-req", children: "*" })] }), _jsx("button", { type: "button", className: "exp-form-copy-btn", onClick: () => void handleCopyCardNumber(), disabled: !reimbursementCardDigits(values.reimbursementCardNumber), title: reimbursementCardDigits(values.reimbursementCardNumber) ? 'Копировать номер карты' : 'Нет номера карты', "aria-label": "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043D\u043E\u043C\u0435\u0440 \u043A\u0430\u0440\u0442\u044B", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2" }), _jsx("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })] }) })] }), isView ? (_jsx("p", { className: "exp-form-static", children: formatReimbursementCardNumber(values.reimbursementCardNumber) || '—' })) : (_jsx("input", { type: "text", className: "exp-form-input", inputMode: "numeric", autoComplete: "cc-number", maxLength: 19, placeholder: "0000 0000 0000 0000", value: values.reimbursementCardNumber, onChange: event => set('reimbursementCardNumber', formatReimbursementCardNumber(event.target.value)), "aria-invalid": Boolean(errors.reimbursementCardNumber) })), !isView && (_jsx("p", { className: "exp-form-hint", children: "\u041A\u0430\u0440\u0442\u0430 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430, \u043D\u0430 \u043A\u043E\u0442\u043E\u0440\u0443\u044E \u0444\u0438\u0440\u043C\u0430 \u0432\u0435\u0440\u043D\u0451\u0442 \u043B\u0438\u0447\u043D\u044B\u0435 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0430. \u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u0430 \u043F\u0440\u0438 \u043E\u043F\u043B\u0430\u0442\u0435 \u0441 \u043B\u0438\u0447\u043D\u043E\u0439 \u043A\u0430\u0440\u0442\u044B \u0438\u043B\u0438 \u043D\u0430\u043B\u0438\u0447\u043D\u044B\u043C\u0438 \u2014 \u043D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E \u043E\u0442 \u0432\u043E\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u043A\u043B\u0438\u0435\u043D\u0442\u043E\u043C." })), errors.reimbursementCardNumber && (_jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.reimbursementCardNumber }))] })), _jsx("div", { className: "exp-form-field", children: _jsxs("div", { className: "exp-form-switch-row", children: [_jsxs("div", { className: "exp-form-switch-info", children: [_jsx("span", { className: "exp-form-label", style: { marginBottom: 0 }, children: "\u0412\u043E\u0437\u043C\u0435\u0449\u0430\u0435\u043C\u044B\u0439 \u043A\u043B\u0438\u0435\u043D\u0442\u043E\u043C" }), _jsx("p", { className: "exp-form-hint", style: { margin: '0.25rem 0 0 0' }, children: "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u0435, \u0435\u0441\u043B\u0438 \u044D\u0442\u043E\u0442 \u0440\u0430\u0441\u0445\u043E\u0434 \u043F\u043E\u0442\u043E\u043C \u043A\u043E\u043C\u043F\u0435\u043D\u0441\u0438\u0440\u0443\u0435\u0442 \u043A\u043B\u0438\u0435\u043D\u0442. \u042D\u0442\u043E \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u043E\u0442 \u0432\u044B\u043F\u043B\u0430\u0442\u044B \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0443: \u043F\u0440\u0438 \u00AB\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u0435/\u041B\u0438\u0447\u043D\u0430\u044F \u043A\u0430\u0440\u0442\u0430\u00BB \u043A\u0430\u0440\u0442\u0443 \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u044E\u0442 \u0432\u0441\u0435\u0433\u0434\u0430 \u2014 \u0434\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u043A\u043B\u0438\u0435\u043D\u0442 \u043D\u0435 \u0432\u043E\u0437\u043C\u0435\u0449\u0430\u0435\u0442." })] }), _jsx("button", { type: "button", role: "switch", "aria-checked": values.isReimbursable === true, className: `exp-form-switch${values.isReimbursable === true ? ' exp-form-switch--on' : ''}${isView ? ' exp-form-switch--disabled' : ''}`, onClick: () => {
                                                        if (!isView)
                                                            setReimb(values.isReimbursable !== true);
                                                    }, children: _jsx("span", { className: "exp-form-switch__thumb" }) })] }) })] }), showAdditionalSection && (_jsxs("div", { className: "exp-form-block", children: [_jsx("p", { className: "exp-form-block__title", children: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E" }), _jsxs("p", { className: "exp-form-hint", style: { margin: '-0.35rem 0 0.75rem 0' }, children: ["\u0422\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u0442\u0438\u043F\u0430 ", _jsx("strong", { children: "\u00AB\u0417\u0430 \u043A\u043B\u0438\u0435\u043D\u0442\u0430\u00BB" }), ": \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0430 \u043A \u043A\u043B\u0438\u0435\u043D\u0442\u0443 \u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u0443 \u0438\u0437 \u0443\u0447\u0451\u0442\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u0438, \u043A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442, \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043A \u0437\u0430\u044F\u0432\u043A\u0435."] }), values.isReimbursable === false && (_jsxs("p", { className: "exp-form-hint", style: { margin: '0 0 0.75rem 0' }, children: ["\u0415\u0441\u043B\u0438 \u043A\u043B\u0438\u0435\u043D\u0442 ", _jsx("strong", { children: "\u043D\u0435 \u0432\u043E\u0437\u043C\u0435\u0449\u0430\u0435\u0442" }), " \u0440\u0430\u0441\u0445\u043E\u0434, \u043F\u0440\u043E\u0435\u043A\u0442, \u043A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442 \u0438 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043D\u0435 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B, \u0435\u0441\u043B\u0438 \u043D\u0435 \u043D\u0443\u0436\u043D\u044B \u0434\u043B\u044F \u0443\u0447\u0451\u0442\u0430."] })), values.isReimbursable === true && (_jsxs("p", { className: "exp-form-hint", style: { margin: '0 0 0.75rem 0' }, children: [_jsx("strong", { children: "\u041F\u0440\u043E\u0435\u043A\u0442" }), " \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D (\u0441\u043F\u0440\u0430\u0432\u043E\u0447\u043D\u0438\u043A \u0443\u0447\u0451\u0442\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u0438), \u043F\u043E\u0442\u043E\u043C\u0443 \u0447\u0442\u043E \u0440\u0430\u0441\u0445\u043E\u0434 \u0432\u043E\u0437\u043C\u0435\u0449\u0430\u0435\u0442 \u043A\u043B\u0438\u0435\u043D\u0442. \u0412 \u00AB\u041A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442 / \u041F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A\u00BB \u043F\u043E\u0434\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043A\u043B\u0438\u0435\u043D\u0442 \u043F\u0440\u043E\u0435\u043A\u0442\u0430. \u041F\u0440\u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0445 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F\u0445 \u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u2014 \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E \u0440\u0430\u0441\u0445\u043E\u0434\u0430."] })), _jsxs("div", { className: `exp-form-field exp-form-field--project${errors.projectId ? ' exp-form-field--err' : ''}`, children: [expenseProjectsError && (_jsx("p", { className: "exp-form-err-msg", role: "alert", children: expenseProjectsError })), isView ? (_jsx(_Fragment, { children: selectedExpenseProjectMeta ? (_jsxs("div", { className: "exp-project-picker__card exp-project-picker__card--selected exp-project-picker__card--readonly", "aria-label": "\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442", children: [_jsx(ExpenseProjectCardBody, { project: selectedExpenseProjectMeta.project }), _jsx("p", { className: "exp-project-picker__client-line", children: selectedExpenseProjectMeta.client.name })] })) : values.projectId.trim() ? (_jsx("p", { className: "exp-form-static", children: "\u041F\u0440\u043E\u0435\u043A\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u0441\u043F\u0440\u0430\u0432\u043E\u0447\u043D\u0438\u043A\u0435 (ID \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u0432 \u0437\u0430\u044F\u0432\u043A\u0435)." })) : (_jsx("p", { className: "exp-form-static exp-form-static--muted", children: "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D" })) })) : (_jsxs(_Fragment, { children: [expenseProjectsLoading && (_jsx("div", { className: "exp-project-picker__loading", role: "status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432\u2026" })), !expenseProjectsLoading &&
                                                        !expenseProjectsError &&
                                                        expenseClientsProjects.length === 0 && (_jsx("p", { className: "exp-form-hint", children: "\u041D\u0435\u0442 \u043A\u043B\u0438\u0435\u043D\u0442\u043E\u0432: \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0438\u0445 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \u00AB\u0423\u0447\u0451\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u0438\u00BB \u2192 \u00AB\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438\u00BB." })), !expenseProjectsLoading &&
                                                        !expenseProjectsError &&
                                                        expenseClientsProjects.length > 0 && (_jsxs("div", { className: "exp-project-picker", children: [selectedExpenseProjectMeta &&
                                                                selectedExpenseProjectMeta.client.id !== expenseProjectClientId && (_jsxs("div", { className: "exp-project-picker__banner", role: "status", children: [_jsxs("span", { className: "exp-project-picker__banner-text", children: ["\u0412\u044B\u0431\u0440\u0430\u043D \u043F\u0440\u043E\u0435\u043A\u0442 \u00AB", selectedExpenseProjectMeta.project.name, "\u00BB (", selectedExpenseProjectMeta.client.name, ")."] }), _jsx("button", { type: "button", className: "exp-project-picker__banner-action", onClick: () => handleExpenseClientPick(selectedExpenseProjectMeta.client), children: "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u044D\u0442\u043E\u0433\u043E \u043A\u043B\u0438\u0435\u043D\u0442\u0430" })] })), _jsxs("div", { className: "exp-project-picker__field", children: [_jsx("label", { className: "exp-form-label", children: "\u041A\u043B\u0438\u0435\u043D\u0442" }), _jsx(ExpenseSearchableSelect, { portalDropdown: true, disabled: expenseClientsFlat.length === 0, placeholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043A\u043B\u0438\u0435\u043D\u0442\u0430", emptyListText: "\u041D\u0435\u0442 \u043A\u043B\u0438\u0435\u043D\u0442\u043E\u0432", noMatchText: "\u041A\u043B\u0438\u0435\u043D\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", value: expenseProjectClientId, items: expenseClientsFlat, getOptionValue: c => c.id, getOptionLabel: c => c.name, getSearchText: c => c.name, onSelect: handleExpenseClientPick })] }), _jsx("p", { className: "exp-form-hint exp-project-picker__combo-hint", children: "\u041F\u0440\u043E\u0435\u043A\u0442: \u043F\u0440\u0438 \u043F\u0443\u0441\u0442\u043E\u043C \u043F\u043E\u043B\u0435 \u043F\u043E\u0438\u0441\u043A\u0430 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u043F\u0440\u043E\u0435\u043A\u0442\u044B \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u043A\u043B\u0438\u0435\u043D\u0442\u0430; \u043D\u0430\u0447\u043D\u0438\u0442\u0435 \u0432\u0432\u043E\u0434 \u2014 \u043F\u043E\u0438\u0441\u043A \u043F\u043E \u0432\u0441\u0435\u043C \u043F\u0440\u043E\u0435\u043A\u0442\u0430\u043C (\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435, \u043A\u043E\u0434, \u043A\u043B\u0438\u0435\u043D\u0442)." }), _jsxs("div", { className: "exp-project-picker__field", children: [_jsxs("label", { className: "exp-form-label", children: ["\u041F\u0440\u043E\u0435\u043A\u0442", values.isReimbursable === true && _jsx("span", { className: "exp-form-req", children: " *" })] }), _jsx(ExpenseSearchableSelect, { portalDropdown: true, disabled: expenseProjectRowsFlat.length === 0, placeholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0440\u043E\u0435\u043A\u0442", emptyListText: "\u041D\u0435\u0442 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432", noMatchText: "\u041F\u0440\u043E\u0435\u043A\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", value: values.projectId, items: expenseProjectRowsFlat, getOptionValue: r => r.project.id, getOptionLabel: r => `${r.project.name} (${r.client.name})`, getSearchText: r => `${r.client.name} ${r.project.name} ${r.project.code ?? ''}`, filterItems: filterExpenseProjectRows, onSelect: handleExpenseProjectPick, "aria-invalid": Boolean(errors.projectId), renderOption: row => (_jsxs("span", { className: "exp-searchable__opt-rich", children: [_jsx(ExpenseProjectCardBody, { project: row.project }), _jsx("span", { className: "exp-searchable__opt-client", children: row.client.name })] })) })] })] }))] })), !isView &&
                                                !expenseProjectsLoading &&
                                                !expenseProjectsError &&
                                                expenseClientsProjects.length > 0 &&
                                                expenseClientsProjects.every(g => g.projects.length === 0) && (_jsx("p", { className: "exp-form-hint", style: { margin: '0.35rem 0 0 0' }, children: "\u041D\u0435\u0442 \u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430: \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0438\u0445 \u0432\u043E \u0432\u043A\u043B\u0430\u0434\u043A\u0435 \u00AB\u041F\u0440\u043E\u0435\u043A\u0442\u044B\u00BB \u0443\u0447\u0451\u0442\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u0438." })), errors.projectId && (_jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.projectId }))] }), values.expenseType !== 'partner_expense' && values.projectId.trim() !== '' && (_jsxs("div", { className: `exp-form-field${errors.expenseCategoryId ? ' exp-form-field--err' : ''}`, children: [_jsxs("label", { className: "exp-form-label", children: ["\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u0440\u0430\u0441\u0445\u043E\u0434\u0430", values.isReimbursable === true && expenseProjectCategories.length > 0 ? (_jsx("span", { className: "exp-form-req", children: " *" })) : null] }), isView ? (_jsx("p", { className: "exp-form-static", children: values.expenseCategoryId.trim()
                                                    ? expenseProjectCategories.find((c) => c.id === values.expenseCategoryId)?.name ??
                                                        'Категория сохранена'
                                                    : 'Не указана' })) : expenseCategoriesLoading ? (_jsx("p", { className: "exp-form-hint", role: "status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0439\u2026" })) : expenseCategoriesError ? (_jsx("p", { className: "exp-form-err-msg", role: "alert", children: expenseCategoriesError })) : expenseProjectCategories.length === 0 ? (_jsx("p", { className: "exp-form-hint", children: "\u0414\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u044B \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432 \u2014 \u043F\u043E\u043B\u0435 \u043C\u043E\u0436\u043D\u043E \u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u043C." })) : (_jsx(ExpenseSearchableSelect, { portalDropdown: true, placeholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E\u2026", emptyListText: "\u041D\u0435\u0442 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0439", noMatchText: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430", value: values.expenseCategoryId, items: expenseCategoryItems, getOptionValue: c => c.id, getOptionLabel: c => c.name, getSearchText: c => c.search, onSelect: (c) => {
                                                    setValues((prev) => ({ ...prev, expenseCategoryId: c.id }));
                                                    if (errors.expenseCategoryId) {
                                                        setErrors((prev) => ({ ...prev, expenseCategoryId: undefined }));
                                                    }
                                                }, "aria-invalid": Boolean(errors.expenseCategoryId), "aria-label": "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u0440\u0430\u0441\u0445\u043E\u0434\u0430" })), errors.expenseCategoryId && (_jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.expenseCategoryId }))] })), _jsxs("div", { className: "exp-form-field", children: [_jsx("label", { className: "exp-form-label", children: "\u041A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442 / \u041F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A" }), _jsx("input", { type: "text", className: "exp-form-input", placeholder: "\u041F\u043E\u0434\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0438\u0437 \u043A\u043B\u0438\u0435\u043D\u0442\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u0430", value: values.vendor, onChange: e => set('vendor', e.target.value), disabled: isView }), !isView && (_jsx("p", { className: "exp-form-hint", style: { margin: '0.35rem 0 0 0' }, children: "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0437\u0430\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u0438\u043C\u0435\u043D\u0435\u043C \u043A\u043B\u0438\u0435\u043D\u0442\u0430 \u043F\u0440\u0438 \u0432\u044B\u0431\u043E\u0440\u0435 \u043A\u043B\u0438\u0435\u043D\u0442\u0430 \u0438\u043B\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u0430; \u043F\u0440\u0438 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438 \u0437\u0430\u043C\u0435\u043D\u0438\u0442\u0435 \u043D\u0430 \u043F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A\u0430 \u0438\u043B\u0438 \u043A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442\u0430 \u043F\u043E \u0441\u0447\u0451\u0442\u0443." }))] }), _jsxs("div", { className: `exp-form-field${errors.comment ? ' exp-form-field--err' : ''}`, children: [_jsx("label", { className: "exp-form-label", children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439" }), _jsx("textarea", { className: "exp-form-textarea", placeholder: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F", value: values.comment, onChange: e => {
                                                    set('comment', e.target.value);
                                                    if (errors.comment)
                                                        setErrors(prev => ({ ...prev, comment: undefined }));
                                                }, disabled: isView, rows: 3 }), errors.comment && _jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.comment })] })] })), (() => {
                                const allAtt = editingRequest?.attachments ?? [];
                                const serverPaymentDoc = allAtt.filter(a => a.attachmentKind === 'payment_document');
                                const serverReceipt = allAtt.filter(a => a.attachmentKind === 'payment_receipt');
                                const serverLegacy = allAtt.filter(a => !a.attachmentKind);
                                const showServerDelete = Boolean(onExpenseSnapshotUpdated) && (!isView || allowPaymentReceiptUpload
                                    || (currentUserId != null && (editingRequest?.createdByUserId === currentUserId)));
                                const serverAttCount = allAtt.length;
                                const attachmentsAtLimit = serverAttCount + filesPaymentDoc.length + filesReceipt.length >= EXPENSE_ATTACHMENT_MAX_COUNT;
                                const pickOversize = (name) => { setFileSizeHint(`Файл «${name}» больше 15 МБ`); };
                                const pickTooMany = () => { setFileSizeHint(EXPENSE_ATTACHMENT_COUNT_LIMIT_MSG); };
                                const showPaymentDocSection = true;
                                const showReceiptBlock = !isView || serverReceipt.length > 0 || Boolean(allowPaymentReceiptUpload);
                                const showReceiptUploadZone = !isView || Boolean(allowPaymentReceiptUpload);
                                const showReceiptServerDelete = showServerDelete;
                                const fileIcon = (_jsxs("svg", { className: "exp-form-file-zone__icon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "17 8 12 3 7 8" }), _jsx("line", { x1: "12", y1: "3", x2: "12", y2: "15" })] }));
                                return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "exp-form-block exp-form-block--docs", children: [_jsxs("p", { className: "exp-form-block__title", children: ["\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B", values.isReimbursable === true && !isView && (_jsx("span", { className: "exp-form-docs-badge", children: "\u041D\u0443\u0436\u0435\u043D \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B" }))] }), !isView && (!editingRequest || editingRequest.status !== 'paid') && (_jsx("p", { className: "exp-form-hint", style: { margin: '-0.5rem 0 0.25rem 0' }, children: values.isReimbursable === true ? (_jsxs(_Fragment, { children: [_jsx("strong", { children: "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B" }), " \u2014 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0441\u0440\u0430\u0437\u0443 (\u0434\u043E \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0438 \u0438 \u0434\u043E \u043E\u043F\u043B\u0430\u0442\u044B \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0435\u0439).", ' ', "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043E\u043F\u043B\u0430\u0442\u044B (\u0447\u0435\u043A) \u2014 \u0432 \u0431\u043B\u043E\u043A\u0435 \u043D\u0438\u0436\u0435; \u043F\u0440\u0438 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438 \u043C\u043E\u0436\u043D\u043E \u043F\u0440\u0438\u043A\u0440\u0435\u043F\u0438\u0442\u044C \u0441\u0440\u0430\u0437\u0443 \u0438\u043B\u0438 \u043F\u043E\u0437\u0436\u0435."] })) : (_jsxs(_Fragment, { children: ["\u041F\u0440\u0438 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438 \u043F\u0440\u0438\u043A\u0440\u0435\u043F\u0438\u0442\u0435 ", _jsx("strong", { children: "\u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B" }), " (\u0441\u0447\u0451\u0442, \u043D\u0430\u043A\u043B\u0430\u0434\u043D\u0443\u044E \u0438 \u0442.\u043F.) \u2014 \u0434\u043B\u044F \u043B\u044E\u0431\u043E\u0439 \u0437\u0430\u044F\u0432\u043A\u0438, \u0432 \u0442\u043E\u043C \u0447\u0438\u0441\u043B\u0435 \u043D\u0435\u0432\u043E\u0437\u043C\u0435\u0449\u0430\u0435\u043C\u043E\u0439.", ' ', "\u041A\u0432\u0438\u0442\u0430\u043D\u0446\u0438\u044E \u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u0435 \u2014 \u0432 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u043C \u0431\u043B\u043E\u043A\u0435 (\u043F\u043E \u0436\u0435\u043B\u0430\u043D\u0438\u044E \u0441\u0440\u0430\u0437\u0443 \u0438\u043B\u0438 \u043F\u043E\u0441\u043B\u0435 \u043E\u043F\u043B\u0430\u0442\u044B)."] })) })), fileSizeHint && (_jsx("p", { className: "exp-form-err-msg", role: "status", children: fileSizeHint })), attachmentOpenErr && (_jsx("p", { className: "exp-form-err-msg", role: "alert", children: attachmentOpenErr })), showPaymentDocSection && (_jsxs("div", { className: `exp-form-field${errors.attachmentsPaymentDoc ? ' exp-form-field--err' : ''}`, children: [_jsx("label", { className: "exp-form-label", children: "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B" }), !isView && (_jsxs("div", { className: "exp-form-file-zone", role: "button", tabIndex: attachmentsAtLimit ? -1 : 0, "aria-disabled": attachmentsAtLimit, onClick: () => {
                                                                if (attachmentsAtLimit) {
                                                                    setFileSizeHint(EXPENSE_ATTACHMENT_COUNT_LIMIT_MSG);
                                                                    return;
                                                                }
                                                                setFileSizeHint(null);
                                                                fileInputPaymentRef.current?.click();
                                                            }, onKeyDown: e => !attachmentsAtLimit && e.key === 'Enter' && fileInputPaymentRef.current?.click(), children: [_jsx("input", { ref: fileInputPaymentRef, type: "file", multiple: true, disabled: attachmentsAtLimit, style: { display: 'none' }, onChange: e => {
                                                                        appendFilesChecked(e.target.files, setFilesPaymentDoc, pickOversize, serverAttCount + filesReceipt.length, pickTooMany);
                                                                        setErrors(prev => ({ ...prev, attachmentsPaymentDoc: undefined }));
                                                                        e.target.value = '';
                                                                    } }), fileIcon, _jsx("p", { className: "exp-form-file-zone__label", children: attachmentsAtLimit ? 'Достигнут лимит 10 файлов' : 'Нажмите для загрузки' }), _jsx("p", { className: "exp-form-file-zone__hint", children: "\u041B\u044E\u0431\u043E\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u00B7 \u0434\u043E 15 \u041C\u0411 \u00B7 \u0434\u043E 10 \u0444\u0430\u0439\u043B\u043E\u0432 \u043D\u0430 \u0437\u0430\u044F\u0432\u043A\u0443" })] })), errors.attachmentsPaymentDoc && (_jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.attachmentsPaymentDoc })), filesPaymentDoc.length > 0 && (_jsx("ul", { className: "exp-form-file-list", children: filesPaymentDoc.map((f, i) => (_jsxs("li", { className: "exp-form-file-item", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", className: "exp-form-file-item__icon", children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" }), _jsx("polyline", { points: "14 2 14 8 20 8" })] }), _jsx("span", { className: "exp-form-file-item__name", children: f.name }), _jsxs("span", { className: "exp-form-file-item__size", children: [(f.size / 1024).toFixed(0), " \u041A\u0411"] }), _jsx("button", { type: "button", className: "exp-form-file-item__preview", "aria-label": `Просмотр «${f.name}»`, onClick: () => void openLocalAttachmentPreview(f), children: _jsxs("svg", { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: "1.75", "aria-hidden": true, children: [_jsx("path", { d: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] }) }), !isView && (_jsx("button", { type: "button", "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", className: "exp-form-file-item__del", onClick: () => setFilesPaymentDoc(prev => prev.filter((_, j) => j !== i)), children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) }))] }, `pd-${f.name}-${i}`))) })), serverPaymentDoc.length > 0 && (_jsx("ul", { className: "exp-form-file-list", children: serverPaymentDoc.map(f => (_jsxs("li", { className: "exp-form-file-item exp-form-file-item--server", children: [_jsxs("button", { type: "button", className: "exp-form-file-item__open", onClick: () => void openServerAttachmentPreview(f.id, f.fileName), "aria-label": `Превью «${f.fileName}»`, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", className: "exp-form-file-item__icon", children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" }), _jsx("polyline", { points: "14 2 14 8 20 8" })] }), _jsx("span", { className: "exp-form-file-item__name", children: f.fileName }), _jsxs("span", { className: "exp-form-file-item__size", children: [(f.sizeBytes / 1024).toFixed(0), " \u041A\u0411"] })] }), showServerDelete && (_jsx("button", { type: "button", "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", className: "exp-form-file-item__del", disabled: deletingAttachmentId === f.id, onClick: e => { e.preventDefault(); e.stopPropagation(); void handleDeleteServerAttachment(f.id); }, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) }))] }, f.id))) }))] }))] }), _jsxs("div", { className: "exp-form-block exp-form-block--docs exp-form-block--payment-confirm", children: [_jsx("p", { className: "exp-form-block__title", children: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043E\u043F\u043B\u0430\u0442\u044B" }), !showReceiptBlock && (_jsx(_Fragment, { children: editingRequest?.status === 'paid' ? (_jsx("p", { className: "exp-form-static exp-form-static--muted", style: { margin: 0 }, children: "\u041A\u0432\u0438\u0442\u0430\u043D\u0446\u0438\u044F \u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u0435 \u043D\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0430." })) : (_jsx("p", { className: "exp-form-static exp-form-static--muted", style: { margin: 0 }, children: "\u041F\u0440\u0438\u043A\u0440\u0435\u043F\u0438\u0442\u044C \u043A\u0432\u0438\u0442\u0430\u043D\u0446\u0438\u044E \u043C\u043E\u0436\u0435\u0442 \u0430\u0432\u0442\u043E\u0440 \u0437\u0430\u044F\u0432\u043A\u0438 \u0438\u043B\u0438 \u043C\u043E\u0434\u0435\u0440\u0430\u0442\u043E\u0440, \u0435\u0441\u043B\u0438 \u0441\u0442\u0430\u0442\u0443\u0441 \u0438 \u043F\u0440\u0430\u0432\u0430 \u044D\u0442\u043E \u0434\u043E\u043F\u0443\u0441\u043A\u0430\u044E\u0442." })) })), showReceiptBlock && (_jsxs("div", { className: `exp-form-field${errors.attachmentsReceipt ? ' exp-form-field--err' : ''}`, children: [_jsx("label", { className: "exp-form-label", children: "\u041A\u0432\u0438\u0442\u0430\u043D\u0446\u0438\u044F \u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u0435" }), showReceiptUploadZone && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "exp-form-static exp-form-static--muted", style: { margin: '0 0 0.5rem 0' }, children: ["\u0427\u0435\u043A, \u0441\u043A\u0440\u0438\u043D \u0438\u043B\u0438 \u0432\u044B\u043F\u0438\u0441\u043A\u0430 \u043E \u0444\u0430\u043A\u0442\u0435 \u043E\u043F\u043B\u0430\u0442\u044B. \u041C\u043E\u0436\u043D\u043E \u043F\u0440\u0438\u043A\u0440\u0435\u043F\u0438\u0442\u044C \u0437\u0430\u0440\u0430\u043D\u0435\u0435 \u0438\u043B\u0438 \u043F\u043E\u0441\u043B\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u00AB\u0412\u043E\u0437\u043C\u0435\u0449\u0435\u043D\u043E\u00BB.", !isView
                                                                            ? ' Файлы уйдут на сервер вместе с сохранением черновика или отправкой заявки.'
                                                                            : ' Загрузить может автор заявки или модератор.'] }), _jsxs("div", { className: "exp-form-file-zone", role: "button", tabIndex: attachmentsAtLimit ? -1 : 0, "aria-disabled": attachmentsAtLimit, onClick: () => {
                                                                        if (attachmentsAtLimit) {
                                                                            setFileSizeHint(EXPENSE_ATTACHMENT_COUNT_LIMIT_MSG);
                                                                            return;
                                                                        }
                                                                        setFileSizeHint(null);
                                                                        fileInputReceiptRef.current?.click();
                                                                    }, onKeyDown: e => !attachmentsAtLimit && e.key === 'Enter' && fileInputReceiptRef.current?.click(), children: [_jsx("input", { ref: fileInputReceiptRef, type: "file", multiple: true, disabled: attachmentsAtLimit, style: { display: 'none' }, onChange: e => {
                                                                                appendFilesChecked(e.target.files, setFilesReceipt, pickOversize, serverAttCount + filesPaymentDoc.length, pickTooMany);
                                                                                setErrors(prev => ({ ...prev, attachmentsReceipt: undefined }));
                                                                                e.target.value = '';
                                                                            } }), fileIcon, _jsx("p", { className: "exp-form-file-zone__label", children: attachmentsAtLimit ? 'Достигнут лимит 10 файлов' : 'Нажмите для загрузки' }), _jsx("p", { className: "exp-form-file-zone__hint", children: "\u041B\u044E\u0431\u043E\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u00B7 \u0434\u043E 15 \u041C\u0411 \u00B7 \u0434\u043E 10 \u0444\u0430\u0439\u043B\u043E\u0432 \u043D\u0430 \u0437\u0430\u044F\u0432\u043A\u0443" })] })] })), errors.attachmentsReceipt && (_jsx("p", { className: "exp-form-err-msg", "data-err": true, children: errors.attachmentsReceipt })), showReceiptUploadZone && filesReceipt.length > 0 && (_jsx("ul", { className: "exp-form-file-list", children: filesReceipt.map((f, i) => (_jsxs("li", { className: "exp-form-file-item", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", className: "exp-form-file-item__icon", children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" }), _jsx("polyline", { points: "14 2 14 8 20 8" })] }), _jsx("span", { className: "exp-form-file-item__name", children: f.name }), _jsxs("span", { className: "exp-form-file-item__size", children: [(f.size / 1024).toFixed(0), " \u041A\u0411"] }), _jsx("button", { type: "button", className: "exp-form-file-item__preview", "aria-label": `Просмотр «${f.name}»`, onClick: () => void openLocalAttachmentPreview(f), children: _jsxs("svg", { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: "1.75", "aria-hidden": true, children: [_jsx("path", { d: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] }) }), showReceiptUploadZone && (_jsx("button", { type: "button", "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", className: "exp-form-file-item__del", onClick: () => setFilesReceipt(prev => prev.filter((_, j) => j !== i)), children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) }))] }, `pr-${f.name}-${i}`))) })), serverReceipt.length > 0 && (_jsx("ul", { className: "exp-form-file-list", children: serverReceipt.map(f => (_jsxs("li", { className: "exp-form-file-item exp-form-file-item--server", children: [_jsxs("button", { type: "button", className: "exp-form-file-item__open", onClick: () => void openServerAttachmentPreview(f.id, f.fileName), "aria-label": `Превью «${f.fileName}»`, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", className: "exp-form-file-item__icon", children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" }), _jsx("polyline", { points: "14 2 14 8 20 8" })] }), _jsx("span", { className: "exp-form-file-item__name", children: f.fileName }), _jsxs("span", { className: "exp-form-file-item__size", children: [(f.sizeBytes / 1024).toFixed(0), " \u041A\u0411"] })] }), showReceiptServerDelete && (_jsx("button", { type: "button", "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", className: "exp-form-file-item__del", disabled: deletingAttachmentId === f.id, onClick: e => { e.preventDefault(); e.stopPropagation(); void handleDeleteServerAttachment(f.id); }, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) }))] }, f.id))) }))] }))] }), serverLegacy.length > 0 && (_jsxs("div", { className: "exp-form-field", children: [_jsx("label", { className: "exp-form-label", children: "\u0420\u0430\u043D\u0435\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u044B\u0435 \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u044F" }), _jsx("ul", { className: "exp-form-file-list", children: serverLegacy.map(f => (_jsxs("li", { className: "exp-form-file-item exp-form-file-item--server", children: [_jsxs("button", { type: "button", className: "exp-form-file-item__open", onClick: () => void openServerAttachmentPreview(f.id, f.fileName), "aria-label": `Превью «${f.fileName}»`, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", className: "exp-form-file-item__icon", children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" }), _jsx("polyline", { points: "14 2 14 8 20 8" })] }), _jsx("span", { className: "exp-form-file-item__name", children: f.fileName }), _jsxs("span", { className: "exp-form-file-item__size", children: [(f.sizeBytes / 1024).toFixed(0), " \u041A\u0411"] })] }), showServerDelete && (_jsx("button", { type: "button", "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", className: "exp-form-file-item__del", disabled: deletingAttachmentId === f.id, onClick: e => { e.preventDefault(); e.stopPropagation(); void handleDeleteServerAttachment(f.id); }, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) }))] }, f.id))) })] }))] }));
                            })()] }), !isView ? (_jsxs("div", { className: "exp-panel__ft", children: [_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--ghost", onClick: onClose, disabled: formAsyncBusy, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), showDeleteAction && (_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--outline exp-panel-btn--danger-outline", disabled: formAsyncBusy, onClick: openDeleteConfirm, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })), values.expenseType !== 'partner_expense' ? (_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--outline", onClick: handleSaveDraft, disabled: formAsyncBusy || (mode === 'create' && !cbuReady), "aria-busy": saveDraftPending, children: saveDraftPending ? (_jsxs(_Fragment, { children: [_jsx(PanelBtnSpinner, {}), "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435\u2026"] })) : ('Сохранить черновик') })) : null, _jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--primary", onClick: handleSubmit, disabled: formAsyncBusy || (mode === 'create' && !cbuReady), "aria-busy": submitPending, children: submitPending ? (_jsxs(_Fragment, { children: [_jsx(PanelBtnSpinner, {}), values.expenseType === 'partner_expense' ? 'Запись…' : 'Отправка…'] })) : (values.expenseType === 'partner_expense' ? 'Записать расход' : 'Отправить') })] })) : (_jsxs("div", { className: `exp-panel__ft${showModerationActions ||
                            showLifecycleRow ||
                            showWithdrawAction ||
                            showDeleteAction ||
                            showOwnModerationBlockedHint
                            ? ' exp-panel__ft--moderate'
                            : ''}`, children: [moderationErr && !rejectOpen && !reviseOpen && (_jsx("p", { className: "exp-mod-err exp-mod-err--inline", role: "alert", children: moderationErr })), showOwnModerationBlockedHint && (_jsx("p", { className: "exp-panel__ft-hint", role: "status", children: "\u0421\u0432\u043E\u044E \u0437\u0430\u044F\u0432\u043A\u0443 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F \u2014 \u043E\u0431\u0440\u0430\u0442\u0438\u0442\u0435\u0441\u044C \u043A \u0434\u0440\u0443\u0433\u043E\u043C\u0443 \u043C\u043E\u0434\u0435\u0440\u0430\u0442\u043E\u0440\u0443." })), showModerationActions && (_jsx("div", { className: "exp-panel__ft-moderate", children: _jsxs("div", { className: "exp-panel__ft-moderate-btns", children: [_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--primary", disabled: moderationBusy || lifecycleBusy, onClick: openApproveConfirm, children: "\u041E\u0434\u043E\u0431\u0440\u0438\u0442\u044C" }), _jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--outline", disabled: moderationBusy || lifecycleBusy, onClick: () => { setModerationErr(null); setReviseOpen(true); }, children: "\u041D\u0430 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0443" }), _jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--outline exp-panel-btn--danger-outline", disabled: moderationBusy || lifecycleBusy, onClick: () => { setModerationErr(null); setRejectOpen(true); }, children: "\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C" })] }) })), showPayAction && editingRequest?.status === 'approved' && (_jsx("p", { className: "exp-panel__ft-hint", role: "status", children: editingRequest.expenseType === 'partner_expense' ? (_jsx(_Fragment, { children: "\u0420\u0430\u0441\u0445\u043E\u0434 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430 \u0443\u0447\u0442\u0451\u043D \u0431\u0435\u0437 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F. \u0414\u0430\u043B\u044C\u043D\u0435\u0439\u0448\u0438\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u043F\u043E \u043E\u043F\u043B\u0430\u0442\u0435 \u2014 \u043F\u043E \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u043C \u043F\u0440\u0430\u0432\u0438\u043B\u0430\u043C; \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u044F \u043C\u043E\u0434\u0435\u0440\u0430\u0442\u043E\u0440\u0430 \u043D\u0435 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F." })) : String(editingRequest.paymentMethod ?? '').toLowerCase() === 'cash' ? (_jsx(_Fragment, { children: "\u0417\u0430\u044F\u0432\u043A\u0430 \u043E\u0434\u043E\u0431\u0440\u0435\u043D\u0430 \u0438 \u043E\u0436\u0438\u0434\u0430\u0435\u0442 \u043A\u043E\u043C\u043F\u0435\u043D\u0441\u0430\u0446\u0438\u044E. \u041F\u043E\u0441\u043B\u0435 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0430 \u043D\u0430 \u043A\u0430\u0440\u0442\u0443 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \u00AB\u0412\u043E\u0437\u043C\u0435\u0449\u0435\u043D\u043E\u00BB." })) : (_jsx(_Fragment, { children: "\u0417\u0430\u044F\u0432\u043A\u0430 \u043E\u0434\u043E\u0431\u0440\u0435\u043D\u0430 \u0438 \u043E\u0436\u0438\u0434\u0430\u0435\u0442 \u043E\u043F\u043B\u0430\u0442\u044B. \u041F\u043E\u0441\u043B\u0435 \u0431\u0430\u043D\u043A\u043E\u0432\u0441\u043A\u043E\u0433\u043E \u043F\u0435\u0440\u0435\u0447\u0438\u0441\u043B\u0435\u043D\u0438\u044F \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \u00AB\u041E\u043F\u043B\u0430\u0447\u0435\u043D\u043E\u00BB." })) })), showUnpayAction && editingRequest?.status === 'paid' && (_jsx("p", { className: "exp-panel__ft-hint", role: "status", children: "\u041E\u043F\u043B\u0430\u0442\u0430 \u0443\u0436\u0435 \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u0430. \u041F\u0440\u0438 \u043E\u0448\u0438\u0431\u043A\u0435 \u043C\u043E\u0436\u043D\u043E \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443 \u0438 \u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443 \u0432 \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u0435." })), showLifecycleRow && (_jsx("div", { className: "exp-panel__ft-moderate", children: _jsxs("div", { className: "exp-panel__ft-moderate-btns", children: [showPayAction && editingRequest && (_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--primary", disabled: moderationBusy || lifecycleBusy, onClick: openPayConfirm, children: expensePayActionLabel(editingRequest) })), showUnapproveAction && (_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--outline", disabled: moderationBusy || lifecycleBusy, onClick: openUnapproveDialog, children: "\u0421\u043D\u044F\u0442\u044C \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435" })), showUnpayAction && (_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--outline", disabled: moderationBusy || lifecycleBusy, onClick: openUnpayDialog, children: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443" }))] }) })), !showPayAction &&
                                isView &&
                                editingRequest?.status === 'approved' &&
                                editingRequest?.expenseType !== 'partner_expense' && (_jsx("p", { className: "exp-panel__ft-hint", role: "status", children: isEmployeePersonalFundsPayout(editingRequest)
                                    ? 'Статус «Ожидает компенсацию». Подтверждение выплаты сотруднику выполняет назначенный сотрудник.'
                                    : 'Статус «Ожидает оплаты». Отметить оплату могут модераторы реестра расходов.' })), showWithdrawAction && (_jsx("div", { className: "exp-panel__ft-moderate", children: _jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--outline exp-panel-btn--danger-outline", disabled: moderationBusy || lifecycleBusy, onClick: openWithdrawConfirm, children: "\u041E\u0442\u043E\u0437\u0432\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443" }) })), showDeleteAction && (_jsx("div", { className: "exp-panel__ft-moderate", children: _jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--outline exp-panel-btn--danger-outline", disabled: moderationBusy || lifecycleBusy, onClick: openDeleteConfirm, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443" }) })), isView &&
                                editingRequest?.status === 'approved' &&
                                editingRequest.expenseType === 'partner_expense' &&
                                !showPayAction && (_jsx("p", { className: "exp-panel__ft-hint", role: "status", children: "\u0420\u0430\u0441\u0445\u043E\u0434 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430 \u0441\u0440\u0430\u0437\u0443 \u0432 \u0441\u0442\u0430\u0442\u0443\u0441\u0435 \u00AB\u041E\u0434\u043E\u0431\u0440\u0435\u043D\u043E\u00BB \u2014 \u044D\u0442\u0430\u043F \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F \u0441 \u043C\u043E\u0434\u0435\u0440\u0430\u0442\u043E\u0440\u043E\u043C \u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F." })), allowPaymentReceiptUpload && onUploadPaymentReceipts && filesReceipt.length > 0 && (_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--primary", onClick: () => void handleConfirmReceiptUpload(), disabled: receiptUploadPending || lifecycleBusy, "aria-busy": receiptUploadPending, children: receiptUploadPending ? (_jsxs(_Fragment, { children: [_jsx(PanelBtnSpinner, {}), "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026"] })) : ('Прикрепить квитанцию') })), _jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--outline", onClick: onClose, disabled: formAsyncBusy, children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" })] })), formAsyncBusy && (_jsxs("div", { className: "exp-panel__async-busy-layer", role: "status", "aria-live": "polite", children: [_jsx(PanelBtnSpinner, { className: "exp-panel__async-busy-spinner" }), _jsx("span", { className: "exp-panel__async-busy-label", children: submitPending
                                    ? valuesRef.current.expenseType === 'partner_expense'
                                        ? 'Запись расхода…'
                                        : 'Отправка заявки…'
                                    : receiptUploadPending
                                        ? 'Загрузка квитанции…'
                                        : lifecycleBusy
                                            ? 'Смена статуса…'
                                            : 'Сохранение черновика…' })] }))] })] }));
    return typeof document !== 'undefined' ? createPortal(portalLayer, document.body) : null;
}
