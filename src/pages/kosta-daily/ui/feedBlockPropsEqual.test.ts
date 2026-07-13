import { describe, expect, it } from 'vitest';
import type { RenderBlock } from '@entities/chat';
import type { KostaDailyFeedBlockProps } from './KostaDailyFeedBlock';
import { feedBlockPropsEqual } from './feedBlockPropsEqual';

function messageBlock(id: string, text = 'hello'): RenderBlock {
    return {
        type: 'message',
        id,
        msg: {
            id: '1',
            kind: 'user',
            text,
            authorName: 'Alice',
            time: '12:00',
            createdAt: '2026-01-01T00:00:00Z',
            authorId: 2,
            attachments: [],
        },
        own: false,
        showAvatar: true,
        showName: true,
        groupedTop: false,
        groupedBottom: false,
    };
}

function baseProps(block: RenderBlock): KostaDailyFeedBlockProps {
    return {
        block,
        chatSearchOpen: false,
        chatSearchTrimmed: '',
        activeSearchMatchId: null,
        reactionPickerMsgId: null,
        replyFlashId: null,
        ctxMenuMsgId: null,
        userId: 1,
        canClosePoll: false,
        onStartReply: () => {},
        onToggleReactionPicker: () => {},
        onToggleReaction: () => {},
        onScrollToMessage: () => {},
        onVotePoll: () => {},
        onClosePoll: () => {},
        onPreviewAttachment: () => {},
        onBubbleContextMenu: () => {},
        onBubbleTouchStart: () => {},
        onCancelLongPress: () => {},
    };
}

describe('feedBlockPropsEqual', () => {
    it('пропускает ререндер при неизменном блоке и UI-состоянии', () => {
        const block = messageBlock('m1');
        const prev = baseProps(block);
        const next = baseProps(block);
        expect(feedBlockPropsEqual(prev, next)).toBe(true);
    });

    it('требует ререндер при смене reaction picker для этого блока', () => {
        const block = messageBlock('m1');
        const prev = { ...baseProps(block), reactionPickerMsgId: null };
        const next = { ...baseProps(block), reactionPickerMsgId: 'm1' };
        expect(feedBlockPropsEqual(prev, next)).toBe(false);
    });

    it('требует ререндер при активном поиске по тексту сообщения', () => {
        const block = messageBlock('m1', 'findme');
        const prev = { ...baseProps(block), chatSearchOpen: true, chatSearchTrimmed: 'find' };
        const next = { ...baseProps(block), chatSearchOpen: true, chatSearchTrimmed: 'findme' };
        expect(feedBlockPropsEqual(prev, next)).toBe(false);
    });
});
