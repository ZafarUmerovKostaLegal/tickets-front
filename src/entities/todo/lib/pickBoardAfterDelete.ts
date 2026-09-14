import { pickPreferredTodoBoardId, type TodoBoardsListResult } from '../api';

/** Next openable board after deleting one. Null means the list is empty. */
export function pickBoardIdAfterDelete(
    data: TodoBoardsListResult,
    deletedBoardId: number,
): number | null {
    const items = data.items.filter((board) => board.id !== deletedBoardId);
    if (!items.length)
        return null;
    const stillListed = (id: number | null) => id != null && items.some((board) => board.id === id);
    return pickPreferredTodoBoardId({
        items,
        last_selected_board_id: stillListed(data.last_selected_board_id) ? data.last_selected_board_id : null,
        current_board_id: stillListed(data.current_board_id) ? data.current_board_id : null,
    });
}
