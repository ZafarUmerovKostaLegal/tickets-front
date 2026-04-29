import { useAdmin } from '../model/AdminContext';
import { AdminSelect } from './AdminSelect';
import { UserCard } from './UserCard';
import { UserFieldChangeConfirmModal } from './UserFieldChangeConfirmModal';
import { KNOWN_ROLES } from '../model/constants';
export function AdminUsersSection() {
    const { users, loading, search, setSearch, roleFilter, setRoleFilter, includeArchived, setIncludeArchived, filteredUsers, userActionError, savingUserId, handleToggleBlocked, handleToggleArchived, handleRoleChange, handleTTRoleChange, handlePositionChange, pendingUserFieldChange, confirmPendingUserFieldChange, dismissPendingUserFieldChange, openRoleDropdown, setOpenRoleDropdown, roleMenuPos, setRoleMenuPos, roleTriggerRef, roleMenuRef, openTTDropdown, setOpenTTDropdown, ttMenuPos, setTTMenuPos, ttTriggerRef, ttMenuRef, openPosDropdown, setOpenPosDropdown, posMenuPos, setPosMenuPos, posTriggerRef, posMenuRef, ROLE_META, TT_ROLE_OPTIONS, TT_POSITIONS, TT_POSITION_META, } = useAdmin();
    return (<section className="ap__card ap__card--users" style={{ borderRadius: 'var(--ap-card-border-radius)', padding: 'var(--ap-card-padding)', background: 'var(--ap-card-bg)', border: 'var(--ap-card-border)' }}>
      <div className="ap__card-head" style={{ paddingBottom: 'var(--ap-card-head-pb)', marginBottom: 'var(--ap-card-head-mb)', borderBottom: 'var(--ap-card-head-border-bottom)' }}>
        <h2 className="ap__card-title" style={{ fontSize: 'var(--ap-card-title-font-size)', fontWeight: 'var(--ap-card-title-font-weight)', gap: 'var(--ap-card-title-gap)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Пользователи
        </h2>
        <span className="ap__card-count" style={{ fontSize: 'var(--ap-card-count-font-size)', color: 'var(--ap-card-count-color)', fontWeight: 'var(--ap-card-count-font-weight)' }}>{filteredUsers.length}</span>
      </div>
      {userActionError && <p className="ap__inline-error" style={{ color: 'var(--ap-inline-error-color)', fontSize: 'var(--ap-inline-error-font-size)', marginBottom: 'var(--ap-inline-error-mb)' }}>{userActionError}</p>}
      <div className="ap__toolbar" style={{ marginBottom: 'var(--ap-toolbar-mb)', gap: 'var(--ap-toolbar-gap)' }}>
        <div className="ap__search-wrap" style={{ borderRadius: 'var(--ap-search-wrap-border-radius)', border: 'var(--ap-search-wrap-border)', padding: 'var(--ap-search-wrap-padding)', gap: 'var(--ap-search-wrap-gap)' }}>
          <svg className="ap__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 'var(--ap-search-icon-size)', height: 'var(--ap-search-icon-size)', color: 'var(--ap-search-icon-color)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="search" className="ap__search" placeholder="Поиск по имени, email или роли…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ fontSize: 'var(--ap-search-font-size)', color: 'var(--ap-search-color)' }}/>
        </div>
        <div className="ap__toolbar-right" style={{ gap: 'var(--ap-toolbar-right-gap)' }}>
          <AdminSelect value={roleFilter} onChange={setRoleFilter} options={[{ value: 'all', label: 'Все роли' }, ...KNOWN_ROLES.map((r) => ({ value: r, label: r }))]}/>
          <label className="ap__switch-label" style={{ gap: 'var(--ap-switch-label-gap)' }}>
            <span className="switch" style={{ width: 'var(--ap-switch-width)', height: 'var(--ap-switch-height)' }}>
              <input type="checkbox" className="switch__input" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)}/>
              <span className="switch__track" style={{ borderRadius: 'var(--ap-switch-track-border-radius)', background: 'var(--ap-switch-track-bg)' }}><span className="switch__thumb" style={{ width: 'var(--ap-switch-thumb-size)', height: 'var(--ap-switch-thumb-size)', borderRadius: 'var(--ap-switch-thumb-border-radius)', background: 'var(--ap-switch-thumb-bg)' }}/></span>
            </span>
            <span style={{ fontSize: 'var(--ap-switch-label-font-size)', color: 'var(--ap-switch-label-color)' }}>Архивные</span>
          </label>
        </div>
      </div>
      <div className="ap__users-grid" style={{ gap: 'var(--ap-users-grid-gap)' }}>
        {loading && users.length === 0 && Array.from({ length: 3 }).map((_, idx) => (<div key={`skeleton-${idx}`} className="ap__user-card ap__user-card--skeleton" style={{ borderRadius: 'var(--user-card-border-radius)', padding: 'var(--user-card-padding)', gap: 'var(--user-card-gap)', background: 'var(--user-card-bg)', border: 'var(--user-card-border)' }}>
            <div className="ap__user-card-header" style={{ gap: 'var(--user-card-header-gap)' }}>
              <span className="ap__skel ap__skel--avatar" style={{ width: 'var(--user-card-avatar-size)', height: 'var(--user-card-avatar-size)', borderRadius: 'var(--user-card-avatar-border-radius)' }}/>
              <div className="ap__user-card-header-text" style={{ gap: 'var(--user-card-header-text-gap)' }}>
                <span className="ap__skel ap__skel--lg" style={{ height: 'var(--ap-skel-lg-height)', borderRadius: 'var(--ap-skel-border-radius)' }}/>
                <span className="ap__skel ap__skel--md" style={{ height: 'var(--ap-skel-md-height)', width: 'var(--ap-skel-md-width)', borderRadius: 'var(--ap-skel-border-radius)' }}/>
              </div>
            </div>
            <div className="ap__user-card-body" style={{ gap: 'var(--user-card-body-gap)' }}>
              <div className="ap__user-card-row" style={{ fontSize: 'var(--user-card-row-font-size)', gap: 'var(--user-card-row-gap)' }}><span className="ap__skel ap__skel--sm" style={{ height: 'var(--ap-skel-sm-height)', width: 'var(--ap-skel-sm-width)', borderRadius: 'var(--ap-skel-border-radius)' }}/><span className="ap__skel-pill" style={{ height: 'var(--ap-skel-pill-height)', width: 'var(--ap-skel-pill-width)', borderRadius: 'var(--ap-skel-pill-border-radius)' }}/></div>
              <div className="ap__user-card-row" style={{ fontSize: 'var(--user-card-row-font-size)', gap: 'var(--user-card-row-gap)' }}><span className="ap__skel ap__skel--sm" style={{ height: 'var(--ap-skel-sm-height)', width: 'var(--ap-skel-sm-width)', borderRadius: 'var(--ap-skel-border-radius)' }}/><span className="ap__skel-pill" style={{ height: 'var(--ap-skel-pill-height)', width: 'var(--ap-skel-pill-width)', borderRadius: 'var(--ap-skel-pill-border-radius)' }}/></div>
            </div>
          </div>))}
        {!loading && filteredUsers.length === 0 && (<p className="ap__users-empty" style={{ fontSize: 'var(--ap-users-empty-font-size)', color: 'var(--ap-users-empty-color)' }}>Пользователи не найдены</p>)}
        {filteredUsers.map((u) => (<UserCard key={u.id} user={u} KNOWN_ROLES={KNOWN_ROLES} savingUserId={savingUserId} openRoleDropdown={openRoleDropdown} setOpenRoleDropdown={setOpenRoleDropdown} roleMenuPos={roleMenuPos} setRoleMenuPos={setRoleMenuPos} roleTriggerRef={roleTriggerRef} roleMenuRef={roleMenuRef} openTTDropdown={openTTDropdown} setOpenTTDropdown={setOpenTTDropdown} ttMenuPos={ttMenuPos} setTTMenuPos={setTTMenuPos} ttTriggerRef={ttTriggerRef} ttMenuRef={ttMenuRef} openPosDropdown={openPosDropdown} setOpenPosDropdown={setOpenPosDropdown} posMenuPos={posMenuPos} setPosMenuPos={setPosMenuPos} posTriggerRef={posTriggerRef} posMenuRef={posMenuRef} onRoleChange={handleRoleChange} onTTRoleChange={handleTTRoleChange} onPositionChange={handlePositionChange} onToggleBlocked={handleToggleBlocked} onToggleArchived={handleToggleArchived} ROLE_META={ROLE_META} TT_ROLE_OPTIONS={TT_ROLE_OPTIONS} TT_POSITIONS={TT_POSITIONS} TT_POSITION_META={TT_POSITION_META}/>))}
      </div>

      <UserFieldChangeConfirmModal pending={pendingUserFieldChange} ttRoleOptions={TT_ROLE_OPTIONS} savingUserId={savingUserId} onConfirm={confirmPendingUserFieldChange} onDismiss={dismissPendingUserFieldChange}/>
    </section>);
}
