import { describe, expect, it } from 'vitest';
import type { TodoBoardSummary, TodoBoardsListResult } from '../api';
import { pickBoardIdAfterDelete } from './pickBoardAfterDelete';

function summary(id: number): TodoBoardSummary {
    return {
        id,
        title: `Board ${id}`,
        visibility: 'personal',
        color: null,
        background_url: null,
        sort_order: id,
        is_current: false,
        updated_at: null,
        my_role: 'owner',
    };
}

function list(ids: number[], lastSelected: number | null = null): TodoBoardsListResult {
    return {
        items: ids.map(summary),
        current_board_id: lastSelected,
        last_selected_board_id: lastSelected,
    };
}

describe('pickBoardIdAfterDelete', () => {
    it('returns null when the deleted board was the only one', () => {
        expect(pickBoardIdAfterDelete(list([4], 4), 4)).toBeNull();
    });

    it('skips the deleted board and keeps another last-selected board', () => {
        expect(pickBoardIdAfterDelete(list([1, 2, 9], 2), 9)).toBe(2);
    });

    it('falls back to the first remaining board when the deleted one was selected', () => {
        expect(pickBoardIdAfterDelete(list([3, 8], 3), 3)).toBe(8);
    });
});
