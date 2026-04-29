import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconChevronDown, IconClose, IconComment, IconMore, IconPaperclip, IconPlus, IconTag, IconCalendar, IconChecklist, IconUsers, } from './TodoIcons';
import { createAuthenticatedMediaBlobUrl } from '@shared/api';
import { type TodoBoard, type TodoBoardLabel, createTodoBoardLabel, createTodoChecklistItem, deleteTodoCardAttachment, deleteTodoChecklistItem, patchTodoCard, patchTodoChecklistItem, postTodoCardComment, uploadTodoCardAttachment, } from '@entities/todo';
import type { TodoCard, TodoCheckItem } from '@entities/todo/lib/todoUtils';
import { LABEL_COLORS } from '@entities/todo/lib/todoUtils';
import { type TodoBoardUsers, todoInitialFromDisplayLabel, todoParticipantLabel, todoUserPickInitial, todoUserPickLabel, } from '@entities/todo/lib/todoUserDisplay';
export type TodoColumnOption = {
    id: string;
    title: string;
};
type TodoCardModalProps = {
    card: TodoCard;
    columnTitle: string;
    columnId: string;
    columns: TodoColumnOption[];
    boardLabels: TodoBoardLabel[];
    todoBoardUsers: TodoBoardUsers;
    cardServerId: number;
    applyTodoBoard: (promise: Promise<TodoBoard>) => Promise<TodoBoard | null>;
    onMoveToColumn: (targetColumnId: string) => void;
    onClose: () => void;
    onCardUpdate: (patch: Partial<TodoCard>) => void;
    onArchive?: () => void;
};
type PanelType = 'labels' | 'dates' | 'checklist' | 'members' | null;
export const TodoCardModal = memo(function TodoCardModal({ card, columnTitle, columnId, columns, boardLabels, todoBoardUsers, cardServerId, applyTodoBoard, onMoveToColumn, onClose, onCardUpdate, onArchive, }: TodoCardModalProps) {
    const titleId = useId();
    const readOnly = !!card.fromCalendar;
    const apiOk = !readOnly && Number.isFinite(cardServerId) && cardServerId > 0;
    const [descFocused, setDescFocused] = useState(false);
    const [descDraft, setDescDraft] = useState(card.description ?? '');
    const [titleEditing, setTitleEditing] = useState(false);
    const [titleValue, setTitleValue] = useState(card.title);
    const [commentText, setCommentText] = useState('');
    const [activePanel, setActivePanel] = useState<PanelType>(null);
    const [columnMenuOpen, setColumnMenuOpen] = useState(false);
    const [attachError, setAttachError] = useState<string | null>(null);
    const [attachBusy, setAttachBusy] = useState(false);
    const [attachBusyHint, setAttachBusyHint] = useState<string | null>(null);
    const uploadAbortRef = useRef<AbortController | null>(null);
    const columnMenuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const titleInputRef = useRef<HTMLTextAreaElement>(null);
    const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
    useEffect(() => {
        uploadAbortRef.current?.abort();
        uploadAbortRef.current = null;
        setAttachBusy(false);
        setAttachBusyHint(null);
        setTitleValue(card.title);
        setDescDraft(card.description ?? '');
        setTitleEditing(false);
        setColumnMenuOpen(false);
        setAttachError(null);
    }, [card.id, card.title, card.description]);
    useEffect(() => {
        if (!columnMenuOpen)
            return;
        const onDoc = (e: MouseEvent) => {
            if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
                setColumnMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [columnMenuOpen]);
    const togglePanel = useCallback((p: PanelType) => {
        setActivePanel((prev) => (prev === p ? null : p));
    }, []);
    const commitTitle = useCallback(() => {
        if (readOnly) {
            setTitleEditing(false);
            return;
        }
        const trimmed = titleValue.trim();
        if (trimmed && trimmed !== card.title)
            onCardUpdate({ title: trimmed });
        else
            setTitleValue(card.title);
        setTitleEditing(false);
    }, [titleValue, card.title, onCardUpdate, readOnly]);
    const commitDescription = useCallback(() => {
        if (readOnly)
            return;
        const next = descDraft;
        if (next !== (card.description ?? ''))
            onCardUpdate({ description: next });
    }, [descDraft, card.description, onCardUpdate, readOnly]);
    const handleFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const list = e.target.files;
        e.target.value = '';
        if (!list?.length || !apiOk)
            return;
        setAttachError(null);
        const files = Array.from(list);
        const ac = new AbortController();
        uploadAbortRef.current?.abort();
        uploadAbortRef.current = ac;
        setAttachBusy(true);
        try {
            for (let i = 0; i < files.length; i += 1) {
                const file = files[i]!;
                if (ac.signal.aborted)
                    break;
                if (file.size > 15 * 1024 * 1024) {
                    setAttachError('Файл больше 15 МБ');
                    continue;
                }
                setAttachBusyHint(files.length > 1 ? `${file.name} (${i + 1}/${files.length})` : file.name);
                try {
                    const board = await uploadTodoCardAttachment(cardServerId, file, { signal: ac.signal });
                    const applied = await applyTodoBoard(Promise.resolve(board));
                    if (!applied)
                        setAttachError('Не удалось обновить доску');
                    else
                        setAttachError(null);
                }
                catch (err) {
                    if (ac.signal.aborted)
                        break;
                    setAttachError(err instanceof Error ? err.message : 'Не удалось загрузить файл');
                }
            }
        }
        finally {
            if (uploadAbortRef.current === ac)
                uploadAbortRef.current = null;
            setAttachBusy(false);
            setAttachBusyHint(null);
        }
    }, [apiOk, cardServerId, applyTodoBoard]);
    const removeAttachment = useCallback(async (id: string) => {
        if (!apiOk)
            return;
        const num = Number(id);
        if (!Number.isFinite(num))
            return;
        setAttachError(null);
        await applyTodoBoard(deleteTodoCardAttachment(cardServerId, num));
    }, [apiOk, cardServerId, applyTodoBoard]);
    const openAttachment = useCallback(async (mediaUrl: string) => {
        try {
            const blobUrl = await createAuthenticatedMediaBlobUrl(mediaUrl);
            window.open(blobUrl, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        }
        catch {
            setAttachError('Не удалось открыть файл');
        }
    }, []);
    const sendComment = useCallback(async () => {
        const t = commentText.trim();
        if (!t || !apiOk)
            return;
        const board = await applyTodoBoard(postTodoCardComment(cardServerId, t));
        if (board)
            setCommentText('');
    }, [commentText, apiOk, cardServerId, applyTodoBoard]);
    useEffect(() => {
        if (titleEditing && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [titleEditing]);
    useLayoutEffect(() => {
        if (!activePanel || !toolbarRef.current)
            return;
        const rect = toolbarRef.current.getBoundingClientRect();
        const page = toolbarRef.current.closest('.todo-page') as HTMLElement | null;
        const vars: Record<string, string> = {};
        if (page) {
            const cs = getComputedStyle(page);
            const names = ['--todo-accent', '--todo-text', '--todo-muted', '--todo-surface', '--todo-surface2', '--todo-panel-bg', '--todo-border', '--todo-shadow'];
            names.forEach((n) => { vars[n] = cs.getPropertyValue(n).trim(); });
        }
        const applyPosition = () => {
            let top = rect.bottom + 6;
            const left = rect.left;
            const pad = 10;
            const panelEl = panelRef.current;
            if (panelEl) {
                const h = panelEl.getBoundingClientRect().height;
                const vh = window.innerHeight;
                const maxTop = Math.max(pad, vh - h - pad);
                if (top > maxTop)
                    top = maxTop;
            }
            setPanelStyle({ top, left, ...vars } as React.CSSProperties);
        };
        applyPosition();
        const id = requestAnimationFrame(applyPosition);
        return () => cancelAnimationFrame(id);
    }, [activePanel]);
    useEffect(() => {
        if (!activePanel)
            return;
        const onClick = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
                toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
                setActivePanel(null);
            }
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [activePanel]);
    return (<div className="tcm-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="tcm" onClick={(e) => e.stopPropagation()}>

        <header className="tcm__header">
          <div className="tcm__header-left">
            <div className="tcm__column-wrap" ref={columnMenuRef}>
              <button type="button" className="tcm__list-btn" aria-haspopup="listbox" aria-expanded={columnMenuOpen} onClick={() => setColumnMenuOpen((v) => !v)}>
                <span>{columnTitle}</span>
                <IconChevronDown />
              </button>
              {columnMenuOpen && (<div className="tcm__column-menu" role="listbox">
                  {columns.map((col) => (<button key={col.id} type="button" role="option" aria-selected={col.id === columnId} className={`tcm__column-menu-item${col.id === columnId ? ' tcm__column-menu-item--active' : ''}`} onClick={() => {
                    setColumnMenuOpen(false);
                    if (col.id !== columnId)
                        onMoveToColumn(col.id);
                }}>
                      {col.title}
                    </button>))}
                </div>)}
            </div>
          </div>
          <div className="tcm__header-actions">
            <input ref={fileInputRef} type="file" className="tcm__file-input" multiple aria-hidden tabIndex={-1} onChange={handleFiles}/>
            <button type="button" className="tcm__icon-btn" aria-label="Вложения" disabled={readOnly || !apiOk || attachBusy} onClick={() => fileInputRef.current?.click()}>
              <IconPaperclip />
            </button>
            <button type="button" className="tcm__icon-btn" aria-label="Ещё"><IconMore /></button>
            <div className="tcm__header-divider"/>
            <button type="button" className="tcm__icon-btn tcm__icon-btn--close" aria-label="Закрыть" onClick={onClose}><IconClose /></button>
          </div>
        </header>

        <div className="tcm__body">
          <div className="tcm__main">

            <div className="tcm__title-row">
              <button type="button" className={`tcm__check${card.completed ? ' tcm__check--done' : ''}`} onClick={() => !readOnly && onCardUpdate({ completed: !card.completed })} aria-pressed={card.completed} aria-label={card.completed ? 'Снять отметку' : 'Отметить выполнено'}>
                {card.completed && <IconCheck />}
              </button>
              {titleEditing ? (<textarea ref={titleInputRef} id={titleId} className="tcm__title-input" value={titleValue} onChange={(e) => setTitleValue(e.target.value)} onBlur={commitTitle} onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    commitTitle();
                }
                if (e.key === 'Escape') {
                    setTitleValue(card.title);
                    setTitleEditing(false);
                }
            }} rows={2}/>) : (<h2 id={titleId} className={`tcm__title${card.completed ? ' tcm__title--done' : ''}`} onClick={() => !readOnly && setTitleEditing(true)} title={readOnly ? undefined : 'Нажмите для редактирования'}>
                  {card.title}
                </h2>)}
            </div>

            {((card.labels?.length ?? 0) > 0 ||
            card.dueDate ||
            card.startDate ||
            (card.participantUserIds?.length ?? 0) > 0) && (<div className="tcm__meta-row">
                {(card.labels?.length ?? 0) > 0 && card.labels!.map((l) => (<span key={l.id} className="tcm__label-badge" style={{ background: l.color }}>{l.text}</span>))}
                {(card.dueDate || card.startDate) && (<span className="tcm__date-chip tcm__date-chip--group">
                    <IconCalendar />
                    {card.startDate && (<span>
                        {new Date(card.startDate).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                      </span>)}
                    {card.startDate && card.dueDate && <span className="tcm__date-sep">→</span>}
                    {card.dueDate && (<span className="tcm__date-chip--due-inner">
                        {new Date(card.dueDate).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                      </span>)}
                  </span>)}
                {(card.participantUserIds?.length ?? 0) > 0 &&
                card.participantUserIds!.map((uid) => {
                    const label = todoParticipantLabel(todoBoardUsers.byId, uid);
                    return (<span key={uid} className="tcm__member-chip" title={label}>
                        <span className="tcm__member-chip-avatar">{todoInitialFromDisplayLabel(label)}</span>
                        <span className="tcm__member-chip-text">{label}</span>
                      </span>);
                })}
              </div>)}

            <div className="tcm__toolbar" ref={toolbarRef}>
              <button type="button" className={`tcm__tool-btn${activePanel === 'labels' ? ' tcm__tool-btn--active' : ''}`} disabled={readOnly || !apiOk} onClick={() => !readOnly && apiOk && togglePanel('labels')}>
                <IconTag /><span>Метки</span>
              </button>
              <button type="button" className={`tcm__tool-btn${activePanel === 'dates' ? ' tcm__tool-btn--active' : ''}`} disabled={readOnly} onClick={() => !readOnly && togglePanel('dates')}>
                <IconCalendar /><span>Даты</span>
              </button>
              <button type="button" className={`tcm__tool-btn${activePanel === 'checklist' ? ' tcm__tool-btn--active' : ''}`} disabled={readOnly || !apiOk} onClick={() => !readOnly && apiOk && togglePanel('checklist')}>
                <IconChecklist /><span>Чек-лист</span>
              </button>
              <button type="button" className={`tcm__tool-btn${activePanel === 'members' ? ' tcm__tool-btn--active' : ''}`} disabled={readOnly || !apiOk} onClick={() => !readOnly && apiOk && togglePanel('members')}>
                <IconUsers /><span>Участники</span>
              </button>
            </div>
            {readOnly && (<p className="tcm__readonly-hint">Событие Outlook: редактируются только колонка на доске и архив.</p>)}
            {!readOnly && attachError && (<p className="tcm__attach-error tcm__attach-error--banner">{attachError}</p>)}

            {activePanel && createPortal(<div ref={panelRef} className={`tcm__panel${activePanel === 'dates' ? ' tcm__panel--dates' : ''}`} style={panelStyle} onClick={(e) => e.stopPropagation()}>
                {activePanel === 'labels' && (<LabelsPanel card={card} boardLabels={boardLabels} cardServerId={cardServerId} applyTodoBoard={applyTodoBoard} apiOk={apiOk}/>)}
                {activePanel === 'dates' && <DatesPanel card={card} onCardUpdate={onCardUpdate}/>}
                {activePanel === 'checklist' && (<ChecklistPanel cardServerId={cardServerId} applyTodoBoard={applyTodoBoard} apiOk={apiOk}/>)}
                {activePanel === 'members' && (<MembersPanel card={card} cardServerId={cardServerId} applyTodoBoard={applyTodoBoard} apiOk={apiOk} boardUsers={todoBoardUsers}/>)}
              </div>, document.body)}

            {((!readOnly && apiOk) || (card.attachments?.length ?? 0) > 0) && (<section className="tcm__section">
                <h3 className="tcm__section-label">
                  <IconPaperclip />
                  Вложения
                </h3>
                {attachBusy && attachBusyHint && (<p className="tcm__attach-uploading" role="status" aria-live="polite">
                    Загрузка: {attachBusyHint}…
                  </p>)}
                {!readOnly && apiOk && (card.attachments?.length ?? 0) === 0 && !attachBusy && (<p className="tcm__attach-empty">
                    Файлов пока нет. Нажмите иконку скрепки в шапке карточки и выберите файл (до 15 МБ).
                  </p>)}
                {(card.attachments?.length ?? 0) > 0 && (<ul className="tcm__attachments">
                    {card.attachments!.map((a) => (<li key={a.id} className="tcm__attach-row">
                        {a.mediaUrl ? (<button type="button" className="tcm__attach-link" onClick={() => void openAttachment(a.mediaUrl!)}>
                            {a.name}
                          </button>) : (<span className="tcm__attach-name">{a.name}</span>)}
                        {apiOk && (<button type="button" className="tcm__attach-remove" onClick={() => void removeAttachment(a.id)} aria-label="Удалить вложение">
                            ×
                          </button>)}
                      </li>))}
                  </ul>)}
              </section>)}

            {(card.checklist?.length ?? 0) > 0 && (<ChecklistSection checklist={card.checklist!} cardServerId={cardServerId} applyTodoBoard={applyTodoBoard} apiOk={apiOk}/>)}

            <section className="tcm__section">
              <h3 className="tcm__section-label">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/></svg>
                Описание
              </h3>
              <div className={`tcm__desc-wrap${descFocused ? ' tcm__desc-wrap--focus' : ''}`}>
                <textarea className="tcm__desc" placeholder="Добавить более подробное описание..." value={descDraft} readOnly={readOnly} onChange={(e) => setDescDraft(e.target.value)} onFocus={() => setDescFocused(true)} onBlur={() => {
            setDescFocused(false);
            commitDescription();
        }} rows={4}/>
              </div>
            </section>
          </div>

          <aside className="tcm__aside">
            <div className="tcm__aside-section">
              <h3 className="tcm__aside-heading">
                <IconComment />
                Активность
              </h3>

              <div className="tcm__comment-compose">
                <div className="tcm__comment-avatar tcm__comment-avatar--me">Я</div>
                <div className="tcm__comment-compose-wrap">
                  <textarea className="tcm__comment-input" placeholder={apiOk ? 'Написать комментарий…' : 'Комментарии недоступны для этой карточки'} value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={1} disabled={!apiOk} onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendComment();
            }
        }} aria-label="Комментарий"/>
                  {commentText.trim() && apiOk && (<button type="button" className="tcm__comment-send" onClick={() => void sendComment()}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>)}
                </div>
              </div>

              <div className="tcm__activity-feed">
                {[...(card.comments ?? [])]
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((cm) => {
            const authorLabel = todoParticipantLabel(todoBoardUsers.byId, cm.userId);
            return (<div key={cm.id} className="tcm__activity-item">
                        <div className="tcm__activity-avatar" title={authorLabel}>
                          {todoInitialFromDisplayLabel(authorLabel)}
                        </div>
                        <div className="tcm__activity-body">
                          <p className="tcm__activity-text">{cm.body}</p>
                          <span className="tcm__activity-time">
                            {authorLabel}
                            {' · '}
                            {new Date(cm.createdAt).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                })}
                          </span>
                        </div>
                      </div>);
        })}
                {(card.comments?.length ?? 0) === 0 && (<div className="tcm__activity-item tcm__activity-item--muted">
                    <div className="tcm__activity-body">
                      <p className="tcm__activity-text">Комментариев пока нет</p>
                    </div>
                  </div>)}
              </div>
            </div>

            {onArchive && (<div className="tcm__aside-footer">
                <button type="button" className="tcm__archive-btn" onClick={onArchive}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8"/><path d="M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5"/><rect x="2" y="8" width="20" height="13" rx="2"/></svg>
                  Архивировать
                </button>
              </div>)}
          </aside>
        </div>
      </div>
    </div>);
});
function LabelsPanel({ card, boardLabels, cardServerId, applyTodoBoard, apiOk, }: {
    card: TodoCard;
    boardLabels: TodoBoardLabel[];
    cardServerId: number;
    applyTodoBoard: (p: Promise<TodoBoard>) => Promise<TodoBoard | null>;
    apiOk: boolean;
}) {
    const [text, setText] = useState('');
    const [color, setColor] = useState<(typeof LABEL_COLORS)[number]>(LABEL_COLORS[5]);
    const currentIds = new Set((card.labels ?? []).map((l) => Number(l.id)).filter((n) => !Number.isNaN(n)));
    const toggleBoardLabel = async (boardLabelId: number) => {
        if (!apiOk)
            return;
        const next = new Set(currentIds);
        if (next.has(boardLabelId))
            next.delete(boardLabelId);
        else
            next.add(boardLabelId);
        await applyTodoBoard(patchTodoCard(cardServerId, { labelIds: [...next] }));
    };
    const createAndAttach = async () => {
        if (!text.trim() || !apiOk)
            return;
        const t = text.trim();
        const board = await applyTodoBoard(createTodoBoardLabel({ title: t, color }));
        setText('');
        if (!board)
            return;
        const candidates = board.board_labels.filter((l) => l.title === t && l.color === color);
        const created = candidates.sort((a, b) => b.id - a.id)[0];
        if (!created)
            return;
        const next = new Set([...currentIds, created.id]);
        await applyTodoBoard(patchTodoCard(cardServerId, { labelIds: [...next] }));
    };
    return (<div className="tcm__panel-inner">
      <h4 className="tcm__panel-title">Метки доски</h4>
      <p className="tcm__panel-hint">Выберите метку или создайте новую на доске</p>
      <div className="tcm__board-labels-grid">
        {boardLabels.map((bl) => {
            const on = currentIds.has(bl.id);
            return (<button key={bl.id} type="button" className={`tcm__board-label-pill${on ? ' tcm__board-label-pill--on' : ''}`} style={{ ['--pill' as string]: bl.color }} onClick={() => void toggleBoardLabel(bl.id)}>
              <span className="tcm__board-label-pill-dot" style={{ background: bl.color }}/>
              {bl.title}
            </button>);
        })}
      </div>
      <div className="tcm__panel-colors">
        {LABEL_COLORS.map((c) => (<button key={c} type="button" className={`tcm__panel-color${c === color ? ' tcm__panel-color--active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c}/>))}
      </div>
      <div className="tcm__panel-row">
        <input className="tcm__panel-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Новая метка на доске..." onKeyDown={(e) => e.key === 'Enter' && void createAndAttach()}/>
        <button type="button" className="tcm__panel-add" onClick={() => void createAndAttach()} aria-label="Создать метку">
          <IconPlus />
        </button>
      </div>
    </div>);
}
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
function pad2(n: number) { return n.toString().padStart(2, '0'); }
function dateToStr(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function buildCalendar(year: number, month: number): (Date | null)[] {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i++)
        cells.push(null);
    for (let d = 1; d <= daysInMonth; d++)
        cells.push(new Date(year, month, d));
    return cells;
}
function DatesPanel({ card, onCardUpdate }: {
    card: TodoCard;
    onCardUpdate: (p: Partial<TodoCard>) => void;
}) {
    type Field = 'start' | 'due';
    const [activeField, setActiveField] = useState<Field>('start');
    const [startDate, setStartDate] = useState(card.startDate ?? '');
    const [dueDate, setDueDate] = useState(card.dueDate ?? '');
    const [dueTimeLocal, setDueTimeLocal] = useState(card.dueTime ?? '');
    const todayStr = dateToStr(new Date());
    useEffect(() => {
        setStartDate(card.startDate ?? '');
        setDueDate(card.dueDate ?? '');
        setDueTimeLocal(card.dueTime ?? '');
    }, [card.id, card.startDate, card.dueDate, card.dueTime]);
    const selectedStr = activeField === 'start' ? startDate : dueDate;
    const parsed = selectedStr ? new Date(selectedStr) : new Date();
    const [viewYear, setViewYear] = useState(parsed.getFullYear());
    const [viewMonth, setViewMonth] = useState(parsed.getMonth());
    const cells = buildCalendar(viewYear, viewMonth);
    const prevMonth = () => {
        if (viewMonth === 0) {
            setViewYear((y) => y - 1);
            setViewMonth(11);
        }
        else
            setViewMonth((m) => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) {
            setViewYear((y) => y + 1);
            setViewMonth(0);
        }
        else
            setViewMonth((m) => m + 1);
    };
    const pickDate = (d: Date) => {
        const str = dateToStr(d);
        if (activeField === 'start')
            setStartDate(str);
        else
            setDueDate(str);
    };
    const apply = () => {
        onCardUpdate({
            startDate: startDate || undefined,
            startTime: undefined,
            dueDate: dueDate || undefined,
            dueTime: dueTimeLocal || undefined,
        });
    };
    const clear = () => {
        onCardUpdate({ dueDate: undefined, dueTime: undefined });
        setDueDate('');
        setDueTimeLocal('');
    };
    const formatDisplay = (date: string) => {
        if (!date)
            return '—';
        const d = new Date(date);
        return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
    };
    return (<div className="tcm__panel-inner tcm__panel-inner--dates">
      <h4 className="tcm__panel-title">Даты</h4>

      <div className="tcm__dp-tabs">
        <button type="button" className={`tcm__dp-tab${activeField === 'start' ? ' tcm__dp-tab--active' : ''}`} onClick={() => { setActiveField('start'); if (startDate) {
        const d = new Date(startDate);
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
    } }}>
          Начало
        </button>
        <button type="button" className={`tcm__dp-tab${activeField === 'due' ? ' tcm__dp-tab--active' : ''}`} onClick={() => { setActiveField('due'); if (dueDate) {
        const d = new Date(dueDate);
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
    } }}>
          Срок
        </button>
      </div>

      <div className="tcm__dp-cal">
        <div className="tcm__dp-nav">
          <button type="button" className="tcm__dp-nav-btn" onClick={prevMonth} aria-label="Предыдущий месяц">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="tcm__dp-month">{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button type="button" className="tcm__dp-nav-btn" onClick={nextMonth} aria-label="Следующий месяц">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div className="tcm__dp-weekdays">
          {WEEKDAYS.map((w) => <span key={w} className="tcm__dp-wd">{w}</span>)}
        </div>
        <div className="tcm__dp-grid">
          {cells.map((cell, i) => {
            if (!cell)
                return <span key={`e${i}`} className="tcm__dp-cell tcm__dp-cell--empty"/>;
            const str = dateToStr(cell);
            const isSelected = str === selectedStr;
            const isToday = str === todayStr;
            return (<button key={str} type="button" className={[
                    'tcm__dp-cell',
                    isSelected && 'tcm__dp-cell--selected',
                    isToday && !isSelected && 'tcm__dp-cell--today',
                ].filter(Boolean).join(' ')} onClick={() => pickDate(cell)}>
                {cell.getDate()}
              </button>);
        })}
        </div>
      </div>

      <div className="tcm__dp-fields">
        <div className="tcm__dp-field-group">
          <span className="tcm__dp-field-label">Начало</span>
          <div className="tcm__dp-field-row tcm__dp-field-row--date-only">
            <span className="tcm__dp-field-val">{formatDisplay(startDate)}</span>
          </div>
        </div>
        <div className="tcm__dp-field-group">
          <span className="tcm__dp-field-label">Срок</span>
          <div className="tcm__dp-field-row tcm__dp-field-row--date-only">
            <span className="tcm__dp-field-val">{formatDisplay(dueDate)}</span>
          </div>
          <label className="tcm__dp-time-label">
            Время (для сервера)
            <input className="tcm__panel-input tcm__dp-time-input" type="time" value={dueTimeLocal} onChange={(e) => setDueTimeLocal(e.target.value)}/>
          </label>
        </div>
      </div>

      <p className="tcm__panel-hint">«Начало» хранится только в этой сессии; на сервер уходит дедлайн (срок)</p>

      <div className="tcm__panel-actions">
        <button type="button" className="tcm__panel-btn tcm__panel-btn--primary" onClick={apply}>Сохранить</button>
        <button type="button" className="tcm__panel-btn" onClick={clear}>Сбросить срок</button>
      </div>
    </div>);
}
function ChecklistPanel({ cardServerId, applyTodoBoard, apiOk, }: {
    cardServerId: number;
    applyTodoBoard: (p: Promise<TodoBoard>) => Promise<TodoBoard | null>;
    apiOk: boolean;
}) {
    const [text, setText] = useState('');
    const addItem = async () => {
        if (!text.trim() || !apiOk)
            return;
        const t = text.trim();
        setText('');
        await applyTodoBoard(createTodoChecklistItem(cardServerId, { title: t }));
    };
    return (<div className="tcm__panel-inner">
      <h4 className="tcm__panel-title">Добавить пункт</h4>
      <div className="tcm__panel-row">
        <input className="tcm__panel-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Новый пункт..." onKeyDown={(e) => e.key === 'Enter' && void addItem()}/>
        <button type="button" className="tcm__panel-add" onClick={() => void addItem()} aria-label="Добавить">
          <IconPlus />
        </button>
      </div>
    </div>);
}
function ChecklistSection({ checklist, cardServerId, applyTodoBoard, apiOk, }: {
    checklist: TodoCheckItem[];
    cardServerId: number;
    applyTodoBoard: (p: Promise<TodoBoard>) => Promise<TodoBoard | null>;
    apiOk: boolean;
}) {
    const sorted = [...checklist].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const done = sorted.filter((i) => i.done).length;
    const pct = sorted.length > 0 ? Math.round((done / sorted.length) * 100) : 0;
    const toggle = (item: TodoCheckItem) => {
        if (!apiOk)
            return;
        const num = Number(item.id);
        if (!Number.isFinite(num))
            return;
        void applyTodoBoard(patchTodoChecklistItem(cardServerId, num, { isDone: !item.done }));
    };
    const remove = (id: string) => {
        if (!apiOk)
            return;
        const num = Number(id);
        if (!Number.isFinite(num))
            return;
        void applyTodoBoard(deleteTodoChecklistItem(cardServerId, num));
    };
    return (<section className="tcm__section">
      <h3 className="tcm__section-label">
        <IconChecklist />
        Чек-лист
        <span className="tcm__checklist-pct">{pct}%</span>
      </h3>
      <div className="tcm__checklist-bar">
        <div className="tcm__checklist-bar-fill" style={{ width: `${pct}%` }}/>
      </div>
      <div className="tcm__checklist-items">
        {sorted.map((item) => (<div key={item.id} className={`tcm__checklist-item${item.done ? ' tcm__checklist-item--done' : ''}`}>
            <button type="button" className={`tcm__checklist-check${item.done ? ' tcm__checklist-check--done' : ''}`} onClick={() => toggle(item)}>
              {item.done && <IconCheck />}
            </button>
            <span className="tcm__checklist-text">{item.text}</span>
            {apiOk && (<button type="button" className="tcm__checklist-del" onClick={() => remove(item.id)} aria-label="Удалить">
                <IconClose />
              </button>)}
          </div>))}
      </div>
    </section>);
}
function MembersPanel({ card, cardServerId, applyTodoBoard, apiOk, boardUsers, }: {
    card: TodoCard;
    cardServerId: number;
    applyTodoBoard: (p: Promise<TodoBoard>) => Promise<TodoBoard | null>;
    apiOk: boolean;
    boardUsers: TodoBoardUsers;
}) {
    const [userIdRaw, setUserIdRaw] = useState('');
    const [pickSearch, setPickSearch] = useState('');
    const ids = card.participantUserIds ?? [];
    const byId = boardUsers.byId;
    const pickList = useMemo(() => {
        if (boardUsers.error !== null)
            return [];
        const q = pickSearch.trim().toLowerCase();
        return boardUsers.list
            .filter((u) => !ids.includes(u.id) && !u.is_blocked)
            .filter((u) => !q ||
            u.email.toLowerCase().includes(q) ||
            (u.display_name?.toLowerCase().includes(q) ?? false) ||
            String(u.id).includes(q))
            .sort((a, b) => todoUserPickLabel(a).localeCompare(todoUserPickLabel(b), 'ru'));
    }, [boardUsers.list, boardUsers.error, ids, pickSearch]);
    const addMemberById = async (n: number) => {
        if (!apiOk)
            return;
        if (!Number.isFinite(n) || n <= 0)
            return;
        if (ids.includes(n))
            return;
        await applyTodoBoard(patchTodoCard(cardServerId, { participantUserIds: [...ids, n] }));
    };
    const addMemberManual = async () => {
        const n = Number.parseInt(userIdRaw.trim(), 10);
        if (!Number.isFinite(n) || n <= 0)
            return;
        setUserIdRaw('');
        await addMemberById(n);
    };
    const removeMember = async (uid: number) => {
        if (!apiOk)
            return;
        await applyTodoBoard(patchTodoCard(cardServerId, { participantUserIds: ids.filter((x) => x !== uid) }));
    };
    const directoryReady = !boardUsers.loading && boardUsers.error === null;
    return (<div className="tcm__panel-inner">
      <h4 className="tcm__panel-title">Участники</h4>
      <p className="tcm__panel-hint">
        {directoryReady
            ? 'Выберите пользователя из списка. Заблокированные и архивные не показываются.'
            : 'Список пользователей недоступен — можно указать числовой id вручную (как в API participant_user_ids).'}
      </p>
      {(ids.length ?? 0) > 0 && (<div className="tcm__panel-members">
          {ids.map((m) => {
                const u = byId.get(m);
                const label = todoParticipantLabel(byId, m);
                const initial = u ? todoUserPickInitial(u) : todoInitialFromDisplayLabel(label);
                return (<span key={m} className="tcm__panel-member">
                <span className="tcm__panel-member-avatar">{initial}</span>
                <span className="tcm__panel-member-text">
                  <span>{label}</span>
                  {u && <span className="tcm__panel-member-sub">{u.email}</span>}
                </span>
                <button type="button" onClick={() => void removeMember(m)} aria-label="Удалить">
                  ×
                </button>
              </span>);
            })}
        </div>)}
      {boardUsers.loading && <p className="tcm__members-pick-status">Загрузка списка…</p>}
      {boardUsers.error && (<p className="tcm__members-pick-status tcm__members-pick-status--error">{boardUsers.error}</p>)}
      {directoryReady && (<>
          <input className="tcm__panel-input tcm__members-pick-search" type="search" value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} placeholder="Поиск по имени, email или id…" autoComplete="off"/>
          <div className="tcm__members-pick-list" role="listbox" aria-label="Пользователи">
            {pickList.length === 0 ? (<p className="tcm__members-pick-empty">Нет пользователей для добавления</p>) : (pickList.map((u) => (<button key={u.id} type="button" className="tcm__members-pick-row" disabled={!apiOk} aria-label={`Добавить участника ${todoUserPickLabel(u)}`} onClick={() => void addMemberById(u.id)}>
                  <span className="tcm__members-pick-avatar">{todoUserPickInitial(u)}</span>
                  <span className="tcm__members-pick-main">
                    <span className="tcm__members-pick-name">{todoUserPickLabel(u)}</span>
                    <span className="tcm__members-pick-email">{u.email}</span>
                  </span>
                </button>)))}
          </div>
        </>)}
      {!directoryReady && !boardUsers.loading && (<div className="tcm__panel-row">
          <input className="tcm__panel-input" type="number" min={1} step={1} value={userIdRaw} onChange={(e) => setUserIdRaw(e.target.value)} placeholder="User id…" onKeyDown={(e) => e.key === 'Enter' && void addMemberManual()}/>
          <button type="button" className="tcm__panel-add" onClick={() => void addMemberManual()} aria-label="Добавить">
            <IconPlus />
          </button>
        </div>)}
    </div>);
}
