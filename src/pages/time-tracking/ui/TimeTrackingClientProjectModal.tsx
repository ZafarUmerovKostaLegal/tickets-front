import { useState, useEffect, useId, useMemo, useRef, useCallback } from 'react';
import { DatePicker, SearchableSelect } from '@shared/ui';
import { getUserProjectAccess, listAllClientProjectsForClientMerged, createClientProject, patchClientProject, putUserProjectAccess, listHourlyRates, createHourlyRate, patchHourlyRate, listUsersWithProjectAccessToProject, readTimeManagerProjectBillableRateAmount, TIME_TRACKING_PROJECT_CURRENCIES, type TimeManagerClientRow, type TimeManagerClientProjectRow, type TimeManagerClientProjectCreatePayload, type TimeManagerClientProjectPatchPayload, type TimeManagerProjectCurrency, type HourlyRateRow, } from '@entities/time-tracking';
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

function rowToBudgetFormSlice(row: TimeManagerClientProjectRow): Pick<ProjectFormState, 'budgetType' | 'budgetAmount' | 'budgetHours'> {
  const t = (row.budget_type ?? '').toLowerCase().replace(/-/g, '_');
  const rawA = row.budget_amount;
  const rawH = row.budget_hours;
  const rawFixed = row.fixed_fee_amount;
  const aStr = rawA != null && String(rawA).trim() !== '' ? String(rawA) : '';
  const hStr = rawH != null && String(rawH).trim() !== '' ? String(rawH) : '';
  const a = aStr ? parseFloat(aStr.replace(',', '.')) : NaN;
  const h = hStr ? parseFloat(hStr.replace(',', '.')) : NaN;
  const fromFixed = rawFixed != null && String(rawFixed).trim() !== '' ? String(rawFixed) : '';
  if (t === 'hours_and_money' || t === 'hours_and_fees' || t === 'fees_and_hours')
    return { budgetType: 'fees_and_hours', budgetAmount: aStr, budgetHours: hStr };
  if (t === 'total_project_fees' || t === 'money')
    return { budgetType: 'total_project_fees', budgetAmount: aStr, budgetHours: '' };
  if (t === 'total_project_hours' || t === 'hours')
    return { budgetType: 'total_project_hours', budgetAmount: '', budgetHours: hStr };
  if (Number.isFinite(a) && a > 0 && Number.isFinite(h) && h > 0)
    return { budgetType: 'fees_and_hours', budgetAmount: aStr, budgetHours: hStr };
  if (Number.isFinite(a) && a > 0)
    return { budgetType: 'total_project_fees', budgetAmount: aStr, budgetHours: '' };
  if (Number.isFinite(h) && h > 0)
    return { budgetType: 'total_project_hours', budgetAmount: '', budgetHours: hStr };
  if (row.project_type === 'fixed_fee' && fromFixed)
    return { budgetType: 'total_project_fees', budgetAmount: fromFixed, budgetHours: '' };
  return { budgetType: 'no_budget', budgetAmount: '', budgetHours: '' };
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
function buildCreatePayload(form: ProjectFormState): TimeManagerClientProjectCreatePayload {
  const name = form.name.trim();
  const pt = form.projectType;
  let billableRateType: string | null = null;
  if (pt === 'time_and_materials' || pt === 'fixed_fee') {
    billableRateType = form.billableRateType.trim() || 'person_billable_rate';
  }
  let budgetAmount: string | number | null = null;
  let budgetHours: string | number | null = null;
  if (form.budgetType === 'no_budget') {
    budgetAmount = null;
    budgetHours = null;
  }
  else if (form.budgetType === 'total_project_fees') {
    budgetAmount = parseOptionalDecimal(form.budgetAmount);
    budgetHours = null;
  }
  else if (form.budgetType === 'total_project_hours') {
    budgetAmount = null;
    budgetHours = parseOptionalDecimal(form.budgetHours);
  }
  else if (form.budgetType === 'fees_and_hours') {
    budgetAmount = parseOptionalDecimal(form.budgetAmount);
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
    budgetHours,
    budgetResetsEveryMonth: form.budgetResetsEveryMonth,
    budgetIncludesExpenses: form.budgetIncludesExpenses,
    sendBudgetAlerts: form.sendBudgetAlerts,
    budgetAlertThresholdPercent,
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
  const [form, setForm] = useState<ProjectFormState>(() => initial ? rowToForm(initial) : emptyProjectForm());
  const [pickedClientId, setPickedClientId] = useState(() => {
    if (fixedClientId)
      return fixedClientId;
    return clientsForPicker?.[0]?.id ?? '';
  });
  const [codeHint, setCodeHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
          : undefined));
      })
      .catch(() => {
        if (!cancelled)
          setCodeHint(suggestedNextKlProjectCode(clientNameForCode, [], effectiveClientId
            ? { clientId: effectiveClientId, allClients: clientsForPicker ?? [] }
            : undefined));
      });
    return () => {
      cancelled = true;
    };
  }, [mode, effectiveClientId, clientNameForCode, clientsForPicker]);
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
        window.alert(`Сохранён проект, но доступ сотрудникам выдан не полностью (проверьте ставки в валюте проекта и правило «минимум один партнёр» по должности в справочнике TT):\n\n${failed.join('\n')}`);
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
        window.alert(`Сохранён проект, но не все ставки записаны:\n\n${rateFailed.join('\n')}`);
      }
    }
    setEditMembersBaseline([...assignedUserIds]);
  }
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
        setError('Для фиксированного гонорара укажите сумму контракта в блоке «Бюджет» (лимит по деньгам).');
        return;
      }
    }
    if (form.budgetType === 'fees_and_hours') {
      const ba = parseOptionalDecimal(form.budgetAmount);
      const bh = parseOptionalDecimal(form.budgetHours);
      const na = typeof ba === 'string' ? parseFloat(String(ba).replace(',', '.')) : Number(ba);
      const nh = typeof bh === 'string' ? parseFloat(String(bh).replace(',', '.')) : Number(bh);
      if (!ba || !Number.isFinite(na) || na <= 0) {
        setError('В режиме «Сумма и часы» укажите лимит по деньгам');
        return;
      }
      if (!bh || !Number.isFinite(nh) || nh <= 0) {
        setError('В режиме «Сумма и часы» укажите лимит по часам');
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
    setError(null);
    setSaving(true);
    try {
      const body = buildCreatePayload(form);
      if (mode === 'create') {
        const row = await createClientProject(effectiveClientId, body);
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
      <p className="tt-tm-hint">Лимиты бюджета (деньги) и сумма фикс-контракта — в валюте проекта.</p>
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
    </div>

    {showBudgetFees && (<div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-bamt`}>
        {form.projectType === 'fixed_fee' ? (<>Сумма контракта <span className="tt-tm-req">*</span></>) : (form.budgetType === 'fees_and_hours' ? 'Лимит по деньгам' : 'Сумма бюджета')}
      </label>
      <div className="tt-tm-money-input" role="group" aria-label={`Сумма в ${projectCurrencyCode}`}>
        <span className="tt-tm-money-input__symbol" title={projectCurrencyCode} aria-hidden>
          {projectCurrencySymbol(projectCurrencyCode)}
        </span>
        <input id={`${uid}-bamt`} className="tt-tm-input tt-tm-money-input__input" inputMode="decimal" placeholder="напр. 50000" value={form.budgetAmount} onChange={(e) => setForm((f) => ({ ...f, budgetAmount: e.target.value }))} aria-label={`Сумма бюджета, ${projectCurrencyCode}`} />
      </div>
    </div>)}

    {showBudgetHours && (<div className="tt-tm-field">
      <label className="tt-tm-label" htmlFor={`${uid}-bhrs`}>
        {form.budgetType === 'fees_and_hours' ? 'Лимит по часам' : 'Часы бюджета'}
      </label>
      <input id={`${uid}-bhrs`} className="tt-tm-input" inputMode="decimal" placeholder="напр. 500" value={form.budgetHours} onChange={(e) => setForm((f) => ({ ...f, budgetHours: e.target.value }))} />
    </div>)}

    <fieldset className="tt-tm-fieldset">
      <legend className="tt-tm-fieldset-legend">Параметры бюджета</legend>
      <label className="tt-tm-check-row">
        <input type="checkbox" checked={form.budgetResetsEveryMonth} onChange={(e) => setForm((f) => ({ ...f, budgetResetsEveryMonth: e.target.checked }))} />
        <span>Сбрасывать бюджет каждый месяц</span>
      </label>
      <label className="tt-tm-check-row">
        <input type="checkbox" checked={form.budgetIncludesExpenses} onChange={(e) => setForm((f) => ({ ...f, budgetIncludesExpenses: e.target.checked }))} />
        <span>В бюджет входят расходы</span>
      </label>
      <label className="tt-tm-check-row">
        <input type="checkbox" checked={form.sendBudgetAlerts} onChange={(e) => setForm((f) => ({ ...f, sendBudgetAlerts: e.target.checked }))} />
        <span>Уведомления о превышении бюджета</span>
      </label>
      {form.sendBudgetAlerts && (<div className="tt-tm-field" style={{ marginTop: '0.5rem' }}>
        <label className="tt-tm-label" htmlFor={`${uid}-thr`}>
          Порог уведомления, %
        </label>
        <input id={`${uid}-thr`} className="tt-tm-input" inputMode="decimal" value={form.budgetAlertThresholdPercent} onChange={(e) => setForm((f) => ({ ...f, budgetAlertThresholdPercent: e.target.value }))} />
      </div>)}
    </fieldset>

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

    {canManage && (mode === 'create' || mode === 'edit') && (<ProjectMembersField assignedIds={assignedUserIds} onAssignedChange={handleAssignedChange} disabled={saving || editMembersLoading} showBillableRate={showMemberBillableRate} projectCurrency={(form.currency || 'USD').trim() || 'USD'} memberRates={memberRates} onUpdateMemberRate={(id, d) => setMemberRates((p) => ({ ...p, [id]: d }))} />)}

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
  if (isPage) {
    return (<div className="tt-tm-proj-page">
      <div className="tt-tm-proj-page__card tt-tm-modal tt-tm-modal--project">
        <div className="tt-tm-modal__body">{formBody}</div>
        {formFooter}
      </div>
    </div>);
  }
  return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation" onClick={onClose}>
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
  </div>);
}
