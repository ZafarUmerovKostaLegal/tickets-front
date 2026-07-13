import { useState, useMemo, useEffect, useRef, useCallback, useId, useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatedLink, SearchableSelect, useAppDialog } from '@shared/ui';
import { listTimeManagerClients, listClientProjects, getTimeManagerClient, createTimeManagerClient, patchTimeManagerClient, deleteTimeManagerClient, createClientContact, patchClientContact, deleteClientContact, fetchProjectsBudgetMetrics, applyBudgetMetricsToProjects, patchClientProject, deleteClientProject, isForbiddenError, TIME_TRACKING_PROJECT_CURRENCIES, type TimeManagerClientRow, type TimeManagerClientContactRow, type TimeManagerClientProjectRow, } from '@entities/time-tracking';
import { TIME_TRACKING_LIST_PAGE_SIZE } from '@entities/time-tracking/model/timeTrackingListPageSize';
import { Pagination } from '@shared/ui/Pagination';
import { clientRowSearchText } from '@pages/time-tracking/lib/clientRowSearchText';
import { useCurrentUser } from '@shared/hooks';
import { getProjectDetailUrl } from '@shared/config';
import { formatDateRu } from '@shared/lib/formatDate';
import { mapClientProjectToProjectRow } from '@entities/time-tracking/model/mapClientProjectToProjectRow';
import { buildProjectArchiveTogglePatch, buildProjectPauseTogglePatch } from '@entities/time-tracking/lib/projectArchiveRestore';
import type { ProjectRow, ProjectStatus, ProjectType } from '@entities/time-tracking/model/types';
import { canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { useI18n, ttProjectTypeLabel, ttProjectPluralWord } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { showToast } from '@shared/ui/app-toast';
import type { TimeTrackingT } from '@shared/i18n';
import { ClientProjectModal } from './TimeTrackingClientProjectModal';
import { QuickCreateClientModal } from './QuickCreateClientModal';
import { ProjectsSkeleton, ProjectsTableSkeleton } from './ProjectsSkeleton';
import { AddClientContactForClientModal } from './AddClientContactForClientModal';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
const CURRENCIES = TIME_TRACKING_PROJECT_CURRENCIES;
const TT_MODAL_DD_Z = 12000;
const PP_ACTIONS_MENU_FALLBACK_W = 96;
const TYPE_COLOR: Record<ProjectType, {
    color: string;
    bg: string;
}> = {
    'Время и материалы': { color: '#4f46e5', bg: 'rgba(37,99,235,0.08)' },
    'Фиксированная ставка': { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
    'Без бюджета': { color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
    'Пакет часов': { color: '#0d9488', bg: 'rgba(13,148,136,0.08)' },
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
function remainingPct(budget: number, spent: number): number | null {
    if (!Number.isFinite(budget) || budget <= 0)
        return null;
    const pct = Math.round(((budget - spent) / budget) * 100);
    return Number.isFinite(pct) ? pct : null;
}
function spentPct(budget: number, spent: number) {
    if (!Number.isFinite(budget) || budget <= 0)
        return 0;
    return Math.min((spent / budget) * 100, 100);
}
function BudgetBar({ progressPercent, budget, spent, t, }: {
    progressPercent?: number | null;
    budget?: number;
    spent?: number;
    t: TimeTrackingT;
}) {
    const fallbackPct = (budget != null && spent != null) ? spentPct(budget, spent) : 0;
    const pct = Number.isFinite(progressPercent as number) ? Math.max(0, Number(progressPercent)) : fallbackPct;
    const over = pct > 100;
    const bluePct = Math.min(pct, 100);
    const redPct = over ? Math.min((pct - 100) * 0.8, 45) : 0;
    const title = Number.isFinite(progressPercent as number)
        ? t('timeTrackingPage.projects.table.progressTitle').replace('{percent}', String(Math.round(Number(progressPercent))))
        : t('timeTrackingPage.projects.table.spentBudgetTitle')
            .replace('{spent}', fmtAmt(spent ?? 0))
            .replace('{budget}', fmtAmt(budget ?? 0));
    return (<div className="pp__bar-wrap" title={title}>
      <div className="pp__bar">
        <div className="pp__bar-fill pp__bar-fill--blue" style={{ width: `${bluePct}%` }}/>
        {over && <div className="pp__bar-fill pp__bar-fill--red" style={{ width: `${redPct}%` }}/>}
      </div>
    </div>);
}
function ClientsScopeDropdown({ includeArchived, totalCount, onSelect, t, }: {
    includeArchived: boolean;
    totalCount: number;
    onSelect: (includeArchived: boolean) => void;
    t: TimeTrackingT;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open)
            return;
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node))
                setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);
    const label = includeArchived
        ? t('timeTrackingPage.clients.allClientsFilter').replace('{count}', String(totalCount))
        : t('timeTrackingPage.clients.activeClientsFilter').replace('{count}', String(totalCount));
    return (<div ref={ref} className="pp__status-wrap">
      <button type="button" className="pp__status-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {label} <IcoChevronPp cls={`pp__status-chevron${open ? ' pp__status-chevron--open' : ''}`}/>
      </button>
      {open && (<div className="pp__status-dropdown">
          <button type="button" className={`pp__status-opt${!includeArchived ? ' pp__status-opt--on' : ''}`} onClick={() => {
                onSelect(false);
                setOpen(false);
            }}>
            {!includeArchived && <IcoCheck />} {t('timeTrackingPage.clients.activeClientsFilter').replace('{count}', String(totalCount))}
          </button>
          <button type="button" className={`pp__status-opt${includeArchived ? ' pp__status-opt--on' : ''}`} onClick={() => {
                onSelect(true);
                setOpen(false);
            }}>
            {includeArchived && <IcoCheck />} {t('timeTrackingPage.clients.allClientsFilter').replace('{count}', String(totalCount))}
          </button>
        </div>)}
    </div>);
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
const IcoPlus = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
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
function parseOptionalPercent(s: string, t: TimeTrackingT): {
    ok: true;
    value: number | null;
} | {
    ok: false;
    message: string;
} {
    const trimmed = s.trim();
    if (!trimmed)
        return { ok: true, value: null };
    const n = parseFloat(trimmed.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
        return { ok: false, message: t('timeTrackingPage.clients.errors.percentRange') };
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
function formatInvoiceDueLabel(c: TimeManagerClientRow, t: TimeTrackingT): string {
    const mode = c.invoice_due_mode || 'custom';
    const days = c.invoice_due_days_after_issue;
    if (mode === 'custom' && days != null)
        return t('timeTrackingPage.clients.invoiceDue.afterInvoiceDays').replace('{days}', String(days));
    if (days != null)
        return t('timeTrackingPage.clients.invoiceDue.modeDays').replace('{mode}', mode).replace('{days}', String(days));
    return mode === 'custom' ? t('timeTrackingPage.clients.modal.paymentAfterInvoice') : mode;
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
type ClientViewModalProps = {
    listRow: TimeManagerClientRow;
    canManage: boolean;
    onClose: () => void;
    onEdit: (detail: TimeManagerClientRow) => void;
    onClientUpdated?: () => void;
};
function ClientViewModal({ listRow, canManage, onClose, onEdit, onClientUpdated }: ClientViewModalProps) {
    const uid = useId();
    const { t } = useI18n();
    const { showAlert } = useAppDialog();
    const [restoring, setRestoring] = useState(false);
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
                setError(e instanceof Error ? e.message : t('timeTrackingPage.clients.errors.loadCardFailed'));
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
    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--client tt-tm-modal--client-view" role="dialog" aria-modal="true" aria-labelledby={`${uid}-view-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-view-title`} className="tt-tm-modal__title">
            {t('timeTrackingPage.clients.viewModal.title')}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          {loading && (<p className="tt-tm-hint" role="status">
              {t('timeTrackingPage.clients.modal.loadingCard')}
            </p>)}
          {error && (<p className="tt-tm-field-error" role="alert">
              {error}
            </p>)}
          {!loading && !error && c.is_archived && (<p className="tt-tm-archived-banner" role="status">
              {t('timeTrackingPage.clients.viewModal.archivedBanner')}
            </p>)}
          <ViewReadonlyField label={t('timeTrackingPage.clients.viewModal.name')} value={c.name}/>
          <ViewReadonlyField label={t('timeTrackingPage.clients.modal.address')} value={c.address ?? ''}/>

          <fieldset className="tt-tm-fieldset tt-tm-fieldset--view">
            <legend className="tt-tm-fieldset-legend">{t('timeTrackingPage.clients.modal.organization')}</legend>
            <div className="tt-tm-view-grid">
              <ViewReadonlyField label={t('timeTrackingPage.common.phone')} value={c.phone ?? ''}/>
              <ViewReadonlyField label={t('timeTrackingPage.clients.modal.email')} value={c.email ?? ''}/>
            </div>
          </fieldset>

          <fieldset className="tt-tm-fieldset tt-tm-fieldset--view">
            <legend className="tt-tm-fieldset-legend">{t('timeTrackingPage.clients.modal.mainContact')}</legend>
            <ViewReadonlyField label={t('timeTrackingPage.clients.modal.contactName')} value={c.contact_name ?? ''}/>
            <div className="tt-tm-view-grid">
              <ViewReadonlyField label={t('timeTrackingPage.common.phone')} value={c.contact_phone ?? ''}/>
              <ViewReadonlyField label={t('timeTrackingPage.clients.modal.contactEmail')} value={c.contact_email ?? ''}/>
            </div>
          </fieldset>

          <fieldset className="tt-tm-fieldset tt-tm-fieldset--view">
            <legend className="tt-tm-fieldset-legend">{t('timeTrackingPage.clients.viewModal.billing')}</legend>
            <div className="tt-tm-view-grid tt-tm-view-grid--3">
              <ViewReadonlyField label={t('timeTrackingPage.clients.modal.invoiceCurrency')} value={c.currency || 'USD'}/>
              <ViewReadonlyField label={t('timeTrackingPage.clients.modal.paymentTerms')} value={formatInvoiceDueLabel(c, t)}/>
              <ViewReadonlyField label={t('timeTrackingPage.clients.viewModal.tax')} value={formatPercentDisplay(c.tax_percent)}/>
              <ViewReadonlyField label={t('timeTrackingPage.clients.viewModal.tax2')} value={formatPercentDisplay(c.tax2_percent)}/>
              <ViewReadonlyField label={t('timeTrackingPage.clients.viewModal.discount')} value={formatPercentDisplay(c.discount_percent)}/>
            </div>
          </fieldset>

          <fieldset className="tt-tm-fieldset tt-tm-fieldset--view">
            <legend className="tt-tm-fieldset-legend">{t('timeTrackingPage.clients.modal.additionalContacts')}</legend>
            {extras.length === 0 ? (<p className="tt-tm-hint tt-tm-hint--inline">{t('timeTrackingPage.clients.viewModal.noExtraContacts')}</p>) : (<ul className="tt-tm-contact-list tt-tm-contact-list--view">
                {extras.map((x) => (<li key={x.id} className="tt-tm-contact-list__item tt-tm-contact-list__item--view">
                    <div className="tt-tm-contact-list__main">
                      <span className="tt-tm-contact-list__name">{x.name}</span>
                      <ContactPhoneEmailMeta phone={x.phone} email={x.email}/>
                    </div>
                  </li>))}
              </ul>)}
          </fieldset>

          {c.created_at && (<p className="tt-tm-view-meta">
              {t('timeTrackingPage.clients.viewModal.created').replace('{date}', formatDateRu(c.created_at))}
              {c.updated_at ? t('timeTrackingPage.clients.viewModal.updated').replace('{date}', formatDateRu(c.updated_at)) : ''}
            </p>)}
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" onClick={onClose}>
            {t('timeTrackingPage.close')}
          </button>
          {canManage && !loading && c.is_archived && (<button type="button" className="tt-settings__btn tt-settings__btn--outline tt-settings__btn--accent-text" disabled={restoring} onClick={() => void (async () => {
                    setRestoring(true);
                    try {
                        await patchTimeManagerClient(listRow.id, { isArchived: false });
                        onClientUpdated?.();
                        onClose();
                    }
                    catch (e) {
                        await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.clients.errors.restoreFailed') });
                    }
                    finally {
                        setRestoring(false);
                    }
                })()}>
              {restoring ? t('timeTrackingPage.common.restoring') : t('timeTrackingPage.common.fromArchive')}
            </button>)}
          {canManage && !loading && (<button type="button" className="tt-settings__btn tt-settings__btn--primary" onClick={() => onEdit(detail ?? listRow)}>
              {t('timeTrackingPage.common.edit')}
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
    const { t } = useI18n();
    const { showConfirm } = useAppDialog();
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
                setError(e instanceof Error ? e.message : t('timeTrackingPage.clients.errors.loadClientCardFailed'));
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
            setError(t('timeTrackingPage.clients.errors.nameRequired'));
            return;
        }
        const daysRaw = form.invoiceDueDaysAfterIssue.trim();
        let days: number | null = null;
        if (daysRaw) {
            const d = parseInt(daysRaw, 10);
            if (Number.isNaN(d) || d < 0 || d > 3650) {
                setError(t('timeTrackingPage.clients.errors.paymentDaysRange'));
                return;
            }
            days = d;
        }
        const tp = parseOptionalPercent(form.taxPercent, t);
        const t2 = parseOptionalPercent(form.tax2Percent, t);
        const dp = parseOptionalPercent(form.discountPercent, t);
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
            setError(e instanceof Error ? e.message : t('timeTrackingPage.common.saveFailed'));
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
            setContactsError(t('timeTrackingPage.clients.errors.contactNameRequired'));
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
            setContactsError(e instanceof Error ? e.message : t('timeTrackingPage.clients.errors.contactSaveFailed'));
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
            setContactsError(t('timeTrackingPage.clients.errors.extraContactNameRequired'));
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
            setContactsError(e instanceof Error ? e.message : t('timeTrackingPage.clients.errors.contactAddFailed'));
        }
        finally {
            setContactBusy(false);
        }
    };
    const handleDeleteContact = async (contactId: string, contactName: string) => {
        if (!clientId || !canManage || archivedLocked)
            return;
        const ok = await showConfirm({
            title: t('timeTrackingPage.clients.deleteConfirm.contactTitle'),
            message: t('timeTrackingPage.clients.deleteConfirm.contactMessage').replace('{name}', contactName),
            variant: 'danger',
            confirmLabel: t('timeTrackingPage.delete'),
        });
        if (!ok)
            return;
        setContactsError(null);
        setContactBusy(true);
        try {
            await deleteClientContact(clientId, contactId);
            setExtraContacts((prev) => prev.filter((x) => x.id !== contactId));
            void refreshContactsFromServer();
        }
        catch (e) {
            setContactsError(e instanceof Error ? e.message : t('timeTrackingPage.clients.errors.contactDeleteFailed'));
        }
        finally {
            setContactBusy(false);
        }
    };
    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--client" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-title`} className="tt-tm-modal__title">
            {mode === 'create' ? t('timeTrackingPage.clients.modal.createTitle') : t('timeTrackingPage.clients.modal.editTitle')}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          {detailLoading && mode === 'edit' && (<p className="tt-tm-hint" role="status">
              {t('timeTrackingPage.clients.modal.loadingCard')}
            </p>)}
          {form.isArchived && mode === 'edit' && (<p className="tt-tm-archived-banner" role="status">
              {t('timeTrackingPage.clients.modal.archivedBanner')}
            </p>)}
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-name`}>
              {t('timeTrackingPage.clients.modal.clientName')} <span className="tt-tm-req">*</span>
            </label>
            <input id={`${uid}-name`} className="tt-tm-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoComplete="organization"/>
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-addr`}>
              {t('timeTrackingPage.clients.modal.address')}
            </label>
            <textarea id={`${uid}-addr`} className="tt-tm-textarea" rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}/>
          </div>

          <fieldset className="tt-tm-fieldset">
            <legend className="tt-tm-fieldset-legend">{t('timeTrackingPage.clients.modal.organization')}</legend>
            <div className="tt-tm-field-row tt-tm-field-row--grid-3">
              <div className="tt-tm-field tt-tm-field--cell">
                <label className="tt-tm-label" htmlFor={`${uid}-org-phone`}>
                  {t('timeTrackingPage.common.phone')}
                </label>
                <input id={`${uid}-org-phone`} className="tt-tm-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} autoComplete="tel"/>
              </div>
              <div className="tt-tm-field tt-tm-field--cell" style={{ gridColumn: 'span 2' }}>
                <label className="tt-tm-label" htmlFor={`${uid}-org-email`}>
                  {t('timeTrackingPage.clients.modal.email')}
                </label>
                <input id={`${uid}-org-email`} type="email" className="tt-tm-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} autoComplete="email"/>
              </div>
            </div>
          </fieldset>

          <fieldset className="tt-tm-fieldset">
            <legend className="tt-tm-fieldset-legend">{t('timeTrackingPage.clients.modal.mainContact')}</legend>
            <div className="tt-tm-field">
              <label className="tt-tm-label" htmlFor={`${uid}-cname`}>
                {t('timeTrackingPage.clients.modal.contactName')}
              </label>
              <input id={`${uid}-cname`} className="tt-tm-input" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}/>
            </div>
            <div className="tt-tm-field-row tt-tm-field-row--grid-3">
              <div className="tt-tm-field tt-tm-field--cell">
                <label className="tt-tm-label" htmlFor={`${uid}-cphone`}>
                  {t('timeTrackingPage.clients.contacts.contactPhoneLabel')}
                </label>
                <input id={`${uid}-cphone`} className="tt-tm-input" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} autoComplete="tel"/>
              </div>
              <div className="tt-tm-field tt-tm-field--cell" style={{ gridColumn: 'span 2' }}>
                <label className="tt-tm-label" htmlFor={`${uid}-cemail`}>
                  {t('timeTrackingPage.clients.contacts.contactEmailLabel')}
                </label>
                <input id={`${uid}-cemail`} type="email" className="tt-tm-input" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} autoComplete="email"/>
              </div>
            </div>
          </fieldset>

          <div className="tt-tm-field-row tt-tm-field-row--grid-3" role="group" aria-label={t('timeTrackingPage.clients.contacts.billingGroupAria')}>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-cur`}>
                {t('timeTrackingPage.clients.modal.invoiceCurrency')}
              </label>
              <select id={`${uid}-cur`} className="tt-tm-select" value={CURRENCIES.includes(form.currency as (typeof CURRENCIES)[number]) ? form.currency : 'USD'} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map((c) => (<option key={c} value={c}>
                    {c}
                  </option>))}
              </select>
            </div>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-mode`}>
                {t('timeTrackingPage.clients.modal.paymentTerms')}
              </label>
              <select id={`${uid}-mode`} className="tt-tm-select" value={form.invoiceDueMode} onChange={(e) => setForm((f) => ({ ...f, invoiceDueMode: e.target.value }))} title={t('timeTrackingPage.clients.contacts.invoiceDueModeTitle')}>
                <option value="custom">{t('timeTrackingPage.clients.modal.paymentAfterInvoice')}</option>
              </select>
            </div>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-days`} title={t('timeTrackingPage.clients.contacts.daysAfterInvoiceTitle')}>
                {t('timeTrackingPage.clients.contacts.daysAfterInvoice')}
              </label>
              <input id={`${uid}-days`} type="number" min={0} max={3650} className="tt-tm-input" placeholder="15" value={form.invoiceDueDaysAfterIssue} onChange={(e) => setForm((f) => ({ ...f, invoiceDueDaysAfterIssue: e.target.value }))}/>
            </div>
          </div>
          <div className="tt-tm-field-row tt-tm-field-row--grid-3" role="group" aria-label={t('timeTrackingPage.clients.contacts.taxesGroupAria')}>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-tax`}>
                {t('timeTrackingPage.clients.viewModal.tax')}
              </label>
              <input id={`${uid}-tax`} type="text" inputMode="decimal" className="tt-tm-input" placeholder={t('timeTrackingPage.clients.contacts.taxPlaceholder')} value={form.taxPercent} onChange={(e) => setForm((f) => ({ ...f, taxPercent: e.target.value }))}/>
            </div>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-tax2`}>
                {t('timeTrackingPage.clients.viewModal.tax2')}
              </label>
              <input id={`${uid}-tax2`} type="text" inputMode="decimal" className="tt-tm-input" placeholder={t('timeTrackingPage.invoices.detail.optionalPlaceholder')} value={form.tax2Percent} onChange={(e) => setForm((f) => ({ ...f, tax2Percent: e.target.value }))}/>
            </div>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-disc`}>
                {t('timeTrackingPage.clients.viewModal.discount')}
              </label>
              <input id={`${uid}-disc`} type="text" inputMode="decimal" className="tt-tm-input" placeholder={t('timeTrackingPage.clients.contacts.discountPlaceholder')} value={form.discountPercent} onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}/>
            </div>
          </div>

          <label className="tt-tm-check-row">
            <input type="checkbox" checked={form.isArchived} onChange={(e) => setForm((f) => ({ ...f, isArchived: e.target.checked }))}/>
            <span>{t('timeTrackingPage.clients.contacts.isArchivedHint')}</span>
          </label>

          {mode === 'edit' && clientId && (<fieldset className="tt-tm-fieldset">
              <legend className="tt-tm-fieldset-legend">{t('timeTrackingPage.clients.modal.additionalContacts')}</legend>
              {!canManage && (<p className="tt-tm-hint">{t('timeTrackingPage.clients.contacts.insufficientRightsEdit')}</p>)}
              {archivedLocked && canManage && (<p className="tt-tm-hint">{t('timeTrackingPage.clients.contacts.unarchiveToEdit')}</p>)}
              {contactsError && (<p className="tt-tm-field-error" role="alert">
                  {contactsError}
                </p>)}
              <ul className="tt-tm-contact-list">
                {extraContacts.map((c) => (<li key={c.id} className="tt-tm-contact-list__item">
                    {editingId === c.id ? (<div className="tt-tm-contact-edit">
                        <input className="tt-tm-input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t('timeTrackingPage.clients.contacts.nameRequired')} aria-label={t('timeTrackingPage.clients.contacts.contactNameAria')}/>
                        <input className="tt-tm-input" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder={t('timeTrackingPage.common.phone')} aria-label={t('timeTrackingPage.common.phone')}/>
                        <input className="tt-tm-input" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder={t('timeTrackingPage.clients.modal.email')} aria-label={t('timeTrackingPage.clients.modal.email')}/>
                        <div className="tt-tm-contact-edit__actions">
                          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={contactBusy} onClick={cancelEditContact}>
                            {t('timeTrackingPage.cancel')}
                          </button>
                          <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={contactBusy} onClick={() => void saveEditContact()}>
                            {t('timeTrackingPage.save')}
                          </button>
                        </div>
                      </div>) : (<>
                        <div className="tt-tm-contact-list__main">
                          <span className="tt-tm-contact-list__name">{c.name}</span>
                          <ContactPhoneEmailMeta phone={c.phone} email={c.email}/>
                        </div>
                        {canManage && !archivedLocked && (<div className="tt-tm-contact-list__actions">
                            <button type="button" className="tt-settings__btn tt-settings__btn--outline" disabled={contactBusy || Boolean(editingId)} onClick={() => startEditContact(c)}>
                              {t('timeTrackingPage.common.change')}
                            </button>
                            <button type="button" className="tt-settings__btn tt-settings__btn--outline tt-settings__row-edit--danger" disabled={contactBusy || Boolean(editingId)} onClick={() => void handleDeleteContact(c.id, c.name)}>
                              {t('timeTrackingPage.delete')}
                            </button>
                          </div>)}
                      </>)}
                  </li>))}
              </ul>
              {canManage && !archivedLocked && (<div className="tt-tm-contact-add">
                  <span className="tt-tm-label">{t('timeTrackingPage.clients.contacts.newContact')}</span>
                  <div className="tt-tm-contact-add__row">
                    <input className="tt-tm-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('timeTrackingPage.clients.contacts.nameRequired')} aria-label={t('timeTrackingPage.clients.contacts.newContactNameAria')}/>
                    <input className="tt-tm-input" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder={t('timeTrackingPage.common.phone')}/>
                    <input className="tt-tm-input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={t('timeTrackingPage.clients.modal.email')}/>
                  </div>
                  <button type="button" className="tt-settings__btn tt-settings__btn--outline tt-settings__btn--accent-text" disabled={contactBusy || detailLoading || !clientId} onClick={() => void handleAddContact()}>
                    {t('timeTrackingPage.clients.contacts.addContactBtn')}
                  </button>
                </div>)}
            </fieldset>)}

          {error && (<p className="tt-tm-field-error" role="alert">
              {error}
            </p>)}
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>
            {t('timeTrackingPage.cancel')}
          </button>
          <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving || (mode === 'edit' && detailLoading)} onClick={() => void handleSubmit()}>
            {saving ? t('timeTrackingPage.saving') : mode === 'create' ? t('timeTrackingPage.common.create') : t('timeTrackingPage.save')}
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
    const { t } = useI18n();
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
            setError(t('timeTrackingPage.clients.errors.selectClient'));
            return;
        }
        const n = name.trim();
        if (!n) {
            setError(t('timeTrackingPage.clients.errors.contactNameRequired'));
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
            setError(e instanceof Error ? e.message : t('timeTrackingPage.clients.errors.contactAddFailed'));
        }
        finally {
            setSaving(false);
        }
    };
    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--add-contact" role="dialog" aria-modal="true" aria-labelledby={`${uid}-add-contact-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-add-contact-title`} className="tt-tm-modal__title">
            {t('timeTrackingPage.clients.addContactModal.title')}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          {!canManage && (<p className="tt-tm-field-error" role="alert">
              {t('timeTrackingPage.clients.addContactModal.insufficientRights')}
            </p>)}
          {listLoading && <p className="tt-tm-hint">{t('timeTrackingPage.clients.contacts.loadingList')}</p>}
          {!listLoading && clients.length === 0 && (<p className="tt-tm-hint">{t('timeTrackingPage.clients.createClientFirst')}</p>)}
          {!listLoading && clients.length > 0 && activeClients.length === 0 && (<p className="tt-tm-hint">
              {t('timeTrackingPage.clients.contacts.allArchivedHint')}
            </p>)}
          <div className="tt-tm-field">
            <label className="tt-tm-label" id={`${uid}-add-contact-client-lbl`} htmlFor={`${uid}-client`}>
              {t('timeTrackingPage.common.client')} <span className="tt-tm-req">*</span>
            </label>
            <SearchableSelect<TimeManagerClientRow> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId={`${uid}-client`} value={clientId} items={activeClients} getOptionValue={(c) => c.id} getOptionLabel={(c) => c.name} getSearchText={clientRowSearchText} onSelect={(c) => setClientId(c.id)} placeholder={t('timeTrackingPage.common.selectClient')} emptyListText={t('timeTrackingPage.common.noClients')} noMatchText={t('timeTrackingPage.common.clientNotFound')} disabled={!canManage || listLoading || activeClients.length === 0 || saving} portalDropdown portalZIndex={TT_MODAL_DD_Z} portalMinWidth={320} portalDropdownClassName="tsp-srch__dropdown--tall" aria-labelledby={`${uid}-add-contact-client-lbl`} renderOption={(c) => (<span className="tt-tm-dd__opt">
                <span className="tt-tm-dd__opt-name">{c.name}</span>
                {c.address ? (<span className="tt-tm-dd__opt-sub">{c.address}</span>) : c.email ? (<span className="tt-tm-dd__opt-sub">{c.email}</span>) : null}
              </span>)}/>
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-cname`}>
              {t('timeTrackingPage.clients.addContactModal.contactName')} <span className="tt-tm-req">*</span>
            </label>
            <input id={`${uid}-cname`} className="tt-tm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('timeTrackingPage.clients.addContactModal.contactNamePlaceholder')} disabled={!canManage}/>
          </div>
          <div className="tt-tm-field-row tt-tm-field-row--grid-3">
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-cphone`}>
                {t('timeTrackingPage.common.phone')}
              </label>
              <input id={`${uid}-cphone`} className="tt-tm-input" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" disabled={!canManage}/>
            </div>
            <div className="tt-tm-field tt-tm-field--cell" style={{ gridColumn: 'span 2' }}>
              <label className="tt-tm-label" htmlFor={`${uid}-cemail`}>
                {t('timeTrackingPage.clients.modal.email')}
              </label>
              <input id={`${uid}-cemail`} type="email" className="tt-tm-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={!canManage}/>
            </div>
          </div>
          <p className="tt-tm-hint">
            {t('timeTrackingPage.clients.addContactModal.hint')}
          </p>
          {error && (<p className="tt-tm-field-error" role="alert">
              {error}
            </p>)}
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>
            {t('timeTrackingPage.cancel')}
          </button>
          <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving || !canManage || listLoading || activeClients.length === 0} onClick={() => void submit()}>
            {saving ? t('timeTrackingPage.saving') : t('timeTrackingPage.add')}
          </button>
        </div>
      </div>
    </div>);
}
export function TimeTrackingClientsPanel() {
    const { t, locale } = useI18n();
    const { user } = useCurrentUser();
    const { showAlert, showConfirm } = useAppDialog();
    const canManage = canManageTimeTrackingClients(user);
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
        rows: TimeManagerClientProjectRow[];
    };
    const [clientProjects, setClientProjects] = useState<Record<string, ClientProjectsSlice>>({});
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
    const [projectEdit, setProjectEdit] = useState<{
        client: TimeManagerClientRow;
        project: TimeManagerClientProjectRow;
    } | null>(null);
    const [actionProjectId, setActionProjectId] = useState<string | null>(null);
    const [clientMenuOpen, setClientMenuOpen] = useState<string | null>(null);
    const clientMenuRef = useRef<HTMLDivElement>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);
    const menuPortalRef = useRef<HTMLDivElement>(null);
    const [menuPlacement, setMenuPlacement] = useState<{
        top: number;
        left: number;
        minWidth: number;
        maxWidth: number;
    } | null>(null);
    const [actionBusy, setActionBusy] = useState(false);
    const [contactModalClient, setContactModalClient] = useState<{
        id: string;
        name: string;
        is_archived: boolean;
    } | null>(null);
    const [restoreBusyId, setRestoreBusyId] = useState<string | null>(null);
    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => window.clearTimeout(t);
    }, [search]);
    const loadClientProjects = useCallback(async (clientId: string) => {
        setClientProjects((prev) => ({
            ...prev,
            [clientId]: {
                loading: true,
                total: prev[clientId]?.total ?? 0,
                rows: prev[clientId]?.rows ?? [],
            },
        }));
        try {
            const fetched = await listClientProjects(clientId);
            let items = [...fetched].sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
            if (items.length > 0) {
                try {
                    const metrics = await fetchProjectsBudgetMetrics(items.map((p) => p.id));
                    items = applyBudgetMetricsToProjects(items, metrics);
                }
                catch {
                    /* metrics optional */
                }
            }
            setClientProjects((prev) => ({
                ...prev,
                [clientId]: {
                    loading: false,
                    total: items.length,
                    rows: items,
                },
            }));
        }
        catch {
            setClientProjects((prev) => ({
                ...prev,
                [clientId]: {
                    loading: false,
                    total: 0,
                    rows: [],
                },
            }));
        }
    }, []);
    const loadClients = useCallback(async (includeArchivedOverride?: boolean) => {
        const inc = includeArchivedOverride ?? includeArchived;
        setListLoading(true);
        setListError(null);
        try {
            const r = await listTimeManagerClients(inc, { limit: PAGE, offset: (clientsPage - 1) * PAGE });
            const rows = [...r.items].sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
            setClients(rows);
            setClientsTotal(r.total);
        }
        catch (e) {
            if (isForbiddenError(e)) {
                setListError(t('timeTrackingPage.clients.errors.insufficientRightsView'));
            }
            else {
                setListError(e instanceof Error ? e.message : t('timeTrackingPage.clients.errors.loadListFailed'));
            }
            setClients([]);
            setClientsTotal(0);
        }
        finally {
            setListLoading(false);
        }
    }, [includeArchived, clientsPage, PAGE, t]);
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
        setClientsSearchPage(1);
    }, [includeArchived, debouncedSearch]);
    const tableWrapRef = useRef<HTMLDivElement>(null);
    const handleClientsPageChange = useCallback((nextPage: number) => {
        if (debouncedSearch) {
            setClientsSearchPage(nextPage);
        }
        else {
            setClientsPage(nextPage);
        }
        tableWrapRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [debouncedSearch]);
    useEffect(() => {
        if (!actionProjectId)
            return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (actionMenuRef.current?.contains(t))
                return;
            if (menuPortalRef.current?.contains(t))
                return;
            setActionProjectId(null);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [actionProjectId]);
    useEffect(() => {
        if (!clientMenuOpen)
            return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (clientMenuRef.current?.contains(t))
                return;
            setClientMenuOpen(null);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [clientMenuOpen]);
    useEffect(() => {
        if (!actionProjectId)
            return;
        const close = () => setActionProjectId(null);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [actionProjectId]);
    useLayoutEffect(() => {
        if (!actionProjectId) {
            setMenuPlacement(null);
            return;
        }
        const wrap = actionMenuRef.current;
        const btn = wrap?.querySelector('.pp__actions-btn');
        if (!(btn instanceof HTMLElement)) {
            setMenuPlacement(null);
            return;
        }
        const rect = btn.getBoundingClientRect();
        const maxWidth = Math.min(280, window.innerWidth - 16);
        const minWidth = Math.max(PP_ACTIONS_MENU_FALLBACK_W, rect.width);
        let left = rect.right - minWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - minWidth - 8));
        const top = rect.bottom + 4;
        setMenuPlacement({ top, left, minWidth, maxWidth });
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
    useEffect(() => {
        if (listBusy)
            return;
        for (const c of displayClients) {
            if (!collapsed.has(c.id) && clientProjects[c.id] === undefined) {
                void loadClientProjects(c.id);
            }
        }
    }, [displayClients, collapsed, listBusy, clientProjects, loadClientProjects]);
    const onSaved = useCallback((row: TimeManagerClientRow) => {
        if (row.is_archived) {
            setIncludeArchived(true);
            void loadClients(true);
            return;
        }
        void loadClients();
    }, [loadClients]);
    const handleRestoreFromArchive = useCallback(async (c: TimeManagerClientRow) => {
        setRestoreBusyId(c.id);
        try {
            await patchTimeManagerClient(c.id, { isArchived: false });
            void loadClients();
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.clients.errors.unarchiveFailed') });
        }
        finally {
            setRestoreBusyId(null);
        }
    }, [loadClients, showAlert, t]);
    const handleDelete = async (id: string, name: string) => {
        const ok = await showConfirm({
            title: t('timeTrackingPage.clients.deleteConfirm.title'),
            message: t('timeTrackingPage.clients.deleteConfirm.message').replace('{name}', name),
            variant: 'danger',
            confirmLabel: t('timeTrackingPage.delete'),
        });
        if (!ok)
            return;
        try {
            await deleteTimeManagerClient(id);
            setClientProjects((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            setCollapsed((prev) => {
                const n = new Set(prev);
                n.delete(id);
                return n;
            });
            void loadClients();
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.common.deleteFailed') });
        }
    };
    const toggleClientCollapse = (clientId: string) => {
        setCollapsed((prev) => {
            const n = new Set(prev);
            if (n.has(clientId)) {
                n.delete(clientId);
            }
            else {
                n.add(clientId);
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
    const openActionProject = useMemo(() => {
        if (!actionProjectId)
            return null;
        for (const slice of Object.values(clientProjects)) {
            const hit = slice.rows.find((r) => r.id === actionProjectId);
            if (hit) {
                const client = displayClients.find((c) => c.id === hit.client_id);
                if (client)
                    return { client, project: hit, mapped: mapClientProjectToProjectRow(hit, client) };
            }
        }
        return null;
    }, [actionProjectId, clientProjects, displayClients]);
    if (listLoading && !debouncedSearch)
        return <ProjectsSkeleton />;
    return (<div className="pp">
      {listError && (<p className="tt-settings__banner-error pp__load-error" role="alert">
          {listError}
        </p>)}

      <div className="pp__topbar">
        <div className="pp__topbar-left">
          <h1 className="pp__title">{t('timeTrackingPage.clients.title')}</h1>
          <ClientsScopeDropdown includeArchived={includeArchived} totalCount={clientsPagerTotal} onSelect={setIncludeArchived} t={t}/>
        </div>
        <div className="pp__topbar-right">
          <div className="tt-settings__search-wrap pp__projects-search">
            <span className="tt-settings__search-icon">
              <IcoSearch />
            </span>
            <input type="search" className="tt-settings__search" placeholder={t('timeTrackingPage.clients.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('timeTrackingPage.clients.searchAria')}/>
          </div>
          <div className="tt-settings__dropdown-wrap" ref={importRef}>
            <button type="button" className="pp__filter-btn" onClick={() => setImportOpen((v) => !v)} aria-expanded={importOpen}>
              {t('timeTrackingPage.clients.importExport')} <IcoChevron />
            </button>
            {importOpen && (<div className="tt-settings__dropdown">
                <button type="button" className="tt-settings__dropdown-item" disabled title={t('timeTrackingPage.clients.inDevelopment')}>
                  {t('timeTrackingPage.clients.importClients')}
                </button>
                <button type="button" className="tt-settings__dropdown-item" disabled title={t('timeTrackingPage.clients.inDevelopment')}>
                  {t('timeTrackingPage.clients.exportClients')}
                </button>
              </div>)}
          </div>
          <button type="button" className="pp__filter-btn" disabled={!canManage || !hasClientsInDirectory} title={!canManage
            ? t('timeTrackingPage.common.manageRoleHint')
            : !hasClientsInDirectory
                ? t('timeTrackingPage.clients.createClientFirst')
                : undefined} onClick={() => setAddContactOpen(true)}>
            <IcoPlus /> {t('timeTrackingPage.clients.addContact')}
          </button>
          <button type="button" className="pp__new-btn" disabled={!canManage} title={!canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined} onClick={() => setQuickClientOpen(true)}>
            <IcoPlus /> {t('timeTrackingPage.clients.newClient')}
          </button>
        </div>
      </div>

      {!listBusy && !listError && !canManage && (<p className="tt-settings__banner-info" role="status">
          {t('timeTrackingPage.common.viewOnlyClients')}
        </p>)}

      {!listError && (<div className="pp__table-wrap" ref={tableWrapRef}>
          {listBusy ? <ProjectsTableSkeleton /> : (<div className="pp__table">
              <div className="pp__thead">
                <span className="pp__th pp__th--check">
                  <span className="pp__checkbox"/>
                </span>
                <span className="pp__th pp__th--name">{t('timeTrackingPage.projects.table.clientProject')}</span>
                <span className="pp__th pp__th--budget">{t('timeTrackingPage.projects.table.budget')}</span>
                <span className="pp__th pp__th--spent">{t('timeTrackingPage.projects.table.spent')}</span>
                <span className="pp__th pp__th--bar"/>
                <span className="pp__th pp__th--remaining">{t('timeTrackingPage.projects.table.remaining')}</span>
                <span className="pp__th pp__th--costs">{t('timeTrackingPage.projects.table.costs')}</span>
                <span className="pp__th pp__th--actions"/>
              </div>
              {!listBusy && displayClients.length === 0 && (<div className="pp__empty">
                  <IcoFolder />
                  <span>
                    {!hasClientsInDirectory && !debouncedSearch
                        ? t('timeTrackingPage.clients.empty.noClients')
                        : t('timeTrackingPage.clients.empty.noFilterMatch')}
                  </span>
                </div>)}
              {!listBusy &&
                displayClients.map((c) => {
                    const isCollapsed = collapsed.has(c.id);
                    const pj = clientProjects[c.id];
                    const rawProjects = pj?.rows ?? [];
                    const projectTotal = pj?.total ?? 0;
                    const projPanelLoading = Boolean(pj?.loading);
                    const mappedForSpent = rawProjects.map((pr) => mapClientProjectToProjectRow(pr, c));
                    const clientHasProjects = (pj?.total ?? 0) > 0 || rawProjects.length > 0;
                    const countLabel = !pj
                        ? '…'
                        : projPanelLoading && rawProjects.length === 0
                            ? '…'
                            : `${projectTotal} ${ttProjectPluralWord(projectTotal, t, locale)}`;
                    const isClientMenuOpen = clientMenuOpen === c.id;
                    return (<div key={c.id} className={`pp__group${isCollapsed ? ' pp__group--collapsed' : ''}`}>
                        <div className="pp__client-row">
                          <div className="pp__client-row-main" onClick={() => toggleClientCollapse(c.id)} role="button" tabIndex={0} aria-expanded={!isCollapsed} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleClientCollapse(c.id)}>
                            <span className={`pp__client-chevron${!isCollapsed ? ' pp__client-chevron--open' : ''}`}>
                              <IcoChevronPp />
                            </span>
                            <span className="pp__client-name">{c.name}</span>
                            {c.is_archived && <span className="tt-settings__archived-badge">{t('timeTrackingPage.common.archived')}</span>}
                            <span className="pp__client-meta">{countLabel}</span>
                            {isCollapsed && pj && !projPanelLoading && rawProjects.length > 0 && (<span className="pp__client-total" title={t('timeTrackingPage.projects.table.spentByCurrencyTitle')}>
                                {fmtGroupSpentByCurrency(mappedForSpent)}
                              </span>)}
                          </div>
                          <div className="pp__client-row-tools" ref={isClientMenuOpen ? clientMenuRef : undefined}>
                            <button type="button" className={`pp__actions-btn pp__actions-btn--client${isClientMenuOpen ? ' pp__actions-btn--open' : ''}`} onClick={(e) => {
                                e.stopPropagation();
                                setClientMenuOpen(isClientMenuOpen ? null : c.id);
                            }}>
                              {t('timeTrackingPage.projects.actions.actions')} <IcoChevronPp cls={`pp__actions-chevron${isClientMenuOpen ? ' pp__actions-chevron--open' : ''}`}/>
                            </button>
                            {isClientMenuOpen && (<div className="pp__actions-menu" role="menu">
                                <button type="button" className="pp__actions-item" onClick={() => {
                                    setClientMenuOpen(null);
                                    setViewClient(c);
                                }}>
                                  {t('timeTrackingPage.common.details')}
                                </button>
                                <button type="button" className="pp__actions-item" disabled={!canManage} title={!canManage ? t('timeTrackingPage.common.insufficientRights') : undefined} onClick={() => {
                                    setClientMenuOpen(null);
                                    setModal({ mode: 'edit', row: c });
                                }}>
                                  {t('timeTrackingPage.common.edit')}
                                </button>
                                {c.is_archived && canManage && (<button type="button" className="pp__actions-item" disabled={restoreBusyId === c.id} onClick={() => {
                                    setClientMenuOpen(null);
                                    void handleRestoreFromArchive(c);
                                }}>
                                    {restoreBusyId === c.id ? t('timeTrackingPage.common.restoring') : t('timeTrackingPage.common.fromArchive')}
                                  </button>)}
                                <div className="pp__actions-sep"/>
                                <button type="button" className="pp__actions-item pp__actions-item--danger" disabled={!canManage || clientHasProjects} title={!canManage
                                  ? t('timeTrackingPage.common.insufficientRights')
                                  : clientHasProjects
                                    ? t('timeTrackingPage.clients.row.deleteBlockedHasProjects')
                                    : undefined} onClick={() => {
                                    setClientMenuOpen(null);
                                    void handleDelete(c.id, c.name);
                                }}>
                                  {t('timeTrackingPage.delete')}
                                </button>
                              </div>)}
                          </div>
                          {canManage && (<button type="button" className="pp__client-add-contact" disabled={Boolean(c.is_archived)} title={c.is_archived
                                ? t('timeTrackingPage.projects.actions.clientArchivedContact')
                                : t('timeTrackingPage.projects.actions.addContact')} onClick={(e) => {
                                e.stopPropagation();
                                setContactModalClient({
                                    id: c.id,
                                    name: c.name,
                                    is_archived: Boolean(c.is_archived),
                                });
                            }}>
                              <IcoPlus />
                              <span>{t('timeTrackingPage.common.contact')}</span>
                            </button>)}
                        </div>
                        {!isCollapsed && (<>
                            {projPanelLoading && rawProjects.length === 0 ? (<p className="pp__client-panel-hint" role="status">
                                {t('timeTrackingPage.clients.table.loadingProjects')}
                              </p>) : !projPanelLoading && rawProjects.length === 0 ? (<p className="pp__client-panel-hint">{t('timeTrackingPage.clients.table.noProjectsForClient')}</p>) : (<>
                                {rawProjects.map((p) => {
                                    const mapped = mapClientProjectToProjectRow(p, c);
                                    const typeMeta = TYPE_COLOR[mapped.type];
                                    const hasBudgetConfigured = mapped.hasBudgetConfigured !== false;
                                    const hasBudget = mapped.budget != null;
                                    const spentVal = Number.isFinite(mapped.spent) ? mapped.spent : 0;
                                    const rem = mapped.remaining ?? (hasBudget ? mapped.budget! - spentVal : null);
                                    const over = rem != null && rem < 0;
                                    const budgetVal = mapped.budget ?? 0;
                                    const pctRaw = hasBudget && budgetVal > 0
                                        ? (Number.isFinite(mapped.progressPercent as number)
                                            ? Math.round(Number(mapped.progressPercent))
                                            : remainingPct(budgetVal, spentVal))
                                        : null;
                                    const pct = pctRaw != null && Number.isFinite(pctRaw) ? pctRaw : null;
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
                                            {ttProjectTypeLabel(mapped.type, t)}
                                          </span>
                                        </span>
                                        <span className="pp__td pp__td--budget">
                                          {!hasBudgetConfigured
                                                ? (<span className="pp__dash">{t('timeTrackingPage.projects.table.noBudget')}</span>)
                                                : hasBudget
                                                    ? fmtAmt(mapped.budget!, mapped.currency)
                                                    : fmtAmt(0, mapped.currency)}
                                        </span>
                                        <span
                                          className="pp__td pp__td--spent pp__metric-cell"
                                          title={mapped.loggedHours != null
                                            ? `${fmtAmt(spentVal, mapped.currency)} · ${t('timeTrackingPage.projects.table.hoursLogged').replace('{hours}', mapped.loggedHours.toLocaleString(localeTag(locale)))}`
                                            : fmtAmt(spentVal, mapped.currency)}
                                        >
                                          <span className="pp__metric-primary">{fmtAmt(spentVal, mapped.currency)}</span>
                                          {mapped.loggedHours != null ? (
                                            <span className="pp__metric-sub">
                                              {t('timeTrackingPage.projects.table.hoursLogged').replace('{hours}', mapped.loggedHours.toLocaleString(localeTag(locale)))}
                                            </span>
                                          ) : null}
                                        </span>
                                        <span className="pp__td pp__td--bar">
                                          <BudgetBar progressPercent={mapped.progressPercent} budget={mapped.budget} spent={spentVal} t={t}/>
                                        </span>
                                        <span className={`pp__td pp__td--remaining pp__metric-cell${over ? ' pp__td--over' : ''}`}>
                                          {rem != null ? (<>
                                              <span className="pp__metric-primary pp__rem-val">
                                                {over ? '−' : ''}
                                                {fmtAmt(Math.abs(rem), mapped.currency)}
                                              </span>
                                              {pct != null && (
                                                <span className={`pp__metric-sub pp__rem-pct${over ? ' pp__rem-pct--over' : ''}`}>
                                                  {over ? '−' : ''}
                                                  {Math.abs(pct)}%
                                                </span>
                                              )}
                                            </>) : (<span className="pp__metric-primary pp__dash">{fmtAmt(0, mapped.currency)}</span>)}
                                        </span>
                                        <span className="pp__td pp__td--costs">
                                          {mapped.costs > 0 ? (<span className="pp__costs-val">{fmtAmt(mapped.costs, mapped.currency)}</span>) : (<span className="pp__zero">0,00 {mapped.currency}</span>)}
                                        </span>
                                        <span className="pp__td pp__td--actions" onClick={(e) => e.stopPropagation()}>
                                          <div className="pp__actions-wrap" ref={isOpen ? actionMenuRef : undefined}>
                                            <button type="button" className={`pp__actions-btn${isOpen ? ' pp__actions-btn--open' : ''}`} onClick={() => setActionProjectId(isOpen ? null : p.id)}>
                                              {t('timeTrackingPage.projects.actions.actions')} <IcoChevronPp cls={`pp__actions-chevron${isOpen ? ' pp__actions-chevron--open' : ''}`}/>
                                            </button>
                                          </div>
                                        </span>
                                      </div>);
                                })}
                              </>)}
                          </>)}
                      </div>);
                })}
            </div>)}
          {!listBusy && clientsPagerTotal > PAGE ? (<Pagination className="pp__table-pagination" page={clientsPagerPage} totalCount={clientsPagerTotal} pageSize={PAGE} loading={listBusy} onPageChange={handleClientsPageChange}/>) : null}
        </div>)}

      {openActionProject && actionProjectId && createPortal(<div ref={menuPortalRef} className="pp__actions-menu pp__actions-menu--portal" style={menuPlacement
            ? {
                top: menuPlacement.top,
                left: menuPlacement.left,
                minWidth: menuPlacement.minWidth,
                maxWidth: menuPlacement.maxWidth,
            }
            : {
                position: 'fixed',
                left: '-9999px',
                top: 0,
                visibility: 'hidden',
                pointerEvents: 'none',
                width: 'max-content',
                minWidth: PP_ACTIONS_MENU_FALLBACK_W,
                maxWidth: Math.min(280, typeof window !== 'undefined' ? window.innerWidth - 16 : 280),
            }} role="menu">
          <button type="button" className="pp__actions-item" disabled={!canManage || actionBusy} title={!canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined} onClick={() => {
                setActionProjectId(null);
                setProjectEdit({ client: openActionProject.client, project: openActionProject.project });
            }}>
            {t('timeTrackingPage.common.edit')}
          </button>
          <button type="button" className="pp__actions-item" disabled={actionBusy} onClick={() => {
                setActionProjectId(null);
                navigate(getProjectDetailUrl(openActionProject.project.id, openActionProject.client.id));
            }}>
            {t('timeTrackingPage.projects.actions.open')}
          </button>
          {openActionProject.mapped.status !== 'archived' && (<button type="button" className="pp__actions-item" disabled={!canManage || actionBusy} title={!canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined} onClick={() => {
                void (async () => {
                    if (!canManage)
                        return;
                    const mapped = openActionProject.mapped;
                    const pausing = mapped.status !== 'paused';
                    if (pausing) {
                        const okPause = await showConfirm({
                            title: t('timeTrackingPage.projects.pauseConfirm.title'),
                            message: t('timeTrackingPage.projects.pauseConfirm.message').replace('{name}', mapped.name),
                            confirmLabel: t('timeTrackingPage.projects.actions.pause'),
                        });
                        if (!okPause)
                            return;
                    }
                    setActionBusy(true);
                    try {
                        await patchClientProject(openActionProject.client.id, openActionProject.project.id, buildProjectPauseTogglePatch(pausing));
                        setActionProjectId(null);
                        void loadClientProjects(openActionProject.client.id);
                        showToast({
                            message: pausing
                                ? t('timeTrackingPage.projects.pauseConfirm.paused')
                                : t('timeTrackingPage.projects.pauseConfirm.resumed'),
                            variant: 'success',
                        });
                    }
                    catch (e) {
                        await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.projects.errors.updateFailed') });
                    }
                    finally {
                        setActionBusy(false);
                    }
                })();
            }}>
            {openActionProject.mapped.status === 'paused'
                ? t('timeTrackingPage.projects.actions.resume')
                : t('timeTrackingPage.projects.actions.pause')}
          </button>)}
          <button type="button" className="pp__actions-item" disabled={!canManage || actionBusy} title={!canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined} onClick={() => {
                void (async () => {
                    if (!canManage)
                        return;
                    const mapped = openActionProject.mapped;
                    const restoring = mapped.status === 'archived';
                    if (!restoring) {
                        const okArchive = await showConfirm({
                            title: t('timeTrackingPage.projects.archiveConfirm.title'),
                            message: t('timeTrackingPage.projects.archiveConfirm.message').replace('{name}', mapped.name),
                            confirmLabel: t('timeTrackingPage.projects.actions.toArchive'),
                        });
                        if (!okArchive)
                            return;
                    }
                    setActionBusy(true);
                    try {
                        await patchClientProject(openActionProject.client.id, openActionProject.project.id, buildProjectArchiveTogglePatch(!restoring));
                        setActionProjectId(null);
                        void loadClientProjects(openActionProject.client.id);
                        showToast({
                            message: restoring
                                ? t('timeTrackingPage.projects.archiveConfirm.restored')
                                : t('timeTrackingPage.projects.archiveConfirm.archived'),
                            variant: 'success',
                        });
                    }
                    catch (e) {
                        await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.projects.errors.updateFailed') });
                    }
                    finally {
                        setActionBusy(false);
                    }
                })();
            }}>
            {openActionProject.mapped.status === 'archived' ? t('timeTrackingPage.projects.actions.restore') : t('timeTrackingPage.projects.actions.toArchive')}
          </button>
          <div className="pp__actions-sep"/>
          <button type="button" className="pp__actions-item pp__actions-item--danger" disabled={!canManage || actionBusy || openActionProject.mapped.deletable === false} title={!canManage
                ? t('timeTrackingPage.common.manageRoleHint')
                : openActionProject.mapped.deletable === false
                    ? t('timeTrackingPage.projects.actions.deleteBlocked')
                    : undefined} onClick={() => {
                void (async () => {
                    if (!canManage)
                        return;
                    const mapped = openActionProject.mapped;
                    if (mapped.deletable === false) {
                        await showAlert({ message: `${t('timeTrackingPage.projects.actions.deleteBlocked')}.` });
                        return;
                    }
                    const okDelete = await showConfirm({
                        title: t('timeTrackingPage.projects.deleteConfirm.title'),
                        message: t('timeTrackingPage.projects.deleteConfirm.message').replace('{name}', mapped.name),
                        variant: 'danger',
                        confirmLabel: t('timeTrackingPage.delete'),
                    });
                    if (!okDelete)
                        return;
                    setActionBusy(true);
                    try {
                        await deleteClientProject(openActionProject.client.id, openActionProject.project.id);
                        setActionProjectId(null);
                        void loadClientProjects(openActionProject.client.id);
                    }
                    catch (e) {
                        await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.projects.errors.deleteFailed') });
                    }
                    finally {
                        setActionBusy(false);
                    }
                })();
            }}>
            {t('timeTrackingPage.delete')}
          </button>
        </div>, document.body)}

      {quickClientOpen && (<QuickCreateClientModal canManage={canManage} onClose={() => setQuickClientOpen(false)} onCreated={onSaved} onOpenFullForm={() => setModal({ mode: 'create', row: null })}/>)}

      {modal && (<TimeManagerClientModal key={modal.mode === 'edit' && modal.row ? modal.row.id : 'create'} mode={modal.mode} initial={modal.row} canManage={canManage} onClose={() => setModal(null)} onSaved={onSaved}/>)}

      {projectEdit && (<ClientProjectModal key={projectEdit.project.id} mode="edit" fixedClientId={projectEdit.client.id} initial={projectEdit.project} canManage={canManage} onClose={() => setProjectEdit(null)} onSaved={onProjectSavedFromModal}/>)}

      {addContactOpen && (<AddClientContactModal includeArchived={includeArchived} canManage={canManage} onClose={() => setAddContactOpen(false)}/>)}

      {contactModalClient && (<AddClientContactForClientModal clientId={contactModalClient.id} clientName={contactModalClient.name} clientArchived={contactModalClient.is_archived} canManage={canManage} onClose={() => setContactModalClient(null)}/>)}

      {viewClient && (<ClientViewModal listRow={viewClient} canManage={canManage} onClose={() => setViewClient(null)} onClientUpdated={() => void loadClients()} onEdit={(detail) => {
                setViewClient(null);
                setModal({ mode: 'edit', row: detail });
            }}/>)}
    </div>);
}
