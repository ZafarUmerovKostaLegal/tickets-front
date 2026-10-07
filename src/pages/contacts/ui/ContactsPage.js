import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { isContactsHttpError, listAllContactsClientsMerged, listContactsClientContacts, listContactsColleagues, } from '@entities/contacts';
import { canAccessTimeTracking, canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { contactSearchText, downloadVCard, employeesToContactCards, flattenClientContacts, } from '../lib/contactsModel';
import { AddContactModal } from './AddContactModal';
import { ContactBusinessCard } from './ContactBusinessCard';
import './ContactsPage.css';
function formatContactsLoadError(e, fallback, serviceUnavailable) {
    if (isContactsHttpError(e, 503))
        return serviceUnavailable;
    return e instanceof Error ? e.message : fallback;
}
function IconSearch() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("path", { d: "m21 21-4.35-4.35" })] }));
}
function IconPlus() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", "aria-hidden": true, children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }));
}
export function ContactsPage() {
    const { t } = useI18n();
    const { user } = useCurrentUser();
    const canSeeClients = canAccessTimeTracking(user);
    const canManageClients = canManageTimeTrackingClients(user);
    const [tab, setTab] = useState('colleagues');
    const [search, setSearch] = useState('');
    const [employees, setEmployees] = useState([]);
    const [clients, setClients] = useState([]);
    const [colleaguesLoading, setColleaguesLoading] = useState(true);
    const [clientsLoading, setClientsLoading] = useState(false);
    const [colleaguesError, setColleaguesError] = useState(null);
    const [clientsError, setClientsError] = useState(null);
    const [addOpen, setAddOpen] = useState(false);
    useEffect(() => {
        let cancelled = false;
        setColleaguesLoading(true);
        setColleaguesError(null);
        void listContactsColleagues()
            .then((rows) => {
            if (!cancelled)
                setEmployees(rows);
        })
            .catch((e) => {
            if (!cancelled) {
                setColleaguesError(formatContactsLoadError(e, t('contactsPage.loadColleaguesFailed'), t('contactsPage.serviceUnavailable')));
                setEmployees([]);
            }
        })
            .finally(() => {
            if (!cancelled)
                setColleaguesLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [t]);
    const loadClients = useCallback(async () => {
        setClientsLoading(true);
        setClientsError(null);
        try {
            const rows = await listAllContactsClientsMerged(false);
            const enriched = [...rows];
            const missingIndexes = rows
                .map((client, index) => client.extra_contacts === undefined ? index : -1)
                .filter((index) => index >= 0);
            let cursor = 0;
            const workers = Array.from({ length: Math.min(6, missingIndexes.length) }, async () => {
                while (cursor < missingIndexes.length) {
                    const index = missingIndexes[cursor++];
                    const client = rows[index];
                    try {
                        const extra_contacts = await listContactsClientContacts(client.id);
                        enriched[index] = { ...client, extra_contacts };
                    }
                    catch {
                        // Keep the client row usable even when one contact list fails.
                    }
                }
            });
            await Promise.all(workers);
            setClients(enriched);
        }
        catch (e) {
            setClientsError(formatContactsLoadError(e, t('contactsPage.loadClientsFailed'), t('contactsPage.serviceUnavailable')));
            setClients([]);
        }
        finally {
            setClientsLoading(false);
        }
    }, [t]);
    useEffect(() => {
        if (!canSeeClients)
            return;
        void loadClients();
    }, [canSeeClients, loadClients]);
    const colleagueCards = useMemo(() => employeesToContactCards(employees), [employees]);
    const clientCards = useMemo(() => flattenClientContacts(clients), [clients]);
    const activeCards = tab === 'colleagues' ? colleagueCards : clientCards;
    const filteredCards = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q)
            return activeCards;
        return activeCards.filter((card) => contactSearchText(card).toLowerCase().includes(q));
    }, [activeCards, search]);
    const loading = tab === 'colleagues' ? colleaguesLoading : clientsLoading;
    const error = tab === 'colleagues' ? colleaguesError : clientsError;
    const emptyLabel = tab === 'colleagues' ? t('contactsPage.emptyColleagues') : t('contactsPage.emptyClients');
    return (_jsxs("div", { className: "contacts-page", children: [_jsxs("main", { className: "contacts-page__main", children: [_jsx("header", { className: "contacts-page__header", children: _jsxs("div", { className: "contacts-page__header-inner", children: [_jsxs("div", { className: "contacts-page__header-start", children: [_jsx(AppBackButton, { className: "app-back-btn" }), _jsx(AppHomeLogo, { withSeparator: true }), _jsxs("div", { children: [_jsx("h1", { className: "contacts-page__title", children: t('contactsPage.title') }), _jsx("p", { className: "contacts-page__subtitle", children: t('contactsPage.subtitle') })] })] }), _jsx(AppPageSettings, {})] }) }), _jsxs("nav", { className: "contacts-tabs", role: "tablist", "aria-label": t('contactsPage.title'), children: [_jsx("button", { type: "button", role: "tab", "aria-selected": tab === 'colleagues', className: `contacts-tabs__tab${tab === 'colleagues' ? ' contacts-tabs__tab--on' : ''}`, onClick: () => setTab('colleagues'), children: t('contactsPage.tabColleagues') }), canSeeClients ? (_jsx("button", { type: "button", role: "tab", "aria-selected": tab === 'clients', className: `contacts-tabs__tab${tab === 'clients' ? ' contacts-tabs__tab--on' : ''}`, onClick: () => setTab('clients'), children: t('contactsPage.tabClients') })) : null] }), _jsxs("div", { className: "contacts-page__content", role: "tabpanel", children: [_jsxs("div", { className: "contacts-page__toolbar", children: [_jsxs("div", { className: "contacts-page__search-wrap", children: [_jsx("span", { className: "contacts-page__search-icon", "aria-hidden": true, children: _jsx(IconSearch, {}) }), _jsx("input", { type: "search", className: "contacts-page__search", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('contactsPage.searchPlaceholder'), "aria-label": t('contactsPage.searchPlaceholder') })] }), tab === 'clients' && canSeeClients ? (_jsxs("button", { type: "button", className: "contacts-page__btn contacts-page__btn--primary", onClick: () => setAddOpen(true), disabled: !canManageClients, children: [_jsx(IconPlus, {}), t('contactsPage.addContact')] })) : null] }), !canSeeClients && tab === 'clients' ? (_jsx("p", { className: "contacts-page__hint", children: t('contactsPage.clientsAccessHint') })) : null, error ? _jsx("p", { className: "contacts-page__error", role: "alert", children: error }) : null, loading ? (_jsx("p", { className: "contacts-page__status", children: t('contactsPage.loading') })) : (_jsxs(_Fragment, { children: [!error && filteredCards.length === 0 ? (_jsx("p", { className: "contacts-page__status", children: emptyLabel })) : null, _jsx("ul", { className: "contacts-page__grid", role: "list", children: filteredCards.map((card) => {
                                            const isYou = tab === 'colleagues'
                                                && user?.id != null
                                                && card.id === `colleague-${user.id}`;
                                            return (_jsx("li", { role: "listitem", children: _jsx(ContactBusinessCard, { card: card, isYou: isYou, youBadge: t('contactsPage.youBadge'), primaryBadge: t('contactsPage.primaryContactBadge'), saveLabel: t('contactsPage.saveToPhone'), onSave: () => downloadVCard(card) }) }, card.id));
                                        }) })] }))] })] }), addOpen ? (_jsx(AddContactModal, { clients: clients, canManage: canManageClients, onClose: () => setAddOpen(false), onSaved: () => void loadClients() })) : null] }));
}
