import { useCallback, useEffect, useId, useState } from 'react';
import {
    getTimeManagerClient,
    listClientContacts,
    type TimeManagerClientContactRow,
} from '@entities/time-tracking';
import { listContactsClientContacts } from '@entities/contacts';
import { getCalendarStatus, reconnectOutlookCalendar } from '@entities/todo/lib/calendarApi';
import { useI18n } from '@shared/i18n';
import { AddClientContactForClientModal } from './AddClientContactForClientModal';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';

const PRIMARY_KEY = 'primary';

type ContactOption = {
    key: string;
    name: string;
    email: string | null;
    phone: string | null;
    isPrimary?: boolean;
};

export type InvoiceSendSelectedContact = {
    email: string;
    name: string;
};

export type InvoiceSendContactModalProps = {
    clientId: string;
    clientName: string;
    invoiceLabel: string;
    onClose: () => void;
    onConfirm: (contact: InvoiceSendSelectedContact) => void | Promise<void>;
};

function optionHasEmail(opt: ContactOption): boolean {
    return Boolean(opt.email?.trim());
}

function mergeContactRows(...lists: TimeManagerClientContactRow[][]): TimeManagerClientContactRow[] {
    const byId = new Map<string, TimeManagerClientContactRow>();
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

function buildOptions(
    primaryName: string | null | undefined,
    primaryEmail: string | null | undefined,
    primaryPhone: string | null | undefined,
    extras: TimeManagerClientContactRow[],
): ContactOption[] {
    const options: ContactOption[] = [];
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

function pickDefaultKey(options: ContactOption[]): string {
    const withEmail = options.find(optionHasEmail);
    return withEmail?.key ?? '';
}

async function loadExtraContacts(clientId: string, embedded: TimeManagerClientContactRow[] | undefined): Promise<TimeManagerClientContactRow[]> {
    const settled = await Promise.allSettled([
        listClientContacts(clientId),
        listContactsClientContacts(clientId),
    ]);
    const fromTt = settled[0].status === 'fulfilled' ? settled[0].value : [];
    const fromContacts = settled[1].status === 'fulfilled' ? settled[1].value : [];
    return mergeContactRows(fromTt, fromContacts, embedded ?? []);
}

export function InvoiceSendContactModal({
    clientId,
    clientName,
    invoiceLabel,
    onClose,
    onConfirm,
}: InvoiceSendContactModalProps) {
    const { t } = useI18n();
    const uid = useId();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [options, setOptions] = useState<ContactOption[]>([]);
    const [selectedKey, setSelectedKey] = useState('');
    const [clientArchived, setClientArchived] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [outlookConnected, setOutlookConnected] = useState<boolean | null>(null);
    const [outlookBusy, setOutlookBusy] = useState(false);
    const [outlookError, setOutlookError] = useState<string | null>(null);

    const refreshOutlookStatus = useCallback(async () => {
        try {
            const st = await getCalendarStatus();
            setOutlookConnected(st.connected);
        }
        catch {
            setOutlookConnected(false);
        }
    }, []);

    const applyLoaded = useCallback((
        primaryName: string | null | undefined,
        primaryEmail: string | null | undefined,
        primaryPhone: string | null | undefined,
        extras: TimeManagerClientContactRow[],
        preferKey?: string,
    ) => {
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

    const reload = useCallback(async (preferKey?: string) => {
        setLoading(true);
        setLoadError(null);
        try {
            const client = await getTimeManagerClient(clientId);
            setClientArchived(Boolean(client.is_archived));
            const extras = await loadExtraContacts(clientId, client.extra_contacts);
            applyLoaded(
                client.contact_name,
                client.contact_email ?? client.email,
                client.contact_phone ?? client.phone,
                extras,
                preferKey,
            );
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
        if (addOpen)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [addOpen, onClose]);

    const selected = options.find((o) => o.key === selectedKey);
    const canConfirm = Boolean(selected && optionHasEmail(selected) && !loading && !sending);

    const handleReconnectOutlook = async () => {
        setOutlookError(null);
        setOutlookBusy(true);
        try {
            await reconnectOutlookCalendar();
        }
        catch (e) {
            setOutlookError(e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.outlookNotConnected'));
            setOutlookBusy(false);
        }
    };

    const handleConfirm = async () => {
        if (!canConfirm || !selected?.email)
            return;
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

    return (<>
      {portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation" onClick={onClose}>
        <div
          className="tt-tm-modal tt-tm-modal--add-contact tt-inv-send-contact"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${uid}-send-title`}
          onClick={(ev) => ev.stopPropagation()}
        >
          <div className="tt-tm-modal__head">
            <h2 id={`${uid}-send-title`} className="tt-tm-modal__title">
              {t('timeTrackingPage.invoices.sendDialog.title')}
            </h2>
            <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('timeTrackingPage.close')} disabled={sending}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div className="tt-tm-modal__body">
            <p className="tt-tm-hint">
              {t('timeTrackingPage.invoices.sendDialog.invoiceLabel').replace('{invoice}', invoiceLabel)}
            </p>
            <p className="tt-tm-hint">{t('timeTrackingPage.invoices.sendDialog.hint')}</p>

            <div className="tt-inv-send-contact__outlook" role="group" aria-label={t('timeTrackingPage.invoices.sendDialog.outlookAria')}>
              <p className="tt-tm-hint">
                {outlookConnected === null
                    ? t('timeTrackingPage.invoices.sendDialog.outlookChecking')
                    : outlookConnected
                        ? t('timeTrackingPage.invoices.sendDialog.outlookConnected')
                        : t('timeTrackingPage.invoices.sendDialog.outlookDisconnected')}
              </p>
              <button
                type="button"
                className="tt-settings__btn tt-settings__btn--ghost"
                disabled={outlookBusy || sending}
                onClick={() => void handleReconnectOutlook()}
              >
                {outlookBusy
                    ? t('timeTrackingPage.invoices.sendDialog.outlookConnecting')
                    : outlookConnected
                        ? t('timeTrackingPage.invoices.sendDialog.outlookReconnect')
                        : t('timeTrackingPage.invoices.sendDialog.outlookConnect')}
              </button>
              {outlookError && (<p className="tt-tm-field-error" role="alert">{outlookError}</p>)}
            </div>

            {loading && (<p className="tt-tm-hint" role="status">{t('timeTrackingPage.invoices.sendDialog.loading')}</p>)}
            {loadError && (<p className="tt-tm-field-error" role="alert">{loadError}</p>)}
            {!loading && !loadError && options.length === 0 && (
              <p className="tt-tm-hint" role="status">{t('timeTrackingPage.invoices.sendDialog.empty')}</p>
            )}

            {!loading && options.length > 0 && (
              <ul className="tt-tm-contact-list tt-inv-send-contact__list" role="radiogroup" aria-labelledby={`${uid}-send-title`}>
                {options.map((opt) => {
                    const enabled = optionHasEmail(opt);
                    const inputId = `${uid}-opt-${opt.key}`;
                    return (
                      <li key={opt.key} className={`tt-tm-contact-list__item tt-inv-send-contact__item${enabled ? '' : ' tt-inv-send-contact__item--disabled'}`}>
                        <label className="tt-inv-send-contact__label" htmlFor={inputId}>
                          <input
                            id={inputId}
                            type="radio"
                            name={`${uid}-send-contact`}
                            value={opt.key}
                            checked={selectedKey === opt.key}
                            disabled={!enabled || sending}
                            onChange={() => setSelectedKey(opt.key)}
                          />
                          <span className="tt-tm-contact-list__main">
                            <span className="tt-tm-contact-list__name">
                              {opt.name}
                              {opt.isPrimary ? (
                                <span className="tt-inv-send-contact__badge">
                                  {t('timeTrackingPage.invoices.sendDialog.primaryBadge')}
                                </span>
                              ) : null}
                            </span>
                            <span className="tt-tm-contact-list__meta">
                              {enabled
                                  ? opt.email
                                  : t('timeTrackingPage.invoices.sendDialog.noEmail')}
                              {opt.phone ? ` · ${opt.phone}` : ''}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                })}
              </ul>
            )}

          </div>
          <div className="tt-tm-modal__foot">
            <button
              type="button"
              className="tt-settings__btn tt-settings__btn--ghost"
              disabled={sending || loading}
              onClick={() => setAddOpen(true)}
            >
              {t('timeTrackingPage.invoices.sendDialog.addContact')}
            </button>
            <div className="tt-inv-send-contact__foot-actions">
              <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={sending} onClick={onClose}>
                {t('timeTrackingPage.invoices.sendDialog.cancel')}
              </button>
              <button
                type="button"
                className="tt-settings__btn tt-settings__btn--primary"
                disabled={!canConfirm}
                onClick={() => void handleConfirm()}
              >
                {sending
                    ? t('timeTrackingPage.invoices.sendDialog.sending')
                    : t('timeTrackingPage.invoices.sendDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      </div>)}

      {addOpen && (
        <AddClientContactForClientModal
          clientId={clientId}
          clientName={clientName}
          clientArchived={clientArchived}
          canManage
          onClose={() => setAddOpen(false)}
          onCreated={(row) => {
              const prefer = row.email?.trim() ? row.id : undefined;
              void reload(prefer);
          }}
        />
      )}
    </>);
}
