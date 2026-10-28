import { jsx as _jsx } from "react/jsx-runtime";
import { memo } from 'react';
import { twemojiHtml } from '../lib/twemoji';
export const TwemojiText = memo(function TwemojiText({ text, className }) {
    const html = twemojiHtml(text);
    return (_jsx("span", { className: className, 
        // eslint-disable-next-line no-restricted-syntax -- html from twemojiHtml → sanitizeHtml
        dangerouslySetInnerHTML: { __html: html } }));
});
export const TwemojiEmoji = memo(function TwemojiEmoji({ emoji, size = '1em', className, title, }) {
    const html = twemojiHtml(emoji);
    const cls = ['twemoji-wrap', className].filter(Boolean).join(' ');
    return (_jsx("span", { className: cls, title: title, style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size,
            height: size,
            flexShrink: 0,
            overflow: 'hidden',
            lineHeight: 1,
        }, 
        // eslint-disable-next-line no-restricted-syntax -- html from twemojiHtml → sanitizeHtml
        dangerouslySetInnerHTML: { __html: html } }));
});
