import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useId, useState } from 'react';
import { getTimeManagerClient, listClientContacts, } from '@entities/time-tracking';
import { listContactsClientContacts } from '@entities/contacts';
import { connectOutlookCalendar, getCalendarStatus, invalidateCalendarApiCache, reconnectOutlookCalendar } from '@entities/todo/lib/calendarApi';
import { useI18n } from '@shared/i18n';
import { AddClientContactForClientModal, } from './AddClientContactForClientModal';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
import './TimeTrackingForms.css';
const PRIMARY_KEY = 'primary';
function optionHasEmail(opt) {
    return Boolean(opt.email?.trim());
}
function mergeContactRows(...lists) {
    const byId = new Map();
    for (const list of lists) {
        for (const row of list) {
            const id = String(row.id ?? '').trim();
            if (!id)
                continue;
            const prev = byId.get(id);
            if (!prev) {
                byId.set(id, row);
                continue;
            }
            byId.set(id, {
                ...prev,
                ...row,
                name: row.name.trim() || prev.name,
                email: row.email?.trim() || prev.email,
                phone: row.phone?.trim() || prev.phone,
            });
        }
    }
    return [...byId.values()];
}
function buildOptions(primaryName, primaryEmail, primaryPhone, extras) {
    const options = [];
    const pName = (primaryName ?? '').trim();
    const pEmail = (primaryEmail ?? '').trim() || null;
    const pPhone = (primaryPhone ?? '').trim() || null;
    if (pName || pEmail || pPhone) {
        options.push({
            key: PRIMARY_KEY,
            name: pName || pEmail || '—',
            email: pEmail,
            phone: pPhone,
            isPrimary: true,
        });
    }
    for (const row of extras) {
        options.push({
            key: row.id,
            name: row.name.trim() || row.email?.trim() || '—',
            email: row.email?.trim() || null,
            phone: row.phone?.trim() || null,
        });
    }
    return options;
}
function pickDefaultKey(options) {
    const withEmail = options.find(optionHasEmail);
    return withEmail?.key ?? '';
}
async function loadExtraContacts(clientId, embedded) {
    const settled = await Promise.allSettled([
        listClientContacts(clientId),
        listContactsClientContacts(clientId),
    ]);
    const fromTt = settled[0].status === 'fulfilled' ? settled[0].value : [];
    const fromContacts = settled[1].status === 'fulfilled' ? settled[1].value : [];
    return mergeContactRows(fromTt, fromContacts, embedded ?? []);
}
export function InvoiceSendContactModal({ clientId, clientName, invoiceLabel, onClose, onConfirm, }) {
    const { t } = useI18n();
    const uid = useId();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [options, setOptions] = useState([]);
    const [selectedKey, setSelectedKey] = useState('');
    const [clientArchived, setClientArchived] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [editContact, setEditContact] = useState(null);
    const [sending, setSending] = useState(false);
    const [outlookConnected, setOutlookConnected] = useState(null);
    const [outlookMailReady, setOutlookMailReady] = useState(null);
    const [outlookMailReason, setOutlookMailReason] = useState(null);
    const [outlookBusy, setOutlookBusy] = useState(false);
    const [outlookError, setOutlookError] = useState(null);
    const refreshOutlookStatus = useCallback(async () => {
        invalidateCalendarApiCache();
        try {
            const st = await getCalendarStatus();
            setOutlookConnected(st.connected);
            setOutlookMailReady(typeof st.mailReady === 'boolean' ? st.mailReady : null);
            setOutlookMailReason(st.mailReadyReason?.trim() || null);
        }
        catch {
            setOutlookConnected(false);
            setOutlookMailReady(false);
            setOutlookMailReason(null);
        }
    }, []);
    const applyLoaded = useCallback((primaryName, primaryEmail, primaryPhone, extras, preferKey) => {
        const next = buildOptions(primaryName, primaryEmail, primaryPhone, extras);
        setOptions(next);
        setSelectedKey((prev) => {
            if (preferKey && next.some((o) => o.key === preferKey && optionHasEmail(o)))
                return preferKey;
            if (prev && next.some((o) => o.key === prev && optionHasEmail(o)))
                return prev;
            return pickDefaultKey(next);
        });
    }, []);
    const reload = useCallback(async (preferKey) => {
        setLoading(true);
        setLoadError(null);
        try {
            const client = await getTimeManagerClient(clientId);
            setClientArchived(Boolean(client.is_archived));
            const extras = await loadExtraContacts(clientId, client.extra_contacts);
            applyLoaded(client.contact_name, client.contact_email ?? client.email, client.contact_phone ?? client.phone, extras, preferKey);
        }
        catch (e) {
            setLoadError(e instanceof Error ? e.message : t('timeTrackingPage.invoices.sendDialog.loadFailed'));
            setOptions([]);
            setSelectedKey('');
        }
        finally {
            setLoading(false);
        }
    }, [applyLoaded, clientId, t]);
    useEffect(() => {
        void reload();
    }, [reload]);
    useEffect(() => {
        void refreshOutlookStatus();
    }, [refreshOutlookStatus]);
    useEffect(() => {
        if (addOpen || editContact)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [addOpen, editContact, onClose]);
    const openEdit = (opt) => {
        setEditContact({
            kind: opt.isPrimary ? 'primary' : 'extra',
            id: opt.isPrimary ? undefined : opt.key,
            name: opt.name === '—' ? '' : opt.name,
            phone: opt.phone,
            email: opt.email,
        });
    };
    const selected = options.find((o) => o.key === selectedKey);
    const outlookReady = outlookConnected === true && outlookMailReady !== false;
    const canConfirm = Boolean(selected && optionHasEmail(selected) && !loading && !sending && outlookReady);
    const handleConnectOutlook = async () => {
        setOutlookError(null);
        setOutlookBusy(true);
        try {
            // Never use prompt=consent here: non-admins get «Требуется утверждение администратора»
            // even when org admin consent is already granted.
            if (!outlookConnected)
                await connectOutlookCalendar();
            else
                await reconnectOutlookCalendar();
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.outlookNotConnected');
            setOutlookError(/admin|админ|consent|соглас|утвержден/i.test(msg)
                ? t('timeTrackingPage.invoices.sendDialog.outlookAdminConsentHint')
                : msg);
            setOutlookBusy(false);
        }
    };
    const handleConfirm = async () => {
        if (!selected?.email || loading || sending)
            return;
        if (outlookConnected === null) {
            setOutlookError(t('timeTrackingPage.invoices.sendDialog.outlookChecking'));
            return;
        }
        if (!outlookReady) {
            setOutlookError(t('timeTrackingPage.invoices.sendDialog.connectBeforeSend'));
            return;
        }
        setOutlookError(null);
        setSending(true);
        try {
            await onConfirm({
                email: selected.email.trim(),
                name: selected.name.trim(),
            });
        }
        finally {
            setSending(false);
        }
    };
    return (_jsxs(_Fragment, { children: [portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", onClick: onClose, children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--add-contact tt-inv-send-contact", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-send-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { id: `${uid}-send-title`, className: "tt-tm-modal__title", children: t('timeTrackingPage.invoices.sendDialog.title') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tt-tm-modal__body", children: [_jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.invoices.sendDialog.invoiceLabel').replace('{invoice}', invoiceLabel) }), _jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.invoices.sendDialog.hint') }), _jsxs("div", { className: `tt-inv-send-contact__outlook${!outlookReady && outlookConnected !== null ? ' tt-inv-send-contact__outlook--warn' : ''}`, role: "group", "aria-label": t('timeTrackingPage.invoices.sendDialog.outlookAria'), children: [_jsx("p", { className: "tt-tm-hint", children: outlookConnected === null
                                                ? t('timeTrackingPage.invoices.sendDialog.outlookChecking')
                                                : !outlookConnected
                                                    ? t('timeTrackingPage.invoices.sendDialog.outlookDisconnected')
                                                    : outlookMailReady === false
                                                        ? outlookMailReason === 'no_exchange_mailbox'
                                                            ? t('timeTrackingPage.invoices.sendDialog.outlookNoMailboxLicense')
                                                            : outlookMailReason === 'missing_scope'
                                                                ? t('timeTrackingPage.invoices.sendDialog.outlookMailScopeMissing')
                                                                : t('timeTrackingPage.invoices.sendDialog.outlookMailNotReady')
                                                        : outlookMailReady === true
                                                            ? t('timeTrackingPage.invoices.sendDialog.outlookConnected')
                                                            : t('timeTrackingPage.invoices.sendDialog.outlookConnectedUnknownMail') }), !outlookReady && outlookConnected !== null && outlookMailReason !== 'no_exchange_mailbox' && (_jsx("p", { className: "tt-tm-hint tt-inv-send-contact__outlook-admin-hint", children: t('timeTrackingPage.invoices.sendDialog.outlookAdminConsentHint') })), outlookConnected && outlookMailReady === false && outlookMailReason === 'no_exchange_mailbox' && (_jsx("p", { className: "tt-tm-hint tt-inv-send-contact__outlook-admin-hint", children: t('timeTrackingPage.invoices.sendDialog.outlookLicenseHint') })), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", disabled: outlookBusy, onClick: () => void handleConnectOutlook(), children: outlookBusy
                                                ? t('timeTrackingPage.invoices.sendDialog.outlookConnecting')
                                                : !outlookConnected || outlookMailReady === false
                                                    ? t('timeTrackingPage.invoices.sendDialog.outlookConnect')
                                                    : t('timeTrackingPage.invoices.sendDialog.outlookReconnect') }), outlookError && (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: outlookError }))] }), loading && (_jsx("p", { className: "tt-tm-hint", role: "status", children: t('timeTrackingPage.invoices.sendDialog.loading') })), loadError && (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: loadError })), !loading && !loadError && options.length === 0 && (_jsx("p", { className: "tt-tm-hint", role: "status", children: t('timeTrackingPage.invoices.sendDialog.empty') })), !loading && options.length > 0 && (_jsx("ul", { className: "tt-tm-contact-list tt-inv-send-contact__list", role: "radiogroup", "aria-labelledby": `${uid}-send-title`, children: options.map((opt) => {
                                        const enabled = optionHasEmail(opt);
                                        const inputId = `${uid}-opt-${opt.key}`;
                                        return (_jsx("li", { className: `tt-tm-contact-list__item tt-inv-send-contact__item${enabled ? '' : ' tt-inv-send-contact__item--disabled'}`, children: _jsxs("div", { className: "tt-inv-send-contact__row", children: [_jsxs("label", { className: "tt-inv-send-contact__label", htmlFor: inputId, children: [_jsx("input", { id: inputId, type: "radio", name: `${uid}-send-contact`, value: opt.key, checked: selectedKey === opt.key, disabled: !enabled || sending, onChange: () => setSelectedKey(opt.key) }), _jsxs("span", { className: "tt-tm-contact-list__main", children: [_jsxs("span", { className: "tt-tm-contact-list__name", children: [opt.name, opt.isPrimary ? (_jsx("span", { className: "tt-inv-send-contact__badge", children: t('timeTrackingPage.invoices.sendDialog.primaryBadge') })) : null] }), _jsxs("span", { className: "tt-tm-contact-list__meta", children: [enabled
                                                                                ? opt.email
                                                                                : t('timeTrackingPage.invoices.sendDialog.noEmail'), opt.phone ? ` · ${opt.phone}` : ''] })] })] }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost tt-inv-send-contact__edit", disabled: sending || loading, onClick: () => openEdit(opt), children: t('timeTrackingPage.invoices.sendDialog.editContact') })] }) }, opt.key));
                                    }) }))] }), _jsxs("div", { className: "tt-tm-modal__foot", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", disabled: sending || loading, onClick: () => setAddOpen(true), children: t('timeTrackingPage.invoices.sendDialog.addContact') }), _jsxs("div", { className: "tt-inv-send-contact__foot-actions", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", onClick: onClose, children: t('timeTrackingPage.invoices.sendDialog.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: !canConfirm, title: !outlookReady && outlookConnected !== null
                                                ? t('timeTrackingPage.invoices.sendDialog.connectBeforeSend')
                                                : undefined, onClick: () => void handleConfirm(), children: sending
                                                ? t('timeTrackingPage.invoices.sendDialog.sending')
                                                : t('timeTrackingPage.invoices.sendDialog.confirm') })] })] })] }) })), addOpen && (_jsx(AddClientContactForClientModal, { clientId: clientId, clientName: clientName, clientArchived: clientArchived, canManage: true, onClose: () => setAddOpen(false), onCreated: (row) => {
                    const prefer = row.email?.trim() ? row.id : undefined;
                    void reload(prefer);
                } })), editContact && (_jsx(AddClientContactForClientModal, { clientId: clientId, clientName: clientName, clientArchived: clientArchived, canManage: true, editContact: editContact, onClose: () => setEditContact(null), onSaved: ({ key, email }) => {
                    const prefer = email?.trim() ? key : undefined;
                    void reload(prefer);
                } }))] }));
}
