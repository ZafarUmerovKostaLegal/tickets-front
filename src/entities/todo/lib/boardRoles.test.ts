import { describe, expect, it } from 'vitest';
import { canDeleteTodoBoard, canEditKanbanStructure } from './boardRoles';

describe('canDeleteTodoBoard', () => {
    it('allows only the owner', () => {
        expect(canDeleteTodoBoard('owner')).toBe(true);
        expect(canDeleteTodoBoard(' Owner ')).toBe(true);
    });

    it('hides delete from editors and viewers even if they can edit the board', () => {
        expect(canEditKanbanStructure('editor')).toBe(true);
        expect(canDeleteTodoBoard('editor')).toBe(false);
        expect(canDeleteTodoBoard('viewer')).toBe(false);
        expect(canDeleteTodoBoard('participant')).toBe(false);
        expect(canDeleteTodoBoard(null)).toBe(false);
    });
});
