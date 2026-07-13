import { useRef, type ChangeEvent, type KeyboardEvent } from 'react';
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

function IconAttach() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
    );
}

function IconSend() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
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
}: KostaDailyComposerProps) {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || disabled || sending)
            return;
        onAttachFile(file);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
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

                <input
                    ref={fileInputRef}
                    type="file"
                    className="kd-tg__composer-file-input"
                    onChange={handleFileChange}
                    disabled={disabled || sending}
                    hidden
                />
                <button
                    type="button"
                    className="kd-tg__composer-btn"
                    title="Прикрепить файл"
                    aria-label="Прикрепить файл"
                    disabled={disabled || sending}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <IconPaperclip />
                </button>

                {onCreatePoll ? (
                    <button
                        type="button"
                        className="kd-tg__composer-btn"
                        title="Опрос или викторина"
                        aria-label="Опрос или викторина"
                        disabled={disabled || sending}
                        onClick={onCreatePoll}
                    >
                        <IconPoll />
                    </button>
                ) : null}

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
                    <button
                        type="button"
                        className={`kd-tg__composer-input-attach${pickerOpen && (pickerTab === 'sticker' || pickerTab === 'gif') ? ' kd-tg__composer-input-attach--active' : ''}`}
                        title="Стикеры"
                        aria-label="Стикеры"
                        disabled={disabled}
                        onClick={() => togglePicker('sticker')}
                    >
                        <IconAttach />
                    </button>
                </label>

                <button
                    type="button"
                    className="kd-tg__composer-send"
                    disabled={!canSend}
                    aria-label="Отправить"
                    onClick={onSend}
                >
                    <IconSend />
                </button>
            </div>
        </footer>
    );
}
