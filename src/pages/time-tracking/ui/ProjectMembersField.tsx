import { useEffect, useMemo, useId, useState } from 'react';
import { listTimeTrackingUsers, type TimeTrackingUserRow, TIME_TRACKING_PROJECT_CURRENCIES } from '@entities/time-tracking';
import { SearchableSelect } from '@shared/ui';

function userLabel(u: TimeTrackingUserRow): string {
    const n = u.display_name?.trim();
    if (n)
        return n;
    return u.email?.trim() || `Пользователь ${u.id}`;
}

function userOptionA11yLabel(u: TimeTrackingUserRow): string {
    const pos = u.position?.trim();
    return [userLabel(u), pos || 'должность не указана', u.email, String(u.id)].filter(Boolean).join(', ');
}
function userPositionDisplay(u: TimeTrackingUserRow): {
    text: string;
    isPlaceholder: boolean;
} {
    const p = u.position?.trim();
    if (p)
        return { text: p, isPlaceholder: false };
    return { text: 'Должность не указана', isPlaceholder: true };
}

function userSearchText(u: TimeTrackingUserRow): string {
    return [u.display_name, u.email, String(u.id), u.position].filter(Boolean).join(' ');
}

export type ProjectMemberRateDraft = {
    amount: string;
    currency: string;
    rateId?: string;
};

type ProjectMembersFieldProps = {
    assignedIds: number[];
    onAssignedChange: (ids: number[]) => void;
    disabled?: boolean;
    
    showBillableRate?: boolean;
    
    projectCurrency: string;
    memberRates: Record<number, ProjectMemberRateDraft>;
    onUpdateMemberRate: (userId: number, draft: ProjectMemberRateDraft) => void;
};

export function ProjectMembersField({ assignedIds, onAssignedChange, disabled = false, showBillableRate = false, projectCurrency, memberRates, onUpdateMemberRate, }: ProjectMembersFieldProps) {
    const uid = useId();
    const [users, setUsers] = useState<TimeTrackingUserRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [pickKey, setPickKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        listTimeTrackingUsers()
            .then((rows) => {
                if (cancelled)
                    return;
                const active = rows.filter((u) => !u.is_archived && !u.is_blocked);
                setUsers(active);
            })
            .catch((e) => {
                if (!cancelled) {
                    setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить пользователей');
                    setUsers([]);
                }
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const assignedSet = useMemo(() => new Set(assignedIds), [assignedIds]);
    const assignedUsers = useMemo(() => {
        const m = new Map(users.map((u) => [u.id, u]));
        return assignedIds.map((id) => m.get(id)).filter(Boolean) as TimeTrackingUserRow[];
    }, [users, assignedIds]);

    const available = useMemo(() => users.filter((u) => !assignedSet.has(u.id)), [users, assignedSet]);

    const remove = (id: number) => {
        if (disabled)
            return;
        onAssignedChange(assignedIds.filter((x) => x !== id));
    };

    const addLabelId = `${uid}-members-label`;
    const addHintId = `${uid}-members-hint`;
    const curOpts = useMemo(() => TIME_TRACKING_PROJECT_CURRENCIES, []);

    return (<div className="tt-tm-field tt-tm-members">
      <span className="tt-tm-label" id={addLabelId}>
        Участники проекта
      </span>
      {loadError && (<p className="tt-tm-field-error" role="alert">
          {loadError}
        </p>)}
      {loading && !loadError && (<p className="tt-tm-hint" role="status">
          Загрузка списка пользователей…
        </p>)}
      {!loading && !loadError && (<>
          {assignedUsers.length > 0 && (<ul className="tt-tm-members__chips" aria-label="Выбранные участники">
              {assignedUsers.map((u) => {
                const dr = memberRates[u.id] ?? { amount: '', currency: projectCurrency || 'USD' };
                const pos = userPositionDisplay(u);
                return (<li key={u.id} className="tt-tm-members__chip">
                    <div className="tt-tm-members__chip-identity">
                      <span className="tt-tm-members__chip-text">{userLabel(u)}</span>
                      <span className={`tt-tm-members__chip-position${pos.isPlaceholder ? ' tt-tm-members__chip-position--empty' : ''}`}>{pos.text}</span>
                      {u.email ? (<span className="tt-tm-members__chip-meta">{u.email}</span>) : null}
                    </div>
                    {showBillableRate && (<div className="tt-tm-members__rate" onClick={(e) => e.stopPropagation()}>
                        <label className="tt-tm-members__rate-lbl" htmlFor={`${uid}-rate-${u.id}`}>
                          Опл. ставка / ч
                        </label>
                        <div className="tt-tm-members__rate-row">
                          <input id={`${uid}-rate-${u.id}`} type="text" className="tt-tm-input tt-tm-members__rate-amt" inputMode="decimal" autoComplete="off" placeholder="0.00" value={dr.amount} disabled={disabled} onChange={(e) => onUpdateMemberRate(u.id, { ...dr, amount: e.target.value })} aria-label={`Ставка в час, ${userLabel(u)}`}/>
                          <select className="tt-tm-input tt-tm-members__rate-cur" value={TIME_TRACKING_PROJECT_CURRENCIES.includes(dr.currency as (typeof curOpts)[number]) ? dr.currency : 'USD'} disabled={disabled} onChange={(e) => onUpdateMemberRate(u.id, { ...dr, currency: e.target.value })} aria-label={`Валюта ставки, ${userLabel(u)}`}>
                            {curOpts.map((c) => (<option key={c} value={c}>{c}</option>))}
                          </select>
                        </div>
                      </div>)}
                    <button type="button" className="tt-tm-members__chip-remove" disabled={disabled} onClick={() => remove(u.id)} aria-label={`Убрать ${userLabel(u)}`} title="Убрать">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </li>);
              })}
            </ul>)}
          {available.length === 0
            ? (assignedUsers.length === 0
                ? (<p className="tt-tm-hint">Нет доступных пользователей для назначения.</p>)
                : (<p className="tt-tm-hint">Все доступные пользователи уже добавлены.</p>))
            : (<>
                <div className="tt-tm-members__add-row">
                  <button type="button" className="tt-tm-members__add-plus" disabled={disabled} title="Добавить участника" aria-label="Добавить участника" onClick={() => {
                    if (disabled)
                        return;
                    document.getElementById(`${uid}-add-member`)?.click();
                }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                  <SearchableSelect<TimeTrackingUserRow> key={pickKey} buttonId={`${uid}-add-member`} className="tt-tm-dd tt-tm-members__add-select" buttonClassName="tt-tm-dd__btn" value="" items={available} getOptionValue={(u) => String(u.id)} getOptionLabel={userOptionA11yLabel} getSearchText={userSearchText} onSelect={(u) => {
                    if (disabled)
                        return;
                    if (assignedSet.has(u.id))
                        return;
                    onAssignedChange([...assignedIds, u.id]);
                    setPickKey((k) => k + 1);
                }} placeholder="Добавить участника…" emptyListText="Нет пользователей" noMatchText="Никого не найдено" disabled={disabled} portalDropdown portalZIndex={12000} portalMinWidth={300} portalDropdownClassName="tsp-srch__dropdown--tall" aria-labelledby={addLabelId} aria-describedby={addHintId} renderOption={(u) => {
                    const { text, isPlaceholder } = userPositionDisplay(u);
                    return (<span className="tt-tm-members__opt">
                  <span className="tt-tm-members__opt-name">{userLabel(u)}</span>
                  <span className={`tt-tm-members__opt-position${isPlaceholder ? ' tt-tm-members__opt-position--empty' : ''}`}>{text}</span>
                  {u.email ? (<span className="tt-tm-members__opt-email">{u.email}</span>) : null}
                </span>);
                }}/>
                </div>
                <p id={addHintId} className="tt-tm-hint tt-tm-members__add-hint">
                  {showBillableRate
                    ? 'Нажмите «+» или откройте поле выше, чтобы добавить участника и указать оплачиваемую ставку за час.'
                    : 'Нажмите «+» или откройте поле выше, чтобы добавить участника.'}
                </p>
              </>)}
        </>)}
    </div>);
}
