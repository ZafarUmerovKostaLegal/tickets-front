import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo } from 'react';
import { TwemojiEmoji } from '@shared/ui';
import { avatarColor, initials } from './kostaDailyAvatar';
import { highlightSearchText, messageMatchesSearch } from './kostaDailySearchHighlight';
import { KostaDailyMessageContent, isStickerOrGifMessage } from './KostaDailyMessageContent';
import { KostaDailyAttachment } from './KostaDailyAttachment';
import { KostaDailyPollMessage } from './KostaDailyPollMessage';
import { KostaDailyChecklistMessage } from './KostaDailyChecklistMessage';
import { REACTION_EMOJIS } from './kostaDailyReactions';
import { feedBlockPropsEqual } from './feedBlockPropsEqual';
function KostaDailyFeedBlockInner({ block, chatSearchOpen, chatSearchTrimmed, activeSearchMatchId, reactionPickerMsgId, replyFlashId, ctxMenuMsgId, userId, canClosePoll, onStartReply, onToggleReactionPicker, onToggleReaction, onScrollToMessage, onVotePoll, onClosePoll, onToggleChecklistItem, onAppendChecklistTask, onRemoveChecklistTask, onPreviewAttachment, onBubbleContextMenu, onBubbleTouchStart, onCancelLongPress, }) {
    if (block.type === 'date') {
        return (_jsx("div", { className: "kd-tg__date", children: _jsx("span", { children: block.label }) }));
    }
    if (block.type === 'service') {
        return (_jsx("div", { className: "kd-tg__service", children: _jsx("span", { children: block.text }) }));
    }
    const { msg, own, showAvatar, showName, groupedTop, groupedBottom } = block;
    const attachments = msg.attachments ?? [];
    const hasPoll = !!msg.poll;
    const hasChecklist = !!msg.checklist;
    const hasText = !hasPoll && !hasChecklist && msg.text.trim().length > 0;
    const isMedia = isStickerOrGifMessage(msg.text);
    const isSearchHit = chatSearchOpen && chatSearchTrimmed && messageMatchesSearch(msg.text, msg.authorName, chatSearchTrimmed);
    const isSearchCurrent = isSearchHit && block.id === activeSearchMatchId;
    const reactionPickerOpen = reactionPickerMsgId === block.id;
    return (_jsxs("div", { "data-msg-id": block.id, className: [
            'kd-tg__row',
            own ? 'kd-tg__row--out' : 'kd-tg__row--in',
            groupedTop ? 'kd-tg__row--grouped-top' : '',
            groupedBottom ? 'kd-tg__row--grouped-bottom' : '',
            isSearchHit ? 'kd-tg__row--search-hit' : '',
            isSearchCurrent ? 'kd-tg__row--search-current' : '',
        ].filter(Boolean).join(' '), children: [!own && (_jsx("div", { className: "kd-tg__row-avatar-slot", children: showAvatar ? (_jsx("span", { className: "kd-tg__msg-avatar", style: { background: avatarColor(msg.authorName) }, "aria-hidden": true, children: initials(msg.authorName) })) : null })), _jsxs("div", { className: "kd-tg__row-main", children: [!msg.isDeleted && (_jsxs("div", { className: `kd-tg__row-actions${own ? ' kd-tg__row-actions--out' : ''}`, children: [_jsx("button", { type: "button", className: "kd-tg__row-action-btn", title: "\u041E\u0442\u0432\u0435\u0442\u0438\u0442\u044C", "aria-label": "\u041E\u0442\u0432\u0435\u0442\u0438\u0442\u044C \u043D\u0430 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435", onClick: () => onStartReply(msg), children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("polyline", { points: "9 17 4 12 9 7" }), _jsx("path", { d: "M20 18v-2a4 4 0 0 0-4-4H4" })] }) }), _jsx("button", { type: "button", className: `kd-tg__row-action-btn${reactionPickerOpen ? ' kd-tg__row-action-btn--active' : ''}`, title: "\u0420\u0435\u0430\u043A\u0446\u0438\u044F", "aria-label": "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0440\u0435\u0430\u043A\u0446\u0438\u044E", "aria-expanded": reactionPickerOpen, onClick: () => onToggleReactionPicker(block.id), children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("path", { d: "M8 14s1.5 2 4 2 4-2 4-2" }), _jsx("line", { x1: "9", y1: "9", x2: "9.01", y2: "9" }), _jsx("line", { x1: "15", y1: "9", x2: "15.01", y2: "9" })] }) }), reactionPickerOpen && (_jsx("div", { className: `kd-tg__reaction-picker${own ? ' kd-tg__reaction-picker--out' : ''}`, role: "toolbar", "aria-label": "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0435\u0430\u043A\u0446\u0438\u044E", children: REACTION_EMOJIS.map(({ emoji, label }) => (_jsx("button", { type: "button", className: "kd-tg__reaction-picker-btn", title: label, "aria-label": label, onClick: () => {
                                        onToggleReactionPicker(block.id);
                                        void onToggleReaction(Number(block.id), emoji);
                                    }, children: _jsx(TwemojiEmoji, { emoji: emoji, size: "28px", title: label }) }, emoji))) }))] })), _jsxs("div", { className: [
                            'kd-tg__bubble-wrap',
                            (msg.reactions?.length ?? 0) > 0 ? 'kd-tg__bubble-wrap--has-reactions' : '',
                        ].filter(Boolean).join(' '), children: [_jsxs("div", { className: [
                                    'kd-tg__bubble',
                                    own ? 'kd-tg__bubble--out' : 'kd-tg__bubble--in',
                                    isMedia ? 'kd-tg__bubble--media' : '',
                                    msg.replyTo ? 'kd-tg__bubble--has-reply' : '',
                                    replyFlashId === block.id ? 'kd-tg__bubble--reply-flash' : '',
                                    ctxMenuMsgId === block.id ? 'kd-tg__bubble--ctx-active' : '',
                                ].filter(Boolean).join(' '), onDoubleClick: () => !msg.isDeleted && onStartReply(msg), onContextMenu: (e) => onBubbleContextMenu(e, msg, own), onTouchStart: (e) => onBubbleTouchStart(e, msg, own), onTouchEnd: onCancelLongPress, onTouchMove: onCancelLongPress, onTouchCancel: onCancelLongPress, children: [msg.replyTo ? (_jsxs("button", { type: "button", className: "kd-tg__bubble-reply", onClick: () => onScrollToMessage(msg.replyTo.messageId), children: [_jsx("span", { className: "kd-tg__bubble-reply-name", style: { color: avatarColor(msg.replyTo.authorName) }, children: msg.replyTo.authorName }), _jsx("span", { className: "kd-tg__bubble-reply-text", children: msg.replyTo.preview })] })) : null, showName && (_jsx("span", { className: "kd-tg__bubble-name", style: { color: avatarColor(msg.authorName) }, children: chatSearchOpen && chatSearchTrimmed
                                            ? highlightSearchText(msg.authorName, chatSearchTrimmed)
                                            : msg.authorName })), hasPoll && msg.poll ? (_jsx(KostaDailyPollMessage, { poll: msg.poll, onVote: (idx) => onVotePoll(msg.poll.id, idx), onClose: () => onClosePoll(msg.poll.id), canClose: canClosePoll })) : null, hasChecklist && msg.checklist ? (_jsx(KostaDailyChecklistMessage, { checklist: msg.checklist, onToggle: (itemId) => onToggleChecklistItem(msg.checklist.id, itemId), onAppend: (text) => onAppendChecklistTask(msg.checklist.id, text), onRemove: (itemId) => onRemoveChecklistTask(msg.checklist.id, itemId) })) : null, hasText && (_jsx(KostaDailyMessageContent, { text: msg.text, highlightQuery: chatSearchOpen ? chatSearchTrimmed : '', highlight: highlightSearchText })), attachments.length > 0 && (_jsx("div", { className: "kd-tg__attachments", children: attachments.map((a) => (_jsx(KostaDailyAttachment, { attachment: a, onPreview: onPreviewAttachment }, a.id))) })), _jsxs("span", { className: "kd-tg__bubble-meta", children: [_jsx("time", { dateTime: msg.time, children: msg.time }), own ? (_jsx("span", { className: "kd-tg__bubble-checks", "aria-hidden": true, title: "\u0414\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E", children: _jsx("svg", { viewBox: "0 0 16 11", width: "16", height: "11", fill: "currentColor", children: _jsx("path", { d: "M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 8.23-2.2-2.462a.46.46 0 0 0-.347-.178.493.493 0 0 0-.372.178l-.05.063a.46.46 0 0 0-.102.305.493.493 0 0 0 .178.381l2.59 2.896a.46.46 0 0 0 .347.178h.051a.457.457 0 0 0 .304-.102l6.648-8.84 2.896 2.59a.46.46 0 0 0 .381.178.493.493 0 0 0 .372-.178l.05-.063a.46.46 0 0 0 .102-.305.493.493 0 0 0-.178-.381L11.453.831a.457.457 0 0 0-.382-.178z" }) }) })) : null] })] }), (msg.reactions?.length ?? 0) > 0 && (_jsx("div", { className: `kd-tg__reactions${own ? ' kd-tg__reactions--out' : ''}`, role: "group", "aria-label": "\u0420\u0435\u0430\u043A\u0446\u0438\u0438", children: msg.reactions.map((rx) => {
                                    const myReaction = userId != null && rx.user_ids.includes(userId);
                                    return (_jsxs("button", { type: "button", className: `kd-tg__reaction${myReaction ? ' kd-tg__reaction--mine' : ''}`, title: myReaction ? 'Убрать реакцию' : rx.user_ids.length > 0
                                            ? rx.user_ids.slice(0, 3).join(', ')
                                            : 'Добавить реакцию', onClick: () => onToggleReaction(Number(block.id), rx.emoji), children: [_jsx(TwemojiEmoji, { emoji: rx.emoji, size: "14px", className: "kd-tg__reaction-emoji" }), _jsx("span", { className: "kd-tg__reaction-count", children: rx.count })] }, rx.emoji));
                                }) }))] })] })] }));
}
export const KostaDailyFeedBlock = memo(KostaDailyFeedBlockInner, feedBlockPropsEqual);
