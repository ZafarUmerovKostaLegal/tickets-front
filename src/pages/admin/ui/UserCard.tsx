import { createPortal } from 'react-dom';
import { formatDateOnly } from '@shared/lib/formatDate';
import type { User } from '@entities/user';
import type { KnownRole, TTPosition } from '../model/constants';
type UserCardProps = {
    user: User;
    savingUserId: number | null;
    openRoleDropdown: number | null;
    setOpenRoleDropdown: (v: number | null) => void;
    roleMenuPos: {
        top: number;
        left: number;
        width: number;
    } | null;
    setRoleMenuPos: (v: {
        top: number;
        left: number;
        width: number;
    } | null) => void;
    roleTriggerRef: React.RefObject<HTMLButtonElement | null>;
    roleMenuRef: React.RefObject<HTMLDivElement | null>;
    openTTDropdown: number | null;
    setOpenTTDropdown: (v: number | null) => void;
    ttMenuPos: {
        top: number;
        left: number;
        width: number;
    } | null;
    setTTMenuPos: (v: {
        top: number;
        left: number;
        width: number;
    } | null) => void;
    ttTriggerRef: React.RefObject<HTMLButtonElement | null>;
    ttMenuRef: React.RefObject<HTMLDivElement | null>;
    openPosDropdown: number | null;
    setOpenPosDropdown: (v: number | null) => void;
    posMenuPos: {
        top: number;
        left: number;
        width: number;
    } | null;
    setPosMenuPos: (v: {
        top: number;
        left: number;
        width: number;
    } | null) => void;
    posTriggerRef: React.RefObject<HTMLButtonElement | null>;
    posMenuRef: React.RefObject<HTMLDivElement | null>;
    onRoleChange: (u: User, role: string) => void;
    onTTRoleChange: (u: User, ttRole: 'user' | 'manager' | null) => void;
    onPositionChange: (u: User, pos: TTPosition | null) => void;
    onToggleBlocked: (u: User) => void;
    onToggleArchived: (u: User) => void;
    KNOWN_ROLES: readonly KnownRole[];
    ROLE_META: Record<KnownRole, {
        color: string;
        bg: string;
        border: string;
    }>;
    TT_ROLE_OPTIONS: {
        value: 'user' | 'manager' | null;
        label: string;
        color: string;
        bg: string;
        border: string;
    }[];
    TT_POSITIONS: readonly TTPosition[];
    TT_POSITION_META: Record<TTPosition, {
        color: string;
        bg: string;
        border: string;
    }>;
};
export function UserCard({ user: u, savingUserId, openRoleDropdown, setOpenRoleDropdown, roleMenuPos, setRoleMenuPos, roleTriggerRef, roleMenuRef, openTTDropdown, setOpenTTDropdown, ttMenuPos, setTTMenuPos, ttTriggerRef, ttMenuRef, openPosDropdown, setOpenPosDropdown, posMenuPos, setPosMenuPos, posTriggerRef, posMenuRef, onRoleChange, onTTRoleChange, onPositionChange, onToggleBlocked, onToggleArchived, KNOWN_ROLES, ROLE_META, TT_ROLE_OPTIONS, TT_POSITIONS, TT_POSITION_META, }: UserCardProps) {
    const statusKey = u.is_archived ? 'archived' : u.is_blocked ? 'blocked' : 'active';
    const statusLabel = u.is_archived ? 'Архив' : u.is_blocked ? 'Заблокирован' : 'Активен';
    const isSaving = savingUserId === u.id;
    const currentTT = TT_ROLE_OPTIONS.find((o) => o.value === u.time_tracking_role) ?? TT_ROLE_OPTIONS[0];
    const currPos = (u.position as TTPosition | null) ?? null;
    const posMeta = currPos && currPos in TT_POSITION_META ? TT_POSITION_META[currPos as TTPosition] : null;
    const handleRoleClick = (e: React.MouseEvent) => {
        if (isSaving)
            return;
        if (openRoleDropdown === u.id) {
            setOpenRoleDropdown(null);
            setRoleMenuPos(null);
        }
        else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setRoleMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
            setOpenRoleDropdown(u.id);
        }
    };
    const handleTTClick = (e: React.MouseEvent) => {
        if (isSaving)
            return;
        if (openTTDropdown === u.id) {
            setOpenTTDropdown(null);
            setTTMenuPos(null);
        }
        else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setTTMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
            setOpenTTDropdown(u.id);
        }
    };
    const handlePosClick = (e: React.MouseEvent) => {
        if (openPosDropdown === u.id) {
            setOpenPosDropdown(null);
            setPosMenuPos(null);
        }
        else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setPosMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
            setOpenPosDropdown(u.id);
        }
    };
    return (<article className={`ap__user-card ap__user-card--${statusKey} ${statusKey !== 'active' ? 'ap__user-card--dim' : ''}`}>
      <div className="ap__user-card-header">
        <span className="ap__user-avatar" style={{ width: 'var(--user-card-avatar-size)', height: 'var(--user-card-avatar-size)', fontSize: 'var(--user-card-avatar-font-size)' }}>{(u.display_name || 'U').charAt(0).toUpperCase()}</span>
        <div className="ap__user-card-header-text">
          <div className="ap__user-card-name-row">
            <span className="ap__user-name" style={{ fontWeight: 'var(--user-card-name-font-weight)', fontSize: 'var(--user-card-name-font-size)' }}>{u.display_name || '—'}</span>
            <span className={`ap__status-badge ap__status-badge--${statusKey}`}>{statusLabel}</span>
          </div>
          <a href={`mailto:${u.email}`} className="ap__user-card-email" style={{ fontSize: 'var(--user-card-email-font-size)', color: 'var(--user-card-email-color)' }}>{u.email}</a>
        </div>
      </div>
      <div className="ap__user-card-body" style={{ gap: 'var(--user-card-body-gap)' }}>
        <div className="ap__user-card-section" style={{ gap: 'var(--user-card-section-gap)' }}>
          <div className="ap__user-card-row" style={{ fontSize: 'var(--user-card-row-font-size)' }}>
            <span className="ap__user-card-lbl" style={{ fontSize: 'var(--user-card-lbl-font-size)', fontWeight: 'var(--user-card-lbl-font-weight)', color: 'var(--user-card-lbl-color)' }}>Роль</span>
            <div className="ap__role-dd">
            <button type="button" className={`ap__role-trigger ap__role-trigger--card${openRoleDropdown === u.id ? ' ap__role-trigger--open' : ''}${isSaving ? ' ap__role-trigger--disabled' : ''}`} disabled={isSaving} aria-haspopup="listbox" aria-expanded={openRoleDropdown === u.id} ref={openRoleDropdown === u.id ? roleTriggerRef : undefined} onClick={handleRoleClick}>
              <span className="ap__role-dot" style={{ background: (ROLE_META[u.role as KnownRole] ?? ROLE_META['Сотрудник']).color }}/>
              <span className="ap__role-label">{u.role || '—'}</span>
              <svg className="ap__role-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {openRoleDropdown === u.id && roleMenuPos && createPortal(<div className="ap__role-menu" role="listbox" style={{ position: 'fixed', top: roleMenuPos.top, left: roleMenuPos.left, minWidth: Math.max(roleMenuPos.width, 180) }} ref={roleMenuRef}>
              {KNOWN_ROLES.map((r) => {
                const meta = ROLE_META[r as KnownRole];
                const isActive = u.role === r;
                return (<button key={r} type="button" role="option" aria-selected={isActive} className={`ap__role-option${isActive ? ' ap__role-option--active' : ''}`} onClick={() => { onRoleChange(u, r); setOpenRoleDropdown(null); setRoleMenuPos(null); }} style={isActive ? { background: meta.bg, color: meta.color, borderColor: meta.border } : undefined}>
                    <span className="ap__role-option-dot" style={{ background: meta.color }}/>
                    {r}
                    {isActive && <svg className="ap__role-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>}
                  </button>);
            })}
            </div>, document.body)}
            </div>
          </div>
          <div className="ap__user-card-row" style={{ fontSize: 'var(--user-card-row-font-size)' }}>
            <span className="ap__user-card-lbl" style={{ fontSize: 'var(--user-card-lbl-font-size)', fontWeight: 'var(--user-card-lbl-font-weight)', color: 'var(--user-card-lbl-color)' }}>Учёт времени</span>
            <div className="ap__role-dd">
            <button type="button" className={`ap__role-trigger ap__role-trigger--card${openTTDropdown === u.id ? ' ap__role-trigger--open' : ''}${isSaving ? ' ap__role-trigger--disabled' : ''}`} disabled={isSaving} aria-haspopup="listbox" aria-expanded={openTTDropdown === u.id} ref={openTTDropdown === u.id ? ttTriggerRef : undefined} onClick={handleTTClick}>
              <span className="ap__role-dot" style={{ background: currentTT.color }}/>
              <span className="ap__role-label">{currentTT.label}</span>
              <svg className="ap__role-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {openTTDropdown === u.id && ttMenuPos && createPortal(<div className="ap__role-menu" role="listbox" style={{ position: 'fixed', top: ttMenuPos.top, left: ttMenuPos.left, minWidth: Math.max(ttMenuPos.width, 180) }} ref={ttMenuRef}>
              {TT_ROLE_OPTIONS.map((opt) => {
                const isActive = u.time_tracking_role === opt.value;
                return (<button key={String(opt.value)} type="button" role="option" aria-selected={isActive} className={`ap__role-option${isActive ? ' ap__role-option--active' : ''}`} onClick={() => { onTTRoleChange(u, opt.value); setOpenTTDropdown(null); setTTMenuPos(null); }} style={isActive ? { background: opt.bg, color: opt.color, borderColor: opt.border } : undefined}>
                    <span className="ap__role-option-dot" style={{ background: opt.color }}/>
                    {opt.label}
                    {isActive && <svg className="ap__role-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>}
                  </button>);
            })}
            </div>, document.body)}
            </div>
          </div>
          <div className="ap__user-card-row" style={{ fontSize: 'var(--user-card-row-font-size)' }}>
            <span className="ap__user-card-lbl" style={{ fontSize: 'var(--user-card-lbl-font-size)', fontWeight: 'var(--user-card-lbl-font-weight)', color: 'var(--user-card-lbl-color)' }}>Должность</span>
            <div className="ap__role-dd">
            <button type="button" className={`ap__role-trigger ap__role-trigger--card${openPosDropdown === u.id ? ' ap__role-trigger--open' : ''}`} aria-haspopup="listbox" aria-expanded={openPosDropdown === u.id} ref={openPosDropdown === u.id ? posTriggerRef : undefined} onClick={handlePosClick}>
              <span className="ap__role-dot" style={{ background: posMeta ? posMeta.color : '#94a3b8' }}/>
              <span className="ap__role-label" style={posMeta ? { color: posMeta.color } : { color: '#94a3b8' }}>{currPos ?? 'Должность'}</span>
              <svg className="ap__role-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {openPosDropdown === u.id && posMenuPos && createPortal(<div className="ap__role-menu" role="listbox" style={{ position: 'fixed', top: posMenuPos.top, left: posMenuPos.left, minWidth: Math.max(posMenuPos.width, 200) }} ref={posMenuRef}>
              <button type="button" role="option" aria-selected={currPos === null} className={`ap__role-option${currPos === null ? ' ap__role-option--active' : ''}`} onClick={() => onPositionChange(u, null)}>
                <span className="ap__role-option-dot" style={{ background: '#94a3b8' }}/>
                Не указана
                {currPos === null && <svg className="ap__role-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>}
              </button>
              {TT_POSITIONS.map((pos) => {
                const m = TT_POSITION_META[pos];
                const isActive = currPos === pos;
                return (<button key={pos} type="button" role="option" aria-selected={isActive} className={`ap__role-option${isActive ? ' ap__role-option--active' : ''}`} onClick={() => onPositionChange(u, pos)} style={isActive ? { background: m.bg, color: m.color, borderColor: m.border } : undefined}>
                    <span className="ap__role-option-dot" style={{ background: m.color }}/>
                    {pos}
                    {isActive && <svg className="ap__role-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>}
                  </button>);
            })}
            </div>, document.body)}
            </div>
          </div>
        </div>
        <div className="ap__user-card-meta" style={{ fontSize: 'var(--user-card-meta-font-size)', color: 'var(--user-card-meta-color)' }}>
          <span title="Создан">{formatDateOnly(u.created_at)}</span>
          <span className="ap__user-card-meta-sep">·</span>
          <span title="Обновлён">{u.updated_at ? formatDateOnly(u.updated_at) : '—'}</span>
        </div>
      </div>
      <div className="ap__user-card-actions">
        <button type="button" className={`ap__act-btn ${u.is_blocked ? 'ap__act-btn--success' : 'ap__act-btn--warn'}`} disabled={isSaving} onClick={() => onToggleBlocked(u)}>
          {u.is_blocked ? 'Разблокировать' : 'Заблокировать'}
        </button>
        <button type="button" className="ap__act-btn ap__act-btn--ghost" disabled={isSaving} onClick={() => onToggleArchived(u)}>
          {u.is_archived ? 'Восстановить' : 'В архив'}
        </button>
      </div>
    </article>);
}
