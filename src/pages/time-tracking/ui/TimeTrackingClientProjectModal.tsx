import { useState, useEffect, useId, useMemo, useRef, useCallback } from 'react';
import { DatePicker, SearchableSelect, useAppDialog } from '@shared/ui';
import { getUserProjectAccess, listAllClientProjectsForClientMerged, createClientProject, patchClientProject, putUserProjectAccess, listHourlyRates, createHourlyRate, patchHourlyRate, listUsersWithProjectAccessToProject, createProjectTask, readTimeManagerProjectBillableRateAmount, TIME_TRACKING_PROJECT_CURRENCIES, type TimeManagerClientRow, type TimeManagerClientProjectRow, type TimeManagerClientProjectCreatePayload, type TimeManagerClientProjectPatchPayload, type TimeManagerProjectCurrency, type HourlyRateRow, } from '@entities/time-tracking';
import { suggestedNextKlProjectCode } from '@entities/time-tracking/lib/klProjectCode';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
import { QuickCreateClientModal } from './QuickCreateClientModal';
import { ProjectMembersField, type ProjectMemberRateDraft } from './ProjectMembersField';
import { clientRowSearchText } from '../lib/clientRowSearchText';

const TM_DD_PORTAL_Z = 12000;


function hourlyRateEffectiveOnDate(r: HourlyRateRow, when: Date): boolean {
  const d0 = (s: string | null | undefined) => (s && String(s).trim() ? String(s).slice(0, 10) : null);
  const today = when.toISOString().slice(0, 10);
  const from = d0(r.valid_from);
  const to = d0(r.valid_to);
  if (from && today < from)
    return false;
  if (to && today > to)
    return false;
  return true;
}

function pickDefaultUserBillableFromSettings(rows: HourlyRateRow[], projectCurrency: string): HourlyRateRow | null {
  const global = rows.filter((r) => {
    const pid = r.project_id ?? r.projectId ?? null;
    return pid == null || String(pid).trim() === '';
  });
  if (global.length === 0)
    return null;
  const now = new Date();
  let pool = global.filter((r) => hourlyRateEffectiveOnDate(r, now));
  if (pool.length === 0)
    pool = global;
  const cur = (projectCurrency || 'USD').trim().toUpperCase();
  const curMatch = pool.filter((r) => (r.currency || '').trim().toUpperCase() === cur);
  const candidates = (curMatch.length > 0 ? curMatch : pool).slice();
  candidates.sort((a, b) => {
    const af = a.valid_from ? String(a.valid_from) : '';
    const bf = b.valid_from ? String(b.valid_from) : '';
    return bf.localeCompare(af);
  });
  return candidates[0] ?? null;
}
function parseMemberAmount(raw: string): number {
  const t = raw.trim().replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}
type TmOpt = { id: string; label: string; search?: string };

const CURRENCY_OPTIONS: TmOpt[] = TIME_TRACKING_PROJECT_CURRENCIES.map((c) => ({ id: c, label: c, search: c }));
const PROJECT_TYPE_OPTIONS: TmOpt[] = [
  { id: 'time_and_materials', label: 'Время и материалы (T&M)', search: 'время материалы T&M tm' },
  { id: 'fixed_fee', label: 'Фиксированный гонорар', search: 'фикс гонорар' },
  { id: 'non_billable', label: 'Не оплачиваемый', search: 'не оплачиваемый' },
];
const BILLABLE_RATE_OPTIONS: TmOpt[] = [
  { id: 'person_billable_rate', label: 'Почасовая ставка сотрудника', search: 'почасовая сотрудник' },
  { id: 'project_billable_rate', label: 'Ставка проекта', search: 'проект' },
];
const BUDGET_TYPE_OPTIONS: TmOpt[] = [
  { id: 'no_budget', label: 'Без бюджета', search: 'нет' },
  { id: 'total_project_fees', label: 'Только деньги', search: 'сумма деньги' },
  { id: 'total_project_hours', label: 'Только часы', search: 'часы лимит' },
  { id: 'fees_and_hours', label: 'Сумма и часы (пакет)', search: 'пакет деньги часы' },
];
const DEFAULT_PROJECT_TASK_SEED: Array<{ name: string; billableByDefault: boolean }> = [
  { name: 'Court Hearing', billableByDefault: true },
  { name: 'Court Hearing Preparation', billableByDefault: true },
  { name: 'Document Review', billableByDefault: true },
  { name: 'Document Submission', billableByDefault: true },
  { name: 'Drafting', billableByDefault: true },
  { name: 'Drafting Documents', billableByDefault: true },
  { name: 'Emails', billableByDefault: true },
  { name: 'Meetings', billableByDefault: true },
  { name: 'My mehnat registration', billableByDefault: true },
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

  if (row.project_type === 'fixed_fee') {
    if (Number.isFinite(a) && a > 0)
      return { budgetType: 'total_project_fees', budgetAmount: aStr, budgetHours: '', progressBudgetAmount: '' };
    if (fromFixed)
      return { budgetType: 'total_project_fees', budgetAmount: fromFixed, budgetHours: '', progressBudgetAmount: '' };
    return { budgetType: 'no_budget', budgetAmount: '', budgetHours: '', progressBudgetAmount: '' };
  }

  if (t === 'hours_and_money' || t === 'hours_and_fees' || t === 'fees_and_hours')
    return { budgetType: 'fees_and_hours', budgetAmount: aStr, progressBudgetAmount: pStr, budgetHours: hStr };
  if (t === 'total_project_fees' || t === 'money')
    return { budgetType: 'total_project_fees', budgetAmount: aStr, budgetHours: '', progressBudgetAmount: pStr };
  if (t === 'total_project_hours' || t === 'hours')
    return { budgetType: 'total_project_hours', budgetAmount: '', progressBudgetAmount: '', budgetHours: hStr };
  if (t === 'no_budget' || t === 'none')
    return { budgetType: 'no_budget', budgetAmount: aStr, budgetHours: hStr, progressBudgetAmount: pStr };

  const hasHours = Number.isFinite(h) && h > 0;
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
  projectType: 'time_and_materials' | 'fixed_fee' | 'non_billable';
  billableRateType: string;
  
  projectBillableRateAmount: string;
  budgetType: 'no_budget' | 'total_project_fees' | 'total_project_hours' | 'fees_and_hours';
  budgetAmount: string;
  progressBudgetAmount: string;
  budgetHours: string;
  budgetResetsEveryMonth: boolean;
  budgetIncludesExpenses: boolean;
  sendBudgetAlerts: boolean;
  budgetAlertThresholdPercent: string;
};
function emptyProjectForm(): ProjectFormState {
  return {
    name: '',
    code: '',
    currency: 'USD',
    startDate: '',
    endDate: '',
    notes: '',
    projectType: 'time_and_materials',
    billableRateType: 'person_billable_rate',
    projectBillableRateAmount: '',
    budgetType: 'no_budget',
    budgetAmount: '',
    progressBudgetAmount: '',
    budgetHours: '',
    budgetResetsEveryMonth: false,
    budgetIncludesExpenses: false,
    sendBudgetAlerts: false,
    budgetAlertThresholdPercent: '70',
  };
}
function rowToForm(row: TimeManagerClientProjectRow): ProjectFormState {
  const cur = (row.currency ?? 'USD').trim() || 'USD';
  return {
    name: row.name,
    code: row.code ?? '',
    currency: TIME_TRACKING_PROJECT_CURRENCIES.includes(cur as TimeManagerProjectCurrency) ? cur : 'USD',
    startDate: (row.start_date ?? '').slice(0, 10),
    endDate: (row.end_date ?? '').slice(0, 10),
    notes: row.notes ?? '',
    projectType: row.project_type === 'fixed_fee' || row.project_type === 'non_billable'
      ? row.project_type
      : 'time_and_materials',
    billableRateType: row.billable_rate_type ?? 'person_billable_rate',
    projectBillableRateAmount: readTimeManagerProjectBillableRateAmount(row),
    ...rowToBudgetFormSlice(row),
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
function buildCreatePayload(form: ProjectFormState, initialTimeTrackingUserAuthIds?: number[]): TimeManagerClientProjectCreatePayload {
  const name = form.name.trim();
  const pt = form.projectType;
  let billableRateType: string | null = null;
  if (pt === 'time_and_materials' || pt === 'fixed_fee') {
    billableRateType = form.billableRateType.trim() || 'person_billable_rate';
  }
  let budgetAmount: string | number | null = null;
  let progressBudgetAmount: string | number | null = null;
  let budgetHours: string | number | null = null;
  if (form.budgetType === 'no_budget') {
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
  if (pt === 'time_and_materials' || pt === 'fixed_fee') {
    if ((form.billableRateType || '').trim() === 'project_billable_rate')
      projectBillableRateAmount = parseOptionalDecimal(form.projectBillableRateAmount);
    else
      projectBillableRateAmount = null;
  }
  const ids = (initialTimeTrackingUserAuthIds ?? []).filter((n) => Number.isFinite(n) && n > 0);
  const uniqueIds = [...new Set(ids)];
  return {
    name,
    code: form.code.trim() || null,
    currency: (form.currency.trim() || 'USD') as TimeManagerProjectCurrency,
    startDate: form.startDate.trim() || null,
    endDate: form.endDate.trim() || null,
    notes: form.notes.trim() || null,
    reportVisibility: 'managers_only',
    projectType: pt,
    billableRateType,
    projectBillableRateAmount,
    budgetAmount,
    progressBudgetAmount,
    budgetHours,
    budgetResetsEveryMonth: form.budgetResetsEveryMonth,
    budgetIncludesExpenses: form.budgetIncludesExpenses,
    sendBudgetAlerts: form.sendBudgetAlerts,
    budgetAlertThresholdPercent,
    ...(uniqueIds.length > 0 ? { initialTimeTrackingUserAuthIds: uniqueIds } : {}),
  };
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
  const { showAlert } = useAppDialog();
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
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>([]);
  const [memberRates, setMemberRates] = useState<Record<number, ProjectMemberRateDraft>>({});
  const [editMembersBaseline, setEditMembersBaseline] = useState<number[]>([]);
  const [editMembersLoading, setEditMembersLoading] = useState(false);
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
  const showMemberBillableRate = useMemo(() => (form.projectType === 'time_and_materials' || form.projectType === 'fixed_fee') && form.billableRateType === 'person_billable_rate', [form.projectType, form.billableRateType]);
  const showProjectBillableRate = useMemo(() => (form.projectType === 'time_and_materials' || form.projectType === 'fixed_fee') && form.billableRateType === 'project_billable_rate', [form.projectType, form.billableRateType]);
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
        for (const authUserId of added) {
          void (async () => {
            try {
              const rows = await listHourlyRates(authUserId, 'billable');
              if (!assignedUserIdsRef.current.includes(authUserId))
                return;
              const row = pickDefaultUserBillableFromSettings(rows, cur0);
              if (!row)
                return;
              const amt = typeof row.amount === 'number' ? row.amount : parseFloat(String(row.amount));
              if (!Number.isFinite(amt) || amt <= 0)
                return;
              setMemberRates((p) => {
                if (!assignedUserIdsRef.current.includes(authUserId))
                  return p;
                return {
                  ...p,
                  [authUserId]: {
                    amount: String(amt),
                    currency: (row.currency || cur0).trim() || cur0,
                  },
                };
              });
            }
            catch {
            }
          })();
        }
      }
      return next;
    });
  }, [showMemberBillableRate, form.currency]);
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
        const ids = team.map((m) => Number(m.userId)).filter((n) => Number.isFinite(n));
        setAssignedUserIds(ids);
        setEditMembersBaseline([...ids]);
        const usePersonRate = (initial.project_type === 'time_and_materials' || initial.project_type === 'fixed_fee') && (initial.billable_rate_type ?? 'person_billable_rate') === 'person_billable_rate';
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
          const pidStr = String(initial.id);
          const byProject = rows.find((r) => {
            const pid = r.project_id ?? r.projectId ?? null;
            return pid != null && String(pid) === pidStr;
          });
          if (byProject) {
            const amt = typeof byProject.amount === 'number' ? byProject.amount : parseFloat(String(byProject.amount));
            out[id] = {
              amount: Number.isFinite(amt) ? String(amt) : '',
              currency: byProject.currency || cur0,
              rateId: byProject.id,
            };
          }
          else {
            const def = pickDefaultUserBillableFromSettings(rows, cur0);
            if (def) {
              const amt = typeof def.amount === 'number' ? def.amount : parseFloat(String(def.amount));
              out[id] = {
                amount: Number.isFinite(amt) ? String(amt) : '',
                currency: (def.currency || cur0).trim() || cur0,
              };
            }
            else {
              out[id] = { amount: '', currency: cur0 };
            }
          }
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
  }, [mode, initial?.id, canManage]);
  async function applyProjectMemberAccessAndRates(projectId: string) {
    const useRates = (form.projectType === 'time_and_materials' || form.projectType === 'fixed_fee') && form.billableRateType === 'person_billable_rate';
    const removed = editMembersBaseline.filter((id) => !assignedUserIds.includes(id));
    for (const authUserId of removed) {
      const { projectIds } = await getUserProjectAccess(authUserId);
      await putUserProjectAccess(authUserId, projectIds.filter((p) => p !== projectId));
    }
    if (assignedUserIds.length > 0) {
      const results = await Promise.allSettled(assignedUserIds.map(async (authUserId) => {
        const { projectIds } = await getUserProjectAccess(authUserId);
        await putUserProjectAccess(authUserId, [...new Set([...projectIds, projectId])]);
      }));
      const failed: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          const authUserId = assignedUserIds[i];
          const msg = r.reason instanceof Error ? r.reason.message : 'ошибка';
          failed.push(`Пользователь #${authUserId}: ${msg}`);
        }
      });
      if (failed.length > 0) {
        await showAlert({
          title: 'Проект сохранён частично',
          message: `Доступ сотрудникам выдан не полностью (проверьте ставки в валюте проекта и правило «минимум один партнёр» по должности в справочнике TT):\n\n${failed.join('\n')}`,
        });
      }
    }
    if (useRates && assignedUserIds.length > 0) {
      const rateFailed: string[] = [];
      for (const authUserId of assignedUserIds) {
        const dr = memberRates[authUserId];
        if (!dr)
          continue;
        const n = parseMemberAmount(dr.amount);
        if (!Number.isFinite(n) || n <= 0)
          continue;
        const cur = (dr.currency || form.currency || 'USD').trim() || 'USD';
        try {
          if (dr.rateId) {
            await patchHourlyRate(authUserId, dr.rateId, { amount: String(n), currency: cur });
          }
          else {
            const created = await createHourlyRate(authUserId, { rateKind: 'billable', amount: String(n), currency: cur, validFrom: null, validTo: null, projectId });
            setMemberRates((prev) => ({
              ...prev,
              [authUserId]: { ...dr, amount: String(n), currency: cur, rateId: created.id },
            }));
          }
        }
        catch (e) {
          const msg = e instanceof Error ? e.message : 'ошибка';
          rateFailed.push(`Пользователь #${authUserId}: ${msg}`);
        }
      }
      if (rateFailed.length > 0) {
        await showAlert({
          title: 'Проект сохранён частично',
          message: `Не все ставки записаны:\n\n${rateFailed.join('\n')}`,
        });
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
    if (mode === 'create' && !effectiveClientId) {
      setError('Выберите клиента');
      return;
    }
    const name = form.name.trim();
    if (!name) {
      setError('Укажите название проекта');
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError('Дата окончания не может быть раньше даты начала');
      return;
    }
    if (form.projectType === 'fixed_fee') {
      const ba = parseOptionalDecimal(form.budgetAmount);
      const n = typeof ba === 'string' ? parseFloat(ba.replace(',', '.')) : Number(ba);
      const hasMoney = form.budgetType === 'total_project_fees' || form.budgetType === 'fees_and_hours';
      if (!hasMoney || !Number.isFinite(n) || n <= 0) {
        setError('Для фиксированного гонорара укажите сумму контракта (поле «Сумма контракта» / лимит по деньгам) — на сервер уходит как budgetAmount.');
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
        setError('Укажите жёсткий денежный лимит или плановый бюджет для прогресса (поле ниже), либо оба.');
        return;
      }
    }
    if (form.budgetType === 'fees_and_hours') {
      const ba = parseOptionalDecimal(form.budgetAmount);
      const pb = parseOptionalDecimal(form.progressBudgetAmount);
      const bh = parseOptionalDecimal(form.budgetHours);
      const na = typeof ba === 'string' ? parseFloat(String(ba).replace(',', '.')) : Number(ba);
      const np = typeof pb === 'string' ? parseFloat(String(pb).replace(',', '.')) : Number(pb);
      const nh = typeof bh === 'string' ? parseFloat(String(bh).replace(',', '.')) : Number(bh);
      if (!bh || !Number.isFinite(nh) || nh <= 0) {
        setError('В режиме «Сумма и часы» укажите лимит по часам');
        return;
      }
      const moneyOk = (Number.isFinite(na) && na > 0) || (Number.isFinite(np) && np > 0);
      if (!moneyOk) {
        setError('В режиме «Сумма и часы» укажите жёсткий лимит по деньгам или плановый бюджет для прогресса');
        return;
      }
    }
    const useProjectRate = (form.projectType === 'time_and_materials' || form.projectType === 'fixed_fee') && form.billableRateType === 'project_billable_rate';
    if (useProjectRate) {
      const pa = parseOptionalDecimal(form.projectBillableRateAmount);
      const pn = typeof pa === 'string' ? parseFloat(pa.replace(',', '.')) : Number(pa);
      if (!pa || !Number.isFinite(pn) || pn <= 0) {
        setError('Укажите положительную оплачиваемую почасовую ставку по проекту (тип «Ставка проекта»).');
        return;
      }
    }
    const useRates = (form.projectType === 'time_and_materials' || form.projectType === 'fixed_fee') && form.billableRateType === 'person_billable_rate';
    if (useRates && assignedUserIds.length > 0) {
      for (const uid of assignedUserIds) {
        const dr = memberRates[uid];
        const n = dr ? parseMemberAmount(dr.amount) : NaN;
        if (!Number.isFinite(n) || n <= 0) {
          setError('Укажите положительную оплачиваемую почасовую ставку у каждого участника (тип «почасовая ставка сотрудника»).');
          return;
        }
      }
    }
    const normalizedInitialTaskNames = mode === 'create'
      ? normalizeInitialTaskNames(initialTaskNames)
      : [];
    setError(null);
    setSaving(true);
    try {
      const body = mode === 'create'
        ? buildCreatePayload(form, assignedUserIds)
        : buildCreatePayload(form);
      if (mode === 'create') {
        const row = await createClientProject(effectiveClientId, body);
        if (normalizedInitialTaskNames.length > 0) {
          const taskResults = await Promise.allSettled(normalizedInitialTaskNames.map((taskName) => createProjectTask(effectiveClientId, row.id, {
            name: taskName,
            billableByDefault: true,
          })));
          const failed = taskResults
            .map((result, index) => ({ result, name: normalizedInitialTaskNames[index] }))
            .filter((x): x is {
            result: PromiseRejectedResult;
            name: string;
          } => x.result.status === 'rejected')
            .map((x) => `${x.name}: ${x.result.reason instanceof Error ? x.result.reason.message : 'ошибка'}`);
          if (failed.length > 0) {
            await showAlert({
              title: 'Проект создан частично',
              message: `Часть задач не удалось добавить:\n\n${failed.join('\n')}`,
            });
          }
        }
        if (canManage)
          await applyProjectMemberAccessAndRates(row.id);
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
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    }
    finally {
      setSaving(false);
    }
  };
  const showBudgetFees = form.budgetType === 'total_project_fees' || form.budgetType === 'fees_and_hours';
  const showBudgetHours = form.budgetType === 'total_project_hours' || form.budgetType === 'fees_and_hours';
  const showProgressBudgetNoHardLimit = form.budgetType === 'no_budget' && (form.projectType === 'time_and_materials' || form.projectType === 'non_billable');
  const projectCurrencyCode = TIME_TRACKING_PROJECT_CURRENCIES.includes(form.currency as TimeManagerProjectCurrency) ? String(form.currency) : 'USD';
  const isPage = presentation === 'page' && mode === 'create';
  const formBody = (<>
    {showClientBlock && hasClientsInPicker && (<div className="tt-tm-field">
      <div className="tt-tm-field-row tt-tm-field-row--client-pick">
        <div className="tt-tm-field tt-tm-field--grow">
          <label className="tt-tm-label" id={`${uid}-client-lbl`} htmlFor={`${uid}-client-pick`}>
            Клиент <span className="tt-tm-req">*</span>
          </label>
          <SearchableSelect<TimeManagerClientRow> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId={`${uid}-client-pick`} value={pickedClientId} items={clientsForPicker!} getOptionValue={(c) => c.id} getOptionLabel={(c) => c.name} getSearchText={clientRowSearchText} onSelect={(c) => setPickedClientId(c.id)} placeholder="Найдите или выберите клиента…" emptyListText="Нет клиентов" noMatchText="Клиент не найден" disabled={saving} portalDropdown portalZIndex={TM_DD_PORTAL_Z} portalMinWidth={320} portalDropdownClassName="tsp-srch__dropdown--tall" aria-labelledby={`${uid}-client-lbl`} renderOption={(c) => (<span className="tt-tm-dd__opt">
            <span className="tt-tm-dd__opt-name">{c.name}</span>
            {c.address ? (<span className="tt-tm-dd__opt-sub">{c.address}</span>) : c.email ? (<span className="tt-tm-dd__opt-sub">{c.email}</span>) : null}
          </span>)} />
        </div>
        <div className="tt-tm-field tt-tm-field--shrink">
          <span className="tt-tm-label tt-tm-label--invisible" aria-hidden>
            {'\u00a0'}
          </span>
          <button type="button" className="tt-settings__btn tt-settings__btn--outline" disabled={!canManage} title={!canManage ? 'Недостаточно прав' : undefined} onClick={() => setQuickClientOpen(true)}>
            Новый клиент
          </button>
        </div>
      </div>
    </div>)}
    {showClientBlock && !hasClientsInPicker && (<div className="tt-tm-field">
      <span className="tt-tm-label">Клиент <span className="tt-tm-req">*</span></span>
      <p className="tt-tm-hint" style={{ margin: '0 0 0.5rem' }}>
        В справочнике ещё нет клиентов. Добавьте — достаточно названия; реквизиты можно ввести позже.
      </p>
      <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={!canManage} title={!canManage ? 'Недостаточно прав' : undefined} onClick={() => setQuickClientOpen(true)}>
        Добавить клиента
      </button>
    </div>)}
    {quickClientOpen && (<QuickCreateClientModal canManage={canManage} onClose={() => setQuickClientOpen(false)} onCreated={handleQuickClientCreated} />)}

    <div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-name`}>
        Название проекта <span className="tt-tm-req">*</span>
      </label>
      <input id={`${uid}-name`} className="tt-tm-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
    </div>

    <div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-code`}>
        Код проекта
      </label>
      <input id={`${uid}-code`} className="tt-tm-input" placeholder="напр. KL-ACME-01/02" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
      {mode === 'create' && codeHint && (<p className="tt-tm-hint">
        Подсказка: <strong>{codeHint}</strong>{' '}
        <button type="button" className="tt-settings__btn tt-settings__btn--link" onClick={() => setForm((f) => ({ ...f, code: codeHint }))}>
          Подставить
        </button>
      </p>)}
    </div>

    <div className="tt-tm-field-row">
      <div className="tt-tm-field tt-tm-field--cell">
        <label className="tt-tm-label" htmlFor={`${uid}-start`} id={`${uid}-start-lbl`}>
          Начало
        </label>
        <DatePicker id={`${uid}-start`} className="tt-tm-dp" buttonClassName="tt-tm-dp__btn" value={form.startDate} onChange={(iso) => setForm((f) => ({ ...f, startDate: iso }))} max={form.endDate || undefined} emptyLabel="ДД.ММ.ГГГГ" title="Начало проекта" portal portalZIndex={12000} aria-labelledby={`${uid}-start-lbl`} showChevron />
      </div>
      <div className="tt-tm-field tt-tm-field--cell">
        <label className="tt-tm-label" htmlFor={`${uid}-end`} id={`${uid}-end-lbl`}>
          Окончание
        </label>
        <DatePicker id={`${uid}-end`} className="tt-tm-dp" buttonClassName="tt-tm-dp__btn" value={form.endDate} onChange={(iso) => setForm((f) => ({ ...f, endDate: iso }))} min={form.startDate || undefined} emptyLabel="ДД.ММ.ГГГГ" title="Окончание проекта" portal portalZIndex={12000} aria-labelledby={`${uid}-end-lbl`} showChevron />
      </div>
    </div>

    <div className="tt-tm-field">
      <label className="tt-tm-label" id={`${uid}-cur-lbl`} htmlFor={`${uid}-cur`}>
        Валюта проекта
      </label>
      <SearchableSelect<TmOpt> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId={`${uid}-cur`} value={TIME_TRACKING_PROJECT_CURRENCIES.includes(form.currency as TimeManagerProjectCurrency) ? form.currency : 'USD'} items={CURRENCY_OPTIONS} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={getTmOptSearch} onSelect={(o) => setForm((f) => ({ ...f, currency: o.id }))} placeholder="Валюта…" emptyListText="Нет валют" noMatchText="Не найдено" disabled={saving} portalDropdown portalZIndex={TM_DD_PORTAL_Z} portalMinWidth={260} aria-labelledby={`${uid}-cur-lbl`} />
      <p className="tt-tm-hint">Лимиты бюджета (деньги) и фикс-контракт — в валюте проекта (USD, UZS, EUR, RUB, GBP). Тип бюджета на сервере выставляется автоматически.</p>
    </div>

    <div className="tt-tm-field">
      <label className="tt-tm-label" id={`${uid}-ptype-lbl`} htmlFor={`${uid}-ptype`}>
        Тип проекта
      </label>
      <SearchableSelect<TmOpt> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId={`${uid}-ptype`} value={form.projectType} items={PROJECT_TYPE_OPTIONS} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={getTmOptSearch} onSelect={(o) => setForm((f) => ({ ...f, projectType: o.id as ProjectFormState['projectType'] }))} placeholder="Тип проекта…" emptyListText="Нет вариантов" noMatchText="Не найдено" disabled={saving} portalDropdown portalZIndex={TM_DD_PORTAL_Z} portalMinWidth={300} aria-labelledby={`${uid}-ptype-lbl`} />
    </div>

    <div className="tt-tm-field">
      <label className="tt-tm-label" id={`${uid}-btype-lbl`} htmlFor={`${uid}-btype`}>
        Бюджет
      </label>
      <SearchableSelect<TmOpt> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId={`${uid}-btype`} value={form.budgetType} items={BUDGET_TYPE_OPTIONS} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={getTmOptSearch} onSelect={(o) => setForm((f) => ({ ...f, budgetType: o.id as ProjectFormState['budgetType'] }))} placeholder="Режим бюджета…" emptyListText="Нет вариантов" noMatchText="Не найдено" disabled={saving} portalDropdown portalZIndex={TM_DD_PORTAL_Z} portalMinWidth={300} aria-labelledby={`${uid}-btype-lbl`} />
      <p className="tt-tm-hint">При «Без бюджета» можно указать необязательную сумму ниже — только для отслеживания прогресса (progressBudgetAmount), без жёсткого лимита.</p>
    </div>

    {showProgressBudgetNoHardLimit && (<div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-pbamt-nobudget`}>
        Сумма для отслеживания прогресса (необязательно)
      </label>
      <div className="tt-tm-money-input" role="group" aria-label={`Ориентир прогресса, ${projectCurrencyCode}`}>
        <span className="tt-tm-money-input__symbol" title={projectCurrencyCode} aria-hidden>
          {projectCurrencySymbol(projectCurrencyCode)}
        </span>
        <input id={`${uid}-pbamt-nobudget`} className="tt-tm-input tt-tm-money-input__input" inputMode="decimal" placeholder="оставьте пустым, если не нужно" value={form.progressBudgetAmount} onChange={(e) => setForm((f) => ({ ...f, progressBudgetAmount: e.target.value }))} aria-label={`Сумма для прогресса без лимита, ${projectCurrencyCode}`} />
      </div>
      <p className="tt-tm-hint">Не создаёт жёсткий лимит по проекту; используется в дашборде и отчётах для визуального контроля расхода относительно суммы.</p>
    </div>)}

    {showBudgetFees && (<div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-bamt`}>
        {form.projectType === 'fixed_fee' ? (<>Сумма контракта <span className="tt-tm-req">*</span></>) : (form.budgetType === 'fees_and_hours' ? 'Жёсткий лимит по деньгам' : 'Жёсткий лимит / сумма бюджета')}
      </label>
      <div className="tt-tm-money-input" role="group" aria-label={`Сумма в ${projectCurrencyCode}`}>
        <span className="tt-tm-money-input__symbol" title={projectCurrencyCode} aria-hidden>
          {projectCurrencySymbol(projectCurrencyCode)}
        </span>
        <input id={`${uid}-bamt`} className="tt-tm-input tt-tm-money-input__input" inputMode="decimal" placeholder="напр. 50000" value={form.budgetAmount} onChange={(e) => setForm((f) => ({ ...f, budgetAmount: e.target.value }))} aria-label={`Сумма бюджета, ${projectCurrencyCode}`} />
      </div>
    </div>)}

    {(form.projectType === 'time_and_materials' || form.projectType === 'non_billable') && showBudgetFees && (<div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-pbamt`}>
        План для прогресса (деньги), необязательно
      </label>
      <div className="tt-tm-money-input" role="group" aria-label={`План прогресса, ${projectCurrencyCode}`}>
        <span className="tt-tm-money-input__symbol" title={projectCurrencyCode} aria-hidden>
          {projectCurrencySymbol(projectCurrencyCode)}
        </span>
        <input id={`${uid}-pbamt`} className="tt-tm-input tt-tm-money-input__input" inputMode="decimal" placeholder="если жёсткий лимит не нужен" value={form.progressBudgetAmount} onChange={(e) => setForm((f) => ({ ...f, progressBudgetAmount: e.target.value }))} aria-label={`Плановый бюджет для прогресса, ${projectCurrencyCode}`} />
      </div>
      <p className="tt-tm-hint">Дополнительно к жёсткому лимиту выше: сохраняется как progressBudgetAmount и учитывается, если основной лимит по деньгам не задан.</p>
    </div>)}

    {showBudgetHours && (<div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-bhrs`}>
        {form.budgetType === 'fees_and_hours' ? 'Лимит по часам' : 'Часы бюджета'}
      </label>
      <input id={`${uid}-bhrs`} className="tt-tm-input" inputMode="decimal" placeholder="напр. 500" value={form.budgetHours} onChange={(e) => setForm((f) => ({ ...f, budgetHours: e.target.value }))} />
    </div>)}

    <fieldset className="tt-tm-fieldset tt-tm-fieldset--budget">
      <legend className="tt-tm-fieldset-legend tt-tm-fieldset-legend--budget">Параметры бюджета</legend>
      <div className="tt-tm-fieldset--budget__grid">
        <label className="tt-tm-check-row">
          <input type="checkbox" checked={form.budgetResetsEveryMonth} onChange={(e) => setForm((f) => ({ ...f, budgetResetsEveryMonth: e.target.checked }))} />
          <span>Сбрасывать бюджет каждый месяц</span>
        </label>
        <label className="tt-tm-check-row">
          <input type="checkbox" checked={form.budgetIncludesExpenses} onChange={(e) => setForm((f) => ({ ...f, budgetIncludesExpenses: e.target.checked }))} />
          <span>В бюджет входят расходы</span>
        </label>
        <label className="tt-tm-check-row tt-tm-fieldset--budget__check-wide">
          <input type="checkbox" checked={form.sendBudgetAlerts} onChange={(e) => setForm((f) => ({ ...f, sendBudgetAlerts: e.target.checked }))} />
          <span>Уведомления о превышении бюджета</span>
        </label>
      </div>
      {form.sendBudgetAlerts && (<div className="tt-tm-field tt-tm-fieldset--budget__extra">
        <label className="tt-tm-label" htmlFor={`${uid}-thr`}>
          Порог уведомления, %
        </label>
        <input id={`${uid}-thr`} className="tt-tm-input" inputMode="decimal" value={form.budgetAlertThresholdPercent} onChange={(e) => setForm((f) => ({ ...f, budgetAlertThresholdPercent: e.target.value }))} />
      </div>)}
    </fieldset>
    {mode === 'create' && (<fieldset className="tt-tm-fieldset tt-tm-fieldset--budget">
      <legend className="tt-tm-fieldset-legend tt-tm-fieldset-legend--budget">Задачи проекта</legend>
      <p className="tt-tm-hint">Откройте список задач и снимите галочки с тех, которые не нужны в проекте.</p>
      <div className="tt-tm-members__add-row">
        <button type="button" className="tt-settings__btn tt-settings__btn--outline" onClick={openTaskPicker} disabled={saving}>
          Задачи
        </button>
      </div>
      <p className="tt-tm-members__add-hint">Выбрано задач: {initialTaskNames.length}</p>
      {initialTaskNames.length > 0 && (<div className="tt-tm-members__chips tt-proj-task-pick__chips">
        {initialTaskNames.map((taskName) => (<div key={taskName} className="tt-tm-members__chip tt-proj-task-pick__chip">
          <div className="tt-tm-members__chip-identity">
            <div className="tt-tm-members__chip-text tt-proj-task-pick__chip-text">
              <span className="tt-tm-members__opt-name">{taskName}</span>
              <span className={`tt-task-pill${DEFAULT_PROJECT_TASK_BILLABLE_MAP.get(taskName) ? ' tt-task-pill--billable' : ' tt-task-pill--muted'}`}>
                {DEFAULT_PROJECT_TASK_BILLABLE_MAP.get(taskName) ? 'Оплачиваемая' : 'Неоплачиваемая'}
              </span>
            </div>
          </div>
        </div>))}
      </div>)}
    </fieldset>)}

    {(form.projectType === 'time_and_materials' || form.projectType === 'fixed_fee') && (<div className="tt-tm-field">
      <label className="tt-tm-label" id={`${uid}-brate-lbl`} htmlFor={`${uid}-brate`}>
        Тип ставок
      </label>
      <SearchableSelect<TmOpt> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId={`${uid}-brate`} value={form.billableRateType} items={BILLABLE_RATE_OPTIONS} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={getTmOptSearch} onSelect={(o) => setForm((f) => ({ ...f, billableRateType: o.id }))} placeholder="Тип ставок…" emptyListText="Нет вариантов" noMatchText="Не найдено" disabled={saving} portalDropdown portalZIndex={TM_DD_PORTAL_Z} portalMinWidth={300} aria-labelledby={`${uid}-brate-lbl`} />
    </div>)}

    {showProjectBillableRate && (<div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-pbrate-amt`} id={`${uid}-pbrate-amt-lbl`}>
        Ставка за час (по проекту) <span className="tt-tm-req">*</span>
      </label>
      <div className="tt-tm-money-input" role="group" aria-label={`Ставка за час, ${projectCurrencyCode}`}>
        <span className="tt-tm-money-input__symbol" title={projectCurrencyCode} aria-hidden>
          {projectCurrencySymbol(projectCurrencyCode)}
        </span>
        <input id={`${uid}-pbrate-amt`} className="tt-tm-input tt-tm-money-input__input" inputMode="decimal" placeholder="напр. 100.00" value={form.projectBillableRateAmount} disabled={saving} onChange={(e) => setForm((f) => ({ ...f, projectBillableRateAmount: e.target.value }))} aria-labelledby={`${uid}-pbrate-amt-lbl`} />
      </div>
      <p className="tt-tm-hint">
        Одна оплачиваемая почасовая ставка на весь проект в валюте проекта; копируется на участников с доступом.
      </p>
    </div>)}

    {canManage && (mode === 'create' || mode === 'edit') && (<>
      <ProjectMembersField assignedIds={assignedUserIds} onAssignedChange={handleAssignedChange} disabled={saving || editMembersLoading} showBillableRate={showMemberBillableRate} projectCurrency={(form.currency || 'USD').trim() || 'USD'} memberRates={memberRates} onUpdateMemberRate={(id, d) => setMemberRates((p) => ({ ...p, [id]: d }))} />
      {mode === 'create' && (<p className="tt-tm-hint" style={{ marginTop: '-0.25rem' }}>
        Участники, выбранные до нажатия «Создать», сразу получают доступ к проекту на сервере; при необходимости профиль подтягивается из auth тем же запросом (нужна авторизация на gateway).
      </p>)}
    </>)}

    <div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-notes`}>
        Заметки
      </label>
      <textarea id={`${uid}-notes`} className="tt-tm-textarea" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
    </div>

    {error && (<p className="tt-tm-field-error" role="alert">
      {error}
    </p>)}
  </>);
  const formFooter = (<div className="tt-tm-modal__foot">
    <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>
      Отмена
    </button>
    <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving} onClick={() => void handleSubmit()}>
      {saving ? 'Сохранение…' : mode === 'create' ? 'Создать' : 'Сохранить'}
    </button>
  </div>);
  const taskPickerModal = mode === 'create' && taskPickerOpen
    ? portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--task" role="dialog" aria-modal="true" aria-labelledby={`${uid}-task-pick-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-task-pick-title`} className="tt-tm-modal__title">Задачи проекта</h2>
          <button type="button" className="tt-tm-modal__close" onClick={() => setTaskPickerOpen(false)} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          <div className="tt-proj-task-pick__list">
            {DEFAULT_PROJECT_TASK_SEED.map((task) => (<label key={task.name} className="tt-tm-check-row">
              <input type="checkbox" checked={taskPickerDraft.includes(task.name)} onChange={(e) => toggleTaskInDraft(task.name, e.target.checked)} />
              <span>{task.name} <span className={`tt-task-pill${task.billableByDefault ? ' tt-task-pill--billable' : ' tt-task-pill--muted'}`}>{task.billableByDefault ? 'Оплачиваемая' : 'Неоплачиваемая'}</span></span>
            </label>))}
          </div>
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" onClick={() => setTaskPickerOpen(false)}>Отмена</button>
          <button type="button" className="tt-settings__btn tt-settings__btn--primary" onClick={applyTaskPicker}>Сохранить</button>
        </div>
      </div>
    </div>)
    : null;
  if (isPage) {
    return (<div className="tt-tm-proj-page">
      <div className="tt-tm-proj-page__card tt-tm-modal tt-tm-modal--project">
        <div className="tt-tm-modal__body">{formBody}</div>
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
            {mode === 'create' ? 'Новый проект' : 'Изменить проект'}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">{formBody}</div>
        {formFooter}
      </div>
    </div>)}
    {taskPickerModal}
  </>);
}
