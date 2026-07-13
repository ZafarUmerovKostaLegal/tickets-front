import type { KostaDailyFeedBlockProps } from './KostaDailyFeedBlock';
import { messageMatchesSearch } from './kostaDailySearchHighlight';

export function feedBlockPropsEqual(prev: KostaDailyFeedBlockProps, next: KostaDailyFeedBlockProps): boolean {
    if (prev.block !== next.block)
        return false;
    const id = prev.block.id;
    if (prev.chatSearchOpen !== next.chatSearchOpen)
        return false;
    if (prev.chatSearchTrimmed !== next.chatSearchTrimmed)
        return false;
    if (prev.userId !== next.userId)
        return false;
    if (prev.canClosePoll !== next.canClosePoll)
        return false;
    const uiChanged =
        (prev.activeSearchMatchId === id) !== (next.activeSearchMatchId === id)
        || (prev.reactionPickerMsgId === id) !== (next.reactionPickerMsgId === id)
        || (prev.replyFlashId === id) !== (next.replyFlashId === id)
        || (prev.ctxMenuMsgId === id) !== (next.ctxMenuMsgId === id);
    if (uiChanged)
        return false;
    if (prev.chatSearchOpen && prev.chatSearchTrimmed) {
        const msgBlock = prev.block.type === 'message' ? prev.block : null;
        if (msgBlock && messageMatchesSearch(msgBlock.msg.text, msgBlock.msg.authorName, prev.chatSearchTrimmed))
            return false;
    }
    return true;
}
