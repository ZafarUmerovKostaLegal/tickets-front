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
    return parts[0]!;
}

export function BirthdayPostcardOverlay({ greeting, onClose }: Props) {
    const [stage, setStage] = useState<Stage>('envelope');
    const [flapOpen, setFlapOpen] = useState(false);
    const [sealCrack, setSealCrack] = useState(false);
    const [coverOpen, setCoverOpen] = useState(false);
    const [reveal, setReveal] = useState(false);
    const [noAnim, setNoAnim] = useState(false);
    const [burst, setBurst] = useState(false);

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
        window.setTimeout(() => setFlapOpen(true), 280);
        window.setTimeout(() => {
            setStage('card');
            setBurst(true);
            playBirthdayFanfare();
        }, 980);
        window.setTimeout(() => setCoverOpen(true), 1580);
        window.setTimeout(() => {
            setReveal(true);
            setStage('open');
        }, 2480);
    }, [stage]);

    const replay = useCallback(() => {
        setNoAnim(true);
        setStage('envelope');
        setSealCrack(false);
        setFlapOpen(false);
        setCoverOpen(false);
        setReveal(false);
        setBurst(false);
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
        <div
            className={[
                'bday-pc',
                noAnim ? 'bday-pc--no-anim' : '',
                burst ? 'bday-pc--burst' : '',
                stage === 'open' ? 'bday-pc--open' : '',
            ].filter(Boolean).join(' ')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bday-pc-title"
        >
            <div className="bday-pc__glow" aria-hidden />
            <div className="bday-pc__orbs" aria-hidden>
                <span className="bday-pc__orb bday-pc__orb--a" />
                <span className="bday-pc__orb bday-pc__orb--b" />
                <span className="bday-pc__orb bday-pc__orb--c" />
            </div>

            {burst ? (
                <div className="bday-pc__confetti" aria-hidden>
                    {Array.from({ length: 36 }, (_, i) => (
                        <span
                            key={i}
                            className={`bday-pc__piece bday-pc__piece--${i % 6}`}
                            style={{
                                left: `${4 + (i * 2.6) % 92}%`,
                                animationDelay: `${(i % 12) * 0.05}s`,
                                animationDuration: `${2.4 + (i % 5) * 0.25}s`,
                            }}
                        />
                    ))}
                </div>
            ) : null}

            <div className="bday-pc__frame">
                <p className={`bday-pc__eyebrow${stage !== 'envelope' ? ' bday-pc__eyebrow--fade' : ''}`}>
                    Поздравление от команды
                </p>

                <div className="bday-pc__theater">
                    <div className={`bday-pc__env-scene${stage !== 'envelope' ? ' bday-pc__env-scene--hide' : ''}`}>
                        <div className="bday-pc__env-wrap">
                            <div className={`bday-pc__envelope${flapOpen ? ' bday-pc__envelope--open' : ''}`}>
                                <div className="bday-pc__env-shadow" aria-hidden />
                                <div className="bday-pc__letter-peek" aria-hidden />
                                <div className="bday-pc__env-body" aria-hidden>
                                    <span className="bday-pc__env-monogram">KL</span>
                                </div>
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
                                            stroke="currentColor"
                                            strokeWidth="0.9"
                                            fill="rgba(255,255,255,0.12)"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                    <span className="bday-pc__seal-ring" aria-hidden />
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
                                <div className="bday-pc__card-shine" aria-hidden />
                                <p className="bday-pc__inside-eyebrow">С днём рождения</p>
                                <h1 id="bday-pc-title" className="bday-pc__to-name">{toLine}</h1>
                                <div className="bday-pc__divider" aria-hidden>
                                    <span />
                                    <i />
                                    <span />
                                </div>
                                <p className="bday-pc__message">{greeting.message}</p>
                                <div className="bday-pc__from-wrap">
                                    — <span className="bday-pc__from-name">{greeting.senderName || 'команда Kosta Legal'}</span>
                                </div>
                            </div>

                            <div className={`bday-pc__cover${coverOpen ? ' bday-pc__cover--open' : ''}`}>
                                <div className="bday-pc__cover-pattern" aria-hidden />
                                <p className="bday-pc__cover-sub">Kosta Legal</p>
                                <h2 className="bday-pc__cover-title">С Днём Рождения</h2>
                                <svg className="bday-pc__flourish" viewBox="0 0 90 18" aria-hidden>
                                    <path d="M2 9 C 20 -2, 30 20, 45 9 C 60 -2, 70 20, 88 9" />
                                </svg>
                                <p className="bday-pc__cover-badge">открытка</p>
                            </div>

                            <span className="bday-pc__sparkle" style={{ left: '12%', top: '68%', animationDelay: '0s' }} aria-hidden />
                            <span className="bday-pc__sparkle" style={{ left: '82%', top: '58%', animationDelay: '0.9s' }} aria-hidden />
                            <span className="bday-pc__sparkle" style={{ left: '38%', top: '84%', animationDelay: '1.8s' }} aria-hidden />
                            <span className="bday-pc__sparkle" style={{ left: '68%', top: '76%', animationDelay: '0.45s' }} aria-hidden />
                            <span className="bday-pc__sparkle bday-pc__sparkle--lg" style={{ left: '50%', top: '30%', animationDelay: '0.2s' }} aria-hidden />
                        </div>
                    </div>
                </div>

                <div className={`bday-pc__actions${reveal ? ' bday-pc__actions--show' : ''}`}>
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
