import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useId, useMemo, useRef, useCallback } from 'react';
import { DatePicker, SearchableSelect, useAppDialog } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { getUserProjectAccess, listAllClientProjectsForClientMerged, createClientProject, patchClientProject, putUserProjectAccess, listHourlyRates, createHourlyRate, changeHourlyRateFrom, listUsersWithProjectAccessToProject, listProjectTasks, createProjectTask, deleteProjectTask, patchProjectTask, readTimeManagerProjectBillableRateAmount, readProjectRecordsLanguage, pickEffectiveBillableRateForProject, parseHourlyRateAmount, hourlyRateEffectiveOnDate, TIME_TRACKING_PROJECT_CURRENCIES, } from '@entities/time-tracking';
import { suggestedNextKlProjectCode } from '@entities/time-tracking/lib/klProjectCode';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
import { QuickCreateClientModal } from './QuickCreateClientModal';
import { ProjectMembersField } from './ProjectMembersField';
import { clientRowSearchText } from '../lib/clientRowSearchText';
import './TimeTrackingForms.css';
import './TimeTrackingPage.css';
const TM_DD_PORTAL_Z = 12000;
function memberRateDraftFromPick(pick, fallbackCurrency) {
    const cur0 = (fallbackCurrency || 'USD').trim() || 'USD';
    if (!pick) {
        return { amount: '', currency: cur0, source: 'none', baselineAmount: '', baselineCurrency: cur0 };
    }
    const amt = parseHourlyRateAmount(pick.row);
    const amount = Number.isFinite(amt) && amt > 0 ? String(amt) : '';
    const currency = (pick.row.currency || cur0).trim() || cur0;
    return {
        amount,
        currency,
        rateId: pick.row.id,
        source: pick.source,
        baselineAmount: amount,
        baselineCurrency: currency,
    };
}
function memberRateIsDirty(dr) {
    if (!dr)
        return false;
    const amt = parseMemberAmount(dr.amount);
    if (!Number.isFinite(amt) || amt <= 0)
        return false;
    const baseAmt = dr.baselineAmount != null ? parseMemberAmount(dr.baselineAmount) : NaN;
    const cur = (dr.currency || '').trim().toUpperCase();
    const baseCur = (dr.baselineCurrency || '').trim().toUpperCase();
    if (dr.source === 'none')
        return true;
    if (dr.source === 'global') {
        return !(Number.isFinite(baseAmt) && amt === baseAmt && cur === baseCur);
    }
    return !(Number.isFinite(baseAmt) && amt === baseAmt && cur === baseCur);
}
function parseMemberAmount(raw) {
    const t = raw.trim().replace(',', '.');
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : NaN;
}
const CURRENCY_OPTIONS = TIME_TRACKING_PROJECT_CURRENCIES.map((c) => ({ id: c, label: c, search: c }));
function buildProjectTypeOptions(t) {
    return [
        { id: 'time_and_materials', label: t('timeTrackingPage.projects.modal.projectTypes.timeAndMaterials'), search: 'time materials T&M tm' },
        { id: 'fixed_fee', label: t('timeTrackingPage.projects.modal.projectTypes.fixedFee'), search: 'fixed fee' },
        { id: 'hour_package', label: t('timeTrackingPage.projects.modal.projectTypes.hourPackage'), search: 'hour package monthly hours пакет часов' },
        { id: 'non_billable', label: t('timeTrackingPage.projects.modal.projectTypes.nonBillable'), search: 'non billable' },
    ];
}
function buildRecordsLanguageOptions(t) {
    return [
        { id: 'ENG', label: t('timeTrackingPage.projects.modal.recordsLanguages.eng'), search: 'english eng английский' },
        { id: 'RU', label: t('timeTrackingPage.projects.modal.recordsLanguages.ru'), search: 'russian ru русский' },
    ];
}
function buildBillableRateOptions(t) {
    return [
        { id: 'person_billable_rate', label: t('timeTrackingPage.projects.modal.billableRateTypes.person'), search: 'person hourly' },
        { id: 'project_billable_rate', label: t('timeTrackingPage.projects.modal.billableRateTypes.project'), search: 'project rate' },
    ];
}
function buildBudgetTypeOptions(t) {
    return [
        { id: 'no_budget', label: t('timeTrackingPage.projects.modal.budgetTypes.noBudget'), search: 'no budget' },
        { id: 'total_project_fees', label: t('timeTrackingPage.projects.modal.budgetTypes.feesOnly'), search: 'money fees' },
        { id: 'total_project_hours', label: t('timeTrackingPage.projects.modal.budgetTypes.hoursOnly'), search: 'hours limit' },
        { id: 'fees_and_hours', label: t('timeTrackingPage.projects.modal.budgetTypes.feesAndHours'), search: 'package money hours' },
    ];
}
const DEFAULT_PROJECT_TASK_SEED = [
    { name: 'Court Hearing', billableByDefault: true },
    { name: 'Court Hearing Preparation', billableByDefault: true },
    { name: 'Document Review', billableByDefault: true },
    { name: 'Document Submission', billableByDefault: true },
    { name: 'Drafting', billableByDefault: true },
    { name: 'Drafting Documents', billableByDefault: true },
    { name: 'Emails', billableByDefault: true },
    { name: 'Meetings', billableByDefault: true },
    { name: 'My mehnat registration', billableByDefault: true, billingMode: 'flat_fee', flatFeeAmount: 230000, flatFeeCurrency: 'UZS' },
    { name: 'Research', billableByDefault: true },
    { name: 'Telephone calls', billableByDefault: true },
    { name: 'Kosta Legal Internal', billableByDefault: false },
    { name: 'Accounting', billableByDefault: false },
    { name: 'Business Development', billableByDefault: false },
    { name: 'Lunch/Dinner', billableByDefault: false },
    { name: 'Other research', billableByDefault: false },
    { name: 'Proposals', billableByDefault: false },
    { name: 'Publications', billableByDefault: false },
    { name: 'Review new legislation', billableByDefault: false },
];
const MEHNAT_TASK_NAME = 'My mehnat registration';
const MEHNAT_TASK_NAME_KEY = MEHNAT_TASK_NAME.toLocaleLowerCase('ru');
const DEFAULT_MEHNAT_FLAT_FEE_AMOUNT = 230000;
const DEFAULT_MEHNAT_FLAT_FEE_CURRENCY = 'UZS';
const DEFAULT_PROJECT_TASK_BILLABLE_MAP = new Map(DEFAULT_PROJECT_TASK_SEED.map((task) => [task.name, task.billableByDefault]));
const DEFAULT_PROJECT_TASK_FLAT_FEE_MAP = new Map(DEFAULT_PROJECT_TASK_SEED
    .filter((task) => task.billingMode === 'flat_fee')
    .map((task) => [task.name, task]));
const DEFAULT_PROJECT_TASK_NAMES = DEFAULT_PROJECT_TASK_SEED.map((task) => task.name);
function getTmOptSearch(o) {
    return o.search ?? o.label;
}
function projectCurrencySymbol(iso) {
    const c = (iso || 'USD').trim().toUpperCase() || 'USD';
    const map = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        RUB: '₽',
        UZS: "soʻm",
    };
    if (c in map)
        return map[c];
    try {
        const parts = new Intl.NumberFormat('en', { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' }).formatToParts(0);
        return parts.find((p) => p.type === 'currency')?.value?.trim() || c;
    }
    catch {
        return c;
    }
}
function rowToBudgetFormSlice(row) {
    const t = (row.budget_type ?? '').toLowerCase().replace(/-/g, '_');
    const rawA = row.budget_amount ?? row.budgetAmount;
    const rawP = row.progress_budget_amount ?? row.progressBudgetAmount;
    const rawH = row.budget_hours ?? row.budgetHours;
    const rawFixed = row.fixed_fee_amount ?? row.fixedFeeAmount;
    const aStr = rawA != null && String(rawA).trim() !== '' ? String(rawA) : '';
    const pStr = rawP != null && String(rawP).trim() !== '' ? String(rawP) : '';
    const hStr = rawH != null && String(rawH).trim() !== '' ? String(rawH) : '';
    const fromFixed = rawFixed != null && String(rawFixed).trim() !== '' ? String(rawFixed) : '';
    const a = aStr ? parseFloat(aStr.replace(',', '.')) : NaN;
    const h = hStr ? parseFloat(hStr.replace(',', '.')) : NaN;
    const pNum = pStr ? parseFloat(pStr.replace(',', '.')) : NaN;
    const hasProgMoney = Number.isFinite(pNum) && pNum > 0;
    const hasHardMoney = Number.isFinite(a) && a > 0;
    const hasHours = Number.isFinite(h) && h > 0;
    if (row.project_type === 'fixed_fee') {
        if (Number.isFinite(a) && a > 0)
            return { budgetType: 'total_project_fees', budgetAmount: aStr, budgetHours: '', progressBudgetAmount: '' };
        if (fromFixed)
            return { budgetType: 'total_project_fees', budgetAmount: fromFixed, budgetHours: '', progressBudgetAmount: '' };
        return { budgetType: 'no_budget', budgetAmount: '', budgetHours: '', progressBudgetAmount: '' };
    }
    if (t === 'hours_and_money' || t === 'hours_and_fees' || t === 'fees_and_hours') {
        if (hasHours && (hasHardMoney || hasProgMoney))
            return { budgetType: 'fees_and_hours', budgetAmount: aStr, progressBudgetAmount: pStr, budgetHours: hStr };
        if (hasHours)
            return { budgetType: 'total_project_hours', budgetAmount: '', progressBudgetAmount: '', budgetHours: hStr };
        if (hasHardMoney || hasProgMoney)
            return { budgetType: 'total_project_fees', budgetAmount: aStr, budgetHours: '', progressBudgetAmount: pStr };
        return { budgetType: 'no_budget', budgetAmount: '', budgetHours: '', progressBudgetAmount: '' };
    }
    if (t === 'total_project_fees' || t === 'money')
        return { budgetType: 'total_project_fees', budgetAmount: aStr, budgetHours: '', progressBudgetAmount: pStr };
    if (t === 'total_project_hours' || t === 'hours')
        return { budgetType: 'total_project_hours', budgetAmount: '', progressBudgetAmount: '', budgetHours: hStr };
    if (t === 'no_budget' || t === 'none')
        return { budgetType: 'no_budget', budgetAmount: aStr, budgetHours: hStr, progressBudgetAmount: pStr };
    if (!hasHours && !hasHardMoney && hasProgMoney)
        return { budgetType: 'no_budget', budgetAmount: '', budgetHours: '', progressBudgetAmount: pStr };
    if (hasHours && (hasHardMoney || hasProgMoney))
        return { budgetType: 'fees_and_hours', budgetAmount: aStr, progressBudgetAmount: pStr, budgetHours: hStr };
    if (hasHours)
        return { budgetType: 'total_project_hours', budgetAmount: '', progressBudgetAmount: '', budgetHours: hStr };
    if (hasHardMoney || hasProgMoney)
        return { budgetType: 'total_project_fees', budgetAmount: aStr, budgetHours: '', progressBudgetAmount: pStr };
    return { budgetType: 'no_budget', budgetAmount: '', budgetHours: '', progressBudgetAmount: '' };
}
function projectTypeUsesBillableRates(pt) {
    return pt === 'time_and_materials' || pt === 'fixed_fee' || pt === 'hour_package';
}
function readOptionalNumericField(...values) {
    for (const raw of values) {
        if (raw != null && String(raw).trim() !== '')
            return String(raw);
    }
    return '';
}
function emptyProjectForm() {
    return {
        name: '',
        code: '',
        currency: 'USD',
        startDate: '',
        endDate: '',
        notes: '',
        recordsLanguage: 'ENG',
        projectType: 'time_and_materials',
        billableRateType: 'person_billable_rate',
        projectBillableRateAmount: '',
        budgetType: 'no_budget',
        budgetAmount: '',
        progressBudgetAmount: '',
        budgetHours: '',
        packageHours: '',
        packageFee: '',
        budgetResetsEveryMonth: false,
        budgetIncludesExpenses: false,
        sendBudgetAlerts: false,
        budgetAlertThresholdPercent: '70',
        skipPartnerInvoiceConfirmation: false,
    };
}
function rowToForm(row) {
    const cur = (row.currency ?? 'USD').trim() || 'USD';
    const pt = row.project_type === 'fixed_fee' || row.project_type === 'non_billable' || row.project_type === 'hour_package'
        ? row.project_type
        : 'time_and_materials';
    return {
        name: row.name,
        code: row.code ?? '',
        currency: TIME_TRACKING_PROJECT_CURRENCIES.includes(cur) ? cur : 'USD',
        startDate: (row.start_date ?? '').slice(0, 10),
        endDate: (row.end_date ?? '').slice(0, 10),
        notes: row.notes ?? '',
        recordsLanguage: readProjectRecordsLanguage(row),
        projectType: pt,
        billableRateType: row.billable_rate_type ?? 'person_billable_rate',
        projectBillableRateAmount: readTimeManagerProjectBillableRateAmount(row),
        ...rowToBudgetFormSlice(row),
        packageHours: readOptionalNumericField(row.package_hours_per_month, row.packageHoursPerMonth, row.budget_hours),
        packageFee: readOptionalNumericField(row.package_fee_amount, row.packageFeeAmount, row.budget_amount, row.fixed_fee_amount),
        budgetResetsEveryMonth: row.budget_resets_every_month,
        budgetIncludesExpenses: row.budget_includes_expenses,
        sendBudgetAlerts: row.send_budget_alerts,
        budgetAlertThresholdPercent: row.budget_alert_threshold_percent != null && row.budget_alert_threshold_percent !== ''
            ? String(row.budget_alert_threshold_percent)
            : '70',
        skipPartnerInvoiceConfirmation: row.skip_partner_invoice_confirmation === true
            || row.skipPartnerInvoiceConfirmation === true,
    };
}
function parseOptionalDecimal(raw) {
    const t = raw.trim().replace(',', '.');
    if (!t)
        return null;
    const n = parseFloat(t);
    return Number.isFinite(n) ? t : null;
}
function normalizeInitialTaskNames(rows) {
    const out = [];
    const seen = new Set();
    for (const raw of rows) {
        const name = raw.trim().replace(/\s+/g, ' ');
        if (!name)
            continue;
        const key = name.toLocaleLowerCase('ru');
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(name);
    }
    return out;
}
function buildCreatePayload(form, initialTimeTrackingUserAuthIds, initialProjectAccessMembers, initialTimeTrackingUserBillableHourlyAmounts, initialTaskNames) {
    const name = form.name.trim();
    const pt = form.projectType;
    let billableRateType = null;
    if (projectTypeUsesBillableRates(pt)) {
        billableRateType = form.billableRateType.trim() || 'person_billable_rate';
    }
    let budgetAmount = null;
    let progressBudgetAmount = null;
    let budgetHours = null;
    let packageHoursPerMonth = undefined;
    let packageFeeAmount = undefined;
    if (pt === 'hour_package') {
        packageHoursPerMonth = parseOptionalDecimal(form.packageHours);
        packageFeeAmount = parseOptionalDecimal(form.packageFee);
        budgetHours = packageHoursPerMonth;
        budgetAmount = packageFeeAmount;
        progressBudgetAmount = null;
    }
    else if (form.budgetType === 'no_budget') {
        budgetAmount = null;
        budgetHours = null;
        progressBudgetAmount = pt === 'fixed_fee' ? null : parseOptionalDecimal(form.progressBudgetAmount);
    }
    else if (form.budgetType === 'total_project_fees') {
        budgetAmount = parseOptionalDecimal(form.budgetAmount);
        progressBudgetAmount = pt === 'fixed_fee' ? null : parseOptionalDecimal(form.progressBudgetAmount);
        budgetHours = null;
    }
    else if (form.budgetType === 'total_project_hours') {
        budgetAmount = null;
        progressBudgetAmount = null;
        budgetHours = parseOptionalDecimal(form.budgetHours);
    }
    else if (form.budgetType === 'fees_and_hours') {
        budgetAmount = parseOptionalDecimal(form.budgetAmount);
        progressBudgetAmount = pt === 'fixed_fee' ? null : parseOptionalDecimal(form.progressBudgetAmount);
        budgetHours = parseOptionalDecimal(form.budgetHours);
    }
    const thresholdRaw = form.budgetAlertThresholdPercent.trim().replace(',', '.');
    const budgetAlertThresholdPercent = form.sendBudgetAlerts && thresholdRaw
        ? thresholdRaw
        : form.sendBudgetAlerts
            ? '70'
            : null;
    let projectBillableRateAmount = null;
    if (projectTypeUsesBillableRates(pt)) {
        if ((form.billableRateType || '').trim() === 'project_billable_rate')
            projectBillableRateAmount = parseOptionalDecimal(form.projectBillableRateAmount);
        else
            projectBillableRateAmount = null;
    }
    const ids = (initialTimeTrackingUserAuthIds ?? []).filter((n) => Number.isFinite(n) && n > 0);
    const team = {};
    if (initialProjectAccessMembers != null && initialProjectAccessMembers.length > 0)
        team.initialProjectAccessMembers = initialProjectAccessMembers;
    else if (ids.length > 0) {
        team.initialTimeTrackingUserAuthIds = ids;
        if (initialTimeTrackingUserBillableHourlyAmounts != null)
            team.initialTimeTrackingUserBillableHourlyAmounts = initialTimeTrackingUserBillableHourlyAmounts;
    }
    return {
        name,
        code: form.code.trim() || null,
        currency: (form.currency.trim() || 'USD'),
        startDate: form.startDate.trim() || null,
        endDate: form.endDate.trim() || null,
        notes: form.notes.trim() || null,
        reportVisibility: 'managers_only',
        recordsLanguage: form.recordsLanguage,
        projectType: pt,
        billableRateType,
        projectBillableRateAmount,
        budgetAmount,
        progressBudgetAmount,
        budgetHours,
        ...(pt === 'hour_package'
            ? { packageHoursPerMonth, packageFeeAmount }
            : {}),
        budgetResetsEveryMonth: form.budgetResetsEveryMonth,
        budgetIncludesExpenses: form.budgetIncludesExpenses,
        sendBudgetAlerts: form.sendBudgetAlerts,
        budgetAlertThresholdPercent,
        skipPartnerInvoiceConfirmation: form.skipPartnerInvoiceConfirmation,
        ...(initialTaskNames !== undefined ? { initialTaskNames } : {}),
        ...team,
    };
}
function isTransientNetworkError(e) {
    if (!(e instanceof Error))
        return false;
    const msg = e.message.trim().toLowerCase();
    return msg === 'failed to fetch'
        || msg.includes('networkerror')
        || msg.includes('network request failed')
        || msg.includes('load failed');
}
async function withTaskSyncRetry(fn, attempts = 3) {
    let last;
    for (let i = 0; i < attempts; i += 1) {
        try {
            return await fn();
        }
        catch (e) {
            last = e;
            if (!isTransientNetworkError(e) || i === attempts - 1)
                throw e;
            await new Promise((r) => setTimeout(r, 200 * (i + 1)));
        }
    }
    throw last;
}
async function syncSelectedProjectTasksAfterCreate(clientId, projectId, selectedNames, billableByTaskName, genericError, mehnatBillingMode = 'flat_fee') {
    const selected = new Set(selectedNames.map((n) => n.trim().toLocaleLowerCase('ru')));
    const errors = [];
    let tasks = await withTaskSyncRetry(() => listProjectTasks(clientId, projectId, { bypassGetReuse: true }));
    const existingKeys = new Set(tasks.map((t) => t.name.trim().toLocaleLowerCase('ru')));
    const alreadyMatched = selected.size === existingKeys.size
        && [...selected].every((key) => existingKeys.has(key));
    if (alreadyMatched)
        return [];
    for (const t of tasks) {
        const key = t.name.trim().toLocaleLowerCase('ru');
        if (!selected.has(key)) {
            try {
                await withTaskSyncRetry(() => deleteProjectTask(clientId, projectId, t.id));
            }
            catch (e) {
                errors.push(`${t.name}: ${e instanceof Error ? e.message : genericError}`);
            }
        }
    }
    tasks = await withTaskSyncRetry(() => listProjectTasks(clientId, projectId, { bypassGetReuse: true }));
    const existing = new Set(tasks.map((t) => t.name.trim().toLocaleLowerCase('ru')));
    for (const name of selectedNames) {
        const trimmed = name.trim();
        const key = trimmed.toLocaleLowerCase('ru');
        if (!trimmed || existing.has(key))
            continue;
        try {
            const isMehnat = key === MEHNAT_TASK_NAME_KEY;
            const flatSeed = DEFAULT_PROJECT_TASK_FLAT_FEE_MAP.get(trimmed);
            const useFlatFee = isMehnat
                ? mehnatBillingMode === 'flat_fee'
                : Boolean(flatSeed);
            await withTaskSyncRetry(() => createProjectTask(clientId, projectId, {
                name: trimmed,
                defaultBillableRate: null,
                billableByDefault: billableByTaskName.get(trimmed) ?? true,
                ...(useFlatFee
                    ? {
                        billingMode: 'flat_fee',
                        flatFeeAmount: flatSeed?.flatFeeAmount ?? DEFAULT_MEHNAT_FLAT_FEE_AMOUNT,
                        flatFeeCurrency: flatSeed?.flatFeeCurrency ?? DEFAULT_MEHNAT_FLAT_FEE_CURRENCY,
                    }
                    : {
                        billingMode: 'hourly',
                        flatFeeAmount: null,
                        flatFeeCurrency: null,
                    }),
            }));
        }
        catch (e) {
            errors.push(`${trimmed}: ${e instanceof Error ? e.message : genericError}`);
        }
    }
    return errors;
}
export function ClientProjectModal({ mode, fixedClientId, clientsForPicker, initial, onClose, onSaved, onClientCreated, canManage = true, presentation = 'modal', }) {
    const uid = useId();
    const { t } = useI18n();
    const { showAlert } = useAppDialog();
    const projectTypeOptions = useMemo(() => buildProjectTypeOptions(t), [t]);
    const recordsLanguageOptions = useMemo(() => buildRecordsLanguageOptions(t), [t]);
    const billableRateOptions = useMemo(() => buildBillableRateOptions(t), [t]);
    const budgetTypeOptions = useMemo(() => buildBudgetTypeOptions(t), [t]);
    const [form, setForm] = useState(() => initial ? rowToForm(initial) : emptyProjectForm());
    const [pickedClientId, setPickedClientId] = useState(() => {
        if (fixedClientId)
            return fixedClientId;
        return clientsForPicker?.[0]?.id ?? '';
    });
    const [codeHint, setCodeHint] = useState(null);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [initialTaskNames, setInitialTaskNames] = useState(() => [...DEFAULT_PROJECT_TASK_NAMES]);
    const [mehnatBillingMode, setMehnatBillingMode] = useState('flat_fee');
    const [mehnatTaskId, setMehnatTaskId] = useState(null);
    const [taskPickerOpen, setTaskPickerOpen] = useState(false);
    const [taskPickerDraft, setTaskPickerDraft] = useState(() => [...DEFAULT_PROJECT_TASK_NAMES]);
    const [taskSelectionCollapsed, setTaskSelectionCollapsed] = useState(true);
    const [quickClientOpen, setQuickClientOpen] = useState(false);
    const [assignedUserIds, setAssignedUserIds] = useState([]);
    const [memberRates, setMemberRates] = useState({});
    const [editMembersBaseline, setEditMembersBaseline] = useState([]);
    const [editMembersLoading, setEditMembersLoading] = useState(false);
    const modalBodyRef = useRef(null);
    const failSubmit = useCallback((msg) => {
        setError(msg);
        requestAnimationFrame(() => {
            modalBodyRef.current?.scrollTo({ top: modalBodyRef.current.scrollHeight, behavior: 'smooth' });
        });
    }, []);
    const showClientBlock = mode === 'create' && fixedClientId == null;
    const hasClientsInPicker = (clientsForPicker?.length ?? 0) > 0;
    const effectiveClientId = mode === 'edit' && initial
        ? initial.client_id
        : fixedClientId ?? pickedClientId;
    const clientNameForCode = clientsForPicker?.find((c) => c.id === effectiveClientId)?.name?.trim() ?? '';
    useEffect(() => {
        if (fixedClientId)
            setPickedClientId(fixedClientId);
        else if (clientsForPicker?.[0])
            setPickedClientId((prev) => prev || clientsForPicker[0].id);
    }, [fixedClientId, clientsForPicker]);
    const handleQuickClientCreated = (c) => {
        onClientCreated?.(c);
        setPickedClientId(c.id);
        setQuickClientOpen(false);
    };
    useEffect(() => {
        if (mode !== 'create' || !effectiveClientId)
            return;
        let cancelled = false;
        listAllClientProjectsForClientMerged(effectiveClientId)
            .then((projects) => {
            if (cancelled)
                return;
            const codes = projects.map((p) => p.code);
            setCodeHint(suggestedNextKlProjectCode(clientNameForCode, codes, effectiveClientId
                ? { clientId: effectiveClientId, allClients: clientsForPicker ?? [] }
                : undefined, form.name));
        })
            .catch(() => {
            if (!cancelled)
                setCodeHint(suggestedNextKlProjectCode(clientNameForCode, [], effectiveClientId
                    ? { clientId: effectiveClientId, allClients: clientsForPicker ?? [] }
                    : undefined, form.name));
        });
        return () => {
            cancelled = true;
        };
    }, [mode, effectiveClientId, clientNameForCode, clientsForPicker, form.name]);
    const showMemberBillableRate = useMemo(() => projectTypeUsesBillableRates(form.projectType) && form.billableRateType === 'person_billable_rate', [form.projectType, form.billableRateType]);
    const showProjectBillableRate = useMemo(() => projectTypeUsesBillableRates(form.projectType) && form.billableRateType === 'project_billable_rate', [form.projectType, form.billableRateType]);
    const assignedUserIdsRef = useRef(assignedUserIds);
    assignedUserIdsRef.current = assignedUserIds;
    const handleAssignedChange = useCallback((next) => {
        setAssignedUserIds((prev) => {
            const added = next.filter((id) => !prev.includes(id));
            const removed = prev.filter((id) => !next.includes(id));
            if (removed.length) {
                setMemberRates((p) => {
                    const q = { ...p };
                    for (const id of removed)
                        delete q[id];
                    return q;
                });
            }
            if (added.length && showMemberBillableRate) {
                const cur0 = (form.currency || 'USD').trim() || 'USD';
                const pid = String(initial?.id ?? '').trim();
                for (const authUserId of added) {
                    void (async () => {
                        try {
                            const rows = await listHourlyRates(authUserId, 'billable');
                            if (!assignedUserIdsRef.current.includes(authUserId))
                                return;
                            const pick = pickEffectiveBillableRateForProject(rows, pid, cur0);
                            const draft = memberRateDraftFromPick(pick, cur0);
                            if (!draft.amount.trim())
                                return;
                            setMemberRates((p) => {
                                if (!assignedUserIdsRef.current.includes(authUserId))
                                    return p;
                                const existing = p[authUserId];
                                if (existing && existing.amount.trim() !== '')
                                    return p;
                                return { ...p, [authUserId]: draft };
                            });
                        }
                        catch {
                        }
                    })();
                }
            }
            return next;
        });
    }, [showMemberBillableRate, form.currency, initial?.id]);
    useEffect(() => {
        setMemberRates((prev) => {
            const next = { ...prev };
            const cur = (form.currency || 'USD').trim() || 'USD';
            for (const id of assignedUserIds) {
                if (!next[id])
                    next[id] = { amount: '', currency: cur };
            }
            for (const k of Object.keys(next)) {
                const n = Number(k);
                if (Number.isFinite(n) && !assignedUserIds.includes(n))
                    delete next[n];
            }
            return next;
        });
    }, [assignedUserIds, form.currency]);
    useEffect(() => {
        if (mode !== 'edit' || !initial || !canManage) {
            setEditMembersLoading(false);
            if (mode === 'create')
                setEditMembersBaseline([]);
            return;
        }
        let cancelled = false;
        setEditMembersLoading(true);
        (async () => {
            try {
                const team = await listUsersWithProjectAccessToProject(initial.id);
                if (cancelled)
                    return;
                const ids = [...new Set(team.map((m) => Number(m.userId)).filter((n) => Number.isFinite(n) && n > 0))];
                setAssignedUserIds(ids);
                setEditMembersBaseline([...ids]);
                const usePersonRate = projectTypeUsesBillableRates(initial.project_type) && (initial.billable_rate_type ?? 'person_billable_rate') === 'person_billable_rate';
                if (!usePersonRate) {
                    setMemberRates({});
                    return;
                }
                const cur0 = (initial.currency ?? 'USD').trim() || 'USD';
                const out = {};
                for (const id of ids) {
                    if (cancelled)
                        return;
                    const rows = await listHourlyRates(id, 'billable');
                    if (cancelled)
                        return;
                    const pick = pickEffectiveBillableRateForProject(rows, String(initial.id), cur0);
                    out[id] = memberRateDraftFromPick(pick, cur0);
                }
                if (!cancelled)
                    setMemberRates(out);
            }
            catch {
                if (!cancelled) {
                    setMemberRates({});
                    setAssignedUserIds([]);
                    setEditMembersBaseline([]);
                }
            }
            finally {
                if (!cancelled)
                    setEditMembersLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [mode, initial, canManage]);
    useEffect(() => {
        if (mode !== 'edit' || !initial) {
            setMehnatBillingMode('flat_fee');
            setMehnatTaskId(null);
            return;
        }
        let cancelled = false;
        void listProjectTasks(initial.client_id, initial.id, { bypassGetReuse: true })
            .then((tasks) => {
            if (cancelled)
                return;
            const mehnat = tasks.find((task) => task.name.trim().toLocaleLowerCase('ru') === MEHNAT_TASK_NAME_KEY);
            if (!mehnat) {
                setMehnatTaskId(null);
                setMehnatBillingMode('flat_fee');
                return;
            }
            setMehnatTaskId(mehnat.id);
            setMehnatBillingMode(mehnat.billing_mode === 'flat_fee' ? 'flat_fee' : 'hourly');
        })
            .catch(() => {
            if (!cancelled) {
                setMehnatTaskId(null);
                setMehnatBillingMode('flat_fee');
            }
        });
        return () => {
            cancelled = true;
        };
    }, [mode, initial]);
    async function reloadMemberRate(authUserId, projectId) {
        const cur0 = (form.currency || 'USD').trim() || 'USD';
        const rows = await listHourlyRates(authUserId, 'billable');
        const pick = pickEffectiveBillableRateForProject(rows, projectId, cur0);
        setMemberRates((prev) => ({
            ...prev,
            [authUserId]: memberRateDraftFromPick(pick, cur0),
        }));
    }
    async function handleMemberChangeRateFrom(authUserId, data) {
        const pid = String(initial?.id ?? '').trim();
        if (!pid)
            throw new Error(t('timeTrackingPage.projects.modal.errors.generic'));
        const dr = memberRates[authUserId];
        await changeHourlyRateFrom(authUserId, {
            rateKind: 'billable',
            appliesToProjectId: pid,
            effectiveFrom: data.effectiveFrom,
            amount: data.amount,
            currency: data.currency || (form.currency || 'USD'),
            sourceRateId: dr?.source === 'project' ? dr.rateId : undefined,
        });
        await reloadMemberRate(authUserId, pid);
    }
    async function applyProjectMemberAccessAndRates(projectId) {
        const pid = String(projectId ?? '').trim();
        if (!pid)
            return;
        const useRates = projectTypeUsesBillableRates(form.projectType) && form.billableRateType === 'person_billable_rate';
        const projectCur = (form.currency || 'USD').trim() || 'USD';
        const now = new Date();
        if (useRates && assignedUserIds.length > 0) {
            const rateEnsureFailed = [];
            for (const authUserId of assignedUserIds) {
                const dr = memberRates[authUserId];
                if (!dr || !memberRateIsDirty(dr))
                    continue;
                const n = parseMemberAmount(dr.amount);
                if (!Number.isFinite(n) || n <= 0)
                    continue;
                try {
                    const rows = await listHourlyRates(authUserId, 'billable');
                    const hasActiveInProjectCurrency = rows.some((r) => {
                        const cur = (r.currency || '').trim().toUpperCase();
                        return cur === projectCur.toUpperCase() && hourlyRateEffectiveOnDate(r, now);
                    });
                    if (!hasActiveInProjectCurrency) {
                        const created = await createHourlyRate(authUserId, {
                            rateKind: 'billable',
                            amount: String(n),
                            currency: projectCur,
                            validFrom: null,
                            validTo: null,
                            appliesToProjectId: pid,
                        });
                        setMemberRates((prev) => ({
                            ...prev,
                            [authUserId]: {
                                ...(prev[authUserId] ?? { amount: String(n), currency: projectCur }),
                                amount: String(n),
                                currency: projectCur,
                                rateId: created.id,
                                source: 'project',
                                baselineAmount: String(n),
                                baselineCurrency: projectCur,
                            },
                        }));
                    }
                }
                catch (e) {
                    const msg = e instanceof Error ? e.message : t('timeTrackingPage.projects.modal.errors.generic');
                    rateEnsureFailed.push(t('timeTrackingPage.projects.modal.errors.userFailed').replace('{id}', String(authUserId)).replace('{message}', msg));
                }
            }
            if (rateEnsureFailed.length > 0) {
                await showAlert({
                    title: t('timeTrackingPage.projects.modal.alerts.partialSaveTitle'),
                    message: t('timeTrackingPage.projects.modal.alerts.ratesFailed').replace('{currency}', projectCur).replace('{details}', rateEnsureFailed.join('\n')),
                });
            }
        }
        const removed = editMembersBaseline.filter((id) => !assignedUserIds.includes(id));
        for (const authUserId of removed) {
            const { projectIds } = await getUserProjectAccess(authUserId);
            await putUserProjectAccess(authUserId, projectIds.filter((p) => String(p).trim() !== pid));
        }
        if (assignedUserIds.length > 0) {
            const results = await Promise.allSettled(assignedUserIds.map(async (authUserId) => {
                const { projectIds } = await getUserProjectAccess(authUserId);
                const normalized = projectIds.map((p) => String(p).trim()).filter(Boolean);
                const nextIds = [...new Set([...normalized, pid])];
                let putOptions;
                if (useRates) {
                    const dr = memberRates[authUserId];
                    if (dr && memberRateIsDirty(dr)) {
                        const n = parseMemberAmount(dr.amount);
                        if (Number.isFinite(n) && n > 0) {
                            putOptions = { projectBillableHourlyAmountsByProjectId: { [pid]: String(n) } };
                        }
                    }
                }
                await putUserProjectAccess(authUserId, nextIds, putOptions);
            }));
            const failed = [];
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    const authUserId = assignedUserIds[i];
                    const msg = r.reason instanceof Error ? r.reason.message : t('timeTrackingPage.projects.modal.errors.generic');
                    failed.push(t('timeTrackingPage.projects.modal.errors.userFailed').replace('{id}', String(authUserId)).replace('{message}', msg));
                }
            });
            if (failed.length > 0) {
                await showAlert({
                    title: t('timeTrackingPage.projects.modal.alerts.partialSaveTitle'),
                    message: t('timeTrackingPage.projects.modal.alerts.accessFailed')
                        .replace('{projectName}', (form.name || '').trim() || '—')
                        .replace('{details}', failed.join('\n')),
                });
            }
            if (useRates) {
                const refreshed = { ...memberRates };
                for (const authUserId of assignedUserIds) {
                    try {
                        const rows = await listHourlyRates(authUserId, 'billable');
                        refreshed[authUserId] = memberRateDraftFromPick(pickEffectiveBillableRateForProject(rows, pid, projectCur), projectCur);
                    }
                    catch {
                    }
                }
                setMemberRates(refreshed);
            }
        }
        setEditMembersBaseline([...assignedUserIds]);
    }
    const openTaskPicker = () => {
        setTaskPickerDraft([...initialTaskNames]);
        setTaskPickerOpen(true);
    };
    const toggleTaskInDraft = (name, checked) => {
        setTaskPickerDraft((prev) => {
            if (checked)
                return normalizeInitialTaskNames([...prev, name]);
            const key = name.trim().toLocaleLowerCase('ru');
            return prev.filter((x) => x.trim().toLocaleLowerCase('ru') !== key);
        });
    };
    const applyTaskPicker = () => {
        setInitialTaskNames(normalizeInitialTaskNames(taskPickerDraft));
        setTaskPickerOpen(false);
    };
    const handleSubmit = async () => {
        if (mode === 'edit' && editMembersLoading) {
            failSubmit(t('timeTrackingPage.projects.modal.errors.membersLoading'));
            return;
        }
        if (mode === 'create' && !effectiveClientId) {
            failSubmit(t('timeTrackingPage.projects.validation.clientRequired'));
            return;
        }
        const name = form.name.trim();
        if (!name) {
            failSubmit(t('timeTrackingPage.projects.validation.nameRequired'));
            return;
        }
        if (form.startDate && form.endDate && form.endDate < form.startDate) {
            failSubmit(t('timeTrackingPage.projects.modal.errors.endBeforeStart'));
            return;
        }
        if (form.projectType === 'fixed_fee') {
            const ba = parseOptionalDecimal(form.budgetAmount);
            const n = typeof ba === 'string' ? parseFloat(ba.replace(',', '.')) : Number(ba);
            const hasMoney = form.budgetType === 'total_project_fees' || form.budgetType === 'fees_and_hours';
            if (!hasMoney || !Number.isFinite(n) || n <= 0) {
                failSubmit(t('timeTrackingPage.projects.modal.errors.fixedFeeAmount'));
                return;
            }
        }
        if (form.projectType === 'hour_package') {
            const ph = parseOptionalDecimal(form.packageHours);
            const pf = parseOptionalDecimal(form.packageFee);
            const nh = typeof ph === 'string' ? parseFloat(String(ph).replace(',', '.')) : Number(ph);
            const nf = typeof pf === 'string' ? parseFloat(String(pf).replace(',', '.')) : Number(pf);
            if (!ph || !pf || !Number.isFinite(nh) || nh <= 0 || !Number.isFinite(nf) || nf <= 0) {
                failSubmit(t('timeTrackingPage.projects.modal.errors.hourPackageRequired'));
                return;
            }
        }
        if ((form.projectType === 'time_and_materials' || form.projectType === 'non_billable') && form.budgetType === 'total_project_fees') {
            const ba = parseOptionalDecimal(form.budgetAmount);
            const pb = parseOptionalDecimal(form.progressBudgetAmount);
            const na = typeof ba === 'string' ? parseFloat(String(ba).replace(',', '.')) : Number(ba);
            const np = typeof pb === 'string' ? parseFloat(String(pb).replace(',', '.')) : Number(pb);
            const moneyOk = (Number.isFinite(na) && na > 0) || (Number.isFinite(np) && np > 0);
            if (!moneyOk) {
                failSubmit(t('timeTrackingPage.projects.modal.errors.moneyLimitOrProgress'));
                return;
            }
        }
        if (form.projectType !== 'hour_package' && form.budgetType === 'fees_and_hours') {
            const ba = parseOptionalDecimal(form.budgetAmount);
            const pb = parseOptionalDecimal(form.progressBudgetAmount);
            const bh = parseOptionalDecimal(form.budgetHours);
            const na = typeof ba === 'string' ? parseFloat(String(ba).replace(',', '.')) : Number(ba);
            const np = typeof pb === 'string' ? parseFloat(String(pb).replace(',', '.')) : Number(pb);
            const nh = typeof bh === 'string' ? parseFloat(String(bh).replace(',', '.')) : Number(bh);
            if (!bh || !Number.isFinite(nh) || nh <= 0) {
                failSubmit(t('timeTrackingPage.projects.modal.errors.feesAndHoursNeedHours'));
                return;
            }
            const moneyOk = (Number.isFinite(na) && na > 0) || (Number.isFinite(np) && np > 0);
            if (!moneyOk) {
                failSubmit(t('timeTrackingPage.projects.modal.errors.feesAndHoursNeedMoney'));
                return;
            }
        }
        const useProjectRate = projectTypeUsesBillableRates(form.projectType) && form.billableRateType === 'project_billable_rate';
        if (useProjectRate) {
            const pa = parseOptionalDecimal(form.projectBillableRateAmount);
            const pn = typeof pa === 'string' ? parseFloat(pa.replace(',', '.')) : Number(pa);
            if (!pa || !Number.isFinite(pn) || pn <= 0) {
                failSubmit(t('timeTrackingPage.projects.modal.errors.projectRateRequired'));
                return;
            }
        }
        const useRates = projectTypeUsesBillableRates(form.projectType) && form.billableRateType === 'person_billable_rate';
        const baselineSet = new Set(editMembersBaseline);
        const membersRequiringRate = mode === 'edit'
            ? assignedUserIds.filter((id) => !baselineSet.has(id))
            : assignedUserIds;
        if (useRates && membersRequiringRate.length > 0) {
            for (const uid of membersRequiringRate) {
                const dr = memberRates[uid];
                const n = dr ? parseMemberAmount(dr.amount) : NaN;
                if (!Number.isFinite(n) || n <= 0) {
                    failSubmit(t('timeTrackingPage.projects.modal.errors.memberRateRequired'));
                    return;
                }
            }
        }
        const normalizedInitialTaskNames = mode === 'create'
            ? normalizeInitialTaskNames(initialTaskNames)
            : [];
        let initialProjectAccessMembers;
        if (mode === 'create' && useRates && canManage && assignedUserIds.length > 0) {
            initialProjectAccessMembers = assignedUserIds.map((authUserId) => {
                const dr = memberRates[authUserId];
                const n = dr ? parseMemberAmount(dr.amount) : NaN;
                return { authUserId, billableHourlyAmount: Number.isFinite(n) && n > 0 ? n : 0 };
            });
        }
        setError(null);
        setSaving(true);
        try {
            const useParallelBillableAmounts = mode === 'create'
                && useRates
                && assignedUserIds.length > 0
                && (initialProjectAccessMembers == null || initialProjectAccessMembers.length === 0);
            const initialTimeTrackingUserBillableHourlyAmounts = useParallelBillableAmounts
                ? assignedUserIds.map((authUserId) => {
                    const dr = memberRates[authUserId];
                    const n = dr ? parseMemberAmount(dr.amount) : NaN;
                    return Number.isFinite(n) && n > 0 ? n : null;
                })
                : undefined;
            const body = mode === 'create'
                ? buildCreatePayload(form, initialProjectAccessMembers != null && initialProjectAccessMembers.length > 0 ? undefined : assignedUserIds, initialProjectAccessMembers != null && initialProjectAccessMembers.length > 0 ? initialProjectAccessMembers : undefined, initialTimeTrackingUserBillableHourlyAmounts, normalizedInitialTaskNames)
                : buildCreatePayload(form);
            if (mode === 'create') {
                const row = await createClientProject(effectiveClientId, body);
                const taskSyncErrs = await syncSelectedProjectTasksAfterCreate(effectiveClientId, row.id, normalizedInitialTaskNames, DEFAULT_PROJECT_TASK_BILLABLE_MAP, t('timeTrackingPage.projects.modal.errors.generic'), mehnatBillingMode);
                if (taskSyncErrs.length > 0) {
                    await showAlert({
                        title: t('timeTrackingPage.projects.modal.alerts.createdPartialTitle'),
                        message: t('timeTrackingPage.projects.modal.alerts.tasksSyncFailed').replace('{details}', taskSyncErrs.join('\n')),
                    });
                }
                if (canManage)
                    setEditMembersBaseline([...assignedUserIds]);
                onSaved(row);
            }
            else if (initial) {
                const patch = { ...body };
                const initCur = ((initial.currency ?? 'USD').trim() || 'USD');
                const nextCur = (form.currency.trim() || 'USD');
                if (initCur === nextCur)
                    delete patch.currency;
                const row = await patchClientProject(initial.client_id, initial.id, patch);
                if (canManage)
                    await applyProjectMemberAccessAndRates(row.id);
                if (canManage) {
                    const wantFlat = mehnatBillingMode === 'flat_fee';
                    let taskId = mehnatTaskId;
                    if (!taskId) {
                        const tasks = await listProjectTasks(initial.client_id, initial.id, { bypassGetReuse: true });
                        taskId = tasks.find((task) => task.name.trim().toLocaleLowerCase('ru') === MEHNAT_TASK_NAME_KEY)?.id ?? null;
                    }
                    if (taskId) {
                        await patchProjectTask(initial.client_id, initial.id, taskId, wantFlat
                            ? {
                                billingMode: 'flat_fee',
                                flatFeeAmount: DEFAULT_MEHNAT_FLAT_FEE_AMOUNT,
                                flatFeeCurrency: DEFAULT_MEHNAT_FLAT_FEE_CURRENCY,
                            }
                            : {
                                billingMode: 'hourly',
                                flatFeeAmount: null,
                                flatFeeCurrency: null,
                            });
                    }
                    else if (wantFlat || mehnatBillingMode === 'hourly') {
                        await createProjectTask(initial.client_id, initial.id, {
                            name: MEHNAT_TASK_NAME,
                            defaultBillableRate: null,
                            billableByDefault: true,
                            ...(wantFlat
                                ? {
                                    billingMode: 'flat_fee',
                                    flatFeeAmount: DEFAULT_MEHNAT_FLAT_FEE_AMOUNT,
                                    flatFeeCurrency: DEFAULT_MEHNAT_FLAT_FEE_CURRENCY,
                                }
                                : {
                                    billingMode: 'hourly',
                                    flatFeeAmount: null,
                                    flatFeeCurrency: null,
                                }),
                        });
                    }
                }
                onSaved(row);
            }
            onClose();
        }
        catch (e) {
            failSubmit(e instanceof Error ? e.message : t('timeTrackingPage.common.saveFailed'));
        }
        finally {
            setSaving(false);
        }
    };
    const showBudgetFees = form.budgetType === 'total_project_fees' || form.budgetType === 'fees_and_hours';
    const showBudgetHours = form.budgetType === 'total_project_hours' || form.budgetType === 'fees_and_hours';
    const isHourPackage = form.projectType === 'hour_package';
    const showProgressBudgetNoHardLimit = !isHourPackage && form.budgetType === 'no_budget' && (form.projectType === 'time_and_materials' || form.projectType === 'non_billable');
    const projectCurrencyCode = TIME_TRACKING_PROJECT_CURRENCIES.includes(form.currency) ? String(form.currency) : 'USD';
    const isPage = presentation === 'page' && mode === 'create';
    const formBody = (_jsxs(_Fragment, { children: [showClientBlock && hasClientsInPicker && (_jsx("div", { className: "tt-tm-field", children: _jsxs("div", { className: "tt-tm-field-row tt-tm-field-row--client-pick", children: [_jsxs("div", { className: "tt-tm-field tt-tm-field--grow", children: [_jsxs("label", { className: "tt-tm-label", id: `${uid}-client-lbl`, htmlFor: `${uid}-client-pick`, children: [t('timeTrackingPage.projects.modal.client'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx(SearchableSelect, { className: "tt-tm-dd", buttonClassName: "tt-tm-dd__btn", buttonId: `${uid}-client-pick`, value: pickedClientId, items: clientsForPicker, getOptionValue: (c) => c.id, getOptionLabel: (c) => c.name, getSearchText: clientRowSearchText, onSelect: (c) => setPickedClientId(c.id), placeholder: t('timeTrackingPage.common.selectClient'), emptyListText: t('timeTrackingPage.common.noClients'), noMatchText: t('timeTrackingPage.common.clientNotFound'), disabled: saving, portalDropdown: true, portalZIndex: TM_DD_PORTAL_Z, portalMinWidth: 320, portalDropdownClassName: "tsp-srch__dropdown--tall", "aria-labelledby": `${uid}-client-lbl`, renderOption: (c) => (_jsxs("span", { className: "tt-tm-dd__opt", children: [_jsx("span", { className: "tt-tm-dd__opt-name", children: c.name }), c.address ? (_jsx("span", { className: "tt-tm-dd__opt-sub", children: c.address })) : c.email ? (_jsx("span", { className: "tt-tm-dd__opt-sub", children: c.email })) : null] })) })] }), _jsxs("div", { className: "tt-tm-field tt-tm-field--shrink", children: [_jsx("span", { className: "tt-tm-label tt-tm-label--invisible", "aria-hidden": true, children: '\u00a0' }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--outline", disabled: !canManage, title: !canManage ? t('timeTrackingPage.common.insufficientRights') : undefined, onClick: () => setQuickClientOpen(true), children: t('timeTrackingPage.projects.modal.newClient') })] })] }) })), showClientBlock && !hasClientsInPicker && (_jsxs("div", { className: "tt-tm-field", children: [_jsxs("span", { className: "tt-tm-label", children: [t('timeTrackingPage.projects.modal.client'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx("p", { className: "tt-tm-hint", style: { margin: '0 0 0.5rem' }, children: t('timeTrackingPage.projects.modal.noClientsHint') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: !canManage, title: !canManage ? t('timeTrackingPage.common.insufficientRights') : undefined, onClick: () => setQuickClientOpen(true), children: t('timeTrackingPage.projects.modal.addClient') })] })), quickClientOpen && (_jsx(QuickCreateClientModal, { canManage: canManage, onClose: () => setQuickClientOpen(false), onCreated: handleQuickClientCreated })), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-name`, children: [t('timeTrackingPage.projects.modal.projectName'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx("input", { id: `${uid}-name`, className: "tt-tm-input", value: form.name, onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })) })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-code`, children: t('timeTrackingPage.projects.modal.projectCode') }), _jsx("input", { id: `${uid}-code`, className: "tt-tm-input", placeholder: t('timeTrackingPage.projects.modal.codePlaceholder'), value: form.code, onChange: (e) => setForm((f) => ({ ...f, code: e.target.value })) }), mode === 'create' && codeHint && (_jsxs("p", { className: "tt-tm-hint", children: [t('timeTrackingPage.projects.modal.codeHintPrefix'), " ", _jsx("strong", { children: codeHint }), ' ', _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--link", onClick: () => setForm((f) => ({ ...f, code: codeHint })), children: t('timeTrackingPage.projects.modal.codeHintApply') })] }))] }), _jsxs("div", { className: "tt-tm-field-row", children: [_jsxs("div", { className: "tt-tm-field tt-tm-field--cell", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-start`, id: `${uid}-start-lbl`, children: t('timeTrackingPage.projects.modal.startDate') }), _jsx(DatePicker, { id: `${uid}-start`, className: "tt-tm-dp", buttonClassName: "tt-tm-dp__btn", value: form.startDate, onChange: (iso) => setForm((f) => ({ ...f, startDate: iso })), max: form.endDate || undefined, emptyLabel: t('timeTrackingPage.projects.modal.dateEmpty'), title: t('timeTrackingPage.projects.modal.startDateTitle'), portal: true, portalZIndex: 12000, "aria-labelledby": `${uid}-start-lbl`, showChevron: true })] }), _jsxs("div", { className: "tt-tm-field tt-tm-field--cell", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-end`, id: `${uid}-end-lbl`, children: t('timeTrackingPage.projects.modal.endDate') }), _jsx(DatePicker, { id: `${uid}-end`, className: "tt-tm-dp", buttonClassName: "tt-tm-dp__btn", value: form.endDate, onChange: (iso) => setForm((f) => ({ ...f, endDate: iso })), min: form.startDate || undefined, emptyLabel: t('timeTrackingPage.projects.modal.dateEmpty'), title: t('timeTrackingPage.projects.modal.endDateTitle'), portal: true, portalZIndex: 12000, "aria-labelledby": `${uid}-end-lbl`, showChevron: true })] })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", id: `${uid}-cur-lbl`, htmlFor: `${uid}-cur`, children: t('timeTrackingPage.projects.modal.currency') }), _jsx(SearchableSelect, { className: "tt-tm-dd", buttonClassName: "tt-tm-dd__btn", buttonId: `${uid}-cur`, value: TIME_TRACKING_PROJECT_CURRENCIES.includes(form.currency) ? form.currency : 'USD', items: CURRENCY_OPTIONS, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.label, getSearchText: getTmOptSearch, onSelect: (o) => setForm((f) => ({ ...f, currency: o.id })), placeholder: t('timeTrackingPage.projects.modal.currencyPlaceholder'), emptyListText: t('timeTrackingPage.projects.modal.noCurrencies'), noMatchText: t('timeTrackingPage.common.notFound'), disabled: saving, portalDropdown: true, portalZIndex: TM_DD_PORTAL_Z, portalMinWidth: 260, "aria-labelledby": `${uid}-cur-lbl` }), _jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.projects.modal.currencyHint') })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", id: `${uid}-ptype-lbl`, htmlFor: `${uid}-ptype`, children: t('timeTrackingPage.projects.modal.projectType') }), _jsx(SearchableSelect, { className: "tt-tm-dd", buttonClassName: "tt-tm-dd__btn", buttonId: `${uid}-ptype`, value: form.projectType, items: projectTypeOptions, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.label, getSearchText: getTmOptSearch, onSelect: (o) => setForm((f) => ({ ...f, projectType: o.id })), placeholder: t('timeTrackingPage.projects.modal.projectTypePlaceholder'), emptyListText: t('timeTrackingPage.projects.modal.noOptions'), noMatchText: t('timeTrackingPage.common.notFound'), disabled: saving, portalDropdown: true, portalZIndex: TM_DD_PORTAL_Z, portalMinWidth: 300, "aria-labelledby": `${uid}-ptype-lbl` })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", id: `${uid}-rlang-lbl`, htmlFor: `${uid}-rlang`, children: t('timeTrackingPage.projects.modal.recordsLanguage') }), _jsx(SearchableSelect, { className: "tt-tm-dd", buttonClassName: "tt-tm-dd__btn", buttonId: `${uid}-rlang`, value: form.recordsLanguage, items: recordsLanguageOptions, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.label, getSearchText: getTmOptSearch, onSelect: (o) => setForm((f) => ({ ...f, recordsLanguage: o.id })), placeholder: t('timeTrackingPage.projects.modal.recordsLanguagePlaceholder'), emptyListText: t('timeTrackingPage.projects.modal.noOptions'), noMatchText: t('timeTrackingPage.common.notFound'), disabled: saving, portalDropdown: true, portalZIndex: TM_DD_PORTAL_Z, portalMinWidth: 280, "aria-labelledby": `${uid}-rlang-lbl` }), _jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.projects.modal.recordsLanguageHint') })] }), isHourPackage ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-pkg-hrs`, children: [t('timeTrackingPage.projects.modal.packageHours'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx("input", { id: `${uid}-pkg-hrs`, className: "tt-tm-input", inputMode: "decimal", placeholder: t('timeTrackingPage.projects.modal.budgetHoursPlaceholder'), value: form.packageHours, onChange: (e) => setForm((f) => ({ ...f, packageHours: e.target.value })), disabled: saving })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-pkg-fee`, children: [t('timeTrackingPage.projects.modal.packageFee'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsxs("div", { className: "tt-tm-money-input", role: "group", "aria-label": t('timeTrackingPage.projects.modal.amountGroupAria').replace('{currency}', projectCurrencyCode), children: [_jsx("span", { className: "tt-tm-money-input__symbol", title: projectCurrencyCode, "aria-hidden": true, children: projectCurrencySymbol(projectCurrencyCode) }), _jsx("input", { id: `${uid}-pkg-fee`, className: "tt-tm-input tt-tm-money-input__input", inputMode: "decimal", placeholder: t('timeTrackingPage.projects.modal.budgetAmountPlaceholder'), value: form.packageFee, onChange: (e) => setForm((f) => ({ ...f, packageFee: e.target.value })), disabled: saving, "aria-label": t('timeTrackingPage.projects.modal.budgetAmountAria').replace('{currency}', projectCurrencyCode) })] }), _jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.projects.modal.packageHint') })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", id: `${uid}-btype-lbl`, htmlFor: `${uid}-btype`, children: t('timeTrackingPage.projects.modal.budget') }), _jsx(SearchableSelect, { className: "tt-tm-dd", buttonClassName: "tt-tm-dd__btn", buttonId: `${uid}-btype`, value: form.budgetType, items: budgetTypeOptions, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.label, getSearchText: getTmOptSearch, onSelect: (o) => setForm((f) => ({ ...f, budgetType: o.id })), placeholder: t('timeTrackingPage.projects.modal.budgetModePlaceholder'), emptyListText: t('timeTrackingPage.projects.modal.noOptions'), noMatchText: t('timeTrackingPage.common.notFound'), disabled: saving, portalDropdown: true, portalZIndex: TM_DD_PORTAL_Z, portalMinWidth: 300, "aria-labelledby": `${uid}-btype-lbl` }), _jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.projects.modal.budgetNoHardLimitHint') })] }), showProgressBudgetNoHardLimit && (_jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-pbamt-nobudget`, children: t('timeTrackingPage.projects.modal.progressAmountOptional') }), _jsxs("div", { className: "tt-tm-money-input", role: "group", "aria-label": t('timeTrackingPage.projects.modal.progressAmountGroupAria').replace('{currency}', projectCurrencyCode), children: [_jsx("span", { className: "tt-tm-money-input__symbol", title: projectCurrencyCode, "aria-hidden": true, children: projectCurrencySymbol(projectCurrencyCode) }), _jsx("input", { id: `${uid}-pbamt-nobudget`, className: "tt-tm-input tt-tm-money-input__input", inputMode: "decimal", placeholder: t('timeTrackingPage.projects.modal.progressAmountPlaceholder'), value: form.progressBudgetAmount, onChange: (e) => setForm((f) => ({ ...f, progressBudgetAmount: e.target.value })), "aria-label": t('timeTrackingPage.projects.modal.progressAmountAria').replace('{currency}', projectCurrencyCode) })] }), _jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.projects.modal.progressAmountHint') })] })), showBudgetFees && (_jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-bamt`, children: form.projectType === 'fixed_fee' ? (_jsxs(_Fragment, { children: [t('timeTrackingPage.projects.modal.contractAmount'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] })) : (form.budgetType === 'fees_and_hours' ? t('timeTrackingPage.projects.modal.hardMoneyLimit') : t('timeTrackingPage.projects.modal.hardLimitOrBudget')) }), _jsxs("div", { className: "tt-tm-money-input", role: "group", "aria-label": t('timeTrackingPage.projects.modal.amountGroupAria').replace('{currency}', projectCurrencyCode), children: [_jsx("span", { className: "tt-tm-money-input__symbol", title: projectCurrencyCode, "aria-hidden": true, children: projectCurrencySymbol(projectCurrencyCode) }), _jsx("input", { id: `${uid}-bamt`, className: "tt-tm-input tt-tm-money-input__input", inputMode: "decimal", placeholder: t('timeTrackingPage.projects.modal.budgetAmountPlaceholder'), value: form.budgetAmount, onChange: (e) => setForm((f) => ({ ...f, budgetAmount: e.target.value })), "aria-label": t('timeTrackingPage.projects.modal.budgetAmountAria').replace('{currency}', projectCurrencyCode) })] })] })), (form.projectType === 'time_and_materials' || form.projectType === 'non_billable') && showBudgetFees && (_jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-pbamt`, children: t('timeTrackingPage.projects.modal.progressPlanOptional') }), _jsxs("div", { className: "tt-tm-money-input", role: "group", "aria-label": t('timeTrackingPage.projects.modal.progressPlanGroupAria').replace('{currency}', projectCurrencyCode), children: [_jsx("span", { className: "tt-tm-money-input__symbol", title: projectCurrencyCode, "aria-hidden": true, children: projectCurrencySymbol(projectCurrencyCode) }), _jsx("input", { id: `${uid}-pbamt`, className: "tt-tm-input tt-tm-money-input__input", inputMode: "decimal", placeholder: t('timeTrackingPage.projects.modal.progressPlanPlaceholder'), value: form.progressBudgetAmount, onChange: (e) => setForm((f) => ({ ...f, progressBudgetAmount: e.target.value })), "aria-label": t('timeTrackingPage.projects.modal.progressPlanAria').replace('{currency}', projectCurrencyCode) })] }), _jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.projects.modal.progressPlanHint') })] })), showBudgetHours && (_jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-bhrs`, children: form.budgetType === 'fees_and_hours' ? t('timeTrackingPage.projects.modal.hoursLimit') : t('timeTrackingPage.projects.modal.budgetHours') }), _jsx("input", { id: `${uid}-bhrs`, className: "tt-tm-input", inputMode: "decimal", placeholder: t('timeTrackingPage.projects.modal.budgetHoursPlaceholder'), value: form.budgetHours, onChange: (e) => setForm((f) => ({ ...f, budgetHours: e.target.value })) })] }))] })), _jsxs("fieldset", { className: "tt-tm-fieldset tt-tm-fieldset--budget", children: [_jsx("legend", { className: "tt-tm-fieldset-legend tt-tm-fieldset-legend--budget", children: t('timeTrackingPage.projects.modal.budgetParamsLegend') }), _jsxs("div", { className: "tt-tm-fieldset--budget__grid", children: [_jsxs("label", { className: "tt-ios-toggle-row", children: [_jsx("span", { className: "tt-ios-toggle-row__text", children: t('timeTrackingPage.projects.modal.budgetResetMonthly') }), _jsxs("span", { className: "tt-ios-toggle", children: [_jsx("input", { type: "checkbox", className: "tt-ios-toggle__input", checked: form.budgetResetsEveryMonth, onChange: (e) => setForm((f) => ({ ...f, budgetResetsEveryMonth: e.target.checked })) }), _jsx("span", { className: "tt-ios-toggle__slider", "aria-hidden": true })] })] }), _jsxs("label", { className: "tt-ios-toggle-row", children: [_jsx("span", { className: "tt-ios-toggle-row__text", children: t('timeTrackingPage.projects.modal.budgetIncludesExpenses') }), _jsxs("span", { className: "tt-ios-toggle", children: [_jsx("input", { type: "checkbox", className: "tt-ios-toggle__input", checked: form.budgetIncludesExpenses, onChange: (e) => setForm((f) => ({ ...f, budgetIncludesExpenses: e.target.checked })) }), _jsx("span", { className: "tt-ios-toggle__slider", "aria-hidden": true })] })] }), _jsxs("label", { className: "tt-ios-toggle-row", children: [_jsx("span", { className: "tt-ios-toggle-row__text", children: t('timeTrackingPage.projects.modal.budgetAlerts') }), _jsxs("span", { className: "tt-ios-toggle", children: [_jsx("input", { type: "checkbox", className: "tt-ios-toggle__input", checked: form.sendBudgetAlerts, onChange: (e) => setForm((f) => ({ ...f, sendBudgetAlerts: e.target.checked })) }), _jsx("span", { className: "tt-ios-toggle__slider", "aria-hidden": true })] })] }), _jsxs("label", { className: "tt-ios-toggle-row", children: [_jsx("span", { className: "tt-ios-toggle-row__text", children: t('timeTrackingPage.projects.modal.skipPartnerInvoiceConfirmation') }), _jsxs("span", { className: "tt-ios-toggle", children: [_jsx("input", { type: "checkbox", className: "tt-ios-toggle__input", checked: form.skipPartnerInvoiceConfirmation, onChange: (e) => setForm((f) => ({ ...f, skipPartnerInvoiceConfirmation: e.target.checked })), disabled: saving || !canManage }), _jsx("span", { className: "tt-ios-toggle__slider", "aria-hidden": true })] })] }), _jsxs("label", { className: "tt-ios-toggle-row", children: [_jsx("span", { className: "tt-ios-toggle-row__text", children: t('timeTrackingPage.projects.modal.mehnatFlatFee') }), _jsxs("span", { className: "tt-ios-toggle", children: [_jsx("input", { type: "checkbox", className: "tt-ios-toggle__input", checked: mehnatBillingMode === 'flat_fee', onChange: (e) => setMehnatBillingMode(e.target.checked ? 'flat_fee' : 'hourly'), disabled: saving || !canManage }), _jsx("span", { className: "tt-ios-toggle__slider", "aria-hidden": true })] })] })] }), form.skipPartnerInvoiceConfirmation && (_jsx("p", { className: "tt-tm-hint tt-tm-fieldset--budget__extra", children: t('timeTrackingPage.projects.modal.skipPartnerInvoiceConfirmationHint') })), _jsx("p", { className: "tt-tm-hint tt-tm-fieldset--budget__extra", children: mehnatBillingMode === 'flat_fee'
                            ? t('timeTrackingPage.projects.modal.mehnatFlatFeeHint')
                            : t('timeTrackingPage.projects.modal.mehnatHourlyHint') }), form.sendBudgetAlerts && (_jsxs("div", { className: "tt-tm-field tt-tm-fieldset--budget__extra", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-thr`, children: t('timeTrackingPage.projects.modal.budgetAlertThreshold') }), _jsx("input", { id: `${uid}-thr`, className: "tt-tm-input", inputMode: "decimal", value: form.budgetAlertThresholdPercent, onChange: (e) => setForm((f) => ({ ...f, budgetAlertThresholdPercent: e.target.value })) })] }))] }), mode === 'create' && (_jsxs("fieldset", { className: "tt-tm-fieldset tt-tm-fieldset--budget", children: [_jsx("legend", { className: "tt-tm-fieldset-legend tt-tm-fieldset-legend--budget", children: t('timeTrackingPage.projects.modal.tasksLegend') }), _jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.projects.modal.tasksHint') }), _jsx("div", { className: "tt-tm-members__add-row", children: _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--outline", onClick: openTaskPicker, disabled: saving, children: t('timeTrackingPage.projects.modal.tasksButton') }) }), _jsxs("div", { className: "tt-proj-task-pick__summary", children: [_jsx("p", { className: "tt-tm-members__add-hint", children: t('timeTrackingPage.projects.modal.tasksSelected').replace('{count}', String(initialTaskNames.length)) }), initialTaskNames.length > 0 && (_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--link", onClick: () => setTaskSelectionCollapsed((v) => !v), children: taskSelectionCollapsed ? t('timeTrackingPage.projects.modal.tasksExpand') : t('timeTrackingPage.projects.modal.tasksCollapse') }))] }), !taskSelectionCollapsed && initialTaskNames.length > 0 && (_jsx("div", { className: "tt-tm-members__chips tt-proj-task-pick__chips", children: initialTaskNames.map((taskName) => (_jsx("div", { className: "tt-tm-members__chip tt-proj-task-pick__chip", children: _jsx("div", { className: "tt-tm-members__chip-identity", children: _jsxs("div", { className: "tt-tm-members__chip-text tt-proj-task-pick__chip-text", children: [_jsx("span", { className: "tt-tm-members__opt-name", children: taskName }), _jsx("span", { className: `tt-task-pill${DEFAULT_PROJECT_TASK_BILLABLE_MAP.get(taskName) ? ' tt-task-pill--billable' : ' tt-task-pill--muted'}`, children: DEFAULT_PROJECT_TASK_BILLABLE_MAP.get(taskName) ? t('timeTrackingPage.common.billable') : t('timeTrackingPage.common.nonBillable') })] }) }) }, taskName))) }))] })), projectTypeUsesBillableRates(form.projectType) && (_jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", id: `${uid}-brate-lbl`, htmlFor: `${uid}-brate`, children: t('timeTrackingPage.projects.modal.billableRateMode') }), _jsx(SearchableSelect, { className: "tt-tm-dd", buttonClassName: "tt-tm-dd__btn", buttonId: `${uid}-brate`, value: form.billableRateType, items: billableRateOptions, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.label, getSearchText: getTmOptSearch, onSelect: (o) => setForm((f) => ({ ...f, billableRateType: o.id })), placeholder: t('timeTrackingPage.projects.modal.billableRatePlaceholder'), emptyListText: t('timeTrackingPage.projects.modal.noOptions'), noMatchText: t('timeTrackingPage.common.notFound'), disabled: saving, portalDropdown: true, portalZIndex: TM_DD_PORTAL_Z, portalMinWidth: 300, "aria-labelledby": `${uid}-brate-lbl` })] })), showProjectBillableRate && (_jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-pbrate-amt`, id: `${uid}-pbrate-amt-lbl`, children: [t('timeTrackingPage.projects.modal.projectHourlyRate'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsxs("div", { className: "tt-tm-money-input", role: "group", "aria-label": t('timeTrackingPage.projects.modal.projectHourlyRateGroupAria').replace('{currency}', projectCurrencyCode), children: [_jsx("span", { className: "tt-tm-money-input__symbol", title: projectCurrencyCode, "aria-hidden": true, children: projectCurrencySymbol(projectCurrencyCode) }), _jsx("input", { id: `${uid}-pbrate-amt`, className: "tt-tm-input tt-tm-money-input__input", inputMode: "decimal", placeholder: t('timeTrackingPage.projects.modal.projectHourlyRatePlaceholder'), value: form.projectBillableRateAmount, disabled: saving, onChange: (e) => setForm((f) => ({ ...f, projectBillableRateAmount: e.target.value })), "aria-labelledby": `${uid}-pbrate-amt-lbl` })] }), _jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.projects.modal.projectHourlyRateHint') })] })), canManage && (mode === 'create' || mode === 'edit') && (_jsxs(_Fragment, { children: [_jsx(ProjectMembersField, { assignedIds: assignedUserIds, onAssignedChange: handleAssignedChange, disabled: saving || editMembersLoading, showBillableRate: showMemberBillableRate, projectCurrency: (form.currency || 'USD').trim() || 'USD', projectName: (form.name || '').trim(), memberRates: memberRates, onUpdateMemberRate: (id, d) => setMemberRates((p) => ({ ...p, [id]: d })), allowChangeRateFromDate: mode === 'edit' && showMemberBillableRate && Boolean(initial?.id), onChangeRateFromDate: mode === 'edit' ? (userId, data) => handleMemberChangeRateFrom(userId, data) : undefined }), mode === 'create' && (_jsx("p", { className: "tt-tm-hint", style: { marginTop: '-0.25rem' }, children: t('timeTrackingPage.projects.modal.membersCreateHint') }))] })), _jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-notes`, children: t('timeTrackingPage.projects.modal.notes') }), _jsx("textarea", { id: `${uid}-notes`, className: "tt-tm-textarea", rows: 3, value: form.notes, onChange: (e) => setForm((f) => ({ ...f, notes: e.target.value })) })] })] }));
    const saveDisabled = saving || (mode === 'edit' && editMembersLoading);
    const formFooter = (_jsxs("div", { className: "tt-tm-modal__foot", children: [error ? (_jsx("p", { className: "tt-tm-modal__foot-error", role: "alert", children: error })) : null, _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", disabled: saveDisabled, onClick: onClose, children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: saveDisabled, onClick: () => void handleSubmit(), children: saving ? t('timeTrackingPage.saving') : mode === 'edit' && editMembersLoading ? t('timeTrackingPage.common.loading') : mode === 'create' ? t('timeTrackingPage.projects.modal.create') : t('timeTrackingPage.projects.modal.save') })] }));
    const taskPickerModal = mode === 'create' && taskPickerOpen
        ? portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--task", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-task-pick-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { id: `${uid}-task-pick-title`, className: "tt-tm-modal__title", children: t('timeTrackingPage.projects.modal.tasksLegend') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: () => setTaskPickerOpen(false), "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsx("div", { className: "tt-tm-modal__body", children: _jsx("div", { className: "tt-proj-task-pick__list", children: DEFAULT_PROJECT_TASK_SEED.map((task) => (_jsxs("label", { className: "tt-proj-task-pick__row", children: [_jsxs("span", { className: "tt-proj-task-pick__label", children: [task.name, " ", _jsx("span", { className: `tt-task-pill${task.billableByDefault ? ' tt-task-pill--billable' : ' tt-task-pill--muted'}`, children: task.billableByDefault ? t('timeTrackingPage.common.billable') : t('timeTrackingPage.common.nonBillable') })] }), _jsxs("span", { className: "tt-proj-task-pick__switch", children: [_jsx("input", { type: "checkbox", className: "tt-proj-task-pick__switch-input", checked: taskPickerDraft.includes(task.name), onChange: (e) => toggleTaskInDraft(task.name, e.target.checked) }), _jsx("span", { className: "tt-proj-task-pick__switch-slider", "aria-hidden": true })] })] }, task.name))) }) }), _jsxs("div", { className: "tt-tm-modal__foot", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", onClick: () => setTaskPickerOpen(false), children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", onClick: applyTaskPicker, children: t('timeTrackingPage.save') })] })] }) }))
        : null;
    if (isPage) {
        return (_jsxs("div", { className: "tt-tm-proj-page", children: [_jsxs("div", { className: "tt-tm-proj-page__card tt-tm-modal tt-tm-modal--project", children: [_jsx("div", { className: "tt-tm-modal__body", ref: modalBodyRef, children: formBody }), formFooter] }), taskPickerModal] }));
    }
    return (_jsxs(_Fragment, { children: [portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--project", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-proj-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { id: `${uid}-proj-title`, className: "tt-tm-modal__title", children: mode === 'create' ? t('timeTrackingPage.projects.modal.createTitle') : t('timeTrackingPage.projects.modal.changeTitle') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsx("div", { className: "tt-tm-modal__body", ref: modalBodyRef, children: formBody }), formFooter] }) })), taskPickerModal] }));
}
