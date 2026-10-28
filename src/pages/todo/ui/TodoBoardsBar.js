import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { loadTodoDirectoryUsers } from '@entities/todo/lib/todoDirectoryUsers';
import { resolveBoardBackgroundDisplayUrl } from '@entities/todo/lib/boardBackgroundUrl';
import { canEditKanbanStructure, normalizeBoardRole } from '@entities/todo/lib/boardRoles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatTodoBoardFallback, useI18n } from '@shared/i18n';
function boardPickerCoverGradient(accent) {
    return `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 40%, #ec4899))`;
}
function BoardPickerCardCover({ board }) {
    const accent = board.color?.trim() || '#4f46e5';
    const bgUrl = resolveBoardBackgroundDisplayUrl(board.background_url);
    const [imgFailed, setImgFailed] = useState(false);
    const showBg = Boolean(bgUrl) && !imgFailed;
    useEffect(() => {
        setImgFailed(false);
    }, [bgUrl]);
    return (_jsx("span", { className: "todo-board-picker__card-cover", style: {
            background: showBg ? accent : boardPickerCoverGradient(accent),
        }, children: showBg && bgUrl && (_jsx("img", { src: bgUrl, alt: "", className: "todo-board-picker__card-cover-img", loading: "lazy", decoding: "async", draggable: false, onError: () => setImgFailed(true) })) }));
}
function canRenameTodoBoard(role) {
    const r = normalizeBoardRole(role);
    if (r == null)
        return true;
    return canEditKanbanStructure(r);
}
export function TodoBoardsBar({ themeVarsStyle, boards, currentBoardId, listError, onSelectBoard, onCreateBoard, onRenameBoard, }) {
    const { t } = useI18n();
    const [pickerOpen, setPickerOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [addBoardOpen, setAddBoardOpen] = useState(false);
    const [newBoardName, setNewBoardName] = useState('');
    const [newBoardVisibility, setNewBoardVisibility] = useState('personal');
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [instantAddMembers, setInstantAddMembers] = useState(true);
    const [employees, setEmployees] = useState([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [employeesError, setEmployeesError] = useState(null);
    const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createError, setCreateError] = useState(null);
    const [renamingBoardId, setRenamingBoardId] = useState(null);
    const [renameDraft, setRenameDraft] = useState('');
    const [renameBusy, setRenameBusy] = useState(false);
    const [renameError, setRenameError] = useState(null);
    const skipRenameBlurRef = useRef(false);
    const filteredBoards = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q)
            return boards;
        return boards.filter((b) => {
            const vis = b.visibility.toLowerCase();
            return b.title.toLowerCase().includes(q) || vis.includes(q);
        });
    }, [boards, search]);
    const employeeRows = useMemo(() => [...employees].sort((a, b) => {
        const na = (a.display_name?.trim() || a.email || '').toLowerCase();
        const nb = (b.display_name?.trim() || b.email || '').toLowerCase();
        return na.localeCompare(nb, 'ru');
    }), [employees]);
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
        void loadTodoDirectoryUsers()
            .then((rows) => {
            if (!cancelled)
                setEmployees(rows);
        })
            .catch((e) => {
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
    const handleSubmitNewBoard = async (e) => {
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
            const body = newBoardVisibility === 'shared'
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
        catch (err) {
            setCreateError(err instanceof Error ? err.message : t('todoPage.errors.createBoard'));
        }
        finally {
            setCreateSubmitting(false);
        }
    };
    const startRenameBoard = (board) => {
        if (!canRenameTodoBoard(board.my_role) || renameBusy)
            return;
        setRenameError(null);
        setRenamingBoardId(board.id);
        setRenameDraft(board.title || '');
    };
    const cancelRenameBoard = () => {
        if (renameBusy)
            return;
        skipRenameBlurRef.current = true;
        setRenamingBoardId(null);
        setRenameDraft('');
        setRenameError(null);
    };
    const submitRenameBoard = async (board) => {
        if (skipRenameBlurRef.current) {
            skipRenameBlurRef.current = false;
            return;
        }
        const name = renameDraft.trim();
        if (!name || name === (board.title || '').trim()) {
            cancelRenameBoard();
            return;
        }
        setRenameBusy(true);
        setRenameError(null);
        try {
            await onRenameBoard(board.id, name);
            setRenamingBoardId(null);
            setRenameDraft('');
        }
        catch (err) {
            setRenameError(err instanceof Error ? err.message : t('todoPage.errors.updateBoard'));
        }
        finally {
            setRenameBusy(false);
        }
    };
    useEffect(() => {
        if (pickerOpen)
            return;
        setRenamingBoardId(null);
        setRenameDraft('');
        setRenameError(null);
    }, [pickerOpen]);
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
    const portalHost = typeof document !== 'undefined' &&
        overlaysOpen &&
        createPortal(_jsxs("div", { className: "todo-boards-bar-portal-root", style: themeVarsStyle, children: [pickerOpen && (_jsx("div", { className: "todo-board-picker__backdrop", onClick: () => setPickerOpen(false), children: _jsxs("div", { className: "todo-board-picker", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "todo-board-picker__search-row", children: [_jsxs("label", { className: "todo-board-picker__search-wrap", "aria-label": t('todoPage.boards.searchBoardsAria'), children: [_jsxs("svg", { className: "todo-board-picker__search-icon", width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("path", { d: "m21 21-4.3-4.3" })] }), _jsx("input", { className: "todo-board-picker__search-input", type: "search", placeholder: t('todoPage.boards.searchBoards'), value: search, onChange: (e) => setSearch(e.target.value), autoFocus: true })] }), _jsx("button", { type: "button", className: "todo-board-picker__icon-btn", onClick: handleOpenAddBoard, title: t('todoPage.boards.newBoard'), children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }) }), _jsx("button", { type: "button", className: "todo-board-picker__icon-btn", onClick: () => setPickerOpen(false), title: t('todoPage.close'), children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), (listError || renameError) && (_jsx("div", { className: "todo-boards-bar__emp-status todo-boards-bar__emp-status--error", role: "alert", children: renameError || listError })), _jsxs("div", { className: "todo-board-picker__section-title", children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("path", { d: "M12 7v5l3 2" })] }), _jsx("span", { children: t('todoPage.boards.yourBoards') })] }), _jsxs("div", { className: "todo-board-picker__grid", children: [filteredBoards.map((board) => {
                                        const isCurrent = currentBoardId != null && board.id === currentBoardId;
                                        const canRename = canRenameTodoBoard(board.my_role);
                                        const isRenaming = renamingBoardId === board.id;
                                        const displayTitle = board.title || formatTodoBoardFallback(board.id, t);
                                        return (_jsxs("div", { className: `todo-board-picker__card${isCurrent ? ' todo-board-picker__card--current' : ''}${isRenaming ? ' todo-board-picker__card--renaming' : ''}`, children: [_jsx("button", { type: "button", className: "todo-board-picker__card-select", onClick: () => {
                                                        if (isRenaming)
                                                            return;
                                                        void onSelectBoard(board.id);
                                                        setPickerOpen(false);
                                                    }, children: _jsx(BoardPickerCardCover, { board: board }) }), isRenaming ? (_jsx("input", { className: "todo-board-picker__card-title-input", value: renameDraft, maxLength: 200, autoFocus: true, disabled: renameBusy, "aria-label": t('todoPage.boards.renameAria'), onClick: (e) => e.stopPropagation(), onChange: (e) => setRenameDraft(e.target.value), onBlur: () => {
                                                        void submitRenameBoard(board);
                                                    }, onKeyDown: (e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            e.target.blur();
                                                        }
                                                        if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            cancelRenameBoard();
                                                        }
                                                    } })) : (_jsxs("span", { className: "todo-board-picker__card-foot", children: [_jsx("span", { className: "todo-board-picker__card-title", onDoubleClick: (e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                startRenameBoard(board);
                                                            }, children: displayTitle }), canRename && (_jsx("button", { type: "button", className: "todo-board-picker__rename-btn", title: t('todoPage.boards.rename'), "aria-label": t('todoPage.boards.renameAria'), onClick: (e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                startRenameBoard(board);
                                                            }, children: _jsx("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" }) }) }))] }))] }, board.id));
                                    }), filteredBoards.length === 0 && (_jsx("div", { className: "todo-boards-bar__empty", children: boards.length === 0 ? t('todoPage.boards.noBoards') : t('todoPage.notFound') }))] })] }) })), addBoardOpen && (_jsx("div", { className: "todo-boards-bar__backdrop todo-boards-bar__backdrop--portal", onClick: () => !createSubmitting && setAddBoardOpen(false), children: _jsxs("form", { className: "todo-boards-bar__modal", onClick: (e) => e.stopPropagation(), onSubmit: (e) => void handleSubmitNewBoard(e), children: [_jsxs("div", { className: "todo-boards-bar__modal-head", children: [_jsx("h3", { className: "todo-boards-bar__modal-title", children: t('todoPage.boards.newBoardTitle') }), _jsx("button", { type: "button", className: "todo-boards-bar__modal-close", onClick: () => !createSubmitting && setAddBoardOpen(false), "aria-label": t('todoPage.close'), disabled: createSubmitting, children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), createError && (_jsx("div", { className: "todo-boards-bar__emp-status todo-boards-bar__emp-status--error", role: "alert", children: createError })), _jsx("div", { className: "todo-boards-bar__field", children: _jsxs("label", { className: "todo-boards-bar__label", children: [t('todoPage.boards.boardName'), _jsx("input", { className: "todo-boards-bar__input", value: newBoardName, onChange: (e) => setNewBoardName(e.target.value), placeholder: t('todoPage.boards.boardNamePlaceholder'), autoFocus: true, disabled: createSubmitting })] }) }), _jsxs("div", { className: "todo-boards-bar__field", children: [_jsx("span", { className: "todo-boards-bar__label", children: t('todoPage.boards.access') }), _jsxs("div", { className: "todo-boards-bar__segmented", children: [_jsx("button", { type: "button", className: `todo-boards-bar__segmented-btn${newBoardVisibility === 'personal' ? ' todo-boards-bar__segmented-btn--active' : ''}`, onClick: () => {
                                                    setNewBoardVisibility('personal');
                                                    setSelectedMemberIds([]);
                                                    setEmployeeSearchQuery('');
                                                }, disabled: createSubmitting, children: t('todoPage.boards.private') }), _jsx("button", { type: "button", className: `todo-boards-bar__segmented-btn${newBoardVisibility === 'shared' ? ' todo-boards-bar__segmented-btn--active' : ''}`, onClick: () => setNewBoardVisibility('shared'), disabled: createSubmitting, children: t('todoPage.boards.shared') })] }), _jsx("p", { className: "todo-boards-bar__hint", children: t('todoPage.boards.accessHint') })] }), newBoardVisibility === 'shared' && (_jsxs("div", { className: "todo-boards-bar__field", children: [_jsx("span", { className: "todo-boards-bar__label", id: "todo-add-board-employees-label", children: t('todoPage.boards.employees') }), employeesLoading && (_jsx("div", { className: "todo-boards-bar__emp-status", "aria-live": "polite", children: t('todoPage.boards.employeesLoading') })), employeesError && !employeesLoading && (_jsx("div", { className: "todo-boards-bar__emp-status todo-boards-bar__emp-status--error", role: "alert", children: employeesError })), !employeesLoading && !employeesError && employeeRows.length === 0 && (_jsx("div", { className: "todo-boards-bar__emp-status", children: t('todoPage.boards.employeesNotFound') })), !employeesLoading && !employeesError && employeeRows.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "todo-boards-bar__emp-search-wrap", children: [_jsxs("svg", { className: "todo-boards-bar__emp-search-icon", width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("path", { d: "m21 21-4.3-4.3" })] }), _jsx("input", { className: "todo-boards-bar__emp-search-input", type: "search", placeholder: t('todoPage.boards.employeesSearch'), value: employeeSearchQuery, onChange: (e) => setEmployeeSearchQuery(e.target.value), "aria-labelledby": "todo-add-board-employees-label", disabled: createSubmitting })] }), selectedMemberIds.length > 0 && (_jsx("p", { className: "todo-boards-bar__hint", children: t('todoPage.boards.selectedMembers').replace('{count}', String(selectedMemberIds.length)) })), _jsxs("label", { className: "todo-boards-bar__instant", children: [_jsx("input", { type: "checkbox", checked: instantAddMembers, onChange: (e) => setInstantAddMembers(e.target.checked), disabled: createSubmitting }), _jsx("span", { children: t('todoPage.boards.instantAddMembers') })] }), _jsx("p", { className: "todo-boards-bar__hint", children: t('todoPage.boards.instantAddMembersHint') }), _jsxs("ul", { className: "todo-boards-bar__emp-list", role: "listbox", "aria-label": t('todoPage.boards.employeesAria'), "aria-multiselectable": true, children: [filteredEmployeeRows.length === 0 && (_jsx("li", { className: "todo-boards-bar__emp-empty", children: t('todoPage.boards.employeesEmpty') })), filteredEmployeeRows.map((u) => {
                                                        const title = u.display_name?.trim() || u.email || `id ${u.id}`;
                                                        const sub = u.position?.trim() || u.email;
                                                        const selected = selectedMemberIds.includes(u.id);
                                                        return (_jsx("li", { id: `todo-emp-opt-${u.id}`, role: "presentation", children: _jsxs("button", { type: "button", role: "option", "aria-selected": selected, className: `todo-boards-bar__emp-row${selected ? ' todo-boards-bar__emp-row--selected' : ''}`, onClick: () => {
                                                                    setSelectedMemberIds((prev) => prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]);
                                                                }, disabled: createSubmitting, children: [_jsx("span", { className: "todo-boards-bar__emp-avatar", "aria-hidden": true, children: (title[0] || '?').toUpperCase() }), _jsxs("span", { className: "todo-boards-bar__emp-text", children: [_jsx("span", { className: "todo-boards-bar__emp-name", children: title }), _jsx("span", { className: "todo-boards-bar__emp-sub", children: sub })] })] }) }, u.id));
                                                    })] })] }))] })), _jsxs("div", { className: "todo-boards-bar__actions", children: [_jsx("button", { type: "button", className: "todo-boards-bar__btn todo-boards-bar__btn--ghost", onClick: () => setAddBoardOpen(false), disabled: createSubmitting, children: t('todoPage.cancel') }), _jsx("button", { type: "submit", className: "todo-boards-bar__btn todo-boards-bar__btn--primary", disabled: createSubmitting ||
                                            !newBoardName.trim() ||
                                            (newBoardVisibility === 'shared' &&
                                                (employeesLoading || employeeRows.length === 0 || selectedMemberIds.length === 0)), children: createSubmitting ? t('todoPage.creating') : t('todoPage.boards.createBoard') })] })] }) }))] }), document.body);
    return (_jsxs("section", { className: "todo-boards-bar", "aria-label": t('todoPage.boards.otherBoardsAria'), children: [_jsxs("div", { className: "todo-boards-bar__nav", role: "tablist", "aria-label": t('todoPage.boards.boardModesAria'), children: [_jsxs("button", { type: "button", className: "todo-boards-bar__nav-item todo-boards-bar__nav-item--active", role: "tab", "aria-selected": "true", children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("rect", { x: "3", y: "5", width: "18", height: "14", rx: "2" }), _jsx("path", { d: "M8 9v6M12 9v6M16 9v6" })] }), _jsx("span", { children: t('todoPage.boards.boardTab') })] }), _jsxs("button", { type: "button", className: "todo-boards-bar__nav-item", role: "tab", "aria-selected": pickerOpen, onClick: () => setPickerOpen(true), "aria-expanded": pickerOpen, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("rect", { x: "3", y: "6", width: "12", height: "12", rx: "2" }), _jsx("path", { d: "M19 8v8M15 12h8" })] }), _jsx("span", { children: t('todoPage.boards.pickBoard') }), _jsx("span", { className: `todo-boards-bar__toggle-icon${pickerOpen ? ' todo-boards-bar__toggle-icon--open' : ''}`, children: _jsx("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M6 9l6 6 6-6" }) }) })] })] }), portalHost] }));
}
