import { describe, expect, it } from 'vitest';
import { fileGuardEventFilePath, fileGuardPreviewType, mapFileGuardEvents } from './fileGuardApi';

describe('mapFileGuardEvents', () => {
    it('раскладывает событие по пользователю Windows', () => {
        const feed = mapFileGuardEvents([{
            id: 'abc',
            host: 'DESKTOP-1',
            windowsUser: 'KOSTA\\ivan',
            occurredAt: '2026-10-26T09:15:00',
            process: 'Telegram.exe',
            resource: 'Telegram',
            filePath: 'C:\\Users\\ivan\\Desktop\\a.pdf',
            fileName: 'a.pdf',
            kind: 'send',
            status: 'blocked',
            channel: 'telegram',
            note: '',
            hasFile: true,
        }]);
        expect(feed.users).toEqual([{ id: 'DESKTOP-1|KOSTA\\ivan', login: 'ivan', host: 'DESKTOP-1', dept: '' }]);
        expect(feed.events[0]).toMatchObject({
            id: 'abc',
            d: '26.10.2026',
            t: '09:15:00',
            name: 'a.pdf',
            dir: 'C:\\Users\\ivan\\Desktop',
            u: 'DESKTOP-1|KOSTA\\ivan',
            hasFile: true,
        });
    });

    it('кодирует идентификатор, чтобы путь файла не вышел из журнала', () => {
        expect(fileGuardEventFilePath('../secret')).toBe('/api/v1/file-guard/events/..%2Fsecret/file');
        expect(fileGuardEventFilePath('a?b')).toBe('/api/v1/file-guard/events/a%3Fb/file');
    });

    it('узнаёт тип файла по имени, когда сервер отдаёт его без типа', () => {
        expect(fileGuardPreviewType('a.pdf', 'application/octet-stream')).toBe('application/pdf');
        expect(fileGuardPreviewType('shot.png', null)).toBe('image/png');
        expect(fileGuardPreviewType('link.rdp', 'application/octet-stream')).toBe('text/plain');
        expect(fileGuardPreviewType('photo.jpg', 'image/jpeg')).toBe('image/jpeg');
        expect(fileGuardPreviewType('data.bin', null)).toBe('application/octet-stream');
    });
});
