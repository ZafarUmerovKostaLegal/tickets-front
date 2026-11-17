/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import { CHAT_STICKER_PACKS, CHAT_STICKERS, getRecentStickerIds, pushRecentSticker, stickerById, stickerGlyphById } from './chatMediaCatalog';
import { chatMessageNotificationPreview } from './chatNotificationPreview';
import { encodeChatGif, encodeChatSticker } from './chatRichContent';

describe('chatMediaCatalog', () => {
    afterEach(() => window.localStorage.clear());

    it('has unique sticker ids that point to their pack', () => {
        const ids = CHAT_STICKERS.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const pack of CHAT_STICKER_PACKS)
            for (const s of pack.stickers) expect(s.packId).toBe(pack.id);
    });

    it('looks stickers up by id', () => {
        expect(stickerById('coffee')?.glyph).toBe('☕');
        expect(stickerGlyphById('missing')).toBeNull();
    });

    it('keeps the most recent stickers first, without duplicates, up to 16', () => {
        pushRecentSticker('a');
        pushRecentSticker('b');
        pushRecentSticker('a');
        expect(getRecentStickerIds()).toEqual(['a', 'b']);
        for (let i = 0; i < 20; i += 1) pushRecentSticker(`s${i}`);
        expect(getRecentStickerIds()).toHaveLength(16);
        expect(getRecentStickerIds()[0]).toBe('s19');
    });

    it('survives corrupted storage', () => {
        window.localStorage.setItem('kd_recent_stickers', '{bad');
        expect(getRecentStickerIds()).toEqual([]);
        window.localStorage.setItem('kd_recent_stickers', '[1,"x"]');
        expect(getRecentStickerIds()).toEqual(['x']);
    });
});

const msg = (p: Partial<ChatMessage>) => ({ id: 1, author_user_id: 2, body: '', ...p } as ChatMessage);

describe('chatMessageNotificationPreview', () => {
    it('describes deleted messages, checklists, polls and quizzes', () => {
        expect(chatMessageNotificationPreview(msg({ is_deleted: true }))).toBe('Сообщение удалено');
        expect(chatMessageNotificationPreview(msg({ message_kind: 'checklist', checklist: { title: 'Дела' } as never }))).toBe('Чеклист: Дела');
        expect(chatMessageNotificationPreview(msg({ message_kind: 'checklist' }))).toBe('Чеклист');
        expect(chatMessageNotificationPreview(msg({ message_kind: 'poll', poll: { question: 'Обед?' } as never }))).toBe('Опрос: Обед?');
        expect(chatMessageNotificationPreview(msg({ message_kind: 'quiz' }))).toBe('Викторина');
    });

    it('describes files, stickers, GIFs and text', () => {
        expect(chatMessageNotificationPreview(msg({ attachments: [{ id: 1 }] as never }))).toBe('Файл');
        expect(chatMessageNotificationPreview(msg({ body: encodeChatSticker('coffee') }))).toBe('Стикер');
        expect(chatMessageNotificationPreview(msg({ body: encodeChatGif('https://x/y.gif') }))).toBe('GIF');
        expect(chatMessageNotificationPreview(msg({ body: '  Привет  ' }))).toBe('Привет');
    });
});
