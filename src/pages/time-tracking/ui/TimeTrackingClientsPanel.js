import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './TimeTrackingForms.css';
import { useState, useMemo, useEffect, useRef, useCallback, useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatedLink, SearchableSelect, useAppDialog } from '@shared/ui';
import { listTimeManagerClients, listAllTimeManagerClientsMerged, listClientProjects, getTimeManagerClient, createTimeManagerClient, patchTimeManagerClient, deleteTimeManagerClient, listClientContacts, createClientContact, patchClientContact, deleteClientContact, fetchProjectsBudgetMetrics, applyBudgetMetricsToProjects, patchClientProject, deleteClientProject, isForbiddenError, TIME_TRACKING_PROJECT_CURRENCIES, } from '@entities/time-tracking';
import { TIME_TRACKING_LIST_PAGE_SIZE } from '@entities/time-tracking/model/timeTrackingListPageSize';
import { Pagination } from '@shared/ui/Pagination';
import { clientRowSearchText } from '@pages/time-tracking/lib/clientRowSearchText';
import { useCurrentUser } from '@shared/hooks';
import { getProjectDetailUrl } from '@shared/config';
import { formatDateRu } from '@shared/lib/formatDate';
import { mapClientProjectToProjectRow } from '@entities/time-tracking/model/mapClientProjectToProjectRow';
import { buildProjectArchiveTogglePatch, buildProjectPauseTogglePatch } from '@entities/time-tracking/lib/projectArchiveRestore';
import { canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { useI18n, ttProjectTypeLabel, ttProjectPluralWord } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { showToast } from '@shared/ui/app-toast';
import { ClientProjectModal } from './TimeTrackingClientProjectModal';
import { QuickCreateClientModal } from './QuickCreateClientModal';
import { ProjectsSkeleton, ProjectsTableSkeleton } from './ProjectsSkeleton';
import { AddClientContactForClientModal } from './AddClientContactForClientModal';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
const CURRENCIES = TIME_TRACKING_PROJECT_CURRENCIES;
const TT_MODAL_DD_Z = 12000;
const PP_ACTIONS_MENU_FALLBACK_W = 96;
const TYPE_COLOR = {
    'Время и материалы': { color: '#4f46e5', bg: 'rgba(37,99,235,0.08)' },
    'Фиксированная ставка': { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
    'Без бюджета': { color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
    'Пакет часов': { color: '#0d9488', bg: 'rgba(13,148,136,0.08)' },
};
const STATUS_DOT = {
    active: '#22c55e',
    paused: '#f59e0b',
    archived: '#94a3b8',
};
function fmtAmt(n, cur = 'UZS') {
    return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${cur}`;
}
function fmtGroupSpentByCurrency(projects) {
    const m = new Map();
    for (const p of projects) {
        const c = (p.currency || 'USD').trim() || 'USD';
        const add = Number.isFinite(p.spent) ? p.spent : 0;
        m.set(c, (m.get(c) ?? 0) + add);
    }
    if (m.size === 0)
        return '—';
    const parts = [...m.entries()].sort(([a], [b]) => {
        const rank = (x) => (x === 'USD' ? 0 : x === 'UZS' ? 1 : 2);
        return rank(a) - rank(b) || a.localeCompare(b, 'en');
    });
    return parts.map(([cur, sum]) => fmtAmt(sum, cur)).join(' · ');
}
function remainingPct(budget, spent) {
    if (!Number.isFinite(budget) || budget <= 0)
        return null;
    const pct = Math.round(((budget - spent) / budget) * 100);
    return Number.isFinite(pct) ? pct : null;
}
function spentPct(budget, spent) {
    if (!Number.isFinite(budget) || budget <= 0)
        return 0;
    return Math.min((spent / budget) * 100, 100);
}
function BudgetBar({ progressPercent, budget, spent, t, }) {
    const fallbackPct = (budget != null && spent != null) ? spentPct(budget, spent) : 0;
    const pct = Number.isFinite(progressPercent) ? Math.max(0, Number(progressPercent)) : fallbackPct;
    const over = pct > 100;
    const bluePct = Math.min(pct, 100);
    const redPct = over ? Math.min((pct - 100) * 0.8, 45) : 0;
    const title = Number.isFinite(progressPercent)
        ? t('timeTrackingPage.projects.table.progressTitle').replace('{percent}', String(Math.round(Number(progressPercent))))
        : t('timeTrackingPage.projects.table.spentBudgetTitle')
            .replace('{spent}', fmtAmt(spent ?? 0))
            .replace('{budget}', fmtAmt(budget ?? 0));
    return (_jsx("div", { className: "pp__bar-wrap", title: title, children: _jsxs("div", { className: "pp__bar", children: [_jsx("div", { className: "pp__bar-fill pp__bar-fill--blue", style: { width: `${bluePct}%` } }), over && _jsx("div", { className: "pp__bar-fill pp__bar-fill--red", style: { width: `${redPct}%` } })] }) }));
}
function ClientsScopeDropdown({ includeArchived, totalCount, onSelect, t, }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        const h = (e) => {
            if (ref.current && !ref.current.contains(e.target))
                setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);
    const label = includeArchived
        ? t('timeTrackingPage.clients.allClientsFilter').replace('{count}', String(totalCount))
        : t('timeTrackingPage.clients.activeClientsFilter').replace('{count}', String(totalCount));
    return (_jsxs("div", { ref: ref, className: "pp__status-wrap", children: [_jsxs("button", { type: "button", className: "pp__status-btn", onClick: () => setOpen((v) => !v), "aria-expanded": open, children: [label, " ", _jsx(IcoChevronPp, { cls: `pp__status-chevron${open ? ' pp__status-chevron--open' : ''}` })] }), open && (_jsxs("div", { className: "pp__status-dropdown", children: [_jsxs("button", { type: "button", className: `pp__status-opt${!includeArchived ? ' pp__status-opt--on' : ''}`, onClick: () => {
                            onSelect(false);
                            setOpen(false);
                        }, children: [!includeArchived && _jsx(IcoCheck, {}), " ", t('timeTrackingPage.clients.activeClientsFilter').replace('{count}', String(totalCount))] }), _jsxs("button", { type: "button", className: `pp__status-opt${includeArchived ? ' pp__status-opt--on' : ''}`, onClick: () => {
                            onSelect(true);
                            setOpen(false);
                        }, children: [includeArchived && _jsx(IcoCheck, {}), " ", t('timeTrackingPage.clients.allClientsFilter').replace('{count}', String(totalCount))] })] }))] }));
}
const IcoSearch = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("path", { d: "m21 21-4.35-4.35" })] }));
const IcoChevron = () => (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: _jsx("path", { d: "M6 9l6 6 6-6" }) }));
const IcoChevronPp = ({ cls = '' }) => (_jsx("svg", { className: cls, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M6 9l6 6 6-6" }) }));
const IcoPlus = () => (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }));
const IcoFolder = () => (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }) }));
const IcoCheck = () => (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: _jsx("polyline", { points: "20 6 9 17 4 12" }) }));
function telHref(raw) {
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
function ContactPhoneEmailMeta({ phone, email, }) {
    const p = phone?.trim() ?? '';
    const e = email?.trim() ?? '';
    if (!p && !e)
        return null;
    const tel = p ? telHref(p) : null;
    const mail = e ? `mailto:${encodeURIComponent(e)}` : null;
    return (_jsxs("span", { className: "tt-tm-contact-list__meta", children: [p ? (tel ? (_jsx("a", { href: tel, className: "tt-tm-contact-link", children: p })) : (_jsx("span", { children: p }))) : null, p && e ? ' · ' : null, e && mail ? (_jsx("a", { href: mail, className: "tt-tm-contact-link", children: e })) : null] }));
}
function pctToInput(v) {
    if (v == null || v === '')
        return '';
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? String(n) : '';
}
function parseOptionalPercent(s, t) {
    const trimmed = s.trim();
    if (!trimmed)
        return { ok: true, value: null };
    const n = parseFloat(trimmed.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
        return { ok: false, message: t('timeTrackingPage.clients.errors.percentRange') };
    }
    return { ok: true, value: n };
}
function emptyForm() {
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
function rowToForm(c) {
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
function formatInvoiceDueLabel(c, t) {
    const mode = c.invoice_due_mode || 'custom';
    const days = c.invoice_due_days_after_issue;
    if (mode === 'custom' && days != null)
        return t('timeTrackingPage.clients.invoiceDue.afterInvoiceDays').replace('{days}', String(days));
    if (days != null)
        return t('timeTrackingPage.clients.invoiceDue.modeDays').replace('{mode}', mode).replace('{days}', String(days));
    return mode === 'custom' ? t('timeTrackingPage.clients.modal.paymentAfterInvoice') : mode;
}
function formatPercentDisplay(v) {
    if (v == null || v === '')
        return '';
    return pctToInput(v);
}
function ViewReadonlyField({ label, value }) {
    const show = value.trim() !== '';
    return (_jsxs("div", { className: "tt-tm-view-field", children: [_jsx("div", { className: "tt-tm-view-field__label", children: label }), _jsx("div", { className: `tt-tm-view-field__value${show ? '' : ' tt-tm-view-field__value--empty'}`, children: show ? value : '—' })] }));
}
function ClientViewModal({ listRow, canManage, onClose, onEdit, onClientUpdated }) {
    const uid = useId();
    const { t } = useI18n();
    const { showAlert } = useAppDialog();
    const [restoring, setRestoring] = useState(false);
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const onKey = (e) => {
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
    }, [listRow.id, t]);
    const c = detail ?? listRow;
    const extras = c.extra_contacts ?? [];
    return portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--client tt-tm-modal--client-view", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-view-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { id: `${uid}-view-title`, className: "tt-tm-modal__title", children: t('timeTrackingPage.clients.viewModal.title') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tt-tm-modal__body", children: [loading && (_jsx("p", { className: "tt-tm-hint", role: "status", children: t('timeTrackingPage.clients.modal.loadingCard') })), error && (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: error })), !loading && !error && c.is_archived && (_jsx("p", { className: "tt-tm-archived-banner", role: "status", children: t('timeTrackingPage.clients.viewModal.archivedBanner') })), _jsx(ViewReadonlyField, { label: t('timeTrackingPage.clients.viewModal.name'), value: c.name }), _jsx(ViewReadonlyField, { label: t('timeTrackingPage.clients.modal.address'), value: c.address ?? '' }), _jsxs("fieldset", { className: "tt-tm-fieldset tt-tm-fieldset--view", children: [_jsx("legend", { className: "tt-tm-fieldset-legend", children: t('timeTrackingPage.clients.modal.organization') }), _jsxs("div", { className: "tt-tm-view-grid", children: [_jsx(ViewReadonlyField, { label: t('timeTrackingPage.common.phone'), value: c.phone ?? '' }), _jsx(ViewReadonlyField, { label: t('timeTrackingPage.clients.modal.email'), value: c.email ?? '' })] })] }), _jsxs("fieldset", { className: "tt-tm-fieldset tt-tm-fieldset--view", children: [_jsx("legend", { className: "tt-tm-fieldset-legend", children: t('timeTrackingPage.clients.modal.mainContact') }), _jsx(ViewReadonlyField, { label: t('timeTrackingPage.clients.modal.contactName'), value: c.contact_name ?? '' }), _jsxs("div", { className: "tt-tm-view-grid", children: [_jsx(ViewReadonlyField, { label: t('timeTrackingPage.common.phone'), value: c.contact_phone ?? '' }), _jsx(ViewReadonlyField, { label: t('timeTrackingPage.clients.modal.contactEmail'), value: c.contact_email ?? '' })] })] }), _jsxs("fieldset", { className: "tt-tm-fieldset tt-tm-fieldset--view", children: [_jsx("legend", { className: "tt-tm-fieldset-legend", children: t('timeTrackingPage.clients.viewModal.billing') }), _jsxs("div", { className: "tt-tm-view-grid tt-tm-view-grid--3", children: [_jsx(ViewReadonlyField, { label: t('timeTrackingPage.clients.modal.invoiceCurrency'), value: c.currency || 'USD' }), _jsx(ViewReadonlyField, { label: t('timeTrackingPage.clients.modal.paymentTerms'), value: formatInvoiceDueLabel(c, t) }), _jsx(ViewReadonlyField, { label: t('timeTrackingPage.clients.viewModal.tax'), value: formatPercentDisplay(c.tax_percent) }), _jsx(ViewReadonlyField, { label: t('timeTrackingPage.clients.viewModal.tax2'), value: formatPercentDisplay(c.tax2_percent) }), _jsx(ViewReadonlyField, { label: t('timeTrackingPage.clients.viewModal.discount'), value: formatPercentDisplay(c.discount_percent) })] })] }), _jsxs("fieldset", { className: "tt-tm-fieldset tt-tm-fieldset--view", children: [_jsx("legend", { className: "tt-tm-fieldset-legend", children: t('timeTrackingPage.clients.modal.additionalContacts') }), extras.length === 0 ? (_jsx("p", { className: "tt-tm-hint tt-tm-hint--inline", children: t('timeTrackingPage.clients.viewModal.noExtraContacts') })) : (_jsx("ul", { className: "tt-tm-contact-list tt-tm-contact-list--view", children: extras.map((x) => (_jsx("li", { className: "tt-tm-contact-list__item tt-tm-contact-list__item--view", children: _jsxs("div", { className: "tt-tm-contact-list__main", children: [_jsx("span", { className: "tt-tm-contact-list__name", children: x.name }), _jsx(ContactPhoneEmailMeta, { phone: x.phone, email: x.email })] }) }, x.id))) }))] }), c.created_at && (_jsxs("p", { className: "tt-tm-view-meta", children: [t('timeTrackingPage.clients.viewModal.created').replace('{date}', formatDateRu(c.created_at)), c.updated_at ? t('timeTrackingPage.clients.viewModal.updated').replace('{date}', formatDateRu(c.updated_at)) : ''] }))] }), _jsxs("div", { className: "tt-tm-modal__foot", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", onClick: onClose, children: t('timeTrackingPage.close') }), canManage && !loading && c.is_archived && (_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--outline tt-settings__btn--accent-text", disabled: restoring, onClick: () => void (async () => {
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
                            })(), children: restoring ? t('timeTrackingPage.common.restoring') : t('timeTrackingPage.common.fromArchive') })), canManage && !loading && (_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", onClick: () => onEdit(detail ?? listRow), children: t('timeTrackingPage.common.edit') }))] })] }) }));
}
function TimeManagerClientModal({ mode, initial, canManage, onClose, onSaved }) {
    const uid = useId();
    const { t } = useI18n();
    const { showConfirm } = useAppDialog();
    const [form, setForm] = useState(() => (initial ? rowToForm(initial) : emptyForm()));
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [extraContacts, setExtraContacts] = useState([]);
    const [contactsError, setContactsError] = useState(null);
    const [contactBusy, setContactBusy] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [editingId, setEditingId] = useState(null);
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
    }, [mode, initial, t]);
    const clientId = mode === 'edit' && initial?.id ? initial.id : null;
    const archivedLocked = Boolean(form.isArchived && canManage);
    const refreshContactsFromServer = useCallback(async () => {
        if (!clientId)
            return;
        try {
            const [row, listed] = await Promise.all([
                getTimeManagerClient(clientId),
                listClientContacts(clientId).catch(() => []),
            ]);
            const byId = new Map();
            for (const c of [...(row.extra_contacts ?? []), ...listed]) {
                if (c?.id)
                    byId.set(c.id, c);
            }
            setExtraContacts([...byId.values()]);
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
        let days = null;
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
    const startEditContact = (c) => {
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
    const handleDeleteContact = async (contactId, contactName) => {
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
    return portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--client", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { id: `${uid}-title`, className: "tt-tm-modal__title", children: mode === 'create' ? t('timeTrackingPage.clients.modal.createTitle') : t('timeTrackingPage.clients.modal.editTitle') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tt-tm-modal__body", children: [detailLoading && mode === 'edit' && (_jsx("p", { className: "tt-tm-hint", role: "status", children: t('timeTrackingPage.clients.modal.loadingCard') })), form.isArchived && mode === 'edit' && (_jsx("p", { className: "tt-tm-archived-banner", role: "status", children: t('timeTrackingPage.clients.modal.archivedBanner') })), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-name`, children: [t('timeTrackingPage.clients.modal.clientName'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx("input", { id: `${uid}-name`, className: "tt-tm-input", value: form.name, onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })), autoComplete: "organization" })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-addr`, children: t('timeTrackingPage.clients.modal.address') }), _jsx("textarea", { id: `${uid}-addr`, className: "tt-tm-textarea", rows: 2, value: form.address, onChange: (e) => setForm((f) => ({ ...f, address: e.target.value })) })] }), _jsxs("fieldset", { className: "tt-tm-fieldset", children: [_jsx("legend", { className: "tt-tm-fieldset-legend", children: t('timeTrackingPage.clients.modal.organization') }), _jsxs("div", { className: "tt-tm-field-row tt-tm-field-row--grid-3", children: [_jsxs("div", { className: "tt-tm-field tt-tm-field--cell", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-org-phone`, children: t('timeTrackingPage.common.phone') }), _jsx("input", { id: `${uid}-org-phone`, className: "tt-tm-input", value: form.phone, onChange: (e) => setForm((f) => ({ ...f, phone: e.target.value })), autoComplete: "tel" })] }), _jsxs("div", { className: "tt-tm-field tt-tm-field--cell", style: { gridColumn: 'span 2' }, children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-org-email`, children: t('timeTrackingPage.clients.modal.email') }), _jsx("input", { id: `${uid}-org-email`, type: "email", className: "tt-tm-input", value: form.email, onChange: (e) => setForm((f) => ({ ...f, email: e.target.value })), autoComplete: "email" })] })] })] }), _jsxs("fieldset", { className: "tt-tm-fieldset", children: [_jsx("legend", { className: "tt-tm-fieldset-legend", children: t('timeTrackingPage.clients.modal.mainContact') }), _jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-cname`, children: t('timeTrackingPage.clients.modal.contactName') }), _jsx("input", { id: `${uid}-cname`, className: "tt-tm-input", value: form.contactName, onChange: (e) => setForm((f) => ({ ...f, contactName: e.target.value })) })] }), _jsxs("div", { className: "tt-tm-field-row tt-tm-field-row--grid-3", children: [_jsxs("div", { className: "tt-tm-field tt-tm-field--cell", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-cphone`, children: t('timeTrackingPage.clients.contacts.contactPhoneLabel') }), _jsx("input", { id: `${uid}-cphone`, className: "tt-tm-input", value: form.contactPhone, onChange: (e) => setForm((f) => ({ ...f, contactPhone: e.target.value })), autoComplete: "tel" })] }), _jsxs("div", { className: "tt-tm-field tt-tm-field--cell", style: { gridColumn: 'span 2' }, children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-cemail`, children: t('timeTrackingPage.clients.contacts.contactEmailLabel') }), _jsx("input", { id: `${uid}-cemail`, type: "email", className: "tt-tm-input", value: form.contactEmail, onChange: (e) => setForm((f) => ({ ...f, contactEmail: e.target.value })), autoComplete: "email" })] })] })] }), _jsxs("div", { className: "tt-tm-field-row tt-tm-field-row--grid-3", role: "group", "aria-label": t('timeTrackingPage.clients.contacts.billingGroupAria'), children: [_jsxs("div", { className: "tt-tm-field tt-tm-field--cell", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-cur`, children: t('timeTrackingPage.clients.modal.invoiceCurrency') }), _jsx("select", { id: `${uid}-cur`, className: "tt-tm-select", value: CURRENCIES.includes(form.currency) ? form.currency : 'USD', onChange: (e) => setForm((f) => ({ ...f, currency: e.target.value })), children: CURRENCIES.map((c) => (_jsx("option", { value: c, children: c }, c))) })] }), _jsxs("div", { className: "tt-tm-field tt-tm-field--cell", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-mode`, children: t('timeTrackingPage.clients.modal.paymentTerms') }), _jsx("select", { id: `${uid}-mode`, className: "tt-tm-select", value: form.invoiceDueMode, onChange: (e) => setForm((f) => ({ ...f, invoiceDueMode: e.target.value })), title: t('timeTrackingPage.clients.contacts.invoiceDueModeTitle'), children: _jsx("option", { value: "custom", children: t('timeTrackingPage.clients.modal.paymentAfterInvoice') }) })] }), _jsxs("div", { className: "tt-tm-field tt-tm-field--cell", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-days`, title: t('timeTrackingPage.clients.contacts.daysAfterInvoiceTitle'), children: t('timeTrackingPage.clients.contacts.daysAfterInvoice') }), _jsx("input", { id: `${uid}-days`, type: "number", min: 0, max: 3650, className: "tt-tm-input", placeholder: "15", value: form.invoiceDueDaysAfterIssue, onChange: (e) => setForm((f) => ({ ...f, invoiceDueDaysAfterIssue: e.target.value })) })] })] }), _jsxs("div", { className: "tt-tm-field-row tt-tm-field-row--grid-3", role: "group", "aria-label": t('timeTrackingPage.clients.contacts.taxesGroupAria'), children: [_jsxs("div", { className: "tt-tm-field tt-tm-field--cell", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-tax`, children: t('timeTrackingPage.clients.viewModal.tax') }), _jsx("input", { id: `${uid}-tax`, type: "text", inputMode: "decimal", className: "tt-tm-input", placeholder: t('timeTrackingPage.clients.contacts.taxPlaceholder'), value: form.taxPercent, onChange: (e) => setForm((f) => ({ ...f, taxPercent: e.target.value })) })] }), _jsxs("div", { className: "tt-tm-field tt-tm-field--cell", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-tax2`, children: t('timeTrackingPage.clients.viewModal.tax2') }), _jsx("input", { id: `${uid}-tax2`, type: "text", inputMode: "decimal", className: "tt-tm-input", placeholder: t('timeTrackingPage.invoices.detail.optionalPlaceholder'), value: form.tax2Percent, onChange: (e) => setForm((f) => ({ ...f, tax2Percent: e.target.value })) })] }), _jsxs("div", { className: "tt-tm-field tt-tm-field--cell", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-disc`, children: t('timeTrackingPage.clients.viewModal.discount') }), _jsx("input", { id: `${uid}-disc`, type: "text", inputMode: "decimal", className: "tt-tm-input", placeholder: t('timeTrackingPage.clients.contacts.discountPlaceholder'), value: form.discountPercent, onChange: (e) => setForm((f) => ({ ...f, discountPercent: e.target.value })) })] })] }), _jsxs("label", { className: "tt-tm-check-row", children: [_jsx("input", { type: "checkbox", checked: form.isArchived, onChange: (e) => setForm((f) => ({ ...f, isArchived: e.target.checked })) }), _jsx("span", { children: t('timeTrackingPage.clients.contacts.isArchivedHint') })] }), mode === 'edit' && clientId && (_jsxs("fieldset", { className: "tt-tm-fieldset", children: [_jsx("legend", { className: "tt-tm-fieldset-legend", children: t('timeTrackingPage.clients.modal.additionalContacts') }), !canManage && (_jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.clients.contacts.insufficientRightsEdit') })), archivedLocked && canManage && (_jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.clients.contacts.unarchiveToEdit') })), contactsError && (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: contactsError })), _jsx("ul", { className: "tt-tm-contact-list", children: extraContacts.map((c) => (_jsx("li", { className: "tt-tm-contact-list__item", children: editingId === c.id ? (_jsxs("div", { className: "tt-tm-contact-edit", children: [_jsx("input", { className: "tt-tm-input", value: editName, onChange: (e) => setEditName(e.target.value), placeholder: t('timeTrackingPage.clients.contacts.nameRequired'), "aria-label": t('timeTrackingPage.clients.contacts.contactNameAria') }), _jsx("input", { className: "tt-tm-input", value: editPhone, onChange: (e) => setEditPhone(e.target.value), placeholder: t('timeTrackingPage.common.phone'), "aria-label": t('timeTrackingPage.common.phone') }), _jsx("input", { className: "tt-tm-input", type: "email", value: editEmail, onChange: (e) => setEditEmail(e.target.value), placeholder: t('timeTrackingPage.clients.modal.email'), "aria-label": t('timeTrackingPage.clients.modal.email') }), _jsxs("div", { className: "tt-tm-contact-edit__actions", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", disabled: contactBusy, onClick: cancelEditContact, children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: contactBusy, onClick: () => void saveEditContact(), children: t('timeTrackingPage.save') })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tt-tm-contact-list__main", children: [_jsx("span", { className: "tt-tm-contact-list__name", children: c.name }), _jsx(ContactPhoneEmailMeta, { phone: c.phone, email: c.email })] }), canManage && !archivedLocked && (_jsxs("div", { className: "tt-tm-contact-list__actions", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--outline", disabled: contactBusy || Boolean(editingId), onClick: () => startEditContact(c), children: t('timeTrackingPage.common.change') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--outline tt-settings__row-edit--danger", disabled: contactBusy || Boolean(editingId), onClick: () => void handleDeleteContact(c.id, c.name), children: t('timeTrackingPage.delete') })] }))] })) }, c.id))) }), canManage && !archivedLocked && (_jsxs("div", { className: "tt-tm-contact-add", children: [_jsx("span", { className: "tt-tm-label", children: t('timeTrackingPage.clients.contacts.newContact') }), _jsxs("div", { className: "tt-tm-contact-add__row", children: [_jsx("input", { className: "tt-tm-input", value: newName, onChange: (e) => setNewName(e.target.value), placeholder: t('timeTrackingPage.clients.contacts.nameRequired'), "aria-label": t('timeTrackingPage.clients.contacts.newContactNameAria') }), _jsx("input", { className: "tt-tm-input", value: newPhone, onChange: (e) => setNewPhone(e.target.value), placeholder: t('timeTrackingPage.common.phone') }), _jsx("input", { className: "tt-tm-input", type: "email", value: newEmail, onChange: (e) => setNewEmail(e.target.value), placeholder: t('timeTrackingPage.clients.modal.email') })] }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--outline tt-settings__btn--accent-text", disabled: contactBusy || detailLoading || !clientId, onClick: () => void handleAddContact(), children: t('timeTrackingPage.clients.contacts.addContactBtn') })] }))] })), error && (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: error }))] }), _jsxs("div", { className: "tt-tm-modal__foot", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", disabled: saving, onClick: onClose, children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: saving || (mode === 'edit' && detailLoading), onClick: () => void handleSubmit(), children: saving ? t('timeTrackingPage.saving') : mode === 'create' ? t('timeTrackingPage.common.create') : t('timeTrackingPage.save') })] })] }) }));
}
function AddClientContactModal({ includeArchived, canManage, onClose }) {
    const uid = useId();
    const { t } = useI18n();
    const [clients, setClients] = useState([]);
    const [listLoading, setListLoading] = useState(true);
    const [clientId, setClientId] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        let cancelled = false;
        setListLoading(true);
        void listAllTimeManagerClientsMerged(includeArchived)
            .then((rows) => {
            if (cancelled)
                return;
            const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
            setClients(sorted);
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
        const onKey = (e) => {
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
    return portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--add-contact", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-add-contact-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { id: `${uid}-add-contact-title`, className: "tt-tm-modal__title", children: t('timeTrackingPage.clients.addContactModal.title') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tt-tm-modal__body", children: [!canManage && (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: t('timeTrackingPage.clients.addContactModal.insufficientRights') })), listLoading && _jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.clients.contacts.loadingList') }), !listLoading && clients.length === 0 && (_jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.clients.createClientFirst') })), !listLoading && clients.length > 0 && activeClients.length === 0 && (_jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.clients.contacts.allArchivedHint') })), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", id: `${uid}-add-contact-client-lbl`, htmlFor: `${uid}-client`, children: [t('timeTrackingPage.common.client'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx(SearchableSelect, { className: "tt-tm-dd", buttonClassName: "tt-tm-dd__btn", buttonId: `${uid}-client`, value: clientId, items: activeClients, getOptionValue: (c) => c.id, getOptionLabel: (c) => c.name, getSearchText: clientRowSearchText, onSelect: (c) => setClientId(c.id), placeholder: t('timeTrackingPage.common.selectClient'), emptyListText: t('timeTrackingPage.common.noClients'), noMatchText: t('timeTrackingPage.common.clientNotFound'), disabled: !canManage || listLoading || activeClients.length === 0 || saving, portalDropdown: true, portalZIndex: TT_MODAL_DD_Z, portalMinWidth: 320, portalDropdownClassName: "tsp-srch__dropdown--tall", "aria-labelledby": `${uid}-add-contact-client-lbl`, renderOption: (c) => (_jsxs("span", { className: "tt-tm-dd__opt", children: [_jsx("span", { className: "tt-tm-dd__opt-name", children: c.name }), c.address ? (_jsx("span", { className: "tt-tm-dd__opt-sub", children: c.address })) : c.email ? (_jsx("span", { className: "tt-tm-dd__opt-sub", children: c.email })) : null] })) })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-cname`, children: [t('timeTrackingPage.clients.addContactModal.contactName'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx("input", { id: `${uid}-cname`, className: "tt-tm-input", value: name, onChange: (e) => setName(e.target.value), placeholder: t('timeTrackingPage.clients.addContactModal.contactNamePlaceholder'), disabled: !canManage })] }), _jsxs("div", { className: "tt-tm-field-row tt-tm-field-row--grid-3", children: [_jsxs("div", { className: "tt-tm-field tt-tm-field--cell", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-cphone`, children: t('timeTrackingPage.common.phone') }), _jsx("input", { id: `${uid}-cphone`, className: "tt-tm-input", value: phone, onChange: (e) => setPhone(e.target.value), autoComplete: "tel", disabled: !canManage })] }), _jsxs("div", { className: "tt-tm-field tt-tm-field--cell", style: { gridColumn: 'span 2' }, children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-cemail`, children: t('timeTrackingPage.clients.modal.email') }), _jsx("input", { id: `${uid}-cemail`, type: "email", className: "tt-tm-input", value: email, onChange: (e) => setEmail(e.target.value), autoComplete: "email", disabled: !canManage })] })] }), _jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.clients.addContactModal.hint') }), error && (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: error }))] }), _jsxs("div", { className: "tt-tm-modal__foot", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", disabled: saving, onClick: onClose, children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: saving || !canManage || listLoading || activeClients.length === 0, onClick: () => void submit(), children: saving ? t('timeTrackingPage.saving') : t('timeTrackingPage.add') })] })] }) }));
}
export function TimeTrackingClientsPanel() {
    const { t, locale } = useI18n();
    const { user } = useCurrentUser();
    const { showAlert, showConfirm } = useAppDialog();
    const canManage = canManageTimeTrackingClients(user);
    const navigate = useNavigate();
    const PAGE = TIME_TRACKING_LIST_PAGE_SIZE;
    const [clients, setClients] = useState([]);
    const [clientsPage, setClientsPage] = useState(1);
    const [clientsTotal, setClientsTotal] = useState(0);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [clientsSearchFull, setClientsSearchFull] = useState(null);
    const [clientsSearchLoading, setClientsSearchLoading] = useState(false);
    const [clientsSearchPage, setClientsSearchPage] = useState(1);
    const [includeArchived, setIncludeArchived] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const importRef = useRef(null);
    const [modal, setModal] = useState(null);
    const [viewClient, setViewClient] = useState(null);
    const [addContactOpen, setAddContactOpen] = useState(false);
    const [quickClientOpen, setQuickClientOpen] = useState(false);
    const [clientProjects, setClientProjects] = useState({});
    const [collapsed, setCollapsed] = useState(new Set());
    const [selectedProjectIds, setSelectedProjectIds] = useState(new Set());
    const [projectEdit, setProjectEdit] = useState(null);
    const [actionProjectId, setActionProjectId] = useState(null);
    const [clientMenuOpen, setClientMenuOpen] = useState(null);
    const clientMenuRef = useRef(null);
    const actionMenuRef = useRef(null);
    const menuPortalRef = useRef(null);
    const [menuPlacement, setMenuPlacement] = useState(null);
    const [actionBusy, setActionBusy] = useState(false);
    const [contactModalClient, setContactModalClient] = useState(null);
    const [restoreBusyId, setRestoreBusyId] = useState(null);
    useEffect(() => {
        const t = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
            setClientsPage(1);
            setClientsSearchPage(1);
        }, 300);
        return () => window.clearTimeout(t);
    }, [search]);
    const changeIncludeArchived = useCallback((value) => {
        setIncludeArchived(value);
        setClientsPage(1);
        setClientsSearchPage(1);
    }, []);
    const loadClientProjects = useCallback(async (clientId) => {
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
    const loadClients = useCallback(async (includeArchivedOverride, signal) => {
        const inc = includeArchivedOverride ?? includeArchived;
        setListLoading(true);
        setListError(null);
        try {
            const r = await listTimeManagerClients(inc, { limit: PAGE, offset: (clientsPage - 1) * PAGE }, signal);
            const rows = [...r.items].sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
            setClients(rows);
            setClientsTotal(r.total);
        }
        catch (e) {
            if (signal?.aborted)
                return;
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
            if (!signal?.aborted)
                setListLoading(false);
        }
    }, [includeArchived, clientsPage, PAGE, t]);
    const hasClientsSearch = Boolean(debouncedSearch);
    useEffect(() => {
        if (hasClientsSearch)
            return;
        const controller = new AbortController();
        void loadClients(undefined, controller.signal);
        return () => controller.abort();
    }, [loadClients, hasClientsSearch]);
    useEffect(() => {
        if (!hasClientsSearch) {
            setClientsSearchFull(null);
            setClientsSearchLoading(false);
            setClientsSearchPage(1);
            return;
        }
        let cancelled = false;
        setClientsSearchLoading(true);
        setClientsSearchPage(1);
        void listAllTimeManagerClientsMerged(includeArchived)
            .then((rows) => {
            if (cancelled)
                return;
            const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
            setClientsSearchFull(sorted);
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
    }, [includeArchived, hasClientsSearch]);
    const tableWrapRef = useRef(null);
    const handleClientsPageChange = useCallback((nextPage) => {
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
        const onDown = (e) => {
            const t = e.target;
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
        const onDown = (e) => {
            const t = e.target;
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
        const h = (e) => {
            if (importRef.current && !importRef.current.contains(e.target))
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
    const onSaved = useCallback((row) => {
        if (row.is_archived) {
            if (includeArchived)
                void loadClients(true);
            else
                changeIncludeArchived(true);
            return;
        }
        void loadClients();
    }, [changeIncludeArchived, includeArchived, loadClients]);
    const handleRestoreFromArchive = useCallback(async (c) => {
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
    const handleDelete = async (id, name) => {
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
    const toggleClientCollapse = (clientId) => {
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
    const toggleProjectSelect = (projectId) => {
        setSelectedProjectIds((prev) => {
            const n = new Set(prev);
            if (n.has(projectId))
                n.delete(projectId);
            else
                n.add(projectId);
            return n;
        });
    };
    const onProjectSavedFromModal = (row) => {
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
        return _jsx(ProjectsSkeleton, {});
    return (_jsxs("div", { className: "pp", children: [listError && (_jsx("p", { className: "tt-settings__banner-error pp__load-error", role: "alert", children: listError })), _jsxs("div", { className: "pp__topbar", children: [_jsxs("div", { className: "pp__topbar-left", children: [_jsx("h1", { className: "pp__title", children: t('timeTrackingPage.clients.title') }), _jsx(ClientsScopeDropdown, { includeArchived: includeArchived, totalCount: clientsPagerTotal, onSelect: changeIncludeArchived, t: t })] }), _jsxs("div", { className: "pp__topbar-right", children: [_jsxs("div", { className: "tt-settings__search-wrap pp__projects-search", children: [_jsx("span", { className: "tt-settings__search-icon", children: _jsx(IcoSearch, {}) }), _jsx("input", { type: "search", className: "tt-settings__search", placeholder: t('timeTrackingPage.clients.searchPlaceholder'), value: search, onChange: (e) => setSearch(e.target.value), "aria-label": t('timeTrackingPage.clients.searchAria') })] }), _jsxs("div", { className: "tt-settings__dropdown-wrap", ref: importRef, children: [_jsxs("button", { type: "button", className: "pp__filter-btn", onClick: () => setImportOpen((v) => !v), "aria-expanded": importOpen, children: [t('timeTrackingPage.clients.importExport'), " ", _jsx(IcoChevron, {})] }), importOpen && (_jsxs("div", { className: "tt-settings__dropdown", children: [_jsx("button", { type: "button", className: "tt-settings__dropdown-item", disabled: true, title: t('timeTrackingPage.clients.inDevelopment'), children: t('timeTrackingPage.clients.importClients') }), _jsx("button", { type: "button", className: "tt-settings__dropdown-item", disabled: true, title: t('timeTrackingPage.clients.inDevelopment'), children: t('timeTrackingPage.clients.exportClients') })] }))] }), _jsxs("button", { type: "button", className: "pp__filter-btn", disabled: !canManage || !hasClientsInDirectory, title: !canManage
                                    ? t('timeTrackingPage.common.manageRoleHint')
                                    : !hasClientsInDirectory
                                        ? t('timeTrackingPage.clients.createClientFirst')
                                        : undefined, onClick: () => setAddContactOpen(true), children: [_jsx(IcoPlus, {}), " ", t('timeTrackingPage.clients.addContact')] }), _jsxs("button", { type: "button", className: "pp__new-btn", disabled: !canManage, title: !canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined, onClick: () => setQuickClientOpen(true), children: [_jsx(IcoPlus, {}), " ", t('timeTrackingPage.clients.newClient')] })] })] }), !listBusy && !listError && !canManage && (_jsx("p", { className: "tt-settings__banner-info", role: "status", children: t('timeTrackingPage.common.viewOnlyClients') })), !listError && (_jsxs("div", { className: "pp__table-wrap", ref: tableWrapRef, children: [listBusy ? _jsx(ProjectsTableSkeleton, {}) : (_jsxs("div", { className: "pp__table", children: [_jsxs("div", { className: "pp__thead", children: [_jsx("span", { className: "pp__th pp__th--check", children: _jsx("span", { className: "pp__checkbox" }) }), _jsx("span", { className: "pp__th pp__th--name", children: t('timeTrackingPage.projects.table.clientProject') }), _jsx("span", { className: "pp__th pp__th--budget", children: t('timeTrackingPage.projects.table.budget') }), _jsx("span", { className: "pp__th pp__th--spent", children: t('timeTrackingPage.projects.table.spent') }), _jsx("span", { className: "pp__th pp__th--bar" }), _jsx("span", { className: "pp__th pp__th--remaining", children: t('timeTrackingPage.projects.table.remaining') }), _jsx("span", { className: "pp__th pp__th--costs", children: t('timeTrackingPage.projects.table.costs') }), _jsx("span", { className: "pp__th pp__th--actions" })] }), !listBusy && displayClients.length === 0 && (_jsxs("div", { className: "pp__empty", children: [_jsx(IcoFolder, {}), _jsx("span", { children: !hasClientsInDirectory && !debouncedSearch
                                            ? t('timeTrackingPage.clients.empty.noClients')
                                            : t('timeTrackingPage.clients.empty.noFilterMatch') })] })), !listBusy &&
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
                                    return (_jsxs("div", { className: `pp__group${isCollapsed ? ' pp__group--collapsed' : ''}`, children: [_jsxs("div", { className: "pp__client-row", children: [_jsxs("div", { className: "pp__client-row-main", onClick: () => toggleClientCollapse(c.id), role: "button", tabIndex: 0, "aria-expanded": !isCollapsed, onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && toggleClientCollapse(c.id), children: [_jsx("span", { className: `pp__client-chevron${!isCollapsed ? ' pp__client-chevron--open' : ''}`, children: _jsx(IcoChevronPp, {}) }), _jsx("span", { className: "pp__client-name", children: c.name }), c.is_archived && _jsx("span", { className: "tt-settings__archived-badge", children: t('timeTrackingPage.common.archived') }), _jsx("span", { className: "pp__client-meta", children: countLabel }), isCollapsed && pj && !projPanelLoading && rawProjects.length > 0 && (_jsx("span", { className: "pp__client-total", title: t('timeTrackingPage.projects.table.spentByCurrencyTitle'), children: fmtGroupSpentByCurrency(mappedForSpent) }))] }), _jsxs("div", { className: "pp__client-row-tools", ref: isClientMenuOpen ? clientMenuRef : undefined, children: [_jsxs("button", { type: "button", className: `pp__actions-btn pp__actions-btn--client${isClientMenuOpen ? ' pp__actions-btn--open' : ''}`, onClick: (e) => {
                                                                    e.stopPropagation();
                                                                    setClientMenuOpen(isClientMenuOpen ? null : c.id);
                                                                }, children: [t('timeTrackingPage.projects.actions.actions'), " ", _jsx(IcoChevronPp, { cls: `pp__actions-chevron${isClientMenuOpen ? ' pp__actions-chevron--open' : ''}` })] }), isClientMenuOpen && (_jsxs("div", { className: "pp__actions-menu", role: "menu", children: [_jsx("button", { type: "button", className: "pp__actions-item", onClick: () => {
                                                                            setClientMenuOpen(null);
                                                                            setViewClient(c);
                                                                        }, children: t('timeTrackingPage.common.details') }), _jsx("button", { type: "button", className: "pp__actions-item", disabled: !canManage, title: !canManage ? t('timeTrackingPage.common.insufficientRights') : undefined, onClick: () => {
                                                                            setClientMenuOpen(null);
                                                                            setModal({ mode: 'edit', row: c });
                                                                        }, children: t('timeTrackingPage.common.edit') }), c.is_archived && canManage && (_jsx("button", { type: "button", className: "pp__actions-item", disabled: restoreBusyId === c.id, onClick: () => {
                                                                            setClientMenuOpen(null);
                                                                            void handleRestoreFromArchive(c);
                                                                        }, children: restoreBusyId === c.id ? t('timeTrackingPage.common.restoring') : t('timeTrackingPage.common.fromArchive') })), _jsx("div", { className: "pp__actions-sep" }), _jsx("button", { type: "button", className: "pp__actions-item pp__actions-item--danger", disabled: !canManage || clientHasProjects, title: !canManage
                                                                            ? t('timeTrackingPage.common.insufficientRights')
                                                                            : clientHasProjects
                                                                                ? t('timeTrackingPage.clients.row.deleteBlockedHasProjects')
                                                                                : undefined, onClick: () => {
                                                                            setClientMenuOpen(null);
                                                                            void handleDelete(c.id, c.name);
                                                                        }, children: t('timeTrackingPage.delete') })] }))] }), canManage && (_jsxs("button", { type: "button", className: "pp__client-add-contact", disabled: Boolean(c.is_archived), title: c.is_archived
                                                            ? t('timeTrackingPage.projects.actions.clientArchivedContact')
                                                            : t('timeTrackingPage.projects.actions.addContact'), onClick: (e) => {
                                                            e.stopPropagation();
                                                            setContactModalClient({
                                                                id: c.id,
                                                                name: c.name,
                                                                is_archived: Boolean(c.is_archived),
                                                            });
                                                        }, children: [_jsx(IcoPlus, {}), _jsx("span", { children: t('timeTrackingPage.common.contact') })] }))] }), !isCollapsed && (_jsx(_Fragment, { children: projPanelLoading && rawProjects.length === 0 ? (_jsx("p", { className: "pp__client-panel-hint", role: "status", children: t('timeTrackingPage.clients.table.loadingProjects') })) : !projPanelLoading && rawProjects.length === 0 ? (_jsx("p", { className: "pp__client-panel-hint", children: t('timeTrackingPage.clients.table.noProjectsForClient') })) : (_jsx(_Fragment, { children: rawProjects.map((p) => {
                                                        const mapped = mapClientProjectToProjectRow(p, c);
                                                        const typeMeta = TYPE_COLOR[mapped.type];
                                                        const hasBudgetConfigured = mapped.hasBudgetConfigured !== false;
                                                        const hasBudget = mapped.budget != null;
                                                        const spentVal = Number.isFinite(mapped.spent) ? mapped.spent : 0;
                                                        const rem = mapped.remaining ?? (hasBudget ? mapped.budget - spentVal : null);
                                                        const over = rem != null && rem < 0;
                                                        const budgetVal = mapped.budget ?? 0;
                                                        const pctRaw = hasBudget && budgetVal > 0
                                                            ? (Number.isFinite(mapped.progressPercent)
                                                                ? Math.round(Number(mapped.progressPercent))
                                                                : remainingPct(budgetVal, spentVal))
                                                            : null;
                                                        const pct = pctRaw != null && Number.isFinite(pctRaw) ? pctRaw : null;
                                                        const isOpen = actionProjectId === p.id;
                                                        const isSelected = selectedProjectIds.has(p.id);
                                                        return (_jsxs("div", { className: `pp__row${isSelected ? ' pp__row--selected' : ''}`, onClick: () => navigate(getProjectDetailUrl(p.id, c.id)), style: { cursor: 'pointer' }, children: [_jsx("span", { className: "pp__td pp__td--check", onClick: (e) => e.stopPropagation(), children: _jsx("span", { className: `pp__checkbox${isSelected ? ' pp__checkbox--on' : ''}`, onClick: () => toggleProjectSelect(p.id), role: "checkbox", "aria-checked": isSelected, tabIndex: 0, onKeyDown: (e) => e.key === ' ' && toggleProjectSelect(p.id), children: isSelected && _jsx(IcoCheck, {}) }) }), _jsxs("span", { className: "pp__td pp__td--name", children: [_jsxs(AnimatedLink, { className: "pp__proj-name pp__proj-name--link", to: getProjectDetailUrl(p.id, c.id), children: [_jsx("span", { className: "pp__proj-dot", style: { background: STATUS_DOT[mapped.status] } }), p.name] }), _jsx("span", { className: "pp__type-badge", style: { color: typeMeta.color, background: typeMeta.bg }, children: ttProjectTypeLabel(mapped.type, t) })] }), _jsx("span", { className: "pp__td pp__td--budget", children: !hasBudgetConfigured
                                                                        ? (_jsx("span", { className: "pp__dash", children: t('timeTrackingPage.projects.table.noBudget') }))
                                                                        : hasBudget
                                                                            ? fmtAmt(mapped.budget, mapped.currency)
                                                                            : fmtAmt(0, mapped.currency) }), _jsxs("span", { className: "pp__td pp__td--spent pp__metric-cell", title: mapped.loggedHours != null
                                                                        ? `${fmtAmt(spentVal, mapped.currency)} · ${t('timeTrackingPage.projects.table.hoursLogged').replace('{hours}', mapped.loggedHours.toLocaleString(localeTag(locale)))}`
                                                                        : fmtAmt(spentVal, mapped.currency), children: [_jsx("span", { className: "pp__metric-primary", children: fmtAmt(spentVal, mapped.currency) }), mapped.loggedHours != null ? (_jsx("span", { className: "pp__metric-sub", children: t('timeTrackingPage.projects.table.hoursLogged').replace('{hours}', mapped.loggedHours.toLocaleString(localeTag(locale))) })) : null] }), _jsx("span", { className: "pp__td pp__td--bar", children: _jsx(BudgetBar, { progressPercent: mapped.progressPercent, budget: mapped.budget, spent: spentVal, t: t }) }), _jsx("span", { className: `pp__td pp__td--remaining pp__metric-cell${over ? ' pp__td--over' : ''}`, children: rem != null ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "pp__metric-primary pp__rem-val", children: [over ? '−' : '', fmtAmt(Math.abs(rem), mapped.currency)] }), pct != null && (_jsxs("span", { className: `pp__metric-sub pp__rem-pct${over ? ' pp__rem-pct--over' : ''}`, children: [over ? '−' : '', Math.abs(pct), "%"] }))] })) : (_jsx("span", { className: "pp__metric-primary pp__dash", children: fmtAmt(0, mapped.currency) })) }), _jsx("span", { className: "pp__td pp__td--costs", children: mapped.costs > 0 ? (_jsx("span", { className: "pp__costs-val", children: fmtAmt(mapped.costs, mapped.currency) })) : (_jsxs("span", { className: "pp__zero", children: ["0,00 ", mapped.currency] })) }), _jsx("span", { className: "pp__td pp__td--actions", onClick: (e) => e.stopPropagation(), children: _jsx("div", { className: "pp__actions-wrap", ref: isOpen ? actionMenuRef : undefined, children: _jsxs("button", { type: "button", className: `pp__actions-btn${isOpen ? ' pp__actions-btn--open' : ''}`, onClick: () => setActionProjectId(isOpen ? null : p.id), children: [t('timeTrackingPage.projects.actions.actions'), " ", _jsx(IcoChevronPp, { cls: `pp__actions-chevron${isOpen ? ' pp__actions-chevron--open' : ''}` })] }) }) })] }, p.id));
                                                    }) })) }))] }, c.id));
                                })] })), !listBusy && clientsPagerTotal > PAGE ? (_jsx(Pagination, { className: "pp__table-pagination", page: clientsPagerPage, totalCount: clientsPagerTotal, pageSize: PAGE, loading: listBusy, onPageChange: handleClientsPageChange })) : null] })), openActionProject && actionProjectId && createPortal(_jsxs("div", { ref: menuPortalRef, className: "pp__actions-menu pp__actions-menu--portal", style: menuPlacement
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
                    }, role: "menu", children: [_jsx("button", { type: "button", className: "pp__actions-item", disabled: !canManage || actionBusy, title: !canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined, onClick: () => {
                            setActionProjectId(null);
                            setProjectEdit({ client: openActionProject.client, project: openActionProject.project });
                        }, children: t('timeTrackingPage.common.edit') }), _jsx("button", { type: "button", className: "pp__actions-item", disabled: actionBusy, onClick: () => {
                            setActionProjectId(null);
                            navigate(getProjectDetailUrl(openActionProject.project.id, openActionProject.client.id));
                        }, children: t('timeTrackingPage.projects.actions.open') }), openActionProject.mapped.status !== 'archived' && (_jsx("button", { type: "button", className: "pp__actions-item", disabled: !canManage || actionBusy, title: !canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined, onClick: () => {
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
                        }, children: openActionProject.mapped.status === 'paused'
                            ? t('timeTrackingPage.projects.actions.resume')
                            : t('timeTrackingPage.projects.actions.pause') })), _jsx("button", { type: "button", className: "pp__actions-item", disabled: !canManage || actionBusy, title: !canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined, onClick: () => {
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
                        }, children: openActionProject.mapped.status === 'archived' ? t('timeTrackingPage.projects.actions.restore') : t('timeTrackingPage.projects.actions.toArchive') }), _jsx("div", { className: "pp__actions-sep" }), _jsx("button", { type: "button", className: "pp__actions-item pp__actions-item--danger", disabled: !canManage || actionBusy || openActionProject.mapped.deletable === false, title: !canManage
                            ? t('timeTrackingPage.common.manageRoleHint')
                            : openActionProject.mapped.deletable === false
                                ? t('timeTrackingPage.projects.actions.deleteBlocked')
                                : undefined, onClick: () => {
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
                        }, children: t('timeTrackingPage.delete') })] }), document.body), quickClientOpen && (_jsx(QuickCreateClientModal, { canManage: canManage, onClose: () => setQuickClientOpen(false), onCreated: onSaved, onOpenFullForm: () => setModal({ mode: 'create', row: null }) })), modal && (_jsx(TimeManagerClientModal, { mode: modal.mode, initial: modal.row, canManage: canManage, onClose: () => setModal(null), onSaved: onSaved }, modal.mode === 'edit' && modal.row ? modal.row.id : 'create')), projectEdit && (_jsx(ClientProjectModal, { mode: "edit", fixedClientId: projectEdit.client.id, initial: projectEdit.project, canManage: canManage, onClose: () => setProjectEdit(null), onSaved: onProjectSavedFromModal }, projectEdit.project.id)), addContactOpen && (_jsx(AddClientContactModal, { includeArchived: includeArchived, canManage: canManage, onClose: () => setAddContactOpen(false) })), contactModalClient && (_jsx(AddClientContactForClientModal, { clientId: contactModalClient.id, clientName: contactModalClient.name, clientArchived: contactModalClient.is_archived, canManage: canManage, onClose: () => setContactModalClient(null) })), viewClient && (_jsx(ClientViewModal, { listRow: viewClient, canManage: canManage, onClose: () => setViewClient(null), onClientUpdated: () => void loadClients(), onEdit: (detail) => {
                    setViewClient(null);
                    setModal({ mode: 'edit', row: detail });
                } }))] }));
}
