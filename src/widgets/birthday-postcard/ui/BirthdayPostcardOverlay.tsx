import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { BirthdayGreetingPayload } from '../lib/birthdayGreetingStorage';
import { playBirthdayFanfare } from '../lib/playBirthdayFanfare';
import './BirthdayPostcard.css';

type Props = {
    greeting: BirthdayGreetingPayload;
    onClose: () => void;
};

type Stage = 'envelope' | 'card' | 'open';

function politeGreetingName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return 'коллега';
    const first = parts[0]!;
    if (/^[A-Za-z]/.test(first))
        return first;
    return first;
}

export function BirthdayPostcardOverlay({ greeting, onClose }: Props) {
    const [stage, setStage] = useState<Stage>('envelope');
    const [flapOpen, setFlapOpen] = useState(false);
    const [sealCrack, setSealCrack] = useState(false);
    const [coverOpen, setCoverOpen] = useState(false);
    const [reveal, setReveal] = useState(false);
    const [noAnim, setNoAnim] = useState(false);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener('keydown', onKey, true);
        };
    }, [onClose]);

    const openCard = useCallback(() => {
        if (stage !== 'envelope')
            return;
        setSealCrack(true);
        window.setTimeout(() => setFlapOpen(true), 300);
        window.setTimeout(() => {
            setStage('card');
            playBirthdayFanfare();
        }, 1050);
        window.setTimeout(() => setCoverOpen(true), 1650);
        window.setTimeout(() => {
            setReveal(true);
            setStage('open');
        }, 2500);
    }, [stage]);

    const replay = useCallback(() => {
        setNoAnim(true);
        setStage('envelope');
        setSealCrack(false);
        setFlapOpen(false);
        setCoverOpen(false);
        setReveal(false);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => setNoAnim(false));
        });
    }, []);

    const onSealKey = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openCard();
        }
    };

    const name = politeGreetingName(greeting.recipientName);
    const toLine = /^[A-Za-z]/.test(name) ? `Dear ${name}` : `Дорогой(ая) ${name}`;

    return createPortal(
        <div className={`bday-pc${noAnim ? ' bday-pc--no-anim' : ''}`} role="dialog" aria-modal="true" aria-labelledby="bday-pc-title">
            <div className="bday-pc__frame">
                <p className={`bday-pc__eyebrow${stage !== 'envelope' ? ' bday-pc__eyebrow--fade' : ''}`}>
                    Поздравление от команды
                </p>

                <div className="bday-pc__theater">
                    <div className={`bday-pc__env-scene${stage !== 'envelope' ? ' bday-pc__env-scene--hide' : ''}`}>
                        <div>
                            <div className="bday-pc__envelope">
                                <div className="bday-pc__env-shadow" aria-hidden />
                                <div className="bday-pc__env-body" aria-hidden />
                                <div className={`bday-pc__env-flap${flapOpen ? ' bday-pc__env-flap--open' : ''}`} aria-hidden />
                                <button
                                    type="button"
                                    className={`bday-pc__seal${sealCrack ? ' bday-pc__seal--crack' : ''}`}
                                    aria-label="Открыть открытку"
                                    onClick={openCard}
                                    onKeyDown={onSealKey}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                                        <path
                                            d="M12 3c1.2 2 1.2 4-0.3 5.4C13.6 9 15 10.8 15 12.8c0 2.6-2 4.2-3 5.2 -1-1-3-2.6-3-5.2 0-2 1.4-3.8 3.3-4.4C10.8 7 10.8 5 12 3Z"
                                            stroke="#E9D9B8"
                                            strokeWidth="0.9"
                                            fill="rgba(233,217,184,0.15)"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </button>
                            </div>
                            <p className={`bday-pc__hint${stage !== 'envelope' ? ' bday-pc__hint--fade' : ''}`}>
                                нажмите на печать, чтобы открыть
                            </p>
                        </div>
                    </div>

                    <div className={`bday-pc__card-scene${stage !== 'envelope' ? ' bday-pc__card-scene--show' : ''}`}>
                        <div className="bday-pc__card">
                            <div className={`bday-pc__card-back${reveal ? ' bday-pc__card-back--reveal' : ''}`}>
                                <p className="bday-pc__inside-eyebrow">С днём рождения</p>
                                <h1 id="bday-pc-title" className="bday-pc__to-name">{toLine}</h1>
                                <p className="bday-pc__message">{greeting.message}</p>
                                <div className="bday-pc__from-wrap">
                                    — <span className="bday-pc__from-name">{greeting.senderName || 'команда Kosta Legal'}</span>
                                </div>
                            </div>

                            <div className={`bday-pc__cover${coverOpen ? ' bday-pc__cover--open' : ''}`}>
                                <p className="bday-pc__cover-sub">Kosta Legal</p>
                                <h2 className="bday-pc__cover-title">С Днём Рождения</h2>
                                <svg className="bday-pc__flourish" viewBox="0 0 90 18" aria-hidden>
                                    <path d="M2 9 C 20 -2, 30 20, 45 9 C 60 -2, 70 20, 88 9" />
                                </svg>
                            </div>

                            <span className="bday-pc__sparkle" style={{ left: '14%', top: '70%', animationDelay: '0s' }} aria-hidden />
                            <span className="bday-pc__sparkle" style={{ left: '80%', top: '60%', animationDelay: '1.1s' }} aria-hidden />
                            <span className="bday-pc__sparkle" style={{ left: '40%', top: '85%', animationDelay: '2.1s' }} aria-hidden />
                            <span className="bday-pc__sparkle" style={{ left: '65%', top: '78%', animationDelay: '0.6s' }} aria-hidden />
                        </div>
                    </div>
                </div>

                <div className="bday-pc__actions">
                    {reveal ? (
                        <>
                            <button type="button" className="bday-pc__replay" onClick={replay}>
                                открыть заново
                            </button>
                            <button type="button" className="bday-pc__done" onClick={onClose}>
                                Спасибо
                            </button>
                        </>
                    ) : null}
                </div>
            </div>
        </div>,
        document.body,
    );
}
