import { jsx as _jsx } from "react/jsx-runtime";
import { parseChatMessageBody, stickerById } from '@entities/chat';
import { TwemojiEmoji, TwemojiText } from '@shared/ui';
export function KostaDailyMessageContent({ text, highlightQuery = '', highlight, }) {
    const parsed = parseChatMessageBody(text);
    if (parsed.kind === 'sticker') {
        const sticker = stickerById(parsed.stickerId);
        const glyph = sticker?.glyph ?? '⭐';
        const animClass = sticker?.animation ? `kd-tg__sticker--${sticker.animation}` : '';
        return (_jsx("span", { className: `kd-tg__bubble-sticker ${animClass}`.trim(), role: "img", "aria-label": sticker?.label ?? 'Стикер', title: sticker?.label, children: _jsx(TwemojiEmoji, { emoji: glyph, size: "7rem" }) }));
    }
    if (parsed.kind === 'gif') {
        return (_jsx("img", { className: "kd-tg__bubble-gif", src: parsed.url, alt: "GIF", loading: "lazy", decoding: "async" }));
    }
    const q = highlightQuery.trim();
    if (q && highlight) {
        return _jsx("span", { className: "kd-tg__bubble-text", children: highlight(parsed.text, q) });
    }
    return _jsx(TwemojiText, { text: parsed.text, className: "kd-tg__bubble-text" });
}
export function isStickerOrGifMessage(text) {
    const kind = parseChatMessageBody(text).kind;
    return kind === 'sticker' || kind === 'gif';
}
