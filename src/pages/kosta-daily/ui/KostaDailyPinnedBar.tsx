import { useEffect, useState } from 'react';
import type { ChatPinnedMessage } from '@entities/chat';

export type KostaDailyPinnedBarProps = {
    pins: ChatPinnedMessage[];
    canUnpin: boolean;
    onOpen: (messageId: number) => void;
    onUnpin: (messageId: number) => void;
};

export function KostaDailyPinnedBar({ pins, canUnpin, onOpen, onUnpin }: KostaDailyPinnedBarProps) {
    const [index, setIndex] = useState(0);
    const pinKey = pins.map((pin) => pin.message_id).join(',');

    useEffect(() => {
        setIndex(0);
    }, [pinKey]);

    if (pins.length === 0)
        return null;

    const current = pins[Math.min(index, pins.length - 1)] ?? pins[0];
    if (!current)
        return null;

    return (
        <div className="kd-tg__pinbar">
            <button
                type="button"
                className="kd-tg__pinbar-main"
                onClick={() => {
                    onOpen(current.message_id);
                    if (pins.length > 1)
                        setIndex((value) => (value + 1) % pins.length);
                }}
            >
                <span className="kd-tg__pinbar-rails" aria-hidden>
                    {pins.map((pin, pinIndex) => (
                        <span
                            key={pin.message_id}
                            className={`kd-tg__pinbar-rail${pinIndex === Math.min(index, pins.length - 1) ? ' kd-tg__pinbar-rail--on' : ''}`}
                        />
                    ))}
                </span>
                <span className="kd-tg__pinbar-copy">
                    <span className="kd-tg__pinbar-label">
                        Закреплённое сообщение
                        {pins.length > 1 ? ` · ${Math.min(index, pins.length - 1) + 1} из ${pins.length}` : ''}
                    </span>
                    <span className="kd-tg__pinbar-preview">{current.preview || 'Сообщение'}</span>
                </span>
            </button>
            {canUnpin ? (
                <button
                    type="button"
                    className="kd-tg__pinbar-unpin"
                    aria-label="Открепить сообщение"
                    title="Открепить"
                    onClick={() => onUnpin(current.message_id)}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
            ) : null}
        </div>
    );
}
