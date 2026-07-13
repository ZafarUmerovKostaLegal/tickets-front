import { useEffect, useMemo, useRef, useState } from 'react';
import {
    CHAT_EMOJI_GROUPS,
    CHAT_EMOJI_KEYWORDS,
    CHAT_GIFS,
    CHAT_STICKER_PACKS,
    CHAT_STICKERS,
    getRecentStickerIds,
    pushRecentSticker,
    stickerById,
} from '@entities/chat';
import { TwemojiEmoji } from '@shared/ui';

export type ComposerPickerTab = 'emoji' | 'sticker' | 'gif';

export type KostaDailyComposerPickerProps = {
    open: boolean;
    tab: ComposerPickerTab;
    onTabChange: (tab: ComposerPickerTab) => void;
    onPickEmoji: (emoji: string) => void;
    onPickSticker: (stickerId: string) => void;
    onPickGif: (url: string) => void;
    disabled?: boolean;
};

const EMOJI_GROUP_NAV: { icon: string; title: string }[] = [
    { icon: '⭐', title: 'Частые' },
    { icon: '😀', title: 'Эмоции' },
    { icon: '💼', title: 'Офис' },
    { icon: '👋', title: 'Жесты' },
];

function IconSearch() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
        </svg>
    );
}

function emojiMatchesQuery(emoji: string, groupTitle: string, qLower: string): boolean {
    if (emoji.includes(qLower) || groupTitle.toLowerCase().includes(qLower))
        return true;
    const keywords = CHAT_EMOJI_KEYWORDS[emoji];
    return Boolean(keywords?.toLowerCase().includes(qLower));
}

function filterEmojiGroups(query: string) {
    const q = query.trim();
    if (!q) return CHAT_EMOJI_GROUPS;
    const qLower = q.toLowerCase();
    return CHAT_EMOJI_GROUPS
        .map((group) => ({
            ...group,
            items: group.items.filter((emoji) => emojiMatchesQuery(emoji, group.title, qLower)),
        }))
        .filter((group) => group.items.length > 0);
}

export function KostaDailyComposerPicker({
    open,
    tab,
    onTabChange,
    onPickEmoji,
    onPickSticker,
    onPickGif,
    disabled,
}: KostaDailyComposerPickerProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const packSectionRefs = useRef<Record<string, HTMLElement | null>>({});
    const emojiSectionRefs = useRef<(HTMLElement | null)[]>([]);
    const [query, setQuery] = useState('');
    const [activePackId, setActivePackId] = useState<string>('recent');
    const [activeEmojiGroup, setActiveEmojiGroup] = useState(0);
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        setQuery('');
        setActiveEmojiGroup(0);
    }, [tab, open]);

    useEffect(() => {
        if (open && tab === 'sticker') forceUpdate((n) => n + 1);
    }, [open, tab]);

    const filteredEmojiGroups = useMemo(() => filterEmojiGroups(query), [query]);

    const filteredGifs = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return CHAT_GIFS;
        return CHAT_GIFS.filter((g) => g.label.toLowerCase().includes(q) || g.id.toLowerCase().includes(q));
    }, [query]);

    const recentIds = useMemo(() => getRecentStickerIds(), []);
    const recentStickers = useMemo(
        () => recentIds.map((id) => stickerById(id)).filter(Boolean) as NonNullable<ReturnType<typeof stickerById>>[],
        [recentIds],
    );

    const filteredPackStickers = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return null;
        return CHAT_STICKERS.filter((s) =>
            s.label.toLowerCase().includes(q) || s.glyph.includes(q) || s.id.includes(q));
    }, [query]);

    const handlePickSticker = (stickerId: string) => {
        pushRecentSticker(stickerId);
        forceUpdate((n) => n + 1);
        onPickSticker(stickerId);
    };

    const scrollToPackSection = (packId: string) => {
        setActivePackId(packId);
        const el = packSectionRefs.current[packId];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const scrollToEmojiSection = (index: number) => {
        setActiveEmojiGroup(index);
        const el = emojiSectionRefs.current[index];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (!open) return null;

    return (
        <div className="kd-tg__picker" role="dialog" aria-label="Выбор эмодзи, стикеров и GIF">

            {}
            <div className="kd-tg__picker-toolbar">
                <label className="kd-tg__picker-search">
                    <span className="kd-tg__picker-search-icon" aria-hidden><IconSearch /></span>
                    <input
                        type="search"
                        className="kd-tg__picker-search-input"
                        placeholder={tab === 'sticker' ? 'Поиск стикеров' : tab === 'gif' ? 'Поиск GIF' : 'Поиск эмодзи'}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Поиск"
                    />
                </label>
            </div>

            {}
            <div className="kd-tg__picker-body" role="tabpanel">
                <div className="kd-tg__picker-scroll" ref={scrollRef}>

                    {}
                    {tab === 'emoji' ? (
                        filteredEmojiGroups.length === 0
                            ? <p className="kd-tg__picker-empty">Ничего не найдено</p>
                            : filteredEmojiGroups.map((group, i) => (
                                <section key={group.title} className="kd-tg__picker-section"
                                    ref={(node) => { emojiSectionRefs.current[i] = node; }}>
                                    <div className="kd-tg__picker-section-head">
                                        <h3 className="kd-tg__picker-section-title">{group.title}</h3>
                                    </div>
                                    <div className="kd-tg__picker-grid kd-tg__picker-grid--emoji">
                                        {group.items.map((emoji) => (
                                            <button key={`${group.title}-${emoji}`} type="button"
                                                className="kd-tg__picker-cell kd-tg__picker-cell--emoji"
                                                disabled={disabled} onClick={() => onPickEmoji(emoji)} aria-label={emoji}>
                                                <TwemojiEmoji emoji={emoji} size="1.375rem" className="kd-tg__picker-emoji" />
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            ))
                    ) : null}

                    {}
                    {tab === 'sticker' ? (
                        filteredPackStickers ? (

                            filteredPackStickers.length === 0
                                ? <p className="kd-tg__picker-empty">Стикеры не найдены</p>
                                : (
                                    <div className="kd-tg__picker-grid kd-tg__picker-grid--sticker">
                                        {filteredPackStickers.map((s) => (
                                            <button key={s.id} type="button"
                                                className="kd-tg__picker-cell kd-tg__picker-cell--sticker"
                                                disabled={disabled} title={s.label} aria-label={s.label}
                                                onClick={() => handlePickSticker(s.id)}>
                                                <span className="kd-tg__picker-sticker-glyph" aria-hidden>
                                                    <TwemojiEmoji emoji={s.glyph} size="2.5rem" />
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )
                        ) : (

                            <>
                                {}
                                {recentStickers.length > 0 && (
                                    <section className="kd-tg__picker-section"
                                        ref={(node) => { packSectionRefs.current['recent'] = node; }}>
                                        <div className="kd-tg__picker-section-head">
                                            <h3 className="kd-tg__picker-section-title">🕐 Недавние</h3>
                                        </div>
                                        <div className="kd-tg__picker-grid kd-tg__picker-grid--sticker">
                                            {recentStickers.map((s) => (
                                                <button key={`recent-${s.id}`} type="button"
                                                    className="kd-tg__picker-cell kd-tg__picker-cell--sticker"
                                                    disabled={disabled} title={s.label} aria-label={s.label}
                                                    onClick={() => handlePickSticker(s.id)}>
                                                    <span className="kd-tg__picker-sticker-glyph" aria-hidden>
                                                        <TwemojiEmoji emoji={s.glyph} size="2.5rem" />
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                )}
                                {}
                                {CHAT_STICKER_PACKS.map((pack) => (
                                    <section key={pack.id} className="kd-tg__picker-section"
                                        ref={(node) => { packSectionRefs.current[pack.id] = node; }}>
                                        <div className="kd-tg__picker-section-head">
                                            <h3 className="kd-tg__picker-section-title">
                                                <span className="kd-tg__picker-pack-icon" aria-hidden>
                                                    <TwemojiEmoji emoji={pack.icon} size="1em" />
                                                </span>
                                                {pack.title}
                                            </h3>
                                        </div>
                                        <div className="kd-tg__picker-grid kd-tg__picker-grid--sticker">
                                            {pack.stickers.map((s) => (
                                                <button key={s.id} type="button"
                                                    className="kd-tg__picker-cell kd-tg__picker-cell--sticker"
                                                    disabled={disabled} title={s.label} aria-label={s.label}
                                                    onClick={() => handlePickSticker(s.id)}>
                                                    <span className="kd-tg__picker-sticker-glyph" aria-hidden>
                                                        <TwemojiEmoji emoji={s.glyph} size="2.5rem" />
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </>
                        )
                    ) : null}

                    {}
                    {tab === 'gif' ? (
                        filteredGifs.length === 0
                            ? <p className="kd-tg__picker-empty">GIF не найдены</p>
                            : (
                                <>
                                    <div className="kd-tg__picker-section-head" style={{ padding: '0.5rem 0.75rem 0.25rem' }}>
                                        <h3 className="kd-tg__picker-section-title">GIF-анимации</h3>
                                    </div>
                                    <div className="kd-tg__picker-grid kd-tg__picker-grid--gif">
                                        {filteredGifs.map((gif) => (
                                            <button key={gif.id} type="button"
                                                className="kd-tg__picker-cell kd-tg__picker-cell--gif"
                                                disabled={disabled} title={gif.label} aria-label={`GIF ${gif.label}`}
                                                onClick={() => onPickGif(gif.url)}>
                                                <img src={gif.url} alt="" loading="lazy" decoding="async" />
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )
                    ) : null}
                </div>
            </div>

            {}
            <div className="kd-tg__picker-footer">
                {tab === 'emoji' && !query.trim() ? (

                    <div className="kd-tg__picker-cats" role="tablist" aria-label="Категории эмодзи">
                        {EMOJI_GROUP_NAV.map((cat, index) => (
                            <button key={cat.title} type="button" role="tab"
                                aria-selected={activeEmojiGroup === index}
                                className={`kd-tg__picker-cat${activeEmojiGroup === index ? ' kd-tg__picker-cat--on' : ''}`}
                                title={cat.title} aria-label={cat.title}
                                onClick={() => scrollToEmojiSection(index)}>
                                <TwemojiEmoji emoji={cat.icon} size="1.25rem" />
                            </button>
                        ))}
                    </div>
                ) : tab === 'sticker' && !query.trim() ? (

                    <div className="kd-tg__picker-pack-nav" role="tablist" aria-label="Паки стикеров">
                        {recentStickers.length > 0 && (
                            <button type="button" role="tab"
                                aria-selected={activePackId === 'recent'}
                                className={`kd-tg__picker-pack-tab${activePackId === 'recent' ? ' kd-tg__picker-pack-tab--on' : ''}`}
                                title="Недавние" aria-label="Недавние"
                                onClick={() => scrollToPackSection('recent')}>
                                <TwemojiEmoji emoji="🕐" size="1.25rem" />
                            </button>
                        )}
                        {CHAT_STICKER_PACKS.map((pack) => (
                            <button key={pack.id} type="button" role="tab"
                                aria-selected={activePackId === pack.id}
                                className={`kd-tg__picker-pack-tab${activePackId === pack.id ? ' kd-tg__picker-pack-tab--on' : ''}`}
                                title={pack.title} aria-label={pack.title}
                                onClick={() => scrollToPackSection(pack.id)}>
                                <TwemojiEmoji emoji={pack.icon} size="1.25rem" />
                            </button>
                        ))}
                    </div>
                ) : (

                    <div className="kd-tg__picker-footer-tabs" role="tablist" aria-label="Разделы">
                        <button type="button" role="tab" aria-selected={tab === 'emoji'}
                            className={`kd-tg__picker-footer-tab${tab === 'emoji' ? ' kd-tg__picker-footer-tab--on' : ''}`}
                            title="Эмодзи" onClick={() => onTabChange('emoji')}>
                            <TwemojiEmoji emoji="😊" size="1.25rem" />
                        </button>
                        <button type="button" role="tab" aria-selected={tab === 'sticker'}
                            className={`kd-tg__picker-footer-tab${tab === 'sticker' ? ' kd-tg__picker-footer-tab--on' : ''}`}
                            title="Стикеры" onClick={() => onTabChange('sticker')}>
                            <TwemojiEmoji emoji="🎨" size="1.25rem" />
                        </button>
                        <button type="button" role="tab" aria-selected={tab === 'gif'}
                            className={`kd-tg__picker-footer-tab${tab === 'gif' ? ' kd-tg__picker-footer-tab--on' : ''}`}
                            title="GIF" onClick={() => onTabChange('gif')}>GIF</button>
                    </div>
                )}
            </div>
        </div>
    );
}
