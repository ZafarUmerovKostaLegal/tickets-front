import { useState } from 'react';
import { AppPageSettings } from '@shared/ui';
import { useHome } from '../model/HomeContext';
import { TicketCreateModal } from './TicketCreateModal';
import { HomeStats } from './HomeStats';
import { HomeTicketsSection } from './HomeTicketsSection';
import { HomeNotificationsModal } from './HomeNotificationsModal';
import { NotificationDetailModal } from './NotificationDetailModal';
import { CreateNotificationModal } from './CreateNotificationModal';
import './HomePage.css';
const IconPlus = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>);
const IconBell = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>);
export function HomePageView() {
    const { canCreateTicket, canManageNotifications, isITRole, tickets, statuses, priorities, ticketsLoading, ticketsError, filterStatus, setFilterStatus, filterPriority, setFilterPriority, searchQuery, setSearchQuery, creatorNames, ticketStats, filteredTickets, loadTickets, filterStatusOpen, setFilterStatusOpen, filterPriorityOpen, setFilterPriorityOpen, filterStatusRef, filterPriorityRef, showCreateForm, setShowCreateForm, createSubmitting, createError, setCreateError, createForm, setCreateForm, createFile, setCreateFile, isDraggingFile, setIsDraggingFile, priorityDropdownOpen, setPriorityDropdownOpen, categoryDropdownOpen, setCategoryDropdownOpen, fileInputRef, priorityDropdownRef, categoryDropdownRef, handleCreateSubmit, notifications, notificationsLoading, notificationsError, newNotificationTitle, setNewNotificationTitle, newNotificationDescription, setNewNotificationDescription, createNotificationLoading, createNotificationError, setCreateNotificationError, notificationSearch, setNotificationSearch, filteredNotifications, isCreateNotificationOpen, setIsCreateNotificationOpen, selectedNotification, setSelectedNotification, handleCreateNotification, getPriorityTagClass, getStatusTagClass, TICKET_CATEGORIES, formatDateShort, } = useHome();
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
    return (<div className="home-page">
      {showCreateForm && (<TicketCreateModal onClose={() => setShowCreateForm(false)} onSubmit={handleCreateSubmit} theme={createForm.theme} description={createForm.description} category={createForm.category} priority={createForm.priority} onThemeChange={(v) => setCreateForm((f) => ({ ...f, theme: v }))} onDescriptionChange={(v) => setCreateForm((f) => ({ ...f, description: v }))} onCategoryChange={(v) => setCreateForm((f) => ({ ...f, category: v }))} onPriorityChange={(v) => setCreateForm((f) => ({ ...f, priority: v }))} categories={TICKET_CATEGORIES} priorities={priorities} file={createFile} onFileChange={setCreateFile} isDragging={isDraggingFile} onDragStart={() => setIsDraggingFile(true)} onDragEnd={() => setIsDraggingFile(false)} onDrop={(f) => setCreateFile(f)} fileInputRef={fileInputRef} categoryDropdownOpen={categoryDropdownOpen} setCategoryDropdownOpen={setCategoryDropdownOpen} priorityDropdownOpen={priorityDropdownOpen} setPriorityDropdownOpen={setPriorityDropdownOpen} categoryDropdownRef={categoryDropdownRef} priorityDropdownRef={priorityDropdownRef} submitting={createSubmitting} error={createError}/>)}

      <main className="home-page__main">
        <header className="home-page__header">
          <div className="home-page__header-left">
            <span className="home-page__header-eyebrow">Тикет-система</span>
            <h1 className="home-page__header-h1">Заявки</h1>
          </div>
          <div className="home-page__header-right">
            <AppPageSettings />
            <button type="button" className={`home-page__btn-notifications ${notificationsOpen ? 'home-page__btn-notifications--active' : ''}`} onClick={() => setNotificationsOpen((v) => !v)} aria-label={notificationsOpen ? 'Скрыть уведомления' : 'Показать уведомления'} aria-expanded={notificationsOpen}>
              <IconBell />
              {notifications.length > 0 && (<span className="home-page__btn-notifications-badge">{notifications.length}</span>)}
            </button>
            {canCreateTicket && (<button type="button" className="home-page__btn-create" onClick={handleOpenCreateForm} aria-label="Новая заявка">
                <IconPlus />
                <span className="home-page__btn-create-text">Новая заявка</span>
              </button>)}
          </div>
        </header>

        <div className="home-page__main-inner">
          {!ticketsError && !ticketsLoading && (<HomeStats total={tickets.length} ticketStats={ticketStats} filterStatus={filterStatus} setFilterStatus={setFilterStatus} statuses={statuses}/>)}

          <div className="home-page__content-grid home-page__content-grid--notifications-hidden">
            <HomeTicketsSection isITRole={isITRole} tickets={tickets} filteredTickets={filteredTickets} ticketsLoading={ticketsLoading} ticketsError={ticketsError} statuses={statuses} priorities={priorities} filterStatus={filterStatus} setFilterStatus={setFilterStatus} filterPriority={filterPriority} setFilterPriority={setFilterPriority} filterStatusOpen={filterStatusOpen} setFilterStatusOpen={setFilterStatusOpen} filterPriorityOpen={filterPriorityOpen} setFilterPriorityOpen={setFilterPriorityOpen} filterStatusRef={filterStatusRef} filterPriorityRef={filterPriorityRef} searchQuery={searchQuery} setSearchQuery={setSearchQuery} creatorNames={creatorNames} getStatusTagClass={getStatusTagClass} getPriorityTagClass={getPriorityTagClass} formatDateShort={formatDateShort} loadTickets={loadTickets} canCreateTicket={canCreateTicket} onOpenCreateForm={handleOpenCreateForm}/>
          </div>
        </div>
      </main>

      {notificationsOpen && (<HomeNotificationsModal onClose={() => setNotificationsOpen(false)} notifications={notifications} filteredNotifications={filteredNotifications} notificationsLoading={notificationsLoading} notificationsError={notificationsError} notificationSearch={notificationSearch} setNotificationSearch={setNotificationSearch} canManageNotifications={canManageNotifications} onAddClick={handleOpenCreateNotification} onNotificationSelect={setSelectedNotification}/>)}

      {selectedNotification && (<NotificationDetailModal notification={selectedNotification} onClose={() => setSelectedNotification(null)}/>)}

      {canManageNotifications && isCreateNotificationOpen && (<CreateNotificationModal onClose={() => setIsCreateNotificationOpen(false)} onSubmit={handleCreateNotification} title={newNotificationTitle} description={newNotificationDescription} onTitleChange={setNewNotificationTitle} onDescriptionChange={setNewNotificationDescription} loading={createNotificationLoading} error={createNotificationError}/>)}
    </div>);
}
