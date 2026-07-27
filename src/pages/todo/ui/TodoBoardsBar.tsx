import type { User } from '@entities/user';
import { listColleaguesAsUsers } from '@entities/contacts';
import type { CreateTodoBoardBody, TodoBoardSummary } from '@entities/todo';
import { resolveBoardBackgroundDisplayUrl } from '@entities/todo/lib/boardBackgroundUrl';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { isHiddenSystemUser } from '@shared/lib';
import { formatTodoBoardFallback, useI18n } from '@shared/i18n';

function boardPickerCoverGradient(accent: string): string {
  return `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 40%, #ec4899))`;
}

function BoardPickerCardCover({ board }: { board: TodoBoardSummary }) {
  const accent = board.color?.trim() || '#4f46e5';
  const bgUrl = resolveBoardBackgroundDisplayUrl(board.background_url);
  const [imgFailed, setImgFailed] = useState(false);
  const showBg = Boolean(bgUrl) && !imgFailed;

  useEffect(() => {
    setImgFailed(false);
  }, [bgUrl]);

  return (
    <span
      className="todo-board-picker__card-cover"
      style={{
        background: showBg ? accent : boardPickerCoverGradient(accent),
      }}
    >
      {showBg && bgUrl && (
        <img
          src={bgUrl}
          alt=""
          className="todo-board-picker__card-cover-img"
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setImgFailed(true)}
        />
      )}
    </span>
  );
}

type BoardVisibilityUi = 'personal' | 'shared';

type TodoBoardsBarProps = {
  themeVarsStyle: CSSProperties;
  boards: TodoBoardSummary[];
  currentBoardId: number | null;
  listError?: string | null;
  onSelectBoard: (id: number) => void | Promise<void>;
  onCreateBoard: (body: CreateTodoBoardBody) => Promise<void>;
};

export function TodoBoardsBar({
  themeVarsStyle,
  boards,
  currentBoardId,
  listError,
  onSelectBoard,
  onCreateBoard,
}: TodoBoardsBarProps) {
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addBoardOpen, setAddBoardOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardVisibility, setNewBoardVisibility] = useState<BoardVisibilityUi>('personal');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [instantAddMembers, setInstantAddMembers] = useState(true);
  const [employees, setEmployees] = useState<User[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const filteredBoards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q)
      return boards;
    return boards.filter((b) => {
      const vis = b.visibility.toLowerCase();
      return b.title.toLowerCase().includes(q) || vis.includes(q);
    });
  }, [boards, search]);

  const employeeRows = useMemo(
    () =>
      [...employees].sort((a, b) => {
        const na = (a.display_name?.trim() || a.email || '').toLowerCase();
        const nb = (b.display_name?.trim() || b.email || '').toLowerCase();
        return na.localeCompare(nb, 'ru');
      }),
    [employees],
  );

  const filteredEmployeeRows = useMemo(() => {
    const q = employeeSearchQuery.trim().toLowerCase();
    if (!q)
      return employeeRows;
    return employeeRows.filter((u) => {
      const name = (u.display_name || '').toLowerCase();
      const mail = (u.email || '').toLowerCase();
      const pos = (u.position || '').toLowerCase();
      return name.includes(q) || mail.includes(q) || pos.includes(q);
    });
  }, [employeeRows, employeeSearchQuery]);

  useEffect(() => {
    if (!addBoardOpen)
      return;
    let cancelled = false;
    setEmployeesLoading(true);
    setEmployeesError(null);
    void listColleaguesAsUsers()
      .then((rows) => {
        if (!cancelled)
          setEmployees(rows.filter((u) => !u.is_archived && !u.is_blocked && !isHiddenSystemUser(u)));
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setEmployees([]);
          setEmployeesError(e instanceof Error ? e.message : t('todoPage.errors.loadUsers'));
        }
      })
      .finally(() => {
        if (!cancelled)
          setEmployeesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addBoardOpen, t]);

  const handleOpenAddBoard = () => {
    setNewBoardName('');
    setNewBoardVisibility('personal');
    setSelectedMemberIds([]);
    setInstantAddMembers(true);
    setEmployeeSearchQuery('');
    setEmployees([]);
    setEmployeesError(null);
    setCreateError(null);
    setAddBoardOpen(true);
  };

  const handleSubmitNewBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newBoardName.trim();
    if (!name)
      return;
    if (newBoardVisibility === 'shared' && (employeesLoading || employeeRows.length === 0 || selectedMemberIds.length === 0))
      return;

    const colorPalette = ['#4f46e5', '#0ea5e9', '#22c55e', '#eab308', '#ec4899'];
    const color = colorPalette[boards.length % colorPalette.length];

    setCreateSubmitting(true);
    setCreateError(null);
    try {
      const body: CreateTodoBoardBody = newBoardVisibility === 'shared'
        ? {
            title: name,
            visibility: 'shared',
            color,
            memberUserIds: selectedMemberIds,
            instantAddMembers,
          }
        : { title: name, visibility: 'personal', color };
      await onCreateBoard(body);
      setAddBoardOpen(false);
    }
    catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : t('todoPage.errors.createBoard'));
    }
    finally {
      setCreateSubmitting(false);
    }
  };

  const overlaysOpen = pickerOpen || addBoardOpen;

  useEffect(() => {
    if (!overlaysOpen)
      return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [overlaysOpen]);

  const portalHost =
    typeof document !== 'undefined' &&
    overlaysOpen &&
    createPortal(
      <div className="todo-boards-bar-portal-root" style={themeVarsStyle}>
        {pickerOpen && (
          <div className="todo-board-picker__backdrop" onClick={() => setPickerOpen(false)}>
            <div className="todo-board-picker" onClick={(e) => e.stopPropagation()}>
              <div className="todo-board-picker__search-row">
                <label className="todo-board-picker__search-wrap" aria-label={t('todoPage.boards.searchBoardsAria')}>
                  <svg className="todo-board-picker__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    className="todo-board-picker__search-input"
                    type="search"
                    placeholder={t('todoPage.boards.searchBoards')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </label>
                <button type="button" className="todo-board-picker__icon-btn" onClick={handleOpenAddBoard} title={t('todoPage.boards.newBoard')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </button>
                <button type="button" className="todo-board-picker__icon-btn" onClick={() => setPickerOpen(false)} title={t('todoPage.close')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>

              {listError && (
                <div className="todo-boards-bar__emp-status todo-boards-bar__emp-status--error" role="alert">
                  {listError}
                </div>
              )}

              <div className="todo-board-picker__section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                <span>{t('todoPage.boards.yourBoards')}</span>
              </div>

              <div className="todo-board-picker__grid">
                {filteredBoards.map((board) => {
                  const isCurrent = currentBoardId != null && board.id === currentBoardId;
                  return (
                    <button
                      key={board.id}
                      type="button"
                      className={`todo-board-picker__card${isCurrent ? ' todo-board-picker__card--current' : ''}`}
                      onClick={() => {
                        void onSelectBoard(board.id);
                        setPickerOpen(false);
                      }}
                    >
                      <BoardPickerCardCover board={board} />
                      <span className="todo-board-picker__card-title">{board.title || formatTodoBoardFallback(board.id, t)}</span>
                    </button>
                  );
                })}
                {filteredBoards.length === 0 && (
                  <div className="todo-boards-bar__empty">
                    {boards.length === 0 ? t('todoPage.boards.noBoards') : t('todoPage.notFound')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {addBoardOpen && (
          <div
            className="todo-boards-bar__backdrop todo-boards-bar__backdrop--portal"
            onClick={() => !createSubmitting && setAddBoardOpen(false)}
          >
            <form
              className="todo-boards-bar__modal"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => void handleSubmitNewBoard(e)}
            >
              <div className="todo-boards-bar__modal-head">
                <h3 className="todo-boards-bar__modal-title">{t('todoPage.boards.newBoardTitle')}</h3>
                <button
                  type="button"
                  className="todo-boards-bar__modal-close"
                  onClick={() => !createSubmitting && setAddBoardOpen(false)}
                  aria-label={t('todoPage.close')}
                  disabled={createSubmitting}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {createError && (
                <div className="todo-boards-bar__emp-status todo-boards-bar__emp-status--error" role="alert">
                  {createError}
                </div>
              )}

              <div className="todo-boards-bar__field">
                <label className="todo-boards-bar__label">
                  {t('todoPage.boards.boardName')}
                  <input
                    className="todo-boards-bar__input"
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    placeholder={t('todoPage.boards.boardNamePlaceholder')}
                    autoFocus
                    disabled={createSubmitting}
                  />
                </label>
              </div>

              <div className="todo-boards-bar__field">
                <span className="todo-boards-bar__label">{t('todoPage.boards.access')}</span>
                <div className="todo-boards-bar__segmented">
                  <button
                    type="button"
                    className={`todo-boards-bar__segmented-btn${newBoardVisibility === 'personal' ? ' todo-boards-bar__segmented-btn--active' : ''
                      }`}
                    onClick={() => {
                      setNewBoardVisibility('personal');
                      setSelectedMemberIds([]);
                      setEmployeeSearchQuery('');
                    }}
                    disabled={createSubmitting}
                  >
                    {t('todoPage.boards.private')}
                  </button>
                  <button
                    type="button"
                    className={`todo-boards-bar__segmented-btn${newBoardVisibility === 'shared' ? ' todo-boards-bar__segmented-btn--active' : ''
                      }`}
                    onClick={() => setNewBoardVisibility('shared')}
                    disabled={createSubmitting}
                  >
                    {t('todoPage.boards.shared')}
                  </button>
                </div>
                <p className="todo-boards-bar__hint">
                  {t('todoPage.boards.accessHint')}
                </p>
              </div>

              {newBoardVisibility === 'shared' && (
                <div className="todo-boards-bar__field">
                  <span className="todo-boards-bar__label" id="todo-add-board-employees-label">
                    {t('todoPage.boards.employees')}
                  </span>
                  {employeesLoading && (
                    <div className="todo-boards-bar__emp-status" aria-live="polite">
                      {t('todoPage.boards.employeesLoading')}
                    </div>
                  )}
                  {employeesError && !employeesLoading && (
                    <div className="todo-boards-bar__emp-status todo-boards-bar__emp-status--error" role="alert">
                      {employeesError}
                    </div>
                  )}
                  {!employeesLoading && !employeesError && employeeRows.length === 0 && (
                    <div className="todo-boards-bar__emp-status">{t('todoPage.boards.employeesNotFound')}</div>
                  )}
                  {!employeesLoading && !employeesError && employeeRows.length > 0 && (
                    <>
                      <div className="todo-boards-bar__emp-search-wrap">
                        <svg className="todo-boards-bar__emp-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.3-4.3" />
                        </svg>
                        <input
                          className="todo-boards-bar__emp-search-input"
                          type="search"
                          placeholder={t('todoPage.boards.employeesSearch')}
                          value={employeeSearchQuery}
                          onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                          aria-labelledby="todo-add-board-employees-label"
                          disabled={createSubmitting}
                        />
                      </div>
                      {selectedMemberIds.length > 0 && (
                        <p className="todo-boards-bar__hint">
                          {t('todoPage.boards.selectedMembers').replace('{count}', String(selectedMemberIds.length))}
                        </p>
                      )}
                      <label className="todo-boards-bar__instant">
                        <input
                          type="checkbox"
                          checked={instantAddMembers}
                          onChange={(e) => setInstantAddMembers(e.target.checked)}
                          disabled={createSubmitting}
                        />
                        <span>{t('todoPage.boards.instantAddMembers')}</span>
                      </label>
                      <p className="todo-boards-bar__hint">{t('todoPage.boards.instantAddMembersHint')}</p>
                      <ul
                        className="todo-boards-bar__emp-list"
                        role="listbox"
                        aria-label={t('todoPage.boards.employeesAria')}
                        aria-multiselectable
                      >
                        {filteredEmployeeRows.length === 0 && (
                          <li className="todo-boards-bar__emp-empty">{t('todoPage.boards.employeesEmpty')}</li>
                        )}
                        {filteredEmployeeRows.map((u) => {
                          const title = u.display_name?.trim() || u.email || `id ${u.id}`;
                          const sub = u.position?.trim() || u.email;
                          const selected = selectedMemberIds.includes(u.id);
                          return (
                            <li key={u.id} id={`todo-emp-opt-${u.id}`} role="presentation">
                              <button
                                type="button"
                                role="option"
                                aria-selected={selected}
                                className={`todo-boards-bar__emp-row${selected ? ' todo-boards-bar__emp-row--selected' : ''}`}
                                onClick={() => {
                                  setSelectedMemberIds((prev) =>
                                    prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id],
                                  );
                                }}
                                disabled={createSubmitting}
                              >
                                <span className="todo-boards-bar__emp-avatar" aria-hidden>
                                  {(title[0] || '?').toUpperCase()}
                                </span>
                                <span className="todo-boards-bar__emp-text">
                                  <span className="todo-boards-bar__emp-name">{title}</span>
                                  <span className="todo-boards-bar__emp-sub">{sub}</span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              )}

              <div className="todo-boards-bar__actions">
                <button
                  type="button"
                  className="todo-boards-bar__btn todo-boards-bar__btn--ghost"
                  onClick={() => setAddBoardOpen(false)}
                  disabled={createSubmitting}
                >
                  {t('todoPage.cancel')}
                </button>
                <button
                  type="submit"
                  className="todo-boards-bar__btn todo-boards-bar__btn--primary"
                  disabled={
                    createSubmitting ||
                    !newBoardName.trim() ||
                    (newBoardVisibility === 'shared' &&
                      (employeesLoading || employeeRows.length === 0 || selectedMemberIds.length === 0))
                  }
                >
                  {createSubmitting ? t('todoPage.creating') : t('todoPage.boards.createBoard')}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>,
      document.body,
    );

  return (
    <section className="todo-boards-bar" aria-label={t('todoPage.boards.otherBoardsAria')}>
      <div className="todo-boards-bar__nav" role="tablist" aria-label={t('todoPage.boards.boardModesAria')}>
        <button type="button" className="todo-boards-bar__nav-item todo-boards-bar__nav-item--active" role="tab" aria-selected="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M8 9v6M12 9v6M16 9v6" />
          </svg>
          <span>{t('todoPage.boards.boardTab')}</span>
        </button>

        <button
          type="button"
          className="todo-boards-bar__nav-item"
          role="tab"
          aria-selected={pickerOpen}
          onClick={() => setPickerOpen(true)}
          aria-expanded={pickerOpen}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="6" width="12" height="12" rx="2" />
            <path d="M19 8v8M15 12h8" />
          </svg>
          <span>{t('todoPage.boards.pickBoard')}</span>
          <span
            className={`todo-boards-bar__toggle-icon${pickerOpen ? ' todo-boards-bar__toggle-icon--open' : ''
              }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>
      </div>

      {portalHost}
    </section>
  );
}
