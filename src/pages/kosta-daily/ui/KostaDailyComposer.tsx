import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { encodeChatGif, encodeChatSticker } from '@entities/chat';
import { KostaDailyComposerPicker, type ComposerPickerTab } from './KostaDailyComposerPicker';

function IconPaperclip() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
    );
}

function IconSmile() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
    );
}

function IconSticker() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 12.5V8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h4.5" />
            <path d="M20 12.5 12.5 20c0-4.1 3.4-7.5 7.5-7.5Z" />
            <path d="M9 10h.01M15 10h.01M9 14.5c.8.7 1.8 1 3 1" />
        </svg>
    );
}

function IconFile() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
        </svg>
    );
}

const INPUT_MAX_HEIGHT = 168;

function isTouchLayout(): boolean {
    return typeof window !== 'undefined'
        && !!window.matchMedia
        && window.matchMedia('(pointer: coarse)').matches;
}

function IconSend() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
        </svg>
    );
}

function IconChecklist() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 11l2 2 4-4" />
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M8 17h8" />
        </svg>
    );
}

function IconPoll() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
        </svg>
    );
}

export type ComposerReplyPreview = {
    authorName: string;
    preview: string;
};

export type KostaDailyComposerProps = {
    draft: string;
    onDraftChange: (value: string) => void;
    onSend: () => void;
    onSendBody: (body: string) => Promise<void>;
    onAttachFile: (file: File) => void;
    sending: boolean;
    disabled: boolean;
    sendError: string | null;
    pickerOpen: boolean;
    pickerTab: ComposerPickerTab;
    onPickerOpenChange: (open: boolean) => void;
    onPickerTabChange: (tab: ComposerPickerTab) => void;
    replyTo?: ComposerReplyPreview | null;
    onCancelReply?: () => void;
    onCreatePoll?: () => void;
    onCreateChecklist?: () => void;
};

export function KostaDailyComposer({
    draft,
    onDraftChange,
    onSend,
    onSendBody,
    onAttachFile,
    sending,
    disabled,
    sendError,
    pickerOpen,
    pickerTab,
    onPickerOpenChange,
    onPickerTabChange,
    replyTo,
    onCancelReply,
    onCreatePoll,
    onCreateChecklist,
}: KostaDailyComposerProps) {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const attachRef = useRef<HTMLDivElement>(null);
    const [attachMenuOpen, setAttachMenuOpen] = useState(false);
    const hasAttachMenu = Boolean(onCreatePoll || onCreateChecklist);

    useLayoutEffect(() => {
        const el = inputRef.current;
        if (!el)
            return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT)}px`;
        el.style.overflowY = el.scrollHeight > INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
    }, [draft]);

    useEffect(() => {
        if (!attachMenuOpen)
            return;
        const onPointerDown = (e: PointerEvent) => {
            if (attachRef.current && !attachRef.current.contains(e.target as Node))
                setAttachMenuOpen(false);
        };
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape')
                setAttachMenuOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [attachMenuOpen]);

    const openFilePicker = () => {
        setAttachMenuOpen(false);
        fileInputRef.current?.click();
    };

    const onAttachClick = () => {
        if (!hasAttachMenu) {
            openFilePicker();
            return;
        }
        onPickerOpenChange(false);
        setAttachMenuOpen((v) => !v);
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || disabled || sending)
            return;
        onAttachFile(file);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isTouchLayout()) {
            e.preventDefault();
            onSend();
        }
    };

    const insertEmoji = (emoji: string) => {
        onDraftChange(draft + emoji);
        inputRef.current?.focus();
    };

    const sendSticker = (stickerId: string) => {
        if (disabled || sending)
            return;
        void onSendBody(encodeChatSticker(stickerId));
    };

    const sendGif = (url: string) => {
        if (disabled || sending)
            return;
        void onSendBody(encodeChatGif(url));
    };

    const togglePicker = (tab: ComposerPickerTab) => {
        if (disabled)
            return;
        if (pickerOpen && pickerTab === tab) {
            onPickerOpenChange(false);
            return;
        }
        onPickerTabChange(tab);
        onPickerOpenChange(true);
    };

    const canSend = !disabled && !sending && draft.trim().length > 0;

    return (
        <footer className="kd-tg__composer">
            <KostaDailyComposerPicker
                open={pickerOpen}
                tab={pickerTab}
                onTabChange={onPickerTabChange}
                onPickEmoji={insertEmoji}
                onPickSticker={sendSticker}
                onPickGif={sendGif}
                disabled={disabled || sending}
            />

            {sendError ? (
                <p className="kd-tg__composer-error" role="alert">{sendError}</p>
            ) : null}

            {replyTo ? (
                <div className="kd-tg__composer-preview" role="status">
                    <span className="kd-tg__composer-preview-badge">Ответ</span>
                    <span className="kd-tg__composer-preview-body">
                        <strong className="kd-tg__composer-preview-author">{replyTo.authorName}</strong>
                        <span className="kd-tg__composer-preview-text">{replyTo.preview}</span>
                    </span>
                    {onCancelReply ? (
                        <button
                            type="button"
                            className="kd-tg__composer-preview-close"
                            aria-label="Отменить ответ"
                            title="Отменить"
                            onClick={onCancelReply}
                        >
                            ×
                        </button>
                    ) : null}
                </div>
            ) : null}

            <div className="kd-tg__composer-bar">
                <div className="kd-tg__composer-field">
                    <button
                        type="button"
                        className={`kd-tg__composer-btn${pickerOpen && pickerTab === 'emoji' ? ' kd-tg__composer-btn--active' : ''}`}
                        title="Смайлики"
                        aria-label="Смайлики"
                        aria-expanded={pickerOpen && pickerTab === 'emoji'}
                        disabled={disabled}
                        onClick={() => togglePicker('emoji')}
                    >
                        <IconSmile />
                    </button>

                    <label className="kd-tg__composer-input-wrap">
                        <span className="visually-hidden">Сообщение</span>
                        <textarea
                            ref={inputRef}
                            className="kd-tg__composer-input"
                            rows={1}
                            placeholder="Сообщение"
                            value={draft}
                            onChange={(e) => onDraftChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={disabled || sending}
                        />
                    </label>

                    <button
                        type="button"
                        className={`kd-tg__composer-btn${pickerOpen && (pickerTab === 'sticker' || pickerTab === 'gif') ? ' kd-tg__composer-btn--active' : ''}`}
                        title="Стикеры и GIF"
                        aria-label="Стикеры и GIF"
                        disabled={disabled}
                        onClick={() => togglePicker('sticker')}
                    >
                        <IconSticker />
                    </button>

                    <input
                        ref={fileInputRef}
                        type="file"
                        className="kd-tg__composer-file-input"
                        onChange={handleFileChange}
                        disabled={disabled || sending}
                        hidden
                    />
                    <div className="kd-tg__attach" ref={attachRef}>
                        <button
                            type="button"
                            className={`kd-tg__composer-btn${attachMenuOpen ? ' kd-tg__composer-btn--active' : ''}`}
                            title="Прикрепить"
                            aria-label="Прикрепить"
                            aria-haspopup={hasAttachMenu ? 'menu' : undefined}
                            aria-expanded={hasAttachMenu ? attachMenuOpen : undefined}
                            disabled={disabled || sending}
                            onClick={onAttachClick}
                        >
                            <IconPaperclip />
                        </button>
                        {attachMenuOpen ? (
                            <div className="kd-tg__attach-menu" role="menu">
                                <button type="button" role="menuitem" className="kd-tg__attach-item" onClick={openFilePicker}>
                                    <span className="kd-tg__attach-icon kd-tg__attach-icon--file"><IconFile /></span>
                                    Файл или фото
                                </button>
                                {onCreatePoll ? (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        className="kd-tg__attach-item"
                                        onClick={() => {
                                            setAttachMenuOpen(false);
                                            onCreatePoll();
                                        }}
                                    >
                                        <span className="kd-tg__attach-icon kd-tg__attach-icon--poll"><IconPoll /></span>
                                        Опрос
                                    </button>
                                ) : null}
                                {onCreateChecklist ? (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        className="kd-tg__attach-item"
                                        onClick={() => {
                                            setAttachMenuOpen(false);
                                            onCreateChecklist();
                                        }}
                                    >
                                        <span className="kd-tg__attach-icon kd-tg__attach-icon--checklist"><IconChecklist /></span>
                                        Чеклист
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>

                <button
                    type="button"
                    className={`kd-tg__composer-send${canSend ? ' kd-tg__composer-send--ready' : ''}`}
                    disabled={!canSend}
                    aria-label="Отправить"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={onSend}
                >
                    <IconSend />
                </button>
            </div>
        </footer>
    );
}
