import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { BirthdayGreetingPayload } from '../lib/birthdayGreetingStorage';
import { playBirthdayFanfare } from '../lib/playBirthdayFanfare';
import './BirthdayPostcard.css';

type Props = {
    greeting: BirthdayGreetingPayload;
    onClose: () => void;
};

type Stage = 'envelope' | 'card' | 'open';

const FIREWORK_ORIGINS = [
    { left: '18%', top: '22%' },
    { left: '78%', top: '18%' },
    { left: '50%', top: '12%' },
    { left: '28%', top: '48%' },
    { left: '72%', top: '42%' },
    { left: '50%', top: '58%' },
] as const;

const SPARK_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

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
    const [fireworks, setFireworks] = useState(false);
    const fireworkKey = useMemo(() => (fireworks ? String(Date.now()) : '0'), [fireworks]);

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
        window.setTimeout(() => {
            setCoverOpen(true);
            setFireworks(true);
        }, 1580);
        window.setTimeout(() => {
            setReveal(true);
            setStage('open');
        }, 2480);
        window.setTimeout(() => setFireworks(false), 4200);
    }, [stage]);

    const replay = useCallback(() => {
        setNoAnim(true);
        setStage('envelope');
        setSealCrack(false);
        setFlapOpen(false);
        setCoverOpen(false);
        setReveal(false);
        setBurst(false);
        setFireworks(false);
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

    const isFirm = greeting.kind === 'firm';
    const name = isFirm ? 'Kosta Legal' : politeGreetingName(greeting.recipientName);
    const toLine = greeting.insideTitle
        || (/^[A-Za-z]/.test(name) ? `Dear ${name}` : `Дорогой(ая) ${name}`);
    const paragraphs = greeting.paragraphs?.filter(Boolean)
        ?? greeting.message.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const coverTitle = greeting.coverTitle || 'С Днём Рождения';
    const coverBadge = greeting.coverBadge || 'открытка';
    const insideEyebrow = greeting.insideEyebrow || (isFirm ? 'День рождения фирмы' : 'С днём рождения');
    const envelopeTo = isFirm ? 'Для команды' : 'Для';
    const envelopeName = isFirm ? 'партнёров и коллег' : name;
    const eyebrow = isFirm ? 'День рождения фирмы' : 'Поздравление от команды';
    const hint = isFirm ? 'нажмите на печать, чтобы открыть поздравление' : 'нажмите на печать, чтобы открыть';
    const fromLabel = greeting.senderName || (isFirm ? 'вся команда Kosta Legal' : 'команда Kosta Legal');

    return createPortal(
        <div
            className={[
                'bday-pc',
                isFirm ? 'bday-pc--firm' : '',
                noAnim ? 'bday-pc--no-anim' : '',
                burst ? 'bday-pc--burst' : '',
                stage === 'open' ? 'bday-pc--open' : '',
                coverOpen ? 'bday-pc--cover-open' : '',
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
                    {Array.from({ length: 42 }, (_, i) => (
                        <span
                            key={i}
                            className={`bday-pc__piece bday-pc__piece--${i % 6}`}
                            style={{
                                left: `${4 + (i * 2.35) % 92}%`,
                                animationDelay: `${(i % 12) * 0.05}s`,
                                animationDuration: `${2.4 + (i % 5) * 0.25}s`,
                            }}
                        />
                    ))}
                </div>
            ) : null}

            {fireworks ? (
                <div className="bday-pc__fireworks" key={fireworkKey} aria-hidden>
                    {FIREWORK_ORIGINS.map((origin, oi) => (
                        <div
                            key={oi}
                            className={`bday-pc__fw-burst bday-pc__fw-burst--${oi % 3}`}
                            style={{
                                left: origin.left,
                                top: origin.top,
                                animationDelay: `${oi * 0.18}s`,
                            }}
                        >
                            <span className="bday-pc__fw-flash" />
                            {SPARK_ANGLES.map((angle, si) => (
                                <span
                                    key={si}
                                    className={`bday-pc__fw-spark bday-pc__fw-spark--${(oi + si) % 5}`}
                                    style={{
                                        ['--fw-angle' as string]: `${angle}deg`,
                                        ['--fw-dist' as string]: `${58 + (si % 4) * 14}px`,
                                        animationDelay: `${oi * 0.18 + (si % 3) * 0.03}s`,
                                    }}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            ) : null}

            <div className="bday-pc__frame">
                <p className={`bday-pc__eyebrow${stage !== 'envelope' ? ' bday-pc__eyebrow--fade' : ''}`}>
                    {eyebrow}
                </p>

                <div className="bday-pc__theater">
                    <div className={`bday-pc__env-scene${stage !== 'envelope' ? ' bday-pc__env-scene--hide' : ''}`}>
                        <div className="bday-pc__env-wrap">
                            <div className={`bday-pc__envelope${flapOpen ? ' bday-pc__envelope--open' : ''}`}>
                                <div className="bday-pc__env-shadow" aria-hidden />
                                <div className="bday-pc__letter-peek" aria-hidden />
                                <div className="bday-pc__env-body" aria-hidden>
                                    <div className="bday-pc__env-liner" />
                                    <div className="bday-pc__env-address">
                                        <span className="bday-pc__env-to">{envelopeTo}</span>
                                        <span className="bday-pc__env-name">{envelopeName}</span>
                                    </div>
                                    <img
                                        className="bday-pc__env-logo"
                                        src="/logo.svg"
                                        alt=""
                                        width={28}
                                        height={40}
                                        draggable={false}
                                    />
                                </div>
                                <div className={`bday-pc__env-flap${flapOpen ? ' bday-pc__env-flap--open' : ''}`} aria-hidden>
                                    <span className="bday-pc__env-flap-edge" />
                                </div>
                                <button
                                    type="button"
                                    className={`bday-pc__seal${sealCrack ? ' bday-pc__seal--crack' : ''}`}
                                    aria-label="Открыть открытку"
                                    onClick={openCard}
                                    onKeyDown={onSealKey}
                                >
                                    <img
                                        className="bday-pc__seal-logo"
                                        src="/logo.svg"
                                        alt=""
                                        width={26}
                                        height={38}
                                        draggable={false}
                                    />
                                    <span className="bday-pc__seal-ring" aria-hidden />
                                </button>
                            </div>
                            <p className={`bday-pc__hint${stage !== 'envelope' ? ' bday-pc__hint--fade' : ''}`}>
                                {hint}
                            </p>
                        </div>
                    </div>

                    <div className={`bday-pc__card-scene${stage !== 'envelope' ? ' bday-pc__card-scene--show' : ''}`}>
                        <div className="bday-pc__card">
                            <div className={`bday-pc__card-back${reveal ? ' bday-pc__card-back--reveal' : ''}`}>
                                <div className="bday-pc__card-shine" aria-hidden />
                                <p className="bday-pc__inside-eyebrow">{insideEyebrow}</p>
                                <h1 id="bday-pc-title" className="bday-pc__to-name">{toLine}</h1>
                                <div className="bday-pc__divider" aria-hidden>
                                    <span />
                                    <i />
                                    <span />
                                </div>
                                <div className="bday-pc__letter">
                                    {paragraphs.map((paragraph, index) => (
                                        <p key={index} className="bday-pc__message">{paragraph}</p>
                                    ))}
                                </div>
                                {isFirm ? null : (
                                    <div className="bday-pc__from-wrap">
                                        — <span className="bday-pc__from-name">{fromLabel}</span>
                                    </div>
                                )}
                            </div>

                            <div className={`bday-pc__cover${coverOpen ? ' bday-pc__cover--open' : ''}`}>
                                <div className="bday-pc__cover-face bday-pc__cover-face--front">
                                    <div className="bday-pc__cover-pattern" aria-hidden />
                                    <p className="bday-pc__cover-sub">Kosta Legal</p>
                                    <h2 className="bday-pc__cover-title">{coverTitle}</h2>
                                    <svg className="bday-pc__flourish" viewBox="0 0 90 18" aria-hidden>
                                        <path d="M2 9 C 20 -2, 30 20, 45 9 C 60 -2, 70 20, 88 9" />
                                    </svg>
                                    <p className="bday-pc__cover-badge">{coverBadge}</p>
                                </div>
                                <div className="bday-pc__cover-face bday-pc__cover-face--inside" aria-hidden>
                                    <div className="bday-pc__cover-inside-deco" />
                                    <span className="bday-pc__cover-inside-mark">KL</span>
                                </div>
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
