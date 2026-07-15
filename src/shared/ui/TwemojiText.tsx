import { memo } from 'react';
import { twemojiHtml } from '../lib/twemoji';

interface TwemojiTextProps {
    text: string;
    className?: string;
}

export const TwemojiText = memo(function TwemojiText({ text, className }: TwemojiTextProps) {
    const html = twemojiHtml(text);
    return (
        <span
            className={className}
            // eslint-disable-next-line no-restricted-syntax -- html from twemojiHtml → sanitizeHtml
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
});

interface TwemojiEmojiProps {
    emoji: string;

    size?: string;
    className?: string;
    title?: string;
}

export const TwemojiEmoji = memo(function TwemojiEmoji({
    emoji,
    size = '1em',
    className,
    title,
}: TwemojiEmojiProps) {
    const html = twemojiHtml(emoji);
    const cls = ['twemoji-wrap', className].filter(Boolean).join(' ');
    return (
        <span
            className={cls}
            title={title}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: size,
                height: size,
                flexShrink: 0,
                overflow: 'hidden',
                lineHeight: 1,
            }}
            // eslint-disable-next-line no-restricted-syntax -- html from twemojiHtml → sanitizeHtml
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
});
