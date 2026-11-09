import { describe, expect, it } from 'vitest';
import {
    canDownloadFileManager,
    canManageFileManager,
    canUploadFileManager,
} from './fileManagerAccess';

describe('canManageFileManager', () => {
    it('даёт управление админам и партнёрам', () => {
        expect(canManageFileManager({ role: 'Администратор', position: null })).toBe(true);
        expect(canManageFileManager({ role: 'Главный администратор', position: null })).toBe(true);
        expect(canManageFileManager({ role: 'Партнёр', position: null })).toBe(true);
        expect(canManageFileManager({ role: 'Сотрудник', position: 'Партнёр' })).toBe(true);
        expect(canManageFileManager({ role: 'Сотрудник', position: null })).toBe(false);
        expect(canManageFileManager(null)).toBe(false);
    });
});

describe('canUploadFileManager / canDownloadFileManager', () => {
    it('доступны любому авторизованному пользователю', () => {
        expect(canUploadFileManager({ role: 'Сотрудник' })).toBe(true);
        expect(canDownloadFileManager({ role: 'Сотрудник' })).toBe(true);
        expect(canUploadFileManager(null)).toBe(false);
        expect(canDownloadFileManager(null)).toBe(false);
    });
});
