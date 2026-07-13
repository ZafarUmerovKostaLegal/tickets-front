import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppBackButton, AppPageSettings } from '@shared/ui';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';
import { useHome } from '../model/HomeContext';
import { TicketCreateModal } from './TicketCreateModal';
import { HomeStats } from './HomeStats';
import { HomeTicketsSection } from './HomeTicketsSection';
import { HomeNotificationsModal } from './HomeNotificationsModal';
import { NotificationDetailModal } from './NotificationDetailModal';
import { CreateNotificationModal } from './CreateNotificationModal';
import './HomePage.css';
const IconSeal = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <path d="M12 2L4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>);
const IconPlus = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>);
const IconBell = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>);
export function HomePageView() {
    const { t } = useI18n();
    const { canCreateTicket, canManageNotifications, isITRole, tickets, statuses, priorities, ticketsLoading, ticketsError, filterStatus, setFilterStatus, filterPriority, setFilterPriority, searchQuery, setSearchQuery, creatorNames, ticketStats, filteredTickets, loadTickets, filterStatusOpen, setFilterStatusOpen, filterPriorityOpen, setFilterPriorityOpen, filterStatusRef, filterPriorityRef, showCreateForm, setShowCreateForm, createSubmitting, createError, setCreateError, createForm, setCreateForm, createFile, setCreateFile, isDraggingFile, setIsDraggingFile, priorityDropdownOpen, setPriorityDropdownOpen, categoryDropdownOpen, setCategoryDropdownOpen, fileInputRef, priorityDropdownRef, categoryDropdownRef, handleCreateSubmit, notifications, notificationsLoading, notificationsError, newNotificationTitle, setNewNotificationTitle, newNotificationDescription, setNewNotificationDescription, createNotificationLoading, createNotificationError, setCreateNotificationError, notificationSearch, setNotificationSearch, filteredNotifications, isCreateNotificationOpen, setIsCreateNotificationOpen, selectedNotification, setSelectedNotification, handleNotificationSelect, handleCreateNotification, getPriorityTagClass, getStatusTagClass, TICKET_CATEGORIES, formatDateShort, } = useHome();
    const handleOpenCreateForm = () => {
        setShowCreateForm(true);
        setCreateError(null);
    };
    const handleOpenCreateNotification = () => {
        setNewNotificationTitle('');
        setNewNotificationDescription('');
        setCreateNotificationError(null);
        setIsCreateNotificationOpen(true);
        setNotificationsOpen(false);
    };
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const location = useLocation();
    const showBackToHub = location.pathname === routes.tickets;
    return (<div className="home-page home-page--tickets">
      {showCreateForm && (<TicketCreateModal onClose={() => setShowCreateForm(false)} onSubmit={handleCreateSubmit} theme={createForm.theme} description={createForm.description} category={createForm.category} priority={createForm.priority} onThemeChange={(v) => setCreateForm((f) => ({ ...f, theme: v }))} onDescriptionChange={(v) => setCreateForm((f) => ({ ...f, description: v }))} onCategoryChange={(v) => setCreateForm((f) => ({ ...f, category: v }))} onPriorityChange={(v) => setCreateForm((f) => ({ ...f, priority: v }))} categories={TICKET_CATEGORIES} priorities={priorities} file={createFile} onFileChange={setCreateFile} isDragging={isDraggingFile} onDragStart={() => setIsDraggingFile(true)} onDragEnd={() => setIsDraggingFile(false)} onDrop={(f) => setCreateFile(f)} fileInputRef={fileInputRef} categoryDropdownOpen={categoryDropdownOpen} setCategoryDropdownOpen={setCategoryDropdownOpen} priorityDropdownOpen={priorityDropdownOpen} setPriorityDropdownOpen={setPriorityDropdownOpen} categoryDropdownRef={categoryDropdownRef} priorityDropdownRef={priorityDropdownRef} submitting={createSubmitting} error={createError}/>)}

      <main className="home-page__main">
        <header className="home-page__header home-page__header--tickets">
          {showBackToHub ? (<>
            <div className="home-page__header-ttl-row">
              <AppBackButton to={routes.home} hideLabelOnMobile />
              <span className="home-page__tickets-seal" aria-hidden>
                <IconSeal />
              </span>
              <h1 className="home-page__ttl-title">{t('nav.tickets')}</h1>
            </div>
            <div className="home-page__header-right">
              <AppPageSettings />
              <button type="button" className={`home-page__btn-notifications ${notificationsOpen ? 'home-page__btn-notifications--active' : ''}`} onClick={() => setNotificationsOpen((v) => !v)} aria-label={notificationsOpen ? t('ticketsPage.hideNotifications') : t('ticketsPage.showNotifications')} aria-expanded={notificationsOpen}>
                <IconBell />
                {notifications.length > 0 && (<span className="home-page__btn-notifications-dot" aria-hidden />)}
              </button>
              {canCreateTicket && (<button type="button" className="home-page__btn-create home-page__btn-create--icon" onClick={handleOpenCreateForm} aria-label={t('ticketsPage.newTicketAria')}>
                  <IconPlus />
                </button>)}
            </div>
          </>) : (<>
            <div className="home-page__header-left">
              <span className="home-page__header-eyebrow">{t('brand.title')}</span>
              <h1 className="home-page__header-h1">{t('nav.tickets')}</h1>
            </div>
            <div className="home-page__header-right">
              <AppPageSettings />
              <button type="button" className={`home-page__btn-notifications ${notificationsOpen ? 'home-page__btn-notifications--active' : ''}`} onClick={() => setNotificationsOpen((v) => !v)} aria-label={notificationsOpen ? t('ticketsPage.hideNotifications') : t('ticketsPage.showNotifications')} aria-expanded={notificationsOpen}>
                <IconBell />
                {notifications.length > 0 && (<span className="home-page__btn-notifications-dot" aria-hidden />)}
              </button>
              {canCreateTicket && (<button type="button" className="home-page__btn-create home-page__btn-create--icon" onClick={handleOpenCreateForm} aria-label={t('ticketsPage.newTicketAria')}>
                  <IconPlus />
                </button>)}
            </div>
          </>)}
        </header>

        <div className="home-page__main-inner">
          {!ticketsError && !ticketsLoading && (<HomeStats total={tickets.length} ticketStats={ticketStats} filterStatus={filterStatus} setFilterStatus={setFilterStatus} statuses={statuses}/>)}

          <div className="home-page__content-grid home-page__content-grid--notifications-hidden">
            <HomeTicketsSection isITRole={isITRole} tickets={tickets} filteredTickets={filteredTickets} ticketsLoading={ticketsLoading} ticketsError={ticketsError} statuses={statuses} priorities={priorities} filterStatus={filterStatus} setFilterStatus={setFilterStatus} filterPriority={filterPriority} setFilterPriority={setFilterPriority} filterStatusOpen={filterStatusOpen} setFilterStatusOpen={setFilterStatusOpen} filterPriorityOpen={filterPriorityOpen} setFilterPriorityOpen={setFilterPriorityOpen} filterStatusRef={filterStatusRef} filterPriorityRef={filterPriorityRef} searchQuery={searchQuery} setSearchQuery={setSearchQuery} creatorNames={creatorNames} getStatusTagClass={getStatusTagClass} getPriorityTagClass={getPriorityTagClass} formatDateShort={formatDateShort} loadTickets={loadTickets} canCreateTicket={canCreateTicket} onOpenCreateForm={handleOpenCreateForm}/>
          </div>
        </div>
      </main>

      {notificationsOpen && (<HomeNotificationsModal onClose={() => setNotificationsOpen(false)} notifications={notifications} filteredNotifications={filteredNotifications} notificationsLoading={notificationsLoading} notificationsError={notificationsError} notificationSearch={notificationSearch} setNotificationSearch={setNotificationSearch} canManageNotifications={canManageNotifications} onAddClick={handleOpenCreateNotification} onNotificationSelect={handleNotificationSelect}/>)}

      {selectedNotification && (<NotificationDetailModal notification={selectedNotification} onClose={() => setSelectedNotification(null)}/>)}

      {canManageNotifications && isCreateNotificationOpen && (<CreateNotificationModal onClose={() => setIsCreateNotificationOpen(false)} onSubmit={handleCreateNotification} title={newNotificationTitle} description={newNotificationDescription} onTitleChange={setNewNotificationTitle} onDescriptionChange={setNewNotificationDescription} loading={createNotificationLoading} error={createNotificationError}/>)}
    </div>);
}
