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
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
});
