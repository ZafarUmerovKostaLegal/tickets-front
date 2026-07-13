import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import {
    isContactsHttpError,
    listAllContactsClientsMerged,
    listContactsClientContacts,
    listContactsColleagues,
} from '@entities/contacts';
import type { TimeManagerClientRow, TimeTrackingUserRow } from '@entities/time-tracking';
import { canAccessTimeTracking, canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import {
    contactSearchText,
    downloadVCard,
    employeesToContactCards,
    flattenClientContacts,
} from '../lib/contactsModel';
import { AddContactModal } from './AddContactModal';
import { ContactBusinessCard } from './ContactBusinessCard';
import './ContactsPage.css';

type ContactsTab = 'colleagues' | 'clients';

function formatContactsLoadError(e: unknown, fallback: string, serviceUnavailable: string): string {
    if (isContactsHttpError(e, 503))
        return serviceUnavailable;
    return e instanceof Error ? e.message : fallback;
}

function IconSearch() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
        </svg>
    );
}

function IconPlus() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    );
}

export function ContactsPage() {
    const { t } = useI18n();
    const { user } = useCurrentUser();
    const canSeeClients = canAccessTimeTracking(user);
    const canManageClients = canManageTimeTrackingClients(user);

    const [tab, setTab] = useState<ContactsTab>('colleagues');
    const [search, setSearch] = useState('');
    const [employees, setEmployees] = useState<TimeTrackingUserRow[]>([]);
    const [clients, setClients] = useState<TimeManagerClientRow[]>([]);
    const [colleaguesLoading, setColleaguesLoading] = useState(true);
    const [clientsLoading, setClientsLoading] = useState(false);
    const [colleaguesError, setColleaguesError] = useState<string | null>(null);
    const [clientsError, setClientsError] = useState<string | null>(null);
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
                    setColleaguesError(formatContactsLoadError(
                        e,
                        t('contactsPage.loadColleaguesFailed'),
                        t('contactsPage.serviceUnavailable'),
                    ));
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
            const enriched = await Promise.all(rows.map(async (client) => {
                try {
                    const extra_contacts = await listContactsClientContacts(client.id);
                    return extra_contacts.length > 0 ? { ...client, extra_contacts } : client;
                }
                catch {
                    return client;
                }
            }));
            setClients(enriched);
        }
        catch (e) {
            setClientsError(formatContactsLoadError(
                e,
                t('contactsPage.loadClientsFailed'),
                t('contactsPage.serviceUnavailable'),
            ));
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

    return (
        <div className="contacts-page">
            <main className="contacts-page__main">
                <header className="contacts-page__header">
                    <div className="contacts-page__header-inner">
                        <div className="contacts-page__header-start">
                            <AppBackButton className="app-back-btn" />
                            <AppHomeLogo withSeparator />
                            <div>
                                <h1 className="contacts-page__title">{t('contactsPage.title')}</h1>
                                <p className="contacts-page__subtitle">{t('contactsPage.subtitle')}</p>
                            </div>
                        </div>
                        <AppPageSettings />
                    </div>
                </header>

                <nav className="contacts-tabs" role="tablist" aria-label={t('contactsPage.title')}>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'colleagues'}
                        className={`contacts-tabs__tab${tab === 'colleagues' ? ' contacts-tabs__tab--on' : ''}`}
                        onClick={() => setTab('colleagues')}
                    >
                        {t('contactsPage.tabColleagues')}
                    </button>
                    {canSeeClients ? (
                        <button
                            type="button"
                            role="tab"
                            aria-selected={tab === 'clients'}
                            className={`contacts-tabs__tab${tab === 'clients' ? ' contacts-tabs__tab--on' : ''}`}
                            onClick={() => setTab('clients')}
                        >
                            {t('contactsPage.tabClients')}
                        </button>
                    ) : null}
                </nav>

                <div className="contacts-page__content" role="tabpanel">
                    <div className="contacts-page__toolbar">
                        <div className="contacts-page__search-wrap">
                            <span className="contacts-page__search-icon" aria-hidden><IconSearch /></span>
                            <input
                                type="search"
                                className="contacts-page__search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t('contactsPage.searchPlaceholder')}
                                aria-label={t('contactsPage.searchPlaceholder')}
                            />
                        </div>
                        {tab === 'clients' && canSeeClients ? (
                            <button
                                type="button"
                                className="contacts-page__btn contacts-page__btn--primary"
                                onClick={() => setAddOpen(true)}
                                disabled={!canManageClients}
                            >
                                <IconPlus />
                                {t('contactsPage.addContact')}
                            </button>
                        ) : null}
                    </div>

                    {!canSeeClients && tab === 'clients' ? (
                        <p className="contacts-page__hint">{t('contactsPage.clientsAccessHint')}</p>
                    ) : null}

                    {error ? <p className="contacts-page__error" role="alert">{error}</p> : null}

                    {loading ? (
                        <p className="contacts-page__status">{t('contactsPage.loading')}</p>
                    ) : (
                        <>
                            {!error && filteredCards.length === 0 ? (
                                <p className="contacts-page__status">{emptyLabel}</p>
                            ) : null}
                            <ul className="contacts-page__grid" role="list">
                                {filteredCards.map((card) => {
                                    const isYou = tab === 'colleagues'
                                        && user?.id != null
                                        && card.id === `colleague-${user.id}`;
                                    return (
                                        <li key={card.id} role="listitem">
                                            <ContactBusinessCard
                                                card={card}
                                                isYou={isYou}
                                                youBadge={t('contactsPage.youBadge')}
                                                primaryBadge={t('contactsPage.primaryContactBadge')}
                                                saveLabel={t('contactsPage.saveToPhone')}
                                                onSave={() => downloadVCard(card)}
                                            />
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                </div>
            </main>

            {addOpen ? (
                <AddContactModal
                    clients={clients}
                    canManage={canManageClients}
                    onClose={() => setAddOpen(false)}
                    onSaved={() => void loadClients()}
                />
            ) : null}
        </div>
    );
}
