import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { CHAT_EMOJI_GROUPS, CHAT_EMOJI_KEYWORDS, CHAT_GIFS, CHAT_STICKER_PACKS, CHAT_STICKERS, getRecentStickerIds, pushRecentSticker, stickerById, } from '@entities/chat';
import { TwemojiEmoji } from '@shared/ui';
const EMOJI_GROUP_NAV = [
    { icon: '⭐', title: 'Частые' },
    { icon: '😀', title: 'Эмоции' },
    { icon: '💼', title: 'Офис' },
    { icon: '👋', title: 'Жесты' },
];
function IconSearch() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("path", { d: "m21 21-4.35-4.35" })] }));
}
function emojiMatchesQuery(emoji, groupTitle, qLower) {
    if (emoji.includes(qLower) || groupTitle.toLowerCase().includes(qLower))
        return true;
    const keywords = CHAT_EMOJI_KEYWORDS[emoji];
    return Boolean(keywords?.toLowerCase().includes(qLower));
}
function filterEmojiGroups(query) {
    const q = query.trim();
    if (!q)
        return CHAT_EMOJI_GROUPS;
    const qLower = q.toLowerCase();
    return CHAT_EMOJI_GROUPS
        .map((group) => ({
        ...group,
        items: group.items.filter((emoji) => emojiMatchesQuery(emoji, group.title, qLower)),
    }))
        .filter((group) => group.items.length > 0);
}
export function KostaDailyComposerPicker({ open, tab, onTabChange, onPickEmoji, onPickSticker, onPickGif, disabled, }) {
    const scrollRef = useRef(null);
    const packSectionRefs = useRef({});
    const emojiSectionRefs = useRef([]);
    const [query, setQuery] = useState('');
    const [activePackId, setActivePackId] = useState('recent');
    const [activeEmojiGroup, setActiveEmojiGroup] = useState(0);
    const [, forceUpdate] = useState(0);
    useEffect(() => {
        setQuery('');
        setActiveEmojiGroup(0);
    }, [tab, open]);
    useEffect(() => {
        if (open && tab === 'sticker')
            forceUpdate((n) => n + 1);
    }, [open, tab]);
    const filteredEmojiGroups = useMemo(() => filterEmojiGroups(query), [query]);
    const filteredGifs = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q)
            return CHAT_GIFS;
        return CHAT_GIFS.filter((g) => g.label.toLowerCase().includes(q) || g.id.toLowerCase().includes(q));
    }, [query]);
    const recentIds = useMemo(() => getRecentStickerIds(), []);
    const recentStickers = useMemo(() => recentIds.map((id) => stickerById(id)).filter(Boolean), [recentIds]);
    const filteredPackStickers = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q)
            return null;
        return CHAT_STICKERS.filter((s) => s.label.toLowerCase().includes(q) || s.glyph.includes(q) || s.id.includes(q));
    }, [query]);
    const handlePickSticker = (stickerId) => {
        pushRecentSticker(stickerId);
        forceUpdate((n) => n + 1);
        onPickSticker(stickerId);
    };
    const scrollToPackSection = (packId) => {
        setActivePackId(packId);
        const el = packSectionRefs.current[packId];
        if (el)
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const scrollToEmojiSection = (index) => {
        setActiveEmojiGroup(index);
        const el = emojiSectionRefs.current[index];
        if (el)
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    if (!open)
        return null;
    return (_jsxs("div", { className: "kd-tg__picker", role: "dialog", "aria-label": "\u0412\u044B\u0431\u043E\u0440 \u044D\u043C\u043E\u0434\u0437\u0438, \u0441\u0442\u0438\u043A\u0435\u0440\u043E\u0432 \u0438 GIF", children: [_jsx("div", { className: "kd-tg__picker-toolbar", children: _jsxs("label", { className: "kd-tg__picker-search", children: [_jsx("span", { className: "kd-tg__picker-search-icon", "aria-hidden": true, children: _jsx(IconSearch, {}) }), _jsx("input", { type: "search", className: "kd-tg__picker-search-input", placeholder: tab === 'sticker' ? 'Поиск стикеров' : tab === 'gif' ? 'Поиск GIF' : 'Поиск эмодзи', value: query, onChange: (e) => setQuery(e.target.value), "aria-label": "\u041F\u043E\u0438\u0441\u043A" })] }) }), _jsx("div", { className: "kd-tg__picker-body", role: "tabpanel", children: _jsxs("div", { className: "kd-tg__picker-scroll", ref: scrollRef, children: [tab === 'emoji' ? (filteredEmojiGroups.length === 0
                            ? _jsx("p", { className: "kd-tg__picker-empty", children: "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E" })
                            : filteredEmojiGroups.map((group, i) => (_jsxs("section", { className: "kd-tg__picker-section", ref: (node) => { emojiSectionRefs.current[i] = node; }, children: [_jsx("div", { className: "kd-tg__picker-section-head", children: _jsx("h3", { className: "kd-tg__picker-section-title", children: group.title }) }), _jsx("div", { className: "kd-tg__picker-grid kd-tg__picker-grid--emoji", children: group.items.map((emoji) => (_jsx("button", { type: "button", className: "kd-tg__picker-cell kd-tg__picker-cell--emoji", disabled: disabled, onClick: () => onPickEmoji(emoji), "aria-label": emoji, children: _jsx(TwemojiEmoji, { emoji: emoji, size: "1.375rem", className: "kd-tg__picker-emoji" }) }, `${group.title}-${emoji}`))) })] }, group.title)))) : null, tab === 'sticker' ? (filteredPackStickers ? (filteredPackStickers.length === 0
                            ? _jsx("p", { className: "kd-tg__picker-empty", children: "\u0421\u0442\u0438\u043A\u0435\u0440\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B" })
                            : (_jsx("div", { className: "kd-tg__picker-grid kd-tg__picker-grid--sticker", children: filteredPackStickers.map((s) => (_jsx("button", { type: "button", className: "kd-tg__picker-cell kd-tg__picker-cell--sticker", disabled: disabled, title: s.label, "aria-label": s.label, onClick: () => handlePickSticker(s.id), children: _jsx("span", { className: "kd-tg__picker-sticker-glyph", "aria-hidden": true, children: _jsx(TwemojiEmoji, { emoji: s.glyph, size: "2.5rem" }) }) }, s.id))) }))) : (_jsxs(_Fragment, { children: [recentStickers.length > 0 && (_jsxs("section", { className: "kd-tg__picker-section", ref: (node) => { packSectionRefs.current['recent'] = node; }, children: [_jsx("div", { className: "kd-tg__picker-section-head", children: _jsx("h3", { className: "kd-tg__picker-section-title", children: "\uD83D\uDD50 \u041D\u0435\u0434\u0430\u0432\u043D\u0438\u0435" }) }), _jsx("div", { className: "kd-tg__picker-grid kd-tg__picker-grid--sticker", children: recentStickers.map((s) => (_jsx("button", { type: "button", className: "kd-tg__picker-cell kd-tg__picker-cell--sticker", disabled: disabled, title: s.label, "aria-label": s.label, onClick: () => handlePickSticker(s.id), children: _jsx("span", { className: "kd-tg__picker-sticker-glyph", "aria-hidden": true, children: _jsx(TwemojiEmoji, { emoji: s.glyph, size: "2.5rem" }) }) }, `recent-${s.id}`))) })] })), CHAT_STICKER_PACKS.map((pack) => (_jsxs("section", { className: "kd-tg__picker-section", ref: (node) => { packSectionRefs.current[pack.id] = node; }, children: [_jsx("div", { className: "kd-tg__picker-section-head", children: _jsxs("h3", { className: "kd-tg__picker-section-title", children: [_jsx("span", { className: "kd-tg__picker-pack-icon", "aria-hidden": true, children: _jsx(TwemojiEmoji, { emoji: pack.icon, size: "1em" }) }), pack.title] }) }), _jsx("div", { className: "kd-tg__picker-grid kd-tg__picker-grid--sticker", children: pack.stickers.map((s) => (_jsx("button", { type: "button", className: "kd-tg__picker-cell kd-tg__picker-cell--sticker", disabled: disabled, title: s.label, "aria-label": s.label, onClick: () => handlePickSticker(s.id), children: _jsx("span", { className: "kd-tg__picker-sticker-glyph", "aria-hidden": true, children: _jsx(TwemojiEmoji, { emoji: s.glyph, size: "2.5rem" }) }) }, s.id))) })] }, pack.id)))] }))) : null, tab === 'gif' ? (filteredGifs.length === 0
                            ? _jsx("p", { className: "kd-tg__picker-empty", children: "GIF \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B" })
                            : (_jsxs(_Fragment, { children: [_jsx("div", { className: "kd-tg__picker-section-head", style: { padding: '0.5rem 0.75rem 0.25rem' }, children: _jsx("h3", { className: "kd-tg__picker-section-title", children: "GIF-\u0430\u043D\u0438\u043C\u0430\u0446\u0438\u0438" }) }), _jsx("div", { className: "kd-tg__picker-grid kd-tg__picker-grid--gif", children: filteredGifs.map((gif) => (_jsx("button", { type: "button", className: "kd-tg__picker-cell kd-tg__picker-cell--gif", disabled: disabled, title: gif.label, "aria-label": `GIF ${gif.label}`, onClick: () => onPickGif(gif.url), children: _jsx("img", { src: gif.url, alt: "", loading: "lazy", decoding: "async" }) }, gif.id))) })] }))) : null] }) }), _jsx("div", { className: "kd-tg__picker-footer", children: tab === 'emoji' && !query.trim() ? (_jsx("div", { className: "kd-tg__picker-cats", role: "tablist", "aria-label": "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u044D\u043C\u043E\u0434\u0437\u0438", children: EMOJI_GROUP_NAV.map((cat, index) => (_jsx("button", { type: "button", role: "tab", "aria-selected": activeEmojiGroup === index, className: `kd-tg__picker-cat${activeEmojiGroup === index ? ' kd-tg__picker-cat--on' : ''}`, title: cat.title, "aria-label": cat.title, onClick: () => scrollToEmojiSection(index), children: _jsx(TwemojiEmoji, { emoji: cat.icon, size: "1.25rem" }) }, cat.title))) })) : tab === 'sticker' && !query.trim() ? (_jsxs("div", { className: "kd-tg__picker-pack-nav", role: "tablist", "aria-label": "\u041F\u0430\u043A\u0438 \u0441\u0442\u0438\u043A\u0435\u0440\u043E\u0432", children: [recentStickers.length > 0 && (_jsx("button", { type: "button", role: "tab", "aria-selected": activePackId === 'recent', className: `kd-tg__picker-pack-tab${activePackId === 'recent' ? ' kd-tg__picker-pack-tab--on' : ''}`, title: "\u041D\u0435\u0434\u0430\u0432\u043D\u0438\u0435", "aria-label": "\u041D\u0435\u0434\u0430\u0432\u043D\u0438\u0435", onClick: () => scrollToPackSection('recent'), children: _jsx(TwemojiEmoji, { emoji: "\uD83D\uDD50", size: "1.25rem" }) })), CHAT_STICKER_PACKS.map((pack) => (_jsx("button", { type: "button", role: "tab", "aria-selected": activePackId === pack.id, className: `kd-tg__picker-pack-tab${activePackId === pack.id ? ' kd-tg__picker-pack-tab--on' : ''}`, title: pack.title, "aria-label": pack.title, onClick: () => scrollToPackSection(pack.id), children: _jsx(TwemojiEmoji, { emoji: pack.icon, size: "1.25rem" }) }, pack.id)))] })) : (_jsxs("div", { className: "kd-tg__picker-footer-tabs", role: "tablist", "aria-label": "\u0420\u0430\u0437\u0434\u0435\u043B\u044B", children: [_jsx("button", { type: "button", role: "tab", "aria-selected": tab === 'emoji', className: `kd-tg__picker-footer-tab${tab === 'emoji' ? ' kd-tg__picker-footer-tab--on' : ''}`, title: "\u042D\u043C\u043E\u0434\u0437\u0438", onClick: () => onTabChange('emoji'), children: _jsx(TwemojiEmoji, { emoji: "\uD83D\uDE0A", size: "1.25rem" }) }), _jsx("button", { type: "button", role: "tab", "aria-selected": tab === 'sticker', className: `kd-tg__picker-footer-tab${tab === 'sticker' ? ' kd-tg__picker-footer-tab--on' : ''}`, title: "\u0421\u0442\u0438\u043A\u0435\u0440\u044B", onClick: () => onTabChange('sticker'), children: _jsx(TwemojiEmoji, { emoji: "\uD83C\uDFA8", size: "1.25rem" }) }), _jsx("button", { type: "button", role: "tab", "aria-selected": tab === 'gif', className: `kd-tg__picker-footer-tab${tab === 'gif' ? ' kd-tg__picker-footer-tab--on' : ''}`, title: "GIF", onClick: () => onTabChange('gif'), children: "GIF" })] })) })] }));
}
