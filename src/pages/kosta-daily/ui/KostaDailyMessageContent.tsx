import type { ReactNode } from 'react';
import { parseChatMessageBody, stickerById } from '@entities/chat';
import { TwemojiEmoji, TwemojiText } from '@shared/ui';

export type KostaDailyMessageContentProps = {
    text: string;
    highlightQuery?: string;
    highlight?: (text: string, query: string) => ReactNode;
};

export function KostaDailyMessageContent({
    text,
    highlightQuery = '',
    highlight,
}: KostaDailyMessageContentProps) {
    const parsed = parseChatMessageBody(text);

    if (parsed.kind === 'sticker') {
        const sticker = stickerById(parsed.stickerId);
        const glyph = sticker?.glyph ?? '⭐';
        const animClass = sticker?.animation ? `kd-tg__sticker--${sticker.animation}` : '';
        return (
            <span
                className={`kd-tg__bubble-sticker ${animClass}`.trim()}
                role="img"
                aria-label={sticker?.label ?? 'Стикер'}
                title={sticker?.label}
            >
                <TwemojiEmoji emoji={glyph} size="7rem" />
            </span>
        );
    }

    if (parsed.kind === 'gif') {
        return (
            <img
                className="kd-tg__bubble-gif"
                src={parsed.url}
                alt="GIF"
                loading="lazy"
                decoding="async"
            />
        );
    }

    const q = highlightQuery.trim();
    if (q && highlight) {
        return <span className="kd-tg__bubble-text">{highlight(parsed.text, q)}</span>;
    }

    return <TwemojiText text={parsed.text} className="kd-tg__bubble-text" />;
}

export function isStickerOrGifMessage(text: string): boolean {
    const kind = parseChatMessageBody(text).kind;
    return kind === 'sticker' || kind === 'gif';
}
