export const CHAT_STICKER_PREFIX = 'kd:sticker:';
export const CHAT_GIF_PREFIX = 'kd:gif:';
export function encodeChatSticker(stickerId) {
    return `${CHAT_STICKER_PREFIX}${stickerId}`;
}
export function encodeChatGif(url) {
    return `${CHAT_GIF_PREFIX}${url}`;
}
export function parseChatMessageBody(body) {
    const raw = body.trim();
    if (raw.startsWith(CHAT_STICKER_PREFIX)) {
        return { kind: 'sticker', stickerId: raw.slice(CHAT_STICKER_PREFIX.length) };
    }
    if (raw.startsWith(CHAT_GIF_PREFIX)) {
        return { kind: 'gif', url: raw.slice(CHAT_GIF_PREFIX.length) };
    }
    return { kind: 'text', text: body };
}
export function formatChatMessagePreview(body) {
    const parsed = parseChatMessageBody(body);
    if (parsed.kind === 'sticker')
        return 'Стикер';
    if (parsed.kind === 'gif')
        return 'GIF';
    const t = parsed.text.trim();
    return t || '…';
}
export function isRichChatOnlyMessage(body) {
    const parsed = parseChatMessageBody(body);
    return parsed.kind === 'sticker' || parsed.kind === 'gif';
}
