import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { BirthdayGreetingPayload } from '../lib/birthdayGreetingStorage';
import { playBirthdayFanfare } from '../lib/playBirthdayFanfare';
import './BirthdayPostcard.css';

type Props = {
    greeting: BirthdayGreetingPayload;
    onClose: () => void;
};

export function BirthdayPostcardOverlay({ greeting, onClose }: Props) {
    useEffect(() => {
        playBirthdayFanfare();
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener('keydown', onKey, true);
        };
    }, [onClose]);

    const firstName = greeting.recipientName.split(/\s+/)[0] || greeting.recipientName;

    return createPortal(
        <div className="bday-pc" role="dialog" aria-modal="true" aria-labelledby="bday-pc-title">
            <div className="bday-pc__confetti" aria-hidden>
                {Array.from({ length: 28 }, (_, i) => (
                    <span
                        key={i}
                        className={`bday-pc__piece bday-pc__piece--${i % 6}`}
                        style={{ '--i': i } as CSSProperties}
                    />
                ))}
            </div>
            <div className="bday-pc__card">
                <div className="bday-pc__seal" aria-hidden>
                    <span>KL</span>
                </div>
                <p className="bday-pc__brand">Kosta Legal</p>
                <p className="bday-pc__eyebrow">С днём рождения</p>
                <h2 id="bday-pc-title" className="bday-pc__title">
                    {firstName}!
                </h2>
                <p className="bday-pc__message">{greeting.message}</p>
                <p className="bday-pc__from">— {greeting.senderName}</p>
                <button type="button" className="bday-pc__btn" onClick={onClose}>
                    Спасибо!
                </button>
            </div>
        </div>,
        document.body,
    );
}
