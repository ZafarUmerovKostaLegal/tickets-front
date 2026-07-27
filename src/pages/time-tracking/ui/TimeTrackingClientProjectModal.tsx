import { useState, useEffect, useId, useMemo, useRef, useCallback } from 'react';
import { DatePicker, SearchableSelect, useAppDialog } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { getUserProjectAccess, listAllClientProjectsForClientMerged, createClientProject, patchClientProject, putUserProjectAccess, listHourlyRates, createHourlyRate, changeHourlyRateFrom, listUsersWithProjectAccessToProject, listProjectTasks, createProjectTask, deleteProjectTask, readTimeManagerProjectBillableRateAmount, readProjectRecordsLanguage, pickEffectiveBillableRateForProject, parseHourlyRateAmount, hourlyRateEffectiveOnDate, TIME_TRACKING_PROJECT_CURRENCIES, type TimeManagerClientRow, type TimeManagerClientProjectRow, type TimeManagerClientProjectCreatePayload, type TimeManagerClientProjectPatchPayload, type TimeManagerInitialProjectAccessMember, type TimeManagerProjectCurrency, type TimeManagerProjectRecordsLanguage, } from '@entities/time-tracking';
import { suggestedNextKlProjectCode } from '@entities/time-tracking/lib/klProjectCode';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
import { QuickCreateClientModal } from './QuickCreateClientModal';
import { ProjectMembersField, type ProjectMemberRateDraft } from './ProjectMembersField';
import { clientRowSearchText } from '../lib/clientRowSearchText';

const TM_DD_PORTAL_Z = 12000;

function memberRateDraftFromPick(
  pick: ReturnType<typeof pickEffectiveBillableRateForProject>,
  fallbackCurrency: string,
): ProjectMemberRateDraft {
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

function memberRateIsDirty(dr: ProjectMemberRateDraft | undefined): boolean {
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

function parseMemberAmount(raw: string): number {
  const t = raw.trim().replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}
type TmOpt = { id: string; label: string; search?: string };

const CURRENCY_OPTIONS: TmOpt[] = TIME_TRACKING_PROJECT_CURRENCIES.map((c) => ({ id: c, label: c, search: c }));

function buildProjectTypeOptions(t: ReturnType<typeof useI18n>['t']): TmOpt[] {
  return [
    { id: 'time_and_materials', label: t('timeTrackingPage.projects.modal.projectTypes.timeAndMaterials'), search: 'time materials T&M tm' },
    { id: 'fixed_fee', label: t('timeTrackingPage.projects.modal.projectTypes.fixedFee'), search: 'fixed fee' },
    { id: 'hour_package', label: t('timeTrackingPage.projects.modal.projectTypes.hourPackage'), search: 'hour package monthly hours пакет часов' },
    { id: 'non_billable', label: t('timeTrackingPage.projects.modal.projectTypes.nonBillable'), search: 'non billable' },
  ];
}
function buildRecordsLanguageOptions(t: ReturnType<typeof useI18n>['t']): TmOpt[] {
  return [
    { id: 'ENG', label: t('timeTrackingPage.projects.modal.recordsLanguages.eng'), search: 'english eng английский' },
    { id: 'RU', label: t('timeTrackingPage.projects.modal.recordsLanguages.ru'), search: 'russian ru русский' },
  ];
}
function buildBillableRateOptions(t: ReturnType<typeof useI18n>['t']): TmOpt[] {
  return [
    { id: 'person_billable_rate', label: t('timeTrackingPage.projects.modal.billableRateTypes.person'), search: 'person hourly' },
    { id: 'project_billable_rate', label: t('timeTrackingPage.projects.modal.billableRateTypes.project'), search: 'project rate' },
  ];
}
function buildBudgetTypeOptions(t: ReturnType<typeof useI18n>['t']): TmOpt[] {
  return [
    { id: 'no_budget', label: t('timeTrackingPage.projects.modal.budgetTypes.noBudget'), search: 'no budget' },
    { id: 'total_project_fees', label: t('timeTrackingPage.projects.modal.budgetTypes.feesOnly'), search: 'money fees' },
    { id: 'total_project_hours', label: t('timeTrackingPage.projects.modal.budgetTypes.hoursOnly'), search: 'hours limit' },
    { id: 'fees_and_hours', label: t('timeTrackingPage.projects.modal.budgetTypes.feesAndHours'), search: 'package money hours' },
  ];
}
const DEFAULT_PROJECT_TASK_SEED: Array<{
  name: string;
  billableByDefault: boolean;
  billingMode?: 'hourly' | 'flat_fee';
  flatFeeAmount?: number;
  flatFeeCurrency?: string;
}> = [
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
const DEFAULT_PROJECT_TASK_BILLABLE_MAP = new Map<string, boolean>(DEFAULT_PROJECT_TASK_SEED.map((task) => [task.name, task.billableByDefault]));
const DEFAULT_PROJECT_TASK_FLAT_FEE_MAP = new Map(
  DEFAULT_PROJECT_TASK_SEED
    .filter((task) => task.billingMode === 'flat_fee')
    .map((task) => [task.name, task] as const),
);
const DEFAULT_PROJECT_TASK_NAMES = DEFAULT_PROJECT_TASK_SEED.map((task) => task.name);

function getTmOptSearch(o: TmOpt): string {
  return o.search ?? o.label;
}

function projectCurrencySymbol(iso: string): string {
  const c = (iso || 'USD').trim().toUpperCase() || 'USD';
  const map: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    RUB: '₽',
    UZS: "soʻm",
  };
  if (c in map)
    return map[c];
  try {
    const parts = new Intl.NumberFormat('en', { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' } as Intl.NumberFormatOptions).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value?.trim() || c;
  }
  catch {
    return c;
  }
}

function rowToBudgetFormSlice(row: TimeManagerClientProjectRow): Pick<ProjectFormState, 'budgetType' | 'budgetAmount' | 'budgetHours' | 'progressBudgetAmount'> {
  const t = (row.budget_type ?? '').toLowerCase().replace(/-/g, '_');
  const rawA = row.budget_amount;
  const rawP = row.progress_budget_amount;
  const rawH = row.budget_hours;
  const rawFixed = row.fixed_fee_amount;
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

type ProjectFormState = {
  name: string;
  code: string;
  currency: string;
  startDate: string;
  endDate: string;
  notes: string;
  recordsLanguage: TimeManagerProjectRecordsLanguage;
  projectType: 'time_and_materials' | 'fixed_fee' | 'non_billable' | 'hour_package';
  billableRateType: string;
  
  projectBillableRateAmount: string;
  budgetType: 'no_budget' | 'total_project_fees' | 'total_project_hours' | 'fees_and_hours';
  budgetAmount: string;
  progressBudgetAmount: string;
  budgetHours: string;
  packageHours: string;
  packageFee: string;
  budgetResetsEveryMonth: boolean;
  budgetIncludesExpenses: boolean;
  sendBudgetAlerts: boolean;
  budgetAlertThresholdPercent: string;
};

function projectTypeUsesBillableRates(pt: ProjectFormState['projectType'] | string): boolean {
  return pt === 'time_and_materials' || pt === 'fixed_fee' || pt === 'hour_package';
}

function readOptionalNumericField(...values: Array<string | number | null | undefined>): string {
  for (const raw of values) {
    if (raw != null && String(raw).trim() !== '')
      return String(raw);
  }
  return '';
}

function emptyProjectForm(): ProjectFormState {
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
  };
}
function rowToForm(row: TimeManagerClientProjectRow): ProjectFormState {
  const cur = (row.currency ?? 'USD').trim() || 'USD';
  const pt = row.project_type === 'fixed_fee' || row.project_type === 'non_billable' || row.project_type === 'hour_package'
    ? row.project_type
    : 'time_and_materials';
  return {
    name: row.name,
    code: row.code ?? '',
    currency: TIME_TRACKING_PROJECT_CURRENCIES.includes(cur as TimeManagerProjectCurrency) ? cur : 'USD',
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
  };
}
function parseOptionalDecimal(raw: string): string | number | null {
  const t = raw.trim().replace(',', '.');
  if (!t)
    return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? t : null;
}
function normalizeInitialTaskNames(rows: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
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
function buildCreatePayload(
  form: ProjectFormState,
  initialTimeTrackingUserAuthIds?: number[],
  initialProjectAccessMembers?: TimeManagerInitialProjectAccessMember[],
  initialTimeTrackingUserBillableHourlyAmounts?: (number | null)[],
): TimeManagerClientProjectCreatePayload {
  const name = form.name.trim();
  const pt = form.projectType;
  let billableRateType: string | null = null;
  if (projectTypeUsesBillableRates(pt)) {
    billableRateType = form.billableRateType.trim() || 'person_billable_rate';
  }
  let budgetAmount: string | number | null = null;
  let progressBudgetAmount: string | number | null = null;
  let budgetHours: string | number | null = null;
  let packageHoursPerMonth: string | number | null | undefined = undefined;
  let packageFeeAmount: string | number | null | undefined = undefined;
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
  let projectBillableRateAmount: string | number | null = null;
  if (projectTypeUsesBillableRates(pt)) {
    if ((form.billableRateType || '').trim() === 'project_billable_rate')
      projectBillableRateAmount = parseOptionalDecimal(form.projectBillableRateAmount);
    else
      projectBillableRateAmount = null;
  }
  const ids = (initialTimeTrackingUserAuthIds ?? []).filter((n) => Number.isFinite(n) && n > 0);
  const team: Pick<TimeManagerClientProjectCreatePayload, 'initialTimeTrackingUserAuthIds' | 'initialProjectAccessMembers' | 'initialTimeTrackingUserBillableHourlyAmounts'> = {};
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
    currency: (form.currency.trim() || 'USD') as TimeManagerProjectCurrency,
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
    ...team,
  };
}

async function syncSelectedProjectTasksAfterCreate(
  clientId: string,
  projectId: string,
  selectedNames: string[],
  billableByTaskName: Map<string, boolean>,
  genericError: string,
): Promise<string[]> {
  const selected = new Set(selectedNames.map((n) => n.trim().toLocaleLowerCase('ru')));
  const errors: string[] = [];
  let tasks = await listProjectTasks(clientId, projectId);
  for (const t of tasks) {
    const key = t.name.trim().toLocaleLowerCase('ru');
    if (!selected.has(key)) {
      try {
        await deleteProjectTask(clientId, projectId, t.id);
      }
      catch (e) {
        errors.push(`${t.name}: ${e instanceof Error ? e.message : genericError}`);
      }
    }
  }
  tasks = await listProjectTasks(clientId, projectId);
  const existing = new Set(tasks.map((t) => t.name.trim().toLocaleLowerCase('ru')));
  for (const name of selectedNames) {
    const trimmed = name.trim();
    const key = trimmed.toLocaleLowerCase('ru');
    if (!trimmed || existing.has(key))
      continue;
    try {
      await createProjectTask(clientId, projectId, {
        name: trimmed,
        defaultBillableRate: null,
        billableByDefault: billableByTaskName.get(trimmed) ?? true,
        ...(DEFAULT_PROJECT_TASK_FLAT_FEE_MAP.get(trimmed)
          ? {
              billingMode: 'flat_fee' as const,
              flatFeeAmount: DEFAULT_PROJECT_TASK_FLAT_FEE_MAP.get(trimmed)!.flatFeeAmount ?? null,
              flatFeeCurrency: DEFAULT_PROJECT_TASK_FLAT_FEE_MAP.get(trimmed)!.flatFeeCurrency ?? 'UZS',
            }
          : {}),
      });
    }
    catch (e) {
      errors.push(`${trimmed}: ${e instanceof Error ? e.message : genericError}`);
    }
  }
  return errors;
}
export type ClientProjectModalProps = {
  mode: 'create' | 'edit';
  fixedClientId: string | null;
  clientsForPicker?: TimeManagerClientRow[];
  initial: TimeManagerClientProjectRow | null;
  onClose: () => void;
  onSaved: (row: TimeManagerClientProjectRow) => void;
  
  onClientCreated?: (client: TimeManagerClientRow) => void;
  
  canManage?: boolean;
  
  presentation?: 'modal' | 'page';
};
export function ClientProjectModal({ mode, fixedClientId, clientsForPicker, initial, onClose, onSaved, onClientCreated, canManage = true, presentation = 'modal', }: ClientProjectModalProps) {
  const uid = useId();
  const { t } = useI18n();
  const { showAlert } = useAppDialog();
  const projectTypeOptions = useMemo(() => buildProjectTypeOptions(t), [t]);
  const recordsLanguageOptions = useMemo(() => buildRecordsLanguageOptions(t), [t]);
  const billableRateOptions = useMemo(() => buildBillableRateOptions(t), [t]);
  const budgetTypeOptions = useMemo(() => buildBudgetTypeOptions(t), [t]);
  const [form, setForm] = useState<ProjectFormState>(() => initial ? rowToForm(initial) : emptyProjectForm());
  const [pickedClientId, setPickedClientId] = useState(() => {
    if (fixedClientId)
      return fixedClientId;
    return clientsForPicker?.[0]?.id ?? '';
  });
  const [codeHint, setCodeHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initialTaskNames, setInitialTaskNames] = useState<string[]>(() => [...DEFAULT_PROJECT_TASK_NAMES]);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [taskPickerDraft, setTaskPickerDraft] = useState<string[]>(() => [...DEFAULT_PROJECT_TASK_NAMES]);
  const [taskSelectionCollapsed, setTaskSelectionCollapsed] = useState(true);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>([]);
  const [memberRates, setMemberRates] = useState<Record<number, ProjectMemberRateDraft>>({});
  const [editMembersBaseline, setEditMembersBaseline] = useState<number[]>([]);
  const [editMembersLoading, setEditMembersLoading] = useState(false);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const failSubmit = useCallback((msg: string) => {
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
  const handleQuickClientCreated = (c: TimeManagerClientRow) => {
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
  const handleAssignedChange = useCallback((next: number[]) => {
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
      const next: Record<number, ProjectMemberRateDraft> = { ...prev };
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
        const out: Record<number, ProjectMemberRateDraft> = {};
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
  async function reloadMemberRate(authUserId: number, projectId: string) {
    const cur0 = (form.currency || 'USD').trim() || 'USD';
    const rows = await listHourlyRates(authUserId, 'billable');
    const pick = pickEffectiveBillableRateForProject(rows, projectId, cur0);
    setMemberRates((prev) => ({
      ...prev,
      [authUserId]: memberRateDraftFromPick(pick, cur0),
    }));
  }

  async function handleMemberChangeRateFrom(
    authUserId: number,
    data: { effectiveFrom: string; amount: number; currency: string },
  ) {
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

  async function applyProjectMemberAccessAndRates(projectId: string) {
    const pid = String(projectId ?? '').trim();
    if (!pid)
      return;
    const useRates = projectTypeUsesBillableRates(form.projectType) && form.billableRateType === 'person_billable_rate';
    const projectCur = (form.currency || 'USD').trim() || 'USD';
    const now = new Date();
    if (useRates && assignedUserIds.length > 0) {
      const rateEnsureFailed: string[] = [];
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
        let putOptions: { projectBillableHourlyAmountsByProjectId?: Record<string, string> } | undefined;
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
      const failed: string[] = [];
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
        const refreshed: Record<number, ProjectMemberRateDraft> = { ...memberRates };
        for (const authUserId of assignedUserIds) {
          try {
            const rows = await listHourlyRates(authUserId, 'billable');
            refreshed[authUserId] = memberRateDraftFromPick(
              pickEffectiveBillableRateForProject(rows, pid, projectCur),
              projectCur,
            );
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
  const toggleTaskInDraft = (name: string, checked: boolean) => {
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
    let initialProjectAccessMembers: TimeManagerInitialProjectAccessMember[] | undefined;
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
        ? buildCreatePayload(
            form,
            initialProjectAccessMembers != null && initialProjectAccessMembers.length > 0 ? undefined : assignedUserIds,
            initialProjectAccessMembers != null && initialProjectAccessMembers.length > 0 ? initialProjectAccessMembers : undefined,
            initialTimeTrackingUserBillableHourlyAmounts,
          )
        : buildCreatePayload(form);
      if (mode === 'create') {
        const row = await createClientProject(effectiveClientId, body);
        const taskSyncErrs = await syncSelectedProjectTasksAfterCreate(
          effectiveClientId,
          row.id,
          normalizedInitialTaskNames,
          DEFAULT_PROJECT_TASK_BILLABLE_MAP,
          t('timeTrackingPage.projects.modal.errors.generic'),
        );
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
        const patch: TimeManagerClientProjectPatchPayload = { ...body };
        const initCur = ((initial.currency ?? 'USD').trim() || 'USD') as TimeManagerProjectCurrency;
        const nextCur = (form.currency.trim() || 'USD') as TimeManagerProjectCurrency;
        if (initCur === nextCur)
          delete patch.currency;
        const row = await patchClientProject(initial.client_id, initial.id, patch);
        if (canManage)
          await applyProjectMemberAccessAndRates(row.id);
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
  const projectCurrencyCode = TIME_TRACKING_PROJECT_CURRENCIES.includes(form.currency as TimeManagerProjectCurrency) ? String(form.currency) : 'USD';
  const isPage = presentation === 'page' && mode === 'create';
  const formBody = (<>
    {showClientBlock && hasClientsInPicker && (<div className="tt-tm-field">
      <div className="tt-tm-field-row tt-tm-field-row--client-pick">
        <div className="tt-tm-field tt-tm-field--grow">
          <label className="tt-tm-label" id={`${uid}-client-lbl`} htmlFor={`${uid}-client-pick`}>
            {t('timeTrackingPage.projects.modal.client')} <span className="tt-tm-req">*</span>
          </label>
          <SearchableSelect<TimeManagerClientRow> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId={`${uid}-client-pick`} value={pickedClientId} items={clientsForPicker!} getOptionValue={(c) => c.id} getOptionLabel={(c) => c.name} getSearchText={clientRowSearchText} onSelect={(c) => setPickedClientId(c.id)} placeholder={t('timeTrackingPage.common.selectClient')} emptyListText={t('timeTrackingPage.common.noClients')} noMatchText={t('timeTrackingPage.common.clientNotFound')} disabled={saving} portalDropdown portalZIndex={TM_DD_PORTAL_Z} portalMinWidth={320} portalDropdownClassName="tsp-srch__dropdown--tall" aria-labelledby={`${uid}-client-lbl`} renderOption={(c) => (<span className="tt-tm-dd__opt">
            <span className="tt-tm-dd__opt-name">{c.name}</span>
            {c.address ? (<span className="tt-tm-dd__opt-sub">{c.address}</span>) : c.email ? (<span className="tt-tm-dd__opt-sub">{c.email}</span>) : null}
          </span>)} />
        </div>
        <div className="tt-tm-field tt-tm-field--shrink">
          <span className="tt-tm-label tt-tm-label--invisible" aria-hidden>
            {'\u00a0'}
          </span>
          <button type="button" className="tt-settings__btn tt-settings__btn--outline" disabled={!canManage} title={!canManage ? t('timeTrackingPage.common.insufficientRights') : undefined} onClick={() => setQuickClientOpen(true)}>
            {t('timeTrackingPage.projects.modal.newClient')}
          </button>
        </div>
      </div>
    </div>)}
    {showClientBlock && !hasClientsInPicker && (<div className="tt-tm-field">
      <span className="tt-tm-label">{t('timeTrackingPage.projects.modal.client')} <span className="tt-tm-req">*</span></span>
      <p className="tt-tm-hint" style={{ margin: '0 0 0.5rem' }}>
        {t('timeTrackingPage.projects.modal.noClientsHint')}
      </p>
      <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={!canManage} title={!canManage ? t('timeTrackingPage.common.insufficientRights') : undefined} onClick={() => setQuickClientOpen(true)}>
        {t('timeTrackingPage.projects.modal.addClient')}
      </button>
    </div>)}
    {quickClientOpen && (<QuickCreateClientModal canManage={canManage} onClose={() => setQuickClientOpen(false)} onCreated={handleQuickClientCreated} />)}

    <div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-name`}>
        {t('timeTrackingPage.projects.modal.projectName')} <span className="tt-tm-req">*</span>
      </label>
      <input id={`${uid}-name`} className="tt-tm-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
    </div>

    <div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-code`}>
        {t('timeTrackingPage.projects.modal.projectCode')}
      </label>
      <input id={`${uid}-code`} className="tt-tm-input" placeholder={t('timeTrackingPage.projects.modal.codePlaceholder')} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
      {mode === 'create' && codeHint && (<p className="tt-tm-hint">
        {t('timeTrackingPage.projects.modal.codeHintPrefix')} <strong>{codeHint}</strong>{' '}
        <button type="button" className="tt-settings__btn tt-settings__btn--link" onClick={() => setForm((f) => ({ ...f, code: codeHint }))}>
          {t('timeTrackingPage.projects.modal.codeHintApply')}
        </button>
      </p>)}
    </div>

    <div className="tt-tm-field-row">
      <div className="tt-tm-field tt-tm-field--cell">
        <label className="tt-tm-label" htmlFor={`${uid}-start`} id={`${uid}-start-lbl`}>
          {t('timeTrackingPage.projects.modal.startDate')}
        </label>
        <DatePicker id={`${uid}-start`} className="tt-tm-dp" buttonClassName="tt-tm-dp__btn" value={form.startDate} onChange={(iso) => setForm((f) => ({ ...f, startDate: iso }))} max={form.endDate || undefined} emptyLabel={t('timeTrackingPage.projects.modal.dateEmpty')} title={t('timeTrackingPage.projects.modal.startDateTitle')} portal portalZIndex={12000} aria-labelledby={`${uid}-start-lbl`} showChevron />
      </div>
      <div className="tt-tm-field tt-tm-field--cell">
        <label className="tt-tm-label" htmlFor={`${uid}-end`} id={`${uid}-end-lbl`}>
          {t('timeTrackingPage.projects.modal.endDate')}
        </label>
        <DatePicker id={`${uid}-end`} className="tt-tm-dp" buttonClassName="tt-tm-dp__btn" value={form.endDate} onChange={(iso) => setForm((f) => ({ ...f, endDate: iso }))} min={form.startDate || undefined} emptyLabel={t('timeTrackingPage.projects.modal.dateEmpty')} title={t('timeTrackingPage.projects.modal.endDateTitle')} portal portalZIndex={12000} aria-labelledby={`${uid}-end-lbl`} showChevron />
      </div>
    </div>

    <div className="tt-tm-field">
      <label className="tt-tm-label" id={`${uid}-cur-lbl`} htmlFor={`${uid}-cur`}>
        {t('timeTrackingPage.projects.modal.currency')}
      </label>
      <SearchableSelect<TmOpt> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId={`${uid}-cur`} value={TIME_TRACKING_PROJECT_CURRENCIES.includes(form.currency as TimeManagerProjectCurrency) ? form.currency : 'USD'} items={CURRENCY_OPTIONS} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={getTmOptSearch} onSelect={(o) => setForm((f) => ({ ...f, currency: o.id }))} placeholder={t('timeTrackingPage.projects.modal.currencyPlaceholder')} emptyListText={t('timeTrackingPage.projects.modal.noCurrencies')} noMatchText={t('timeTrackingPage.common.notFound')} disabled={saving} portalDropdown portalZIndex={TM_DD_PORTAL_Z} portalMinWidth={260} aria-labelledby={`${uid}-cur-lbl`} />
      <p className="tt-tm-hint">{t('timeTrackingPage.projects.modal.currencyHint')}</p>
    </div>

    <div className="tt-tm-field">
      <label className="tt-tm-label" id={`${uid}-ptype-lbl`} htmlFor={`${uid}-ptype`}>
        {t('timeTrackingPage.projects.modal.projectType')}
      </label>
      <SearchableSelect<TmOpt> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId={`${uid}-ptype`} value={form.projectType} items={projectTypeOptions} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={getTmOptSearch} onSelect={(o) => setForm((f) => ({ ...f, projectType: o.id as ProjectFormState['projectType'] }))} placeholder={t('timeTrackingPage.projects.modal.projectTypePlaceholder')} emptyListText={t('timeTrackingPage.projects.modal.noOptions')} noMatchText={t('timeTrackingPage.common.notFound')} disabled={saving} portalDropdown portalZIndex={TM_DD_PORTAL_Z} portalMinWidth={300} aria-labelledby={`${uid}-ptype-lbl`} />
    </div>

    <div className="tt-tm-field">
      <label className="tt-tm-label" id={`${uid}-rlang-lbl`} htmlFor={`${uid}-rlang`}>
        {t('timeTrackingPage.projects.modal.recordsLanguage')}
      </label>
      <SearchableSelect<TmOpt> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId={`${uid}-rlang`} value={form.recordsLanguage} items={recordsLanguageOptions} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={getTmOptSearch} onSelect={(o) => setForm((f) => ({ ...f, recordsLanguage: o.id as TimeManagerProjectRecordsLanguage }))} placeholder={t('timeTrackingPage.projects.modal.recordsLanguagePlaceholder')} emptyListText={t('timeTrackingPage.projects.modal.noOptions')} noMatchText={t('timeTrackingPage.common.notFound')} disabled={saving} portalDropdown portalZIndex={TM_DD_PORTAL_Z} portalMinWidth={280} aria-labelledby={`${uid}-rlang-lbl`} />
      <p className="tt-tm-hint">{t('timeTrackingPage.projects.modal.recordsLanguageHint')}</p>
    </div>

    {isHourPackage ? (<>
      <div className="tt-tm-field">
        <label className="tt-tm-label" htmlFor={`${uid}-pkg-hrs`}>
          {t('timeTrackingPage.projects.modal.packageHours')} <span className="tt-tm-req">*</span>
        </label>
        <input id={`${uid}-pkg-hrs`} className="tt-tm-input" inputMode="decimal" placeholder={t('timeTrackingPage.projects.modal.budgetHoursPlaceholder')} value={form.packageHours} onChange={(e) => setForm((f) => ({ ...f, packageHours: e.target.value }))} disabled={saving} />
      </div>
      <div className="tt-tm-field">
        <label className="tt-tm-label" htmlFor={`${uid}-pkg-fee`}>
          {t('timeTrackingPage.projects.modal.packageFee')} <span className="tt-tm-req">*</span>
        </label>
        <div className="tt-tm-money-input" role="group" aria-label={t('timeTrackingPage.projects.modal.amountGroupAria').replace('{currency}', projectCurrencyCode)}>
          <span className="tt-tm-money-input__symbol" title={projectCurrencyCode} aria-hidden>
            {projectCurrencySymbol(projectCurrencyCode)}
          </span>
          <input id={`${uid}-pkg-fee`} className="tt-tm-input tt-tm-money-input__input" inputMode="decimal" placeholder={t('timeTrackingPage.projects.modal.budgetAmountPlaceholder')} value={form.packageFee} onChange={(e) => setForm((f) => ({ ...f, packageFee: e.target.value }))} disabled={saving} aria-label={t('timeTrackingPage.projects.modal.budgetAmountAria').replace('{currency}', projectCurrencyCode)} />
        </div>
        <p className="tt-tm-hint">{t('timeTrackingPage.projects.modal.packageHint')}</p>
      </div>
    </>) : (<>
    <div className="tt-tm-field">
      <label className="tt-tm-label" id={`${uid}-btype-lbl`} htmlFor={`${uid}-btype`}>
        {t('timeTrackingPage.projects.modal.budget')}
      </label>
      <SearchableSelect<TmOpt> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId={`${uid}-btype`} value={form.budgetType} items={budgetTypeOptions} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={getTmOptSearch} onSelect={(o) => setForm((f) => ({ ...f, budgetType: o.id as ProjectFormState['budgetType'] }))} placeholder={t('timeTrackingPage.projects.modal.budgetModePlaceholder')} emptyListText={t('timeTrackingPage.projects.modal.noOptions')} noMatchText={t('timeTrackingPage.common.notFound')} disabled={saving} portalDropdown portalZIndex={TM_DD_PORTAL_Z} portalMinWidth={300} aria-labelledby={`${uid}-btype-lbl`} />
      <p className="tt-tm-hint">{t('timeTrackingPage.projects.modal.budgetNoHardLimitHint')}</p>
    </div>

    {showProgressBudgetNoHardLimit && (<div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-pbamt-nobudget`}>
        {t('timeTrackingPage.projects.modal.progressAmountOptional')}
      </label>
      <div className="tt-tm-money-input" role="group" aria-label={t('timeTrackingPage.projects.modal.progressAmountGroupAria').replace('{currency}', projectCurrencyCode)}>
        <span className="tt-tm-money-input__symbol" title={projectCurrencyCode} aria-hidden>
          {projectCurrencySymbol(projectCurrencyCode)}
        </span>
        <input id={`${uid}-pbamt-nobudget`} className="tt-tm-input tt-tm-money-input__input" inputMode="decimal" placeholder={t('timeTrackingPage.projects.modal.progressAmountPlaceholder')} value={form.progressBudgetAmount} onChange={(e) => setForm((f) => ({ ...f, progressBudgetAmount: e.target.value }))} aria-label={t('timeTrackingPage.projects.modal.progressAmountAria').replace('{currency}', projectCurrencyCode)} />
      </div>
      <p className="tt-tm-hint">{t('timeTrackingPage.projects.modal.progressAmountHint')}</p>
    </div>)}

    {showBudgetFees && (<div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-bamt`}>
        {form.projectType === 'fixed_fee' ? (<>{t('timeTrackingPage.projects.modal.contractAmount')} <span className="tt-tm-req">*</span></>) : (form.budgetType === 'fees_and_hours' ? t('timeTrackingPage.projects.modal.hardMoneyLimit') : t('timeTrackingPage.projects.modal.hardLimitOrBudget'))}
      </label>
      <div className="tt-tm-money-input" role="group" aria-label={t('timeTrackingPage.projects.modal.amountGroupAria').replace('{currency}', projectCurrencyCode)}>
        <span className="tt-tm-money-input__symbol" title={projectCurrencyCode} aria-hidden>
          {projectCurrencySymbol(projectCurrencyCode)}
        </span>
        <input id={`${uid}-bamt`} className="tt-tm-input tt-tm-money-input__input" inputMode="decimal" placeholder={t('timeTrackingPage.projects.modal.budgetAmountPlaceholder')} value={form.budgetAmount} onChange={(e) => setForm((f) => ({ ...f, budgetAmount: e.target.value }))} aria-label={t('timeTrackingPage.projects.modal.budgetAmountAria').replace('{currency}', projectCurrencyCode)} />
      </div>
    </div>)}

    {(form.projectType === 'time_and_materials' || form.projectType === 'non_billable') && showBudgetFees && (<div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-pbamt`}>
        {t('timeTrackingPage.projects.modal.progressPlanOptional')}
      </label>
      <div className="tt-tm-money-input" role="group" aria-label={t('timeTrackingPage.projects.modal.progressPlanGroupAria').replace('{currency}', projectCurrencyCode)}>
        <span className="tt-tm-money-input__symbol" title={projectCurrencyCode} aria-hidden>
          {projectCurrencySymbol(projectCurrencyCode)}
        </span>
        <input id={`${uid}-pbamt`} className="tt-tm-input tt-tm-money-input__input" inputMode="decimal" placeholder={t('timeTrackingPage.projects.modal.progressPlanPlaceholder')} value={form.progressBudgetAmount} onChange={(e) => setForm((f) => ({ ...f, progressBudgetAmount: e.target.value }))} aria-label={t('timeTrackingPage.projects.modal.progressPlanAria').replace('{currency}', projectCurrencyCode)} />
      </div>
      <p className="tt-tm-hint">{t('timeTrackingPage.projects.modal.progressPlanHint')}</p>
    </div>)}

    {showBudgetHours && (<div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-bhrs`}>
        {form.budgetType === 'fees_and_hours' ? t('timeTrackingPage.projects.modal.hoursLimit') : t('timeTrackingPage.projects.modal.budgetHours')}
      </label>
      <input id={`${uid}-bhrs`} className="tt-tm-input" inputMode="decimal" placeholder={t('timeTrackingPage.projects.modal.budgetHoursPlaceholder')} value={form.budgetHours} onChange={(e) => setForm((f) => ({ ...f, budgetHours: e.target.value }))} />
    </div>)}
    </>)}

    <fieldset className="tt-tm-fieldset tt-tm-fieldset--budget">
      <legend className="tt-tm-fieldset-legend tt-tm-fieldset-legend--budget">{t('timeTrackingPage.projects.modal.budgetParamsLegend')}</legend>
      <div className="tt-tm-fieldset--budget__grid">
        <label className="tt-ios-toggle-row">
          <span className="tt-ios-toggle-row__text">{t('timeTrackingPage.projects.modal.budgetResetMonthly')}</span>
          <span className="tt-ios-toggle">
            <input type="checkbox" className="tt-ios-toggle__input" checked={form.budgetResetsEveryMonth} onChange={(e) => setForm((f) => ({ ...f, budgetResetsEveryMonth: e.target.checked }))} />
            <span className="tt-ios-toggle__slider" aria-hidden />
          </span>
        </label>
        <label className="tt-ios-toggle-row">
          <span className="tt-ios-toggle-row__text">{t('timeTrackingPage.projects.modal.budgetIncludesExpenses')}</span>
          <span className="tt-ios-toggle">
            <input type="checkbox" className="tt-ios-toggle__input" checked={form.budgetIncludesExpenses} onChange={(e) => setForm((f) => ({ ...f, budgetIncludesExpenses: e.target.checked }))} />
            <span className="tt-ios-toggle__slider" aria-hidden />
          </span>
        </label>
        <label className="tt-ios-toggle-row">
          <span className="tt-ios-toggle-row__text">{t('timeTrackingPage.projects.modal.budgetAlerts')}</span>
          <span className="tt-ios-toggle">
            <input type="checkbox" className="tt-ios-toggle__input" checked={form.sendBudgetAlerts} onChange={(e) => setForm((f) => ({ ...f, sendBudgetAlerts: e.target.checked }))} />
            <span className="tt-ios-toggle__slider" aria-hidden />
          </span>
        </label>
      </div>
      {form.sendBudgetAlerts && (<div className="tt-tm-field tt-tm-fieldset--budget__extra">
        <label className="tt-tm-label" htmlFor={`${uid}-thr`}>
          {t('timeTrackingPage.projects.modal.budgetAlertThreshold')}
        </label>
        <input id={`${uid}-thr`} className="tt-tm-input" inputMode="decimal" value={form.budgetAlertThresholdPercent} onChange={(e) => setForm((f) => ({ ...f, budgetAlertThresholdPercent: e.target.value }))} />
      </div>)}
    </fieldset>
    {mode === 'create' && (<fieldset className="tt-tm-fieldset tt-tm-fieldset--budget">
      <legend className="tt-tm-fieldset-legend tt-tm-fieldset-legend--budget">{t('timeTrackingPage.projects.modal.tasksLegend')}</legend>
      <p className="tt-tm-hint">{t('timeTrackingPage.projects.modal.tasksHint')}</p>
      <div className="tt-tm-members__add-row">
        <button type="button" className="tt-settings__btn tt-settings__btn--outline" onClick={openTaskPicker} disabled={saving}>
          {t('timeTrackingPage.projects.modal.tasksButton')}
        </button>
      </div>
      <div className="tt-proj-task-pick__summary">
        <p className="tt-tm-members__add-hint">{t('timeTrackingPage.projects.modal.tasksSelected').replace('{count}', String(initialTaskNames.length))}</p>
        {initialTaskNames.length > 0 && (<button type="button" className="tt-settings__btn tt-settings__btn--link" onClick={() => setTaskSelectionCollapsed((v) => !v)}>
            {taskSelectionCollapsed ? t('timeTrackingPage.projects.modal.tasksExpand') : t('timeTrackingPage.projects.modal.tasksCollapse')}
          </button>)}
      </div>
      {!taskSelectionCollapsed && initialTaskNames.length > 0 && (<div className="tt-tm-members__chips tt-proj-task-pick__chips">
        {initialTaskNames.map((taskName) => (<div key={taskName} className="tt-tm-members__chip tt-proj-task-pick__chip">
          <div className="tt-tm-members__chip-identity">
            <div className="tt-tm-members__chip-text tt-proj-task-pick__chip-text">
              <span className="tt-tm-members__opt-name">{taskName}</span>
              <span className={`tt-task-pill${DEFAULT_PROJECT_TASK_BILLABLE_MAP.get(taskName) ? ' tt-task-pill--billable' : ' tt-task-pill--muted'}`}>
                {DEFAULT_PROJECT_TASK_BILLABLE_MAP.get(taskName) ? t('timeTrackingPage.common.billable') : t('timeTrackingPage.common.nonBillable')}
              </span>
            </div>
          </div>
        </div>))}
      </div>)}
    </fieldset>)}

    {projectTypeUsesBillableRates(form.projectType) && (<div className="tt-tm-field">
      <label className="tt-tm-label" id={`${uid}-brate-lbl`} htmlFor={`${uid}-brate`}>
        {t('timeTrackingPage.projects.modal.billableRateMode')}
      </label>
      <SearchableSelect<TmOpt> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId={`${uid}-brate`} value={form.billableRateType} items={billableRateOptions} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={getTmOptSearch} onSelect={(o) => setForm((f) => ({ ...f, billableRateType: o.id }))} placeholder={t('timeTrackingPage.projects.modal.billableRatePlaceholder')} emptyListText={t('timeTrackingPage.projects.modal.noOptions')} noMatchText={t('timeTrackingPage.common.notFound')} disabled={saving} portalDropdown portalZIndex={TM_DD_PORTAL_Z} portalMinWidth={300} aria-labelledby={`${uid}-brate-lbl`} />
    </div>)}

    {showProjectBillableRate && (<div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-pbrate-amt`} id={`${uid}-pbrate-amt-lbl`}>
        {t('timeTrackingPage.projects.modal.projectHourlyRate')} <span className="tt-tm-req">*</span>
      </label>
      <div className="tt-tm-money-input" role="group" aria-label={t('timeTrackingPage.projects.modal.projectHourlyRateGroupAria').replace('{currency}', projectCurrencyCode)}>
        <span className="tt-tm-money-input__symbol" title={projectCurrencyCode} aria-hidden>
          {projectCurrencySymbol(projectCurrencyCode)}
        </span>
        <input id={`${uid}-pbrate-amt`} className="tt-tm-input tt-tm-money-input__input" inputMode="decimal" placeholder={t('timeTrackingPage.projects.modal.projectHourlyRatePlaceholder')} value={form.projectBillableRateAmount} disabled={saving} onChange={(e) => setForm((f) => ({ ...f, projectBillableRateAmount: e.target.value }))} aria-labelledby={`${uid}-pbrate-amt-lbl`} />
      </div>
      <p className="tt-tm-hint">
        {t('timeTrackingPage.projects.modal.projectHourlyRateHint')}
      </p>
    </div>)}

    {canManage && (mode === 'create' || mode === 'edit') && (<>
      <ProjectMembersField
        assignedIds={assignedUserIds}
        onAssignedChange={handleAssignedChange}
        disabled={saving || editMembersLoading}
        showBillableRate={showMemberBillableRate}
        projectCurrency={(form.currency || 'USD').trim() || 'USD'}
        projectName={(form.name || '').trim()}
        memberRates={memberRates}
        onUpdateMemberRate={(id, d) => setMemberRates((p) => ({ ...p, [id]: d }))}
        allowChangeRateFromDate={mode === 'edit' && showMemberBillableRate && Boolean(initial?.id)}
        onChangeRateFromDate={mode === 'edit' ? (userId, data) => handleMemberChangeRateFrom(userId, data) : undefined}
      />
      {mode === 'create' && (<p className="tt-tm-hint" style={{ marginTop: '-0.25rem' }}>
        {t('timeTrackingPage.projects.modal.membersCreateHint')}
      </p>)}
    </>)}

    <div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-notes`}>
        {t('timeTrackingPage.projects.modal.notes')}
      </label>
      <textarea id={`${uid}-notes`} className="tt-tm-textarea" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
    </div>

  </>);
  const saveDisabled = saving || (mode === 'edit' && editMembersLoading);
  const formFooter = (<div className="tt-tm-modal__foot">
    {error ? (<p className="tt-tm-modal__foot-error" role="alert">{error}</p>) : null}
    <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saveDisabled} onClick={onClose}>
      {t('timeTrackingPage.cancel')}
    </button>
    <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saveDisabled} onClick={() => void handleSubmit()}>
      {saving ? t('timeTrackingPage.saving') : mode === 'edit' && editMembersLoading ? t('timeTrackingPage.common.loading') : mode === 'create' ? t('timeTrackingPage.projects.modal.create') : t('timeTrackingPage.projects.modal.save')}
    </button>
  </div>);
  const taskPickerModal = mode === 'create' && taskPickerOpen
    ? portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--task" role="dialog" aria-modal="true" aria-labelledby={`${uid}-task-pick-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-task-pick-title`} className="tt-tm-modal__title">{t('timeTrackingPage.projects.modal.tasksLegend')}</h2>
          <button type="button" className="tt-tm-modal__close" onClick={() => setTaskPickerOpen(false)} aria-label={t('timeTrackingPage.close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          <div className="tt-proj-task-pick__list">
            {DEFAULT_PROJECT_TASK_SEED.map((task) => (<label key={task.name} className="tt-proj-task-pick__row">
              <span className="tt-proj-task-pick__label">
                {task.name} <span className={`tt-task-pill${task.billableByDefault ? ' tt-task-pill--billable' : ' tt-task-pill--muted'}`}>{task.billableByDefault ? t('timeTrackingPage.common.billable') : t('timeTrackingPage.common.nonBillable')}</span>
              </span>
              <span className="tt-proj-task-pick__switch">
                <input type="checkbox" className="tt-proj-task-pick__switch-input" checked={taskPickerDraft.includes(task.name)} onChange={(e) => toggleTaskInDraft(task.name, e.target.checked)} />
                <span className="tt-proj-task-pick__switch-slider" aria-hidden />
              </span>
            </label>))}
          </div>
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" onClick={() => setTaskPickerOpen(false)}>{t('timeTrackingPage.cancel')}</button>
          <button type="button" className="tt-settings__btn tt-settings__btn--primary" onClick={applyTaskPicker}>{t('timeTrackingPage.save')}</button>
        </div>
      </div>
    </div>)
    : null;
  if (isPage) {
    return (<div className="tt-tm-proj-page">
      <div className="tt-tm-proj-page__card tt-tm-modal tt-tm-modal--project">
        <div className="tt-tm-modal__body" ref={modalBodyRef}>{formBody}</div>
        {formFooter}
      </div>
      {taskPickerModal}
    </div>);
  }
  return (<>
    {portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--project" role="dialog" aria-modal="true" aria-labelledby={`${uid}-proj-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-proj-title`} className="tt-tm-modal__title">
            {mode === 'create' ? t('timeTrackingPage.projects.modal.createTitle') : t('timeTrackingPage.projects.modal.changeTitle')}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body" ref={modalBodyRef}>{formBody}</div>
        {formFooter}
      </div>
    </div>)}
    {taskPickerModal}
  </>);
}
