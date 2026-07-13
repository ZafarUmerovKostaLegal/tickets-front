import { memo, type MouseEvent, type TouchEvent } from 'react';
import { TwemojiEmoji } from '@shared/ui';
import type { ChatReaction, DailyMessage, RenderBlock } from '@entities/chat';
import { avatarColor, initials } from './kostaDailyAvatar';
import { highlightSearchText, messageMatchesSearch } from './kostaDailySearchHighlight';
import { KostaDailyMessageContent, isStickerOrGifMessage } from './KostaDailyMessageContent';
import { KostaDailyAttachment } from './KostaDailyAttachment';
import { KostaDailyPollMessage } from './KostaDailyPollMessage';

import { REACTION_EMOJIS } from './kostaDailyReactions';
import { feedBlockPropsEqual } from './feedBlockPropsEqual';

export type KostaDailyFeedBlockProps = {
    block: RenderBlock;
    chatSearchOpen: boolean;
    chatSearchTrimmed: string;
    activeSearchMatchId: string | null;
    reactionPickerMsgId: string | null;
    replyFlashId: string | null;
    ctxMenuMsgId: string | null;
    userId: number | null;
    canClosePoll: boolean;
    onStartReply: (msg: DailyMessage) => void;
    onToggleReactionPicker: (blockId: string) => void;
    onToggleReaction: (messageId: number, emoji: string) => void;
    onScrollToMessage: (messageId: number) => void;
    onVotePoll: (pollId: number, optionIndex: number) => void;
    onClosePoll: (pollId: number) => void;
    onPreviewAttachment: (url: string) => void;
    onBubbleContextMenu: (e: MouseEvent, msg: DailyMessage, own: boolean) => void;
    onBubbleTouchStart: (e: TouchEvent, msg: DailyMessage, own: boolean) => void;
    onCancelLongPress: () => void;
};

function KostaDailyFeedBlockInner({
    block,
    chatSearchOpen,
    chatSearchTrimmed,
    activeSearchMatchId,
    reactionPickerMsgId,
    replyFlashId,
    ctxMenuMsgId,
    userId,
    canClosePoll,
    onStartReply,
    onToggleReactionPicker,
    onToggleReaction,
    onScrollToMessage,
    onVotePoll,
    onClosePoll,
    onPreviewAttachment,
    onBubbleContextMenu,
    onBubbleTouchStart,
    onCancelLongPress,
}: KostaDailyFeedBlockProps) {
    if (block.type === 'date') {
        return (
            <div className="kd-tg__date">
                <span>{block.label}</span>
            </div>
        );
    }
    if (block.type === 'service') {
        return (
            <div className="kd-tg__service">
                <span>{block.text}</span>
            </div>
        );
    }

    const { msg, own, showAvatar, showName, groupedTop, groupedBottom } = block;
    const attachments = msg.attachments ?? [];
    const hasPoll = !!msg.poll;
    const hasText = !hasPoll && msg.text.trim().length > 0;
    const isMedia = isStickerOrGifMessage(msg.text);
    const isSearchHit = chatSearchOpen && chatSearchTrimmed && messageMatchesSearch(msg.text, msg.authorName, chatSearchTrimmed);
    const isSearchCurrent = isSearchHit && block.id === activeSearchMatchId;
    const reactionPickerOpen = reactionPickerMsgId === block.id;

    return (
        <div
            data-msg-id={block.id}
            className={[
                'kd-tg__row',
                own ? 'kd-tg__row--out' : 'kd-tg__row--in',
                groupedTop ? 'kd-tg__row--grouped-top' : '',
                groupedBottom ? 'kd-tg__row--grouped-bottom' : '',
                isSearchHit ? 'kd-tg__row--search-hit' : '',
                isSearchCurrent ? 'kd-tg__row--search-current' : '',
            ].filter(Boolean).join(' ')}
        >
            {!own && (
                <div className="kd-tg__row-avatar-slot">
                    {showAvatar ? (
                        <span
                            className="kd-tg__msg-avatar"
                            style={{ background: avatarColor(msg.authorName) }}
                            aria-hidden
                        >
                            {initials(msg.authorName)}
                        </span>
                    ) : null}
                </div>
            )}
            <div className="kd-tg__row-main">
                {!msg.isDeleted && (
                    <div className={`kd-tg__row-actions${own ? ' kd-tg__row-actions--out' : ''}`}>
                        <button
                            type="button"
                            className="kd-tg__row-action-btn"
                            title="Ответить"
                            aria-label="Ответить на сообщение"
                            onClick={() => onStartReply(msg)}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <polyline points="9 17 4 12 9 7" />
                                <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            className={`kd-tg__row-action-btn${reactionPickerOpen ? ' kd-tg__row-action-btn--active' : ''}`}
                            title="Реакция"
                            aria-label="Добавить реакцию"
                            aria-expanded={reactionPickerOpen}
                            onClick={() => onToggleReactionPicker(block.id)}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                                <circle cx="12" cy="12" r="10" />
                                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                                <line x1="9" y1="9" x2="9.01" y2="9" />
                                <line x1="15" y1="9" x2="15.01" y2="9" />
                            </svg>
                        </button>
                        {reactionPickerOpen && (
                            <div
                                className={`kd-tg__reaction-picker${own ? ' kd-tg__reaction-picker--out' : ''}`}
                                role="toolbar"
                                aria-label="Выберите реакцию"
                            >
                                {REACTION_EMOJIS.map(({ emoji, label }) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        className="kd-tg__reaction-picker-btn"
                                        title={label}
                                        aria-label={label}
                                        onClick={() => {
                                            onToggleReactionPicker(block.id);
                                            void onToggleReaction(Number(block.id), emoji);
                                        }}
                                    >
                                        <TwemojiEmoji emoji={emoji} size="28px" title={label} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className={[
                    'kd-tg__bubble-wrap',
                    (msg.reactions?.length ?? 0) > 0 ? 'kd-tg__bubble-wrap--has-reactions' : '',
                ].filter(Boolean).join(' ')}>
                    <div
                        className={[
                            'kd-tg__bubble',
                            own ? 'kd-tg__bubble--out' : 'kd-tg__bubble--in',
                            isMedia ? 'kd-tg__bubble--media' : '',
                            msg.replyTo ? 'kd-tg__bubble--has-reply' : '',
                            replyFlashId === block.id ? 'kd-tg__bubble--reply-flash' : '',
                            ctxMenuMsgId === block.id ? 'kd-tg__bubble--ctx-active' : '',
                        ].filter(Boolean).join(' ')}
                        onDoubleClick={() => !msg.isDeleted && onStartReply(msg)}
                        onContextMenu={(e) => onBubbleContextMenu(e, msg, own)}
                        onTouchStart={(e) => onBubbleTouchStart(e, msg, own)}
                        onTouchEnd={onCancelLongPress}
                        onTouchMove={onCancelLongPress}
                        onTouchCancel={onCancelLongPress}
                    >
                        {msg.replyTo ? (
                            <button
                                type="button"
                                className="kd-tg__bubble-reply"
                                onClick={() => onScrollToMessage(msg.replyTo!.messageId)}
                            >
                                <span
                                    className="kd-tg__bubble-reply-name"
                                    style={{ color: avatarColor(msg.replyTo.authorName) }}
                                >
                                    {msg.replyTo.authorName}
                                </span>
                                <span className="kd-tg__bubble-reply-text">{msg.replyTo.preview}</span>
                            </button>
                        ) : null}
                        {showName && (
                            <span className="kd-tg__bubble-name" style={{ color: avatarColor(msg.authorName) }}>
                                {chatSearchOpen && chatSearchTrimmed
                                    ? highlightSearchText(msg.authorName, chatSearchTrimmed)
                                    : msg.authorName}
                            </span>
                        )}
                        {hasPoll && msg.poll ? (
                            <KostaDailyPollMessage
                                poll={msg.poll}
                                onVote={(idx) => onVotePoll(msg.poll!.id, idx)}
                                onClose={() => onClosePoll(msg.poll!.id)}
                                canClose={canClosePoll}
                            />
                        ) : null}
                        {hasText && (
                            <KostaDailyMessageContent
                                text={msg.text}
                                highlightQuery={chatSearchOpen ? chatSearchTrimmed : ''}
                                highlight={highlightSearchText}
                            />
                        )}
                        {attachments.length > 0 && (
                            <div className="kd-tg__attachments">
                                {attachments.map((a) => (
                                    <KostaDailyAttachment key={a.id} attachment={a} onPreview={onPreviewAttachment} />
                                ))}
                            </div>
                        )}
                        <span className="kd-tg__bubble-meta">
                            <time dateTime={msg.time}>{msg.time}</time>
                            {own ? (
                                <span className="kd-tg__bubble-checks" aria-hidden title="Доставлено">
                                    <svg viewBox="0 0 16 11" width="16" height="11" fill="currentColor">
                                        <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 8.23-2.2-2.462a.46.46 0 0 0-.347-.178.493.493 0 0 0-.372.178l-.05.063a.46.46 0 0 0-.102.305.493.493 0 0 0 .178.381l2.59 2.896a.46.46 0 0 0 .347.178h.051a.457.457 0 0 0 .304-.102l6.648-8.84 2.896 2.59a.46.46 0 0 0 .381.178.493.493 0 0 0 .372-.178l.05-.063a.46.46 0 0 0 .102-.305.493.493 0 0 0-.178-.381L11.453.831a.457.457 0 0 0-.382-.178z" />
                                    </svg>
                                </span>
                            ) : null}
                        </span>
                    </div>

                    {(msg.reactions?.length ?? 0) > 0 && (
                        <div
                            className={`kd-tg__reactions${own ? ' kd-tg__reactions--out' : ''}`}
                            role="group"
                            aria-label="Реакции"
                        >
                            {(msg.reactions as ChatReaction[]).map((rx) => {
                                const myReaction = userId != null && rx.user_ids.includes(userId);
                                return (
                                    <button
                                        key={rx.emoji}
                                        type="button"
                                        className={`kd-tg__reaction${myReaction ? ' kd-tg__reaction--mine' : ''}`}
                                        title={myReaction ? 'Убрать реакцию' : rx.user_ids.length > 0
                                            ? rx.user_ids.slice(0, 3).join(', ')
                                            : 'Добавить реакцию'}
                                        onClick={() => onToggleReaction(Number(block.id), rx.emoji)}
                                    >
                                        <TwemojiEmoji
                                            emoji={rx.emoji}
                                            size="14px"
                                            className="kd-tg__reaction-emoji"
                                        />
                                        <span className="kd-tg__reaction-count">{rx.count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export const KostaDailyFeedBlock = memo(KostaDailyFeedBlockInner, feedBlockPropsEqual);
