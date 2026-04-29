import { useState, useMemo, useEffect, useRef, useCallback, useId, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatedLink } from '@shared/ui';
import { listTimeManagerClients, listClientProjects, getTimeManagerClient, createTimeManagerClient, patchTimeManagerClient, deleteTimeManagerClient, createClientContact, patchClientContact, deleteClientContact, isForbiddenError, TIME_TRACKING_PROJECT_CURRENCIES, type TimeManagerClientRow, type TimeManagerClientContactRow, type TimeManagerClientProjectRow, } from '@entities/time-tracking';
import { TIME_TRACKING_LIST_PAGE_SIZE } from '@entities/time-tracking/model/timeTrackingListPageSize';
import { Pagination } from '@shared/ui/Pagination';
import { SearchableSelect } from '@shared/ui';
import { clientRowSearchText } from '@pages/time-tracking/lib/clientRowSearchText';
import { useCurrentUser } from '@shared/hooks';
import { getProjectDetailUrl } from '@shared/config';
import { formatDateRu } from '@shared/lib/formatDate';
import { mapClientProjectToProjectRow } from '@entities/time-tracking/model/mapClientProjectToProjectRow';
import type { ProjectRow, ProjectStatus, ProjectType } from '@entities/time-tracking/model/types';
import { canManageTimeManagerClients } from '@entities/time-tracking/model/timeManagerClientsAccess';
import { ClientProjectModal } from './TimeTrackingClientProjectModal';
import { QuickCreateClientModal } from './QuickCreateClientModal';
import { ProjectsTableSkeleton } from './ProjectsSkeleton';
import { AddClientContactForClientModal } from './AddClientContactForClientModal';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
const CURRENCIES = TIME_TRACKING_PROJECT_CURRENCIES;
const TT_MODAL_DD_Z = 12000;
const TYPE_COLOR: Record<ProjectType, {
    color: string;
    bg: string;
}> = {
    'Время и материалы': { color: '#4f46e5', bg: 'rgba(37,99,235,0.08)' },
    'Фиксированная ставка': { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
    'Без бюджета': { color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
};
const STATUS_DOT: Record<ProjectStatus, string> = {
    active: '#22c55e',
    paused: '#f59e0b',
    archived: '#94a3b8',
};
function fmtAmt(n: number, cur = 'UZS') {
    return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${cur}`;
}
function fmtGroupSpentByCurrency(projects: ProjectRow[]): string {
    const m = new Map<string, number>();
    for (const p of projects) {
        const c = (p.currency || 'USD').trim() || 'USD';
        const add = Number.isFinite(p.spent) ? p.spent : 0;
        m.set(c, (m.get(c) ?? 0) + add);
    }
    if (m.size === 0)
        return '—';
    const parts = [...m.entries()].sort(([a], [b]) => {
        const rank = (x: string) => (x === 'USD' ? 0 : x === 'UZS' ? 1 : 2);
        return rank(a) - rank(b) || a.localeCompare(b, 'en');
    });
    return parts.map(([cur, sum]) => fmtAmt(sum, cur)).join(' · ');
}
function remainingPct(budget: number, spent: number) {
    return Math.round(((budget - spent) / budget) * 100);
}
function spentPct(budget: number, spent: number) {
    return Math.min((spent / budget) * 100, 100);
}
function BudgetBar({ budget, spent }: {
    budget: number;
    spent: number;
}) {
    const over = spent > budget;
    const bluePct = over ? 100 : spentPct(budget, spent);
    const redPct = over ? Math.min(((spent - budget) / budget) * 80, 45) : 0;
    return (<div className="pp__bar-wrap" title={`Потрачено: ${fmtAmt(spent)} / Бюджет: ${fmtAmt(budget)}`}>
      <div className="pp__bar">
        <div className="pp__bar-fill pp__bar-fill--blue" style={{ width: `${bluePct}%` }}/>
        {over && <div className="pp__bar-fill pp__bar-fill--red" style={{ width: `${redPct}%` }}/>}
      </div>
    </div>);
}
function pluralProjectsRu(n: number): string {
    if (n === 0)
        return 'нет проектов';
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11)
        return `${n} проект`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
        return `${n} проекта`;
    return `${n} проектов`;
}
const IcoSearch = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>);
const IcoChevron = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 9l6 6 6-6"/>
  </svg>);
const IcoChevronPp = ({ cls = '' }: {
    cls?: string;
}) => (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6"/>
  </svg>);
const IcoPlus = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>);
const IcoFolder = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>);
const IcoCheck = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>);
function telHref(raw: string): string | null {
    const t = raw.trim();
    if (!t)
        return null;
    const compact = t.startsWith('+')
        ? `+${t.slice(1).replace(/\D/g, '')}`
        : t.replace(/\D/g, '');
    if (!compact || compact === '+')
        return null;
    return `tel:${compact}`;
}
function ContactPhoneEmailMeta({ phone, email, }: {
    phone: string | null | undefined;
    email: string | null | undefined;
}): ReactNode {
    const p = phone?.trim() ?? '';
    const e = email?.trim() ?? '';
    if (!p && !e)
        return null;
    const tel = p ? telHref(p) : null;
    const mail = e ? `mailto:${encodeURIComponent(e)}` : null;
    return (<span className="tt-tm-contact-list__meta">
      {p ? (tel ? (<a href={tel} className="tt-tm-contact-link">
            {p}
          </a>) : (<span>{p}</span>)) : null}
      {p && e ? ' · ' : null}
      {e && mail ? (<a href={mail} className="tt-tm-contact-link">
          {e}
        </a>) : null}
    </span>);
}
function pctToInput(v: string | number | null | undefined): string {
    if (v == null || v === '')
        return '';
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? String(n) : '';
}
function parseOptionalPercent(s: string): {
    ok: true;
    value: number | null;
} | {
    ok: false;
    message: string;
} {
    const t = s.trim();
    if (!t)
        return { ok: true, value: null };
    const n = parseFloat(t.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
        return { ok: false, message: 'Проценты должны быть числом от 0 до 100' };
    }
    return { ok: true, value: n };
}
type FormState = {
    name: string;
    address: string;
    currency: string;
    invoiceDueMode: string;
    invoiceDueDaysAfterIssue: string;
    taxPercent: string;
    tax2Percent: string;
    discountPercent: string;
    phone: string;
    email: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    isArchived: boolean;
};
function emptyForm(): FormState {
    return {
        name: '',
        address: '',
        currency: 'USD',
        invoiceDueMode: 'custom',
        invoiceDueDaysAfterIssue: '15',
        taxPercent: '',
        tax2Percent: '',
        discountPercent: '',
        phone: '',
        email: '',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        isArchived: false,
    };
}
function rowToForm(c: TimeManagerClientRow): FormState {
    return {
        name: c.name,
        address: c.address ?? '',
        currency: c.currency || 'USD',
        invoiceDueMode: c.invoice_due_mode || 'custom',
        invoiceDueDaysAfterIssue: c.invoice_due_days_after_issue != null ? String(c.invoice_due_days_after_issue) : '',
        taxPercent: pctToInput(c.tax_percent),
        tax2Percent: pctToInput(c.tax2_percent),
        discountPercent: pctToInput(c.discount_percent),
        phone: c.phone ?? '',
        email: c.email ?? '',
        contactName: c.contact_name ?? '',
        contactPhone: c.contact_phone ?? '',
        contactEmail: c.contact_email ?? '',
        isArchived: Boolean(c.is_archived),
    };
}
function formatInvoiceDueLabel(c: TimeManagerClientRow): string {
    const mode = c.invoice_due_mode || 'custom';
    const days = c.invoice_due_days_after_issue;
    if (mode === 'custom' && days != null)
        return `После даты счёта · ${days} дн.`;
    if (days != null)
        return `${mode} · ${days} дн.`;
    return mode === 'custom' ? 'После даты счёта' : mode;
}
function formatPercentDisplay(v: string | number | null | undefined): string {
    if (v == null || v === '')
        return '';
    return pctToInput(v);
}
function ViewReadonlyField({ label, value }: {
    label: string;
    value: string;
}) {
    const show = value.trim() !== '';
    return (<div className="tt-tm-view-field">
      <div className="tt-tm-view-field__label">{label}</div>
      <div className={`tt-tm-view-field__value${show ? '' : ' tt-tm-view-field__value--empty'}`}>
        {show ? value : '—'}
      </div>
    </div>);
}
function formatClientMeta(c: TimeManagerClientRow): string {
    const parts: string[] = [];
    if (c.is_archived)
        parts.push('архив');
    parts.push(c.currency);
    const t1 = pctToInput(c.tax_percent);
    if (t1)
        parts.push(`налог ${t1}%`);
    const t2 = pctToInput(c.tax2_percent);
    if (t2)
        parts.push(`налог 2: ${t2}%`);
    const d = pctToInput(c.discount_percent);
    if (d)
        parts.push(`скидка ${d}%`);
    if (c.invoice_due_mode === 'custom' && c.invoice_due_days_after_issue != null) {
        parts.push(`оплата через ${c.invoice_due_days_after_issue} дн.`);
    }
    else if (c.invoice_due_days_after_issue != null) {
        parts.push(`оплата: ${c.invoice_due_mode}, ${c.invoice_due_days_after_issue} дн.`);
    }
    return parts.join(' · ');
}
type ClientViewModalProps = {
    listRow: TimeManagerClientRow;
    canManage: boolean;
    onClose: () => void;
    onEdit: (detail: TimeManagerClientRow) => void;
};
function ClientViewModal({ listRow, canManage, onClose, onEdit }: ClientViewModalProps) {
    const uid = useId();
    const [detail, setDetail] = useState<TimeManagerClientRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        void getTimeManagerClient(listRow.id)
            .then((row) => {
            if (!cancelled)
                setDetail(row);
        })
            .catch((e) => {
            if (!cancelled)
                setError(e instanceof Error ? e.message : 'Не удалось загрузить карточку');
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [listRow.id]);
    const c = detail ?? listRow;
    const extras = c.extra_contacts ?? [];
    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation" onClick={onClose}>
      <div className="tt-tm-modal tt-tm-modal--client tt-tm-modal--client-view" role="dialog" aria-modal="true" aria-labelledby={`${uid}-view-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-view-title`} className="tt-tm-modal__title">
            Сведения о клиенте
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          {loading && (<p className="tt-tm-hint" role="status">
              Загрузка карточки…
            </p>)}
          {error && (<p className="tt-tm-field-error" role="alert">
              {error}
            </p>)}
          {!loading && !error && c.is_archived && (<p className="tt-tm-archived-banner" role="status">
              Клиент в архиве.
            </p>)}
          <ViewReadonlyField label="Название" value={c.name}/>
          <ViewReadonlyField label="Адрес" value={c.address ?? ''}/>

          <fieldset className="tt-tm-fieldset tt-tm-fieldset--view">
            <legend className="tt-tm-fieldset-legend">Организация</legend>
            <div className="tt-tm-view-grid">
              <ViewReadonlyField label="Телефон" value={c.phone ?? ''}/>
              <ViewReadonlyField label="Email" value={c.email ?? ''}/>
            </div>
          </fieldset>

          <fieldset className="tt-tm-fieldset tt-tm-fieldset--view">
            <legend className="tt-tm-fieldset-legend">Основной контакт</legend>
            <ViewReadonlyField label="ФИО / должность" value={c.contact_name ?? ''}/>
            <div className="tt-tm-view-grid">
              <ViewReadonlyField label="Телефон" value={c.contact_phone ?? ''}/>
              <ViewReadonlyField label="Email" value={c.contact_email ?? ''}/>
            </div>
          </fieldset>

          <fieldset className="tt-tm-fieldset tt-tm-fieldset--view">
            <legend className="tt-tm-fieldset-legend">Биллинг</legend>
            <div className="tt-tm-view-grid tt-tm-view-grid--3">
              <ViewReadonlyField label="Валюта счёта" value={c.currency || 'USD'}/>
              <ViewReadonlyField label="Срок оплаты" value={formatInvoiceDueLabel(c)}/>
              <ViewReadonlyField label="Налог, %" value={formatPercentDisplay(c.tax_percent)}/>
              <ViewReadonlyField label="Второй налог, %" value={formatPercentDisplay(c.tax2_percent)}/>
              <ViewReadonlyField label="Скидка, %" value={formatPercentDisplay(c.discount_percent)}/>
            </div>
          </fieldset>

          <fieldset className="tt-tm-fieldset tt-tm-fieldset--view">
            <legend className="tt-tm-fieldset-legend">Дополнительные контакты</legend>
            {extras.length === 0 ? (<p className="tt-tm-hint tt-tm-hint--inline">Нет дополнительных контактов.</p>) : (<ul className="tt-tm-contact-list tt-tm-contact-list--view">
                {extras.map((x) => (<li key={x.id} className="tt-tm-contact-list__item tt-tm-contact-list__item--view">
                    <div className="tt-tm-contact-list__main">
                      <span className="tt-tm-contact-list__name">{x.name}</span>
                      <ContactPhoneEmailMeta phone={x.phone} email={x.email}/>
                    </div>
                  </li>))}
              </ul>)}
          </fieldset>

          {c.created_at && (<p className="tt-tm-view-meta">
              Создан: {formatDateRu(c.created_at)}
              {c.updated_at ? ` · Обновлён: ${formatDateRu(c.updated_at)}` : ''}
            </p>)}
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" onClick={onClose}>
            Закрыть
          </button>
          {canManage && !loading && (<button type="button" className="tt-settings__btn tt-settings__btn--primary" onClick={() => onEdit(detail ?? listRow)}>
              Редактировать
            </button>)}
        </div>
      </div>
    </div>);
}
type ClientModalProps = {
    mode: 'create' | 'edit';
    initial: TimeManagerClientRow | null;
    canManage: boolean;
    onClose: () => void;
    onSaved: (row: TimeManagerClientRow) => void;
};
function TimeManagerClientModal({ mode, initial, canManage, onClose, onSaved }: ClientModalProps) {
    const uid = useId();
    const [form, setForm] = useState<FormState>(() => (initial ? rowToForm(initial) : emptyForm()));
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [extraContacts, setExtraContacts] = useState<TimeManagerClientContactRow[]>([]);
    const [contactsError, setContactsError] = useState<string | null>(null);
    const [contactBusy, setContactBusy] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editEmail, setEditEmail] = useState('');
    useEffect(() => {
        if (mode !== 'edit' || !initial?.id) {
            setDetailLoading(false);
            setExtraContacts([]);
            setForm(mode === 'create' ? emptyForm() : initial ? rowToForm(initial) : emptyForm());
            return;
        }
        let cancelled = false;
        setDetailLoading(true);
        setContactsError(null);
        void getTimeManagerClient(initial.id)
            .then((row) => {
            if (cancelled)
                return;
            setForm(rowToForm(row));
            setExtraContacts(row.extra_contacts ?? []);
        })
            .catch((e) => {
            if (!cancelled) {
                setError(e instanceof Error ? e.message : 'Не удалось загрузить карточку клиента');
                setExtraContacts([]);
            }
        })
            .finally(() => {
            if (!cancelled)
                setDetailLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [mode, initial?.id]);
    const clientId = mode === 'edit' && initial?.id ? initial.id : null;
    const archivedLocked = Boolean(form.isArchived && canManage);
    const refreshContactsFromServer = useCallback(async () => {
        if (!clientId)
            return;
        try {
            const row = await getTimeManagerClient(clientId);
            setExtraContacts(row.extra_contacts ?? []);
        }
        catch {
        }
    }, [clientId]);
    const handleSubmit = async () => {
        const name = form.name.trim();
        if (!name) {
            setError('Укажите название клиента');
            return;
        }
        const daysRaw = form.invoiceDueDaysAfterIssue.trim();
        let days: number | null = null;
        if (daysRaw) {
            const d = parseInt(daysRaw, 10);
            if (Number.isNaN(d) || d < 0 || d > 3650) {
                setError('Срок оплаты (дни): целое число от 0 до 3650');
                return;
            }
            days = d;
        }
        const tp = parseOptionalPercent(form.taxPercent);
        const t2 = parseOptionalPercent(form.tax2Percent);
        const dp = parseOptionalPercent(form.discountPercent);
        if (!tp.ok) {
            setError(tp.message);
            return;
        }
        if (!t2.ok) {
            setError(t2.message);
            return;
        }
        if (!dp.ok) {
            setError(dp.message);
            return;
        }
        setError(null);
        setSaving(true);
        const payloadCommon = {
            name,
            address: form.address.trim() || null,
            currency: form.currency.trim() || 'USD',
            invoiceDueMode: form.invoiceDueMode.trim() || 'custom',
            invoiceDueDaysAfterIssue: days,
            taxPercent: tp.value,
            tax2Percent: t2.value,
            discountPercent: dp.value,
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            contactName: form.contactName.trim() || null,
            contactPhone: form.contactPhone.trim() || null,
            contactEmail: form.contactEmail.trim() || null,
            isArchived: form.isArchived,
        };
        try {
            if (mode === 'create') {
                const row = await createTimeManagerClient(payloadCommon);
                onSaved(row);
            }
            else if (initial) {
                const row = await patchTimeManagerClient(initial.id, payloadCommon);
                setExtraContacts(row.extra_contacts ?? extraContacts);
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
    const startEditContact = (c: TimeManagerClientContactRow) => {
        setEditingId(c.id);
        setEditName(c.name);
        setEditPhone(c.phone ?? '');
        setEditEmail(c.email ?? '');
        setContactsError(null);
    };
    const cancelEditContact = () => {
        setEditingId(null);
        setEditName('');
        setEditPhone('');
        setEditEmail('');
    };
    const saveEditContact = async () => {
        if (!clientId || !editingId || !canManage)
            return;
        const name = editName.trim();
        if (!name) {
            setContactsError('Укажите имя контакта');
            return;
        }
        setContactsError(null);
        setContactBusy(true);
        try {
            const updated = await patchClientContact(clientId, editingId, {
                name,
                phone: editPhone.trim() || null,
                email: editEmail.trim() || null,
            });
            setExtraContacts((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
            cancelEditContact();
            void refreshContactsFromServer();
        }
        catch (e) {
            setContactsError(e instanceof Error ? e.message : 'Не удалось сохранить контакт');
        }
        finally {
            setContactBusy(false);
        }
    };
    const handleAddContact = async () => {
        if (!clientId || !canManage || archivedLocked)
            return;
        const name = newName.trim();
        if (!name) {
            setContactsError('Укажите имя дополнительного контакта');
            return;
        }
        setContactsError(null);
        setContactBusy(true);
        try {
            const row = await createClientContact(clientId, {
                name,
                phone: newPhone.trim() || null,
                email: newEmail.trim() || null,
            });
            setExtraContacts((prev) => [...prev, row]);
            setNewName('');
            setNewPhone('');
            setNewEmail('');
            void refreshContactsFromServer();
        }
        catch (e) {
            setContactsError(e instanceof Error ? e.message : 'Не удалось добавить контакт');
        }
        finally {
            setContactBusy(false);
        }
    };
    const handleDeleteContact = async (contactId: string, contactName: string) => {
        if (!clientId || !canManage || archivedLocked)
            return;
        if (!window.confirm(`Удалить контакт «${contactName}»?`))
            return;
        setContactsError(null);
        setContactBusy(true);
        try {
            await deleteClientContact(clientId, contactId);
            setExtraContacts((prev) => prev.filter((x) => x.id !== contactId));
            void refreshContactsFromServer();
        }
        catch (e) {
            setContactsError(e instanceof Error ? e.message : 'Не удалось удалить контакт');
        }
        finally {
            setContactBusy(false);
        }
    };
    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation" onClick={onClose}>
      <div className="tt-tm-modal tt-tm-modal--client" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-title`} className="tt-tm-modal__title">
            {mode === 'create' ? 'Новый клиент' : 'Редактировать клиента'}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          {detailLoading && mode === 'edit' && (<p className="tt-tm-hint" role="status">
              Загрузка карточки клиента…
            </p>)}
          {form.isArchived && mode === 'edit' && (<p className="tt-tm-archived-banner" role="status">
              Клиент в архиве: добавление и изменение дополнительных контактов недоступны, пока не снимете архив. Реквизиты и
              основной контакт на карточке можно править; для проектов и задач сначала разархивируйте клиента.
            </p>)}
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-name`}>
              Название клиента <span className="tt-tm-req">*</span>
            </label>
            <input id={`${uid}-name`} className="tt-tm-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoComplete="organization"/>
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-addr`}>
              Адрес
            </label>
            <textarea id={`${uid}-addr`} className="tt-tm-textarea" rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}/>
          </div>

          <fieldset className="tt-tm-fieldset">
            <legend className="tt-tm-fieldset-legend">Организация</legend>
            <div className="tt-tm-field-row tt-tm-field-row--grid-3">
              <div className="tt-tm-field tt-tm-field--cell">
                <label className="tt-tm-label" htmlFor={`${uid}-org-phone`}>
                  Телефон
                </label>
                <input id={`${uid}-org-phone`} className="tt-tm-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} autoComplete="tel"/>
              </div>
              <div className="tt-tm-field tt-tm-field--cell" style={{ gridColumn: 'span 2' }}>
                <label className="tt-tm-label" htmlFor={`${uid}-org-email`}>
                  Email
                </label>
                <input id={`${uid}-org-email`} type="email" className="tt-tm-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} autoComplete="email"/>
              </div>
            </div>
          </fieldset>

          <fieldset className="tt-tm-fieldset">
            <legend className="tt-tm-fieldset-legend">Основной контакт</legend>
            <div className="tt-tm-field">
              <label className="tt-tm-label" htmlFor={`${uid}-cname`}>
                ФИО / должность контакта
              </label>
              <input id={`${uid}-cname`} className="tt-tm-input" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}/>
            </div>
            <div className="tt-tm-field-row tt-tm-field-row--grid-3">
              <div className="tt-tm-field tt-tm-field--cell">
                <label className="tt-tm-label" htmlFor={`${uid}-cphone`}>
                  Телефон контакта
                </label>
                <input id={`${uid}-cphone`} className="tt-tm-input" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} autoComplete="tel"/>
              </div>
              <div className="tt-tm-field tt-tm-field--cell" style={{ gridColumn: 'span 2' }}>
                <label className="tt-tm-label" htmlFor={`${uid}-cemail`}>
                  Email контакта
                </label>
                <input id={`${uid}-cemail`} type="email" className="tt-tm-input" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} autoComplete="email"/>
              </div>
            </div>
          </fieldset>

          <div className="tt-tm-field-row tt-tm-field-row--grid-3" role="group" aria-label="Валюта и срок оплаты">
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-cur`}>
                Валюта счёта
              </label>
              <select id={`${uid}-cur`} className="tt-tm-select" value={CURRENCIES.includes(form.currency as (typeof CURRENCIES)[number]) ? form.currency : 'USD'} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map((c) => (<option key={c} value={c}>
                    {c}
                  </option>))}
              </select>
            </div>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-mode`}>
                Срок оплаты
              </label>
              <select id={`${uid}-mode`} className="tt-tm-select" value={form.invoiceDueMode} onChange={(e) => setForm((f) => ({ ...f, invoiceDueMode: e.target.value }))} title="Режим invoiceDueMode: custom — N дней после даты счёта">
                <option value="custom">После даты счёта</option>
              </select>
            </div>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-days`} title="Число дней после выставления счёта">
                Дней после счёта
              </label>
              <input id={`${uid}-days`} type="number" min={0} max={3650} className="tt-tm-input" placeholder="15" value={form.invoiceDueDaysAfterIssue} onChange={(e) => setForm((f) => ({ ...f, invoiceDueDaysAfterIssue: e.target.value }))}/>
            </div>
          </div>
          <div className="tt-tm-field-row tt-tm-field-row--grid-3" role="group" aria-label="Налоги и скидка">
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-tax`}>
                Налог, %
              </label>
              <input id={`${uid}-tax`} type="text" inputMode="decimal" className="tt-tm-input" placeholder="напр. 12" value={form.taxPercent} onChange={(e) => setForm((f) => ({ ...f, taxPercent: e.target.value }))}/>
            </div>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-tax2`}>
                Второй налог, %
              </label>
              <input id={`${uid}-tax2`} type="text" inputMode="decimal" className="tt-tm-input" placeholder="необязательно" value={form.tax2Percent} onChange={(e) => setForm((f) => ({ ...f, tax2Percent: e.target.value }))}/>
            </div>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-disc`}>
                Скидка, %
              </label>
              <input id={`${uid}-disc`} type="text" inputMode="decimal" className="tt-tm-input" placeholder="напр. 5" value={form.discountPercent} onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}/>
            </div>
          </div>

          <label className="tt-tm-check-row">
            <input type="checkbox" checked={form.isArchived} onChange={(e) => setForm((f) => ({ ...f, isArchived: e.target.checked }))}/>
            <span>Клиент в архиве (скрыт из основного списка; вложенные сущности нельзя менять, пока архив не снят)</span>
          </label>

          {mode === 'edit' && clientId && (<fieldset className="tt-tm-fieldset">
              <legend className="tt-tm-fieldset-legend">Дополнительные контакты</legend>
              {!canManage && (<p className="tt-tm-hint">Недостаточно прав для изменения контактов.</p>)}
              {archivedLocked && canManage && (<p className="tt-tm-hint">Снимите архив с клиента, чтобы редактировать список.</p>)}
              {contactsError && (<p className="tt-tm-field-error" role="alert">
                  {contactsError}
                </p>)}
              <ul className="tt-tm-contact-list">
                {extraContacts.map((c) => (<li key={c.id} className="tt-tm-contact-list__item">
                    {editingId === c.id ? (<div className="tt-tm-contact-edit">
                        <input className="tt-tm-input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Имя *" aria-label="Имя контакта"/>
                        <input className="tt-tm-input" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Телефон" aria-label="Телефон"/>
                        <input className="tt-tm-input" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" aria-label="Email"/>
                        <div className="tt-tm-contact-edit__actions">
                          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={contactBusy} onClick={cancelEditContact}>
                            Отмена
                          </button>
                          <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={contactBusy} onClick={() => void saveEditContact()}>
                            Сохранить
                          </button>
                        </div>
                      </div>) : (<>
                        <div className="tt-tm-contact-list__main">
                          <span className="tt-tm-contact-list__name">{c.name}</span>
                          <ContactPhoneEmailMeta phone={c.phone} email={c.email}/>
                        </div>
                        {canManage && !archivedLocked && (<div className="tt-tm-contact-list__actions">
                            <button type="button" className="tt-settings__btn tt-settings__btn--outline" disabled={contactBusy || Boolean(editingId)} onClick={() => startEditContact(c)}>
                              Изменить
                            </button>
                            <button type="button" className="tt-settings__btn tt-settings__btn--outline tt-settings__row-edit--danger" disabled={contactBusy || Boolean(editingId)} onClick={() => void handleDeleteContact(c.id, c.name)}>
                              Удалить
                            </button>
                          </div>)}
                      </>)}
                  </li>))}
              </ul>
              {canManage && !archivedLocked && (<div className="tt-tm-contact-add">
                  <span className="tt-tm-label">Новый контакт</span>
                  <div className="tt-tm-contact-add__row">
                    <input className="tt-tm-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Имя *" aria-label="Имя нового контакта"/>
                    <input className="tt-tm-input" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Телефон"/>
                    <input className="tt-tm-input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email"/>
                  </div>
                  <button type="button" className="tt-settings__btn tt-settings__btn--outline tt-settings__btn--accent-text" disabled={contactBusy || detailLoading || !clientId} onClick={() => void handleAddContact()}>
                    + Добавить контакт
                  </button>
                </div>)}
            </fieldset>)}

          {error && (<p className="tt-tm-field-error" role="alert">
              {error}
            </p>)}
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving || (mode === 'edit' && detailLoading)} onClick={() => void handleSubmit()}>
            {saving ? 'Сохранение…' : mode === 'create' ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>);
}
type AddClientContactModalProps = {
    includeArchived: boolean;
    canManage: boolean;
    onClose: () => void;
};
function AddClientContactModal({ includeArchived, canManage, onClose }: AddClientContactModalProps) {
    const uid = useId();
    const [clients, setClients] = useState<TimeManagerClientRow[]>([]);
    const [listLoading, setListLoading] = useState(true);
    const [clientId, setClientId] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        let cancelled = false;
        setListLoading(true);
        void listTimeManagerClients(includeArchived)
            .then((rows) => {
            if (cancelled)
                return;
            rows.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
            setClients(rows);
        })
            .catch(() => {
            if (!cancelled)
                setClients([]);
        })
            .finally(() => {
            if (!cancelled)
                setListLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [includeArchived]);
    const activeClients = useMemo(() => [...clients]
        .filter((c) => !c.is_archived)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })), [clients]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    useEffect(() => {
        if (clientId && !activeClients.some((c) => c.id === clientId)) {
            setClientId('');
        }
    }, [activeClients, clientId]);
    const submit = async () => {
        if (!clientId) {
            setError('Выберите клиента');
            return;
        }
        const n = name.trim();
        if (!n) {
            setError('Укажите имя контакта');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await createClientContact(clientId, {
                name: n,
                phone: phone.trim() || null,
                email: email.trim() || null,
            });
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось добавить контакт');
        }
        finally {
            setSaving(false);
        }
    };
    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation" onClick={onClose}>
      <div className="tt-tm-modal tt-tm-modal--add-contact" role="dialog" aria-modal="true" aria-labelledby={`${uid}-add-contact-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-add-contact-title`} className="tt-tm-modal__title">
            Добавить контакт к клиенту
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          {!canManage && (<p className="tt-tm-field-error" role="alert">
              Недостаточно прав для добавления контактов.
            </p>)}
          {listLoading && <p className="tt-tm-hint">Загрузка списка клиентов…</p>}
          {!listLoading && clients.length === 0 && (<p className="tt-tm-hint">Сначала создайте клиента кнопкой «Новый клиент».</p>)}
          {!listLoading && clients.length > 0 && activeClients.length === 0 && (<p className="tt-tm-hint">
              Все клиенты в архиве. Разархивируйте клиента в карточке редактирования, затем добавьте контакт.
            </p>)}
          <div className="tt-tm-field">
            <label className="tt-tm-label" id={`${uid}-add-contact-client-lbl`} htmlFor={`${uid}-client`}>
              Клиент <span className="tt-tm-req">*</span>
            </label>
            <SearchableSelect<TimeManagerClientRow> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId={`${uid}-client`} value={clientId} items={activeClients} getOptionValue={(c) => c.id} getOptionLabel={(c) => c.name} getSearchText={clientRowSearchText} onSelect={(c) => setClientId(c.id)} placeholder="Найдите или выберите клиента…" emptyListText="Нет клиентов" noMatchText="Клиент не найден" disabled={!canManage || listLoading || activeClients.length === 0 || saving} portalDropdown portalZIndex={TT_MODAL_DD_Z} portalMinWidth={320} portalDropdownClassName="tsp-srch__dropdown--tall" aria-labelledby={`${uid}-add-contact-client-lbl`} renderOption={(c) => (<span className="tt-tm-dd__opt">
                <span className="tt-tm-dd__opt-name">{c.name}</span>
                {c.address ? (<span className="tt-tm-dd__opt-sub">{c.address}</span>) : c.email ? (<span className="tt-tm-dd__opt-sub">{c.email}</span>) : null}
              </span>)}/>
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-cname`}>
              Имя контакта <span className="tt-tm-req">*</span>
            </label>
            <input id={`${uid}-cname`} className="tt-tm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ФИО или должность" disabled={!canManage}/>
          </div>
          <div className="tt-tm-field-row tt-tm-field-row--grid-3">
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-cphone`}>
                Телефон
              </label>
              <input id={`${uid}-cphone`} className="tt-tm-input" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" disabled={!canManage}/>
            </div>
            <div className="tt-tm-field tt-tm-field--cell" style={{ gridColumn: 'span 2' }}>
              <label className="tt-tm-label" htmlFor={`${uid}-cemail`}>
                Email
              </label>
              <input id={`${uid}-cemail`} type="email" className="tt-tm-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={!canManage}/>
            </div>
          </div>
          <p className="tt-tm-hint">
            Контакт сохраняется в списке дополнительных контактов выбранного клиента. Основной контакт и реквизиты
            организации настраиваются в «Редактировать клиента».
          </p>
          {error && (<p className="tt-tm-field-error" role="alert">
              {error}
            </p>)}
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving || !canManage || listLoading || activeClients.length === 0} onClick={() => void submit()}>
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>);
}
export function TimeTrackingClientsPanel() {
    const { user } = useCurrentUser();
    const canManage = canManageTimeManagerClients(user?.role);
    const navigate = useNavigate();
    const PAGE = TIME_TRACKING_LIST_PAGE_SIZE;
    const [clients, setClients] = useState<TimeManagerClientRow[]>([]);
    const [clientsPage, setClientsPage] = useState(1);
    const [clientsTotal, setClientsTotal] = useState(0);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [clientsSearchFull, setClientsSearchFull] = useState<TimeManagerClientRow[] | null>(null);
    const [clientsSearchLoading, setClientsSearchLoading] = useState(false);
    const [clientsSearchPage, setClientsSearchPage] = useState(1);
    const [includeArchived, setIncludeArchived] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const importRef = useRef<HTMLDivElement>(null);
    const [modal, setModal] = useState<{
        mode: 'create' | 'edit';
        row: TimeManagerClientRow | null;
    } | null>(null);
    const [viewClient, setViewClient] = useState<TimeManagerClientRow | null>(null);
    const [addContactOpen, setAddContactOpen] = useState(false);
    const [quickClientOpen, setQuickClientOpen] = useState(false);
    type ClientProjectsSlice = {
        loading: boolean;
        total: number;
        page: number;
        rows: TimeManagerClientProjectRow[];
    };
    const [clientProjects, setClientProjects] = useState<Record<string, ClientProjectsSlice>>({});
    const [projectsExpanded, setProjectsExpanded] = useState<Set<string>>(new Set());
    const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
    const [projectEdit, setProjectEdit] = useState<{
        client: TimeManagerClientRow;
        project: TimeManagerClientProjectRow;
    } | null>(null);
    const [actionProjectId, setActionProjectId] = useState<string | null>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);
    const [contactModalClient, setContactModalClient] = useState<{
        id: string;
        name: string;
        is_archived: boolean;
    } | null>(null);
    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => window.clearTimeout(t);
    }, [search]);
    const loadClientProjectsPage = useCallback(async (clientId: string, page: number) => {
        setClientProjects((prev) => ({
            ...prev,
            [clientId]: {
                loading: true,
                total: prev[clientId]?.total ?? 0,
                page,
                rows: prev[clientId]?.rows ?? [],
            },
        }));
        try {
            const r = await listClientProjects(clientId, { limit: PAGE, offset: (page - 1) * PAGE });
            setClientProjects((prev) => ({
                ...prev,
                [clientId]: {
                    loading: false,
                    total: r.total,
                    page,
                    rows: r.items,
                },
            }));
        }
        catch {
            setClientProjects((prev) => ({
                ...prev,
                [clientId]: {
                    loading: false,
                    total: 0,
                    page: 1,
                    rows: [],
                },
            }));
        }
    }, [PAGE]);
    const loadClients = useCallback(async () => {
        setListLoading(true);
        setListError(null);
        try {
            const r = await listTimeManagerClients(includeArchived, { limit: PAGE, offset: (clientsPage - 1) * PAGE });
            const rows = [...r.items].sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
            setClients(rows);
            setClientsTotal(r.total);
        }
        catch (e) {
            if (isForbiddenError(e)) {
                setListError('Недостаточно прав для просмотра клиентов.');
            }
            else {
                setListError(e instanceof Error ? e.message : 'Не удалось загрузить клиентов');
            }
            setClients([]);
            setClientsTotal(0);
        }
        finally {
            setListLoading(false);
        }
    }, [includeArchived, clientsPage, PAGE]);
    useEffect(() => {
        if (debouncedSearch)
            return;
        void loadClients();
    }, [loadClients, debouncedSearch]);
    useEffect(() => {
        if (!debouncedSearch) {
            setClientsSearchFull(null);
            setClientsSearchLoading(false);
            setClientsSearchPage(1);
            return;
        }
        let cancelled = false;
        setClientsSearchLoading(true);
        setClientsSearchPage(1);
        void listTimeManagerClients(includeArchived)
            .then((rows) => {
            if (cancelled)
                return;
            rows.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
            setClientsSearchFull(rows);
        })
            .catch(() => {
            if (!cancelled)
                setClientsSearchFull([]);
        })
            .finally(() => {
            if (!cancelled)
                setClientsSearchLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [includeArchived, debouncedSearch]);
    useEffect(() => {
        setClientsPage(1);
    }, [includeArchived]);
    useEffect(() => {
        if (!actionProjectId)
            return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (actionMenuRef.current?.contains(t))
                return;
            setActionProjectId(null);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [actionProjectId]);
    useEffect(() => {
        if (!importOpen)
            return;
        const h = (e: MouseEvent) => {
            if (importRef.current && !importRef.current.contains(e.target as Node))
                setImportOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [importOpen]);
    const searchFilteredAll = useMemo(() => {
        if (!debouncedSearch || !clientsSearchFull)
            return [];
        const q = debouncedSearch.toLowerCase();
        return clientsSearchFull.filter((c) => {
            const name = c.name.toLowerCase();
            const addr = (c.address ?? '').toLowerCase();
            const phone = (c.phone ?? '').toLowerCase();
            const email = (c.email ?? '').toLowerCase();
            return name.includes(q) || addr.includes(q) || phone.includes(q) || email.includes(q);
        });
    }, [debouncedSearch, clientsSearchFull]);
    const displayClients = useMemo(() => {
        if (debouncedSearch) {
            const start = (clientsSearchPage - 1) * PAGE;
            return searchFilteredAll.slice(start, start + PAGE);
        }
        return clients;
    }, [debouncedSearch, clientsSearchPage, searchFilteredAll, clients, PAGE]);
    const clientsPagerTotal = debouncedSearch ? searchFilteredAll.length : clientsTotal;
    const clientsPagerPage = debouncedSearch ? clientsSearchPage : clientsPage;
    const listBusy = debouncedSearch ? clientsSearchLoading : listLoading;
    const onSaved = (_row: TimeManagerClientRow) => {
        void loadClients();
    };
    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Удалить клиента «${name}»?`))
            return;
        try {
            await deleteTimeManagerClient(id);
            setClientProjects((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            setProjectsExpanded((prev) => {
                const n = new Set(prev);
                n.delete(id);
                return n;
            });
            void loadClients();
        }
        catch (e) {
            window.alert(e instanceof Error ? e.message : 'Не удалось удалить');
        }
    };
    const toggleClientProjectsCollapse = (clientId: string) => {
        setProjectsExpanded((prev) => {
            const n = new Set(prev);
            if (n.has(clientId)) {
                n.delete(clientId);
            }
            else {
                n.add(clientId);
                void loadClientProjectsPage(clientId, 1);
            }
            return n;
        });
    };
    const toggleProjectSelect = (projectId: string) => {
        setSelectedProjectIds((prev) => {
            const n = new Set(prev);
            if (n.has(projectId))
                n.delete(projectId);
            else
                n.add(projectId);
            return n;
        });
    };
    const onProjectSavedFromModal = (row: TimeManagerClientProjectRow) => {
        const cid = row.client_id;
        setClientProjects((prev) => {
            const cur = prev[cid];
            if (!cur)
                return prev;
            const exists = cur.rows.some((x) => x.id === row.id);
            const nextRows = exists
                ? cur.rows.map((x) => (x.id === row.id ? row : x))
                : [...cur.rows, row].sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
            const nextTotal = exists ? cur.total : cur.total + 1;
            return {
                ...prev,
                [cid]: { ...cur, rows: nextRows, total: nextTotal },
            };
        });
        setProjectEdit(null);
    };
    const hasClientsInDirectory = debouncedSearch ? searchFilteredAll.length > 0 : clientsTotal > 0;
    return (<div className="pp pp--clients">
      {listError && (<p className="tt-settings__banner-error pp__load-error" role="alert">
          {listError}
        </p>)}

      <div className="pp__topbar">
        <div className="pp__topbar-left">
          <h1 className="pp__title">Клиенты</h1>
        </div>
        <div className="pp__topbar-right pp__topbar-right--clients">
          <div className="tt-settings__search-wrap pp__clients-search">
            <span className="tt-settings__search-icon">
              <IcoSearch />
            </span>
            <input type="search" className="tt-settings__search" placeholder="Фильтр по названию, адресу, телефону или email" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Фильтр по клиенту"/>
          </div>
          <label className="tt-settings__archive-toggle">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)}/>
            <span>Показать архивных</span>
          </label>
          <div className="tt-settings__dropdown-wrap" ref={importRef}>
            <button type="button" className="tt-settings__btn tt-settings__btn--outline" onClick={() => setImportOpen((v) => !v)} aria-expanded={importOpen}>
              Импорт/Экспорт <IcoChevron />
            </button>
            {importOpen && (<div className="tt-settings__dropdown">
                <button type="button" className="tt-settings__dropdown-item" disabled title="В разработке">
                  Импорт клиентов
                </button>
                <button type="button" className="tt-settings__dropdown-item" disabled title="В разработке">
                  Экспорт клиентов
                </button>
              </div>)}
          </div>
          <button type="button" className="tt-settings__btn tt-settings__btn--outline tt-settings__btn--accent-text" disabled={!canManage || !hasClientsInDirectory} title={!canManage
            ? 'Доступно главному администратору, администратору и партнёру'
            : !hasClientsInDirectory
                ? 'Сначала создайте клиента'
                : undefined} onClick={() => setAddContactOpen(true)}>
            <IcoPlus /> Добавить контакт
          </button>
          <button type="button" className="pp__new-btn" disabled={!canManage} title={!canManage ? 'Доступно главному администратору, администратору и партнёру' : undefined} onClick={() => setQuickClientOpen(true)}>
            <IcoPlus /> Новый клиент
          </button>
        </div>
      </div>

      {!listBusy && !listError && !canManage && (<p className="tt-settings__banner-info" role="status">
          Режим просмотра: полную карточку можно открыть кнопкой «Сведения». Создавать и редактировать клиентов могут главный
          администратор, администратор и партнёр.
        </p>)}

      {!listError && (<div className="pp__table-wrap">
          {listBusy ? <ProjectsTableSkeleton /> : (<div className="pp__table">
              <div className="pp__thead">
                <span className="pp__th pp__th--check">
                  <span className="pp__checkbox"/>
                </span>
                <span className="pp__th pp__th--name">Клиент / Проект</span>
                <span className="pp__th pp__th--budget">Бюджет</span>
                <span className="pp__th pp__th--spent">Потрачено</span>
                <span className="pp__th pp__th--bar"/>
                <span className="pp__th pp__th--remaining">Остаток</span>
                <span className="pp__th pp__th--costs">Затраты</span>
                <span className="pp__th pp__th--actions"/>
              </div>
              {!listBusy && displayClients.length === 0 && (<div className="pp__empty">
                  <IcoFolder />
                  <span>
                    {!hasClientsInDirectory && !debouncedSearch
                        ? 'Пока нет клиентов. Создайте первого кнопкой «Новый клиент».'
                        : 'Ничего не найдено по фильтру.'}
                  </span>
                </div>)}
              {!listBusy &&
                displayClients.map((c) => {
                    const projectsExpandedFor = projectsExpanded.has(c.id);
                    const pj = clientProjects[c.id];
                    const rawProjects = pj?.rows ?? [];
                    const projectTotal = pj?.total ?? 0;
                    const projPanelLoading = Boolean(pj?.loading);
                    const clientHasOpenProjectMenu = rawProjects.some((p) => p.id === actionProjectId);
                    const mappedForSpent = rawProjects.map((pr) => mapClientProjectToProjectRow(pr, c));
                    const countLabel = !pj
                        ? '…'
                        : projPanelLoading && rawProjects.length === 0
                            ? '…'
                            : pluralProjectsRu(projectTotal);
                    return (<div key={c.id} className={`pp__group${!projectsExpandedFor ? ' pp__group--collapsed' : ''}${clientHasOpenProjectMenu ? ' pp__group--menu-open' : ''}`}>
                        <div className="pp__client-row">
                          <div className="pp__client-row-main" onClick={() => toggleClientProjectsCollapse(c.id)} role="button" tabIndex={0} aria-expanded={projectsExpandedFor} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleClientProjectsCollapse(c.id)}>
                            <span className={`pp__client-chevron${projectsExpandedFor ? ' pp__client-chevron--open' : ''}`}>
                              <IcoChevronPp />
                            </span>
                            <span className="pp__client-name">{c.name}</span>
                            {c.is_archived && <span className="tt-settings__archived-badge">Архив</span>}
                            <span className="pp__client-meta">{countLabel}</span>
                            {!projectsExpandedFor && pj && !projPanelLoading && rawProjects.length > 0 && (<span className="pp__client-total" title="Потрачено по валютам проектов клиента">
                                {fmtGroupSpentByCurrency(mappedForSpent)}
                              </span>)}
                          </div>
                          {canManage && (<button type="button" className="pp__client-add-contact" disabled={Boolean(c.is_archived)} title={c.is_archived
                                ? 'Клиент в архиве — сначала разархивируйте в карточке клиента'
                                : 'Добавить контакт к этому клиенту'} onClick={(e) => {
                                e.stopPropagation();
                                setContactModalClient({
                                    id: c.id,
                                    name: c.name,
                                    is_archived: Boolean(c.is_archived),
                                });
                            }}>
                              <IcoPlus />
                              <span>Контакт</span>
                            </button>)}
                        </div>
                        {projectsExpandedFor && (<>
                            <div className="pp__client-subrow">
                              <div className="pp__client-subrow-main">
                                {c.address ? <span className="pp__client-subrow-addr">{c.address}</span> : null}
                                <span className="pp__client-subrow-meta">{formatClientMeta(c)}</span>
                              </div>
                              <div className="pp__client-subrow-actions">
                                <button type="button" className="tt-settings__row-edit tt-settings__row-edit--foot" onClick={() => setViewClient(c)}>
                                  Сведения
                                </button>
                                <button type="button" className="tt-settings__row-edit tt-settings__row-edit--foot" disabled={!canManage} title={!canManage ? 'Недостаточно прав' : undefined} onClick={() => setModal({ mode: 'edit', row: c })}>
                                  Редактировать
                                </button>
                                <button type="button" className="tt-settings__row-edit tt-settings__row-edit--foot tt-settings__row-edit--danger" disabled={!canManage} title={!canManage ? 'Недостаточно прав' : undefined} onClick={() => void handleDelete(c.id, c.name)}>
                                  Удалить
                                </button>
                              </div>
                            </div>
                            {projPanelLoading && rawProjects.length === 0 ? (<p className="pp__client-panel-hint" role="status">
                                Загрузка проектов…
                              </p>) : !projPanelLoading && rawProjects.length === 0 ? (<p className="pp__client-panel-hint">Нет проектов у этого клиента.</p>) : (<>
                                {rawProjects.map((p) => {
                                    const mapped = mapClientProjectToProjectRow(p, c);
                                    const typeMeta = TYPE_COLOR[mapped.type];
                                    const hasBudget = mapped.budget != null;
                                    const over = hasBudget && mapped.spent > mapped.budget!;
                                    const rem = hasBudget ? mapped.budget! - mapped.spent : null;
                                    const pct = hasBudget ? remainingPct(mapped.budget!, mapped.spent) : null;
                                    const isOpen = actionProjectId === p.id;
                                    const isSelected = selectedProjectIds.has(p.id);
                                    return (<div key={p.id} className={`pp__row${isSelected ? ' pp__row--selected' : ''}`} onClick={() => navigate(getProjectDetailUrl(p.id, c.id))} style={{ cursor: 'pointer' }}>
                                        <span className="pp__td pp__td--check" onClick={(e) => e.stopPropagation()}>
                                          <span className={`pp__checkbox${isSelected ? ' pp__checkbox--on' : ''}`} onClick={() => toggleProjectSelect(p.id)} role="checkbox" aria-checked={isSelected} tabIndex={0} onKeyDown={(e) => e.key === ' ' && toggleProjectSelect(p.id)}>
                                            {isSelected && <IcoCheck />}
                                          </span>
                                        </span>
                                        <span className="pp__td pp__td--name">
                                          <AnimatedLink className="pp__proj-name pp__proj-name--link" to={getProjectDetailUrl(p.id, c.id)}>
                                            <span className="pp__proj-dot" style={{ background: STATUS_DOT[mapped.status] }}/>
                                            {p.name}
                                          </AnimatedLink>
                                          <span className="pp__type-badge" style={{ color: typeMeta.color, background: typeMeta.bg }}>
                                            {mapped.type}
                                          </span>
                                        </span>
                                        <span className="pp__td pp__td--budget">
                                          {hasBudget ? fmtAmt(mapped.budget!, mapped.currency) : <span className="pp__dash">—</span>}
                                        </span>
                                        <span className="pp__td pp__td--spent">
                                          {mapped.spent > 0 ? fmtAmt(mapped.spent, mapped.currency) : <span className="pp__dash">—</span>}
                                        </span>
                                        <span className="pp__td pp__td--bar">
                                          {hasBudget && mapped.spent > 0 && <BudgetBar budget={mapped.budget!} spent={mapped.spent}/>}
                                        </span>
                                        <span className={`pp__td pp__td--remaining${over ? ' pp__td--over' : ''}`}>
                                          {rem != null ? (<>
                                              <span className="pp__rem-val">
                                                {over ? '−' : ''}
                                                {fmtAmt(Math.abs(rem), mapped.currency)}
                                              </span>
                                              {pct != null && (<span className={`pp__rem-pct${over ? ' pp__rem-pct--over' : ''}`}>
                                                  ({over ? '-' : ''}
                                                  {Math.abs(pct)}%)
                                                </span>)}
                                            </>) : (<span className="pp__dash">—</span>)}
                                        </span>
                                        <span className="pp__td pp__td--costs">
                                          {mapped.costs > 0 ? (<span className="pp__costs-val">{fmtAmt(mapped.costs, mapped.currency)}</span>) : (<span className="pp__zero">0,00 {mapped.currency}</span>)}
                                        </span>
                                        <span className="pp__td pp__td--actions" onClick={(e) => e.stopPropagation()}>
                                          <div className="pp__actions-wrap" ref={isOpen ? actionMenuRef : undefined}>
                                            <button type="button" className={`pp__actions-btn${isOpen ? ' pp__actions-btn--open' : ''}`} onClick={() => setActionProjectId(isOpen ? null : p.id)}>
                                              Действия{' '}
                                              <IcoChevronPp cls={`pp__actions-chevron${isOpen ? ' pp__actions-chevron--open' : ''}`}/>
                                            </button>
                                            {isOpen && (<div className="pp__actions-menu" role="menu">
                                                <button type="button" className="pp__actions-item" onClick={() => {
                                                    setActionProjectId(null);
                                                    navigate(getProjectDetailUrl(p.id, c.id));
                                                }}>
                                                  Открыть
                                                </button>
                                                <button type="button" className="pp__actions-item" disabled={!canManage} title={!canManage ? 'Недостаточно прав' : undefined} onClick={() => {
                                                    setActionProjectId(null);
                                                    setProjectEdit({ client: c, project: p });
                                                }}>
                                                  Редактировать
                                                </button>
                                              </div>)}
                                          </div>
                                        </span>
                                      </div>);
                                })}
                                {pj && pj.total > PAGE ? (<Pagination page={pj.page} totalCount={pj.total} pageSize={PAGE} loading={pj.loading} onPageChange={(p) => void loadClientProjectsPage(c.id, p)}/>) : null}
                              </>)}
                          </>)}
                      </div>);
                })}
            </div>)}
        </div>)}

      {!listBusy && clientsPagerTotal > PAGE ? (<Pagination className="pp__table-pagination" page={clientsPagerPage} totalCount={clientsPagerTotal} pageSize={PAGE} loading={listBusy} onPageChange={(p) => debouncedSearch ? setClientsSearchPage(p) : setClientsPage(p)}/>) : null}

      {quickClientOpen && (<QuickCreateClientModal canManage={canManage} onClose={() => setQuickClientOpen(false)} onCreated={onSaved} onOpenFullForm={() => setModal({ mode: 'create', row: null })}/>)}

      {modal && (<TimeManagerClientModal key={modal.mode === 'edit' && modal.row ? modal.row.id : 'create'} mode={modal.mode} initial={modal.row} canManage={canManage} onClose={() => setModal(null)} onSaved={onSaved}/>)}

      {projectEdit && (<ClientProjectModal key={projectEdit.project.id} mode="edit" fixedClientId={projectEdit.client.id} initial={projectEdit.project} canManage={canManage} onClose={() => setProjectEdit(null)} onSaved={onProjectSavedFromModal}/>)}

      {addContactOpen && (<AddClientContactModal includeArchived={includeArchived} canManage={canManage} onClose={() => setAddContactOpen(false)}/>)}

      {contactModalClient && (<AddClientContactForClientModal clientId={contactModalClient.id} clientName={contactModalClient.name} clientArchived={contactModalClient.is_archived} canManage={canManage} onClose={() => setContactModalClient(null)}/>)}

      {viewClient && (<ClientViewModal listRow={viewClient} canManage={canManage} onClose={() => setViewClient(null)} onEdit={(detail) => {
                setViewClient(null);
                setModal({ mode: 'edit', row: detail });
            }}/>)}
    </div>);
}
