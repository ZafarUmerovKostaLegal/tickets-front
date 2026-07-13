import { useEffect, useMemo, useId, useState, useCallback } from 'react';
import { listTimeTrackingUsers, upsertTimeTrackingUser, type TimeTrackingUserRow, TIME_TRACKING_PROJECT_CURRENCIES } from '@entities/time-tracking';
import { listColleaguesAsUsers } from '@entities/contacts';
import type { User } from '@entities/user/model/types';
import { SearchableSelect } from '@shared/ui';
import { isHiddenSystemUser, compareRuLabels } from '@shared/lib';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';

function userLabel(u: TimeTrackingUserRow, fallbackKey: string, t: (key: TranslationKey) => string): string {
    const n = u.display_name?.trim();
    if (n)
        return n;
    return u.email?.trim() || t(fallbackKey as TranslationKey).replace('{id}', String(u.id));
}

function userOptionA11yLabel(u: TimeTrackingUserRow, t: (key: TranslationKey) => string): string {
    const pos = u.position?.trim();
    return [
        userLabel(u, 'timeTrackingPage.users.panel.fallbackUser', t),
        pos || t('timeTrackingPage.projects.membersField.positionNotSetA11y'),
        u.email,
        String(u.id),
    ].filter(Boolean).join(', ');
}

function userPositionDisplay(u: TimeTrackingUserRow, t: (key: TranslationKey) => string): {
    text: string;
    isPlaceholder: boolean;
} {
    const p = u.position?.trim();
    if (p)
        return { text: p, isPlaceholder: false };
    return { text: t('timeTrackingPage.projects.membersField.positionNotSet'), isPlaceholder: true };
}

function userSearchText(u: TimeTrackingUserRow): string {
    return [u.display_name, u.email, String(u.id), u.position].filter(Boolean).join(' ');
}

function authUserToPickerRow(u: User): TimeTrackingUserRow {
    return {
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        picture: u.picture,
        role: u.role,
        position: u.position,
        is_blocked: u.is_blocked,
        is_archived: u.is_archived,
        weekly_capacity_hours: u.weekly_capacity_hours ?? undefined,
        created_at: u.created_at,
        updated_at: u.updated_at,
    };
}

function pickerRowToUpsertUser(u: TimeTrackingUserRow): User {
    return {
        id: u.id,
        email: u.email,
        display_name: u.display_name ?? null,
        picture: u.picture ?? null,
        role: u.role ?? '',
        position: u.position ?? null,
        is_blocked: u.is_blocked,
        is_archived: u.is_archived,
        time_tracking_role: null,
        created_at: u.created_at,
        updated_at: u.updated_at ?? null,
        desktop_background: null,
    };
}

function fallbackPickerRow(id: number, t: (key: TranslationKey) => string): TimeTrackingUserRow {
    return {
        id,
        email: '',
        display_name: t('timeTrackingPage.users.panel.fallbackUser').replace('{id}', `#${id}`),
        is_blocked: false,
        is_archived: false,
        created_at: '',
    };
}

function normalizeAssignedIds(ids: number[]): number[] {
    const out: number[] = [];
    const seen = new Set<number>();
    for (const raw of ids) {
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0 || seen.has(n))
            continue;
        seen.add(n);
        out.push(n);
    }
    return out;
}

export type ProjectMemberRateDraft = {
    amount: string;
    currency: string;
    rateId?: string;
    /** Where the displayed amount came from when the modal loaded. */
    source?: 'project' | 'global' | 'none';
    baselineAmount?: string;
    baselineCurrency?: string;
};

export type ProjectMemberChangeRateFromData = {
    effectiveFrom: string;
    amount: number;
    currency: string;
};

type ProjectMembersFieldProps = {
    assignedIds: number[];
    onAssignedChange: (ids: number[]) => void;
    disabled?: boolean;
    showBillableRate?: boolean;
    projectCurrency: string;
    projectName?: string;
    memberRates: Record<number, ProjectMemberRateDraft>;
    onUpdateMemberRate: (userId: number, draft: ProjectMemberRateDraft) => void;
    /** Edit mode only: allow changing project rate from a specific date. */
    allowChangeRateFromDate?: boolean;
    onChangeRateFromDate?: (userId: number, data: ProjectMemberChangeRateFromData) => void | Promise<void>;
};

function MemberChangeRateFromModal({
    memberLabel,
    projectLabel,
    currency,
    currentAmount,
    onSave,
    onClose,
}: {
    memberLabel: string;
    projectLabel: string;
    currency: string;
    currentAmount: number | null;
    onSave: (d: ProjectMemberChangeRateFromData) => void | Promise<void>;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const uid = useId();
    const [effectiveFrom, setEffectiveFrom] = useState('');
    const [amount, setAmount] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const amtNum = parseFloat(amount.replace(',', '.'));

    const handleSubmit = async () => {
        if (!effectiveFrom) {
            setError(t('timeTrackingPage.projects.membersField.changeFrom.errDate'));
            return;
        }
        if (!amount || !Number.isFinite(amtNum) || amtNum <= 0) {
            setError(t('timeTrackingPage.projects.membersField.changeFrom.errAmount'));
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await Promise.resolve(onSave({ effectiveFrom, amount: amtNum, currency }));
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t('timeTrackingPage.projects.membersField.changeFrom.errSave'));
        }
        finally {
            setSaving(false);
        }
    };

    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--task" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 className="tt-tm-modal__title">{t('timeTrackingPage.projects.membersField.changeFrom.title')}</h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          <p className="tt-tm-hint">
            {t('timeTrackingPage.projects.membersField.changeFrom.hint')
                .replace('{member}', memberLabel)
                .replace('{project}', projectLabel)}
          </p>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-eff`}>{t('timeTrackingPage.projects.membersField.changeFrom.effectiveFrom')}</label>
            <input id={`${uid}-eff`} type="date" className="tt-tm-input" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)}/>
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-amt`}>{t('timeTrackingPage.projects.membersField.changeFrom.newAmount')}</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input id={`${uid}-amt`} type="text" inputMode="decimal" className="tt-tm-input" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}/>
              <input className="tt-tm-input" style={{ maxWidth: '5.5rem' }} value={currency} readOnly disabled aria-label={t('timeTrackingPage.projects.membersField.changeFrom.currency')}/>
            </div>
            {currentAmount != null && Number.isFinite(currentAmount) ? (
              <p className="tt-tm-hint">{t('timeTrackingPage.projects.membersField.changeFrom.current').replace('{amount}', String(currentAmount)).replace('{currency}', currency)}</p>
            ) : null}
          </div>
          {error ? <p className="tt-tm-field-error" role="alert">{error}</p> : null}
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>{t('timeTrackingPage.cancel')}</button>
          <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? t('timeTrackingPage.saving') : t('timeTrackingPage.projects.membersField.changeFrom.submit')}
          </button>
        </div>
      </div>
    </div>);
}

export function ProjectMembersField({
    assignedIds,
    onAssignedChange,
    disabled = false,
    showBillableRate = false,
    projectCurrency,
    projectName,
    memberRates,
    onUpdateMemberRate,
    allowChangeRateFromDate = false,
    onChangeRateFromDate,
}: ProjectMembersFieldProps) {
    const { t } = useI18n();
    const uid = useId();
    const [users, setUsers] = useState<TimeTrackingUserRow[]>([]);
    const [ttUserIds, setTtUserIds] = useState<Set<number>>(() => new Set());
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [pickKey, setPickKey] = useState(0);
    const [addingUserId, setAddingUserId] = useState<number | null>(null);
    const [addError, setAddError] = useState<string | null>(null);
    const [changeFromUserId, setChangeFromUserId] = useState<number | null>(null);
    const userFallbackKey = 'timeTrackingPage.users.panel.fallbackUser' as const;

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        Promise.all([
            listTimeTrackingUsers(),
            listColleaguesAsUsers().catch(() => [] as User[]),
        ])
            .then(([ttRows, authRows]) => {
                if (cancelled)
                    return;
                const activeTt = ttRows.filter((u) => !u.is_archived && !u.is_blocked && !isHiddenSystemUser(u));
                const byId = new Map<number, TimeTrackingUserRow>();
                for (const u of activeTt)
                    byId.set(u.id, u);
                setTtUserIds(new Set(activeTt.map((u) => u.id)));
                for (const au of authRows) {
                    if (au.is_archived || au.is_blocked)
                        continue;
                    if (isHiddenSystemUser(au))
                        continue;
                    if (!byId.has(au.id))
                        byId.set(au.id, authUserToPickerRow(au));
                }
                const merged = [...byId.values()].sort((a, b) => compareRuLabels(userLabel(a, userFallbackKey, t), userLabel(b, userFallbackKey, t)));
                setUsers(merged);
            })
            .catch((e) => {
                if (!cancelled) {
                    setLoadError(e instanceof Error ? e.message : t('timeTrackingPage.projects.membersField.errLoadUsers'));
                    setUsers([]);
                    setTtUserIds(new Set());
                }
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [t]);

    const normalizedAssignedIds = useMemo(() => normalizeAssignedIds(assignedIds), [assignedIds]);
    const assignedSet = useMemo(() => new Set(normalizedAssignedIds), [normalizedAssignedIds]);
    const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

    const assignedUsers = useMemo(() => normalizedAssignedIds.map((id) => userById.get(id) ?? fallbackPickerRow(id, t)), [normalizedAssignedIds, userById, t]);

    const available = useMemo(() => users.filter((u) => !assignedSet.has(u.id)), [users, assignedSet]);

    const remove = (id: number) => {
        if (disabled)
            return;
        onAssignedChange(normalizedAssignedIds.filter((x) => x !== id));
    };

    const addMember = useCallback(async (u: TimeTrackingUserRow) => {
        if (disabled || addingUserId != null)
            return;
        if (assignedSet.has(u.id))
            return;
        setAddError(null);
        if (!ttUserIds.has(u.id)) {
            setAddingUserId(u.id);
            try {
                await upsertTimeTrackingUser(pickerRowToUpsertUser(u));
                setTtUserIds((prev) => new Set([...prev, u.id]));
            }
            catch (e) {
                setAddError(e instanceof Error ? e.message : t('timeTrackingPage.projects.membersField.errAddToTt'));
                setAddingUserId(null);
                return;
            }
            setAddingUserId(null);
        }
        onAssignedChange([...normalizedAssignedIds, u.id]);
        setPickKey((k) => k + 1);
    }, [disabled, addingUserId, assignedSet, normalizedAssignedIds, onAssignedChange, ttUserIds, t]);

    const addLabelId = `${uid}-members-label`;
    const addHintId = `${uid}-members-hint`;
    const curOpts = useMemo(() => TIME_TRACKING_PROJECT_CURRENCIES, []);
    const pickerDisabled = disabled || addingUserId != null;
    const changeFromUser = changeFromUserId != null
        ? (userById.get(changeFromUserId) ?? fallbackPickerRow(changeFromUserId, t))
        : null;
    const changeFromDraft = changeFromUserId != null ? memberRates[changeFromUserId] : undefined;

    return (<div className="tt-tm-field tt-tm-members">
      <span className="tt-tm-label" id={addLabelId}>
        {t('timeTrackingPage.projects.membersField.label')}
      </span>
      {loadError && (<p className="tt-tm-field-error" role="alert">
          {loadError}
        </p>)}
      {addError && (<p className="tt-tm-field-error" role="alert">
          {addError}
        </p>)}
      {loading && !loadError && (<p className="tt-tm-hint" role="status">
          {t('timeTrackingPage.projects.membersField.loadingUsers')}
        </p>)}
      {!loading && !loadError && (<>
          {assignedUsers.length > 0 && (<ul className="tt-tm-members__chips" aria-label={t('timeTrackingPage.projects.membersField.selectedAria')}>
              {assignedUsers.map((u) => {
                const dr = memberRates[u.id] ?? { amount: '', currency: projectCurrency || 'USD' };
                const pos = userPositionDisplay(u, t);
                const label = userLabel(u, userFallbackKey, t);
                const sourceHint = dr.source === 'global'
                    ? t('timeTrackingPage.projects.membersField.rateSourceGlobal')
                    : dr.source === 'project'
                        ? t('timeTrackingPage.projects.membersField.rateSourceProject')
                        : null;
                return (<li key={u.id} className="tt-tm-members__chip">
                    <div className="tt-tm-members__chip-identity">
                      <span className="tt-tm-members__chip-text">{label}</span>
                      <span className={`tt-tm-members__chip-position${pos.isPlaceholder ? ' tt-tm-members__chip-position--empty' : ''}`}>{pos.text}</span>
                      {u.email ? (<span className="tt-tm-members__chip-meta">{u.email}</span>) : null}
                    </div>
                    {showBillableRate && (<div className="tt-tm-members__rate" onClick={(e) => e.stopPropagation()}>
                        <label className="tt-tm-members__rate-lbl" htmlFor={`${uid}-rate-${u.id}`}>
                          {t('timeTrackingPage.projects.membersField.billableRateLabel')}
                        </label>
                        <div className="tt-tm-members__rate-row">
                          <input id={`${uid}-rate-${u.id}`} type="text" className="tt-tm-input tt-tm-members__rate-amt" inputMode="decimal" autoComplete="off" placeholder="0.00" value={dr.amount} disabled={disabled} onChange={(e) => onUpdateMemberRate(u.id, { ...dr, amount: e.target.value })} aria-label={t('timeTrackingPage.projects.membersField.rateAria').replace('{name}', label)}/>
                          <select className="tt-tm-input tt-tm-members__rate-cur" value={TIME_TRACKING_PROJECT_CURRENCIES.includes(dr.currency as (typeof curOpts)[number]) ? dr.currency : 'USD'} disabled={disabled} onChange={(e) => onUpdateMemberRate(u.id, { ...dr, currency: e.target.value })} aria-label={t('timeTrackingPage.projects.membersField.currencyAria').replace('{name}', label)}>
                            {curOpts.map((c) => (<option key={c} value={c}>{c}</option>))}
                          </select>
                        </div>
                        {sourceHint ? <p className="tt-tm-hint tt-tm-members__rate-source">{sourceHint}</p> : null}
                        {allowChangeRateFromDate && onChangeRateFromDate && !disabled ? (
                          <button
                            type="button"
                            className="tt-settings__btn tt-settings__btn--ghost tt-tm-members__change-from"
                            onClick={() => setChangeFromUserId(u.id)}
                          >
                            {t('timeTrackingPage.projects.membersField.changeFrom.cta')}
                          </button>
                        ) : null}
                      </div>)}
                    <button type="button" className="tt-tm-members__chip-remove" disabled={disabled} onClick={() => remove(u.id)} aria-label={t('timeTrackingPage.projects.membersField.removeAria').replace('{name}', label)} title={t('timeTrackingPage.projects.membersField.removeTitle')}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </li>);
              })}
            </ul>)}
          {available.length === 0
            ? (assignedUsers.length === 0
                ? (<p className="tt-tm-hint">{t('timeTrackingPage.projects.membersField.noUsersAvailable')}</p>)
                : (<p className="tt-tm-hint">{t('timeTrackingPage.projects.membersField.allAdded')}</p>))
            : (<>
                <div className="tt-tm-members__add-row">
                  <button type="button" className="tt-tm-members__add-plus" disabled={pickerDisabled} title={t('timeTrackingPage.projects.membersField.addMemberTitle')} aria-label={t('timeTrackingPage.projects.membersField.addMemberAria')} onClick={() => {
                    if (pickerDisabled)
                        return;
                    document.getElementById(`${uid}-add-member`)?.click();
                }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                  <SearchableSelect<TimeTrackingUserRow> key={pickKey} buttonId={`${uid}-add-member`} className="tt-tm-dd tt-tm-members__add-select" buttonClassName="tt-tm-dd__btn" value="" items={available} getOptionValue={(u) => String(u.id)} getOptionLabel={(u) => userOptionA11yLabel(u, t)} getSearchText={userSearchText} onSelect={(u) => {
                    void addMember(u);
                }} placeholder={addingUserId != null ? t('timeTrackingPage.projects.membersField.adding') : t('timeTrackingPage.projects.membersField.addPlaceholder')} emptyListText={t('timeTrackingPage.projects.membersField.noUsers')} noMatchText={t('timeTrackingPage.projects.membersField.noMatch')} disabled={pickerDisabled} portalDropdown portalZIndex={12000} portalMinWidth={300} portalDropdownClassName="tsp-srch__dropdown--tall" aria-labelledby={addLabelId} aria-describedby={addHintId} renderOption={(u) => {
                    const { text, isPlaceholder } = userPositionDisplay(u, t);
                    const needsTt = !ttUserIds.has(u.id);
                    return (<span className="tt-tm-members__opt">
                  <span className="tt-tm-members__opt-name">{userLabel(u, userFallbackKey, t)}</span>
                  <span className={`tt-tm-members__opt-position${isPlaceholder ? ' tt-tm-members__opt-position--empty' : ''}`}>{text}</span>
                  {u.email ? (<span className="tt-tm-members__opt-email">{u.email}</span>) : null}
                  {needsTt ? (<span className="tt-tm-members__opt-email">{t('timeTrackingPage.projects.membersField.willAddToTt')}</span>) : null}
                </span>);
                }}/>
                </div>
                <p id={addHintId} className="tt-tm-hint tt-tm-members__add-hint">
                  {showBillableRate
                    ? t('timeTrackingPage.projects.membersField.hintWithRate')
                    : t('timeTrackingPage.projects.membersField.hint')}
                </p>
              </>)}
        </>)}
      {changeFromUser && onChangeRateFromDate ? (
        <MemberChangeRateFromModal
          memberLabel={userLabel(changeFromUser, userFallbackKey, t)}
          projectLabel={(projectName || '').trim() || '—'}
          currency={(changeFromDraft?.currency || projectCurrency || 'USD').trim() || 'USD'}
          currentAmount={(() => {
              const n = parseFloat(String(changeFromDraft?.amount ?? '').replace(',', '.'));
              return Number.isFinite(n) ? n : null;
          })()}
          onSave={(data) => onChangeRateFromDate(changeFromUser.id, data)}
          onClose={() => setChangeFromUserId(null)}
        />
      ) : null}
    </div>);
}
