import { describe, expect, it } from 'vitest';
import {
    normalizeNotificationItem,
    notificationTypeKey,
    parseBoardTitleFromNotificationDescription,
    TODO_NOTIFICATION_TYPES,
} from './normalize';

describe('normalizeNotificationItem', () => {
    it('нормализует snake_case и camelCase', () => {
        const item = normalizeNotificationItem({
            id: 1,
            uuid: 'abc-uuid',
            title: 'Заголовок',
            description: 'Текст',
            is_archived: false,
            created_at: '2024-01-01',
            notification_type: 'info',
        });
        expect(item).toMatchObject({
            id: 1,
            uuid: 'abc-uuid',
            title: 'Заголовок',
            is_archived: false,
        });
    });

    it('возвращает null без uuid', () => {
        expect(normalizeNotificationItem({ id: 1, title: 'x' })).toBeNull();
    });
});

describe('notificationTypeKey', () => {
    it('приводит тип к нижнему регистру', () => {
        expect(notificationTypeKey({
            id: 1,
            uuid: 'u',
            title: '',
            description: '',
            photo_path: null,
            is_archived: false,
            created_at: '',
            updated_at: '',
            notification_type: 'TODO_BOARD_ADDED',
        })).toBe('todo_board_added');
    });
});

describe('parseBoardTitleFromNotificationDescription', () => {
    it('извлекает название доски из описания', () => {
        expect(parseBoardTitleFromNotificationDescription('Вас добавили на доску «Проект Alpha»'))
            .toBe('Проект Alpha');
        expect(parseBoardTitleFromNotificationDescription('без доски')).toBeNull();
    });
});

describe('TODO_NOTIFICATION_TYPES', () => {
    it('содержит ключи todo-уведомлений', () => {
        expect(TODO_NOTIFICATION_TYPES.boardAdded).toBe('todo_board_added');
    });
});
