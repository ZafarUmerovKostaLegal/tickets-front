import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { playBirthdayFanfare } from '../lib/playBirthdayFanfare';
import './BirthdayPostcard.css';
const FIREWORK_ORIGINS = [
    { left: '18%', top: '22%' },
    { left: '78%', top: '18%' },
    { left: '50%', top: '12%' },
    { left: '28%', top: '48%' },
    { left: '72%', top: '42%' },
    { left: '50%', top: '58%' },
];
const SPARK_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
function politeGreetingName(fullName) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return 'коллега';
    return parts[0];
}
export function BirthdayPostcardOverlay({ greeting, onClose }) {
    const [stage, setStage] = useState('envelope');
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
        const onKey = (e) => {
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
    const onSealKey = (e) => {
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
    return createPortal(_jsxs("div", { className: [
            'bday-pc',
            isFirm ? 'bday-pc--firm' : '',
            noAnim ? 'bday-pc--no-anim' : '',
            burst ? 'bday-pc--burst' : '',
            stage === 'open' ? 'bday-pc--open' : '',
            coverOpen ? 'bday-pc--cover-open' : '',
        ].filter(Boolean).join(' '), role: "dialog", "aria-modal": "true", "aria-labelledby": "bday-pc-title", children: [_jsx("div", { className: "bday-pc__glow", "aria-hidden": true }), _jsxs("div", { className: "bday-pc__orbs", "aria-hidden": true, children: [_jsx("span", { className: "bday-pc__orb bday-pc__orb--a" }), _jsx("span", { className: "bday-pc__orb bday-pc__orb--b" }), _jsx("span", { className: "bday-pc__orb bday-pc__orb--c" })] }), burst ? (_jsx("div", { className: "bday-pc__confetti", "aria-hidden": true, children: Array.from({ length: 42 }, (_, i) => (_jsx("span", { className: `bday-pc__piece bday-pc__piece--${i % 6}`, style: {
                        left: `${4 + (i * 2.35) % 92}%`,
                        animationDelay: `${(i % 12) * 0.05}s`,
                        animationDuration: `${2.4 + (i % 5) * 0.25}s`,
                    } }, i))) })) : null, fireworks ? (_jsx("div", { className: "bday-pc__fireworks", "aria-hidden": true, children: FIREWORK_ORIGINS.map((origin, oi) => (_jsxs("div", { className: `bday-pc__fw-burst bday-pc__fw-burst--${oi % 3}`, style: {
                        left: origin.left,
                        top: origin.top,
                        animationDelay: `${oi * 0.18}s`,
                    }, children: [_jsx("span", { className: "bday-pc__fw-flash" }), SPARK_ANGLES.map((angle, si) => (_jsx("span", { className: `bday-pc__fw-spark bday-pc__fw-spark--${(oi + si) % 5}`, style: {
                                ['--fw-angle']: `${angle}deg`,
                                ['--fw-dist']: `${58 + (si % 4) * 14}px`,
                                animationDelay: `${oi * 0.18 + (si % 3) * 0.03}s`,
                            } }, si)))] }, oi))) }, fireworkKey)) : null, _jsxs("div", { className: "bday-pc__frame", children: [_jsx("p", { className: `bday-pc__eyebrow${stage !== 'envelope' ? ' bday-pc__eyebrow--fade' : ''}`, children: eyebrow }), _jsxs("div", { className: "bday-pc__theater", children: [_jsx("div", { className: `bday-pc__env-scene${stage !== 'envelope' ? ' bday-pc__env-scene--hide' : ''}`, children: _jsxs("div", { className: "bday-pc__env-wrap", children: [_jsxs("div", { className: `bday-pc__envelope${flapOpen ? ' bday-pc__envelope--open' : ''}`, children: [_jsx("div", { className: "bday-pc__env-shadow", "aria-hidden": true }), _jsx("div", { className: "bday-pc__letter-peek", "aria-hidden": true }), _jsxs("div", { className: "bday-pc__env-body", "aria-hidden": true, children: [_jsx("div", { className: "bday-pc__env-liner" }), _jsxs("div", { className: "bday-pc__env-address", children: [_jsx("span", { className: "bday-pc__env-to", children: envelopeTo }), _jsx("span", { className: "bday-pc__env-name", children: envelopeName })] }), _jsx("img", { className: "bday-pc__env-logo", src: "/logo.svg", alt: "", width: 28, height: 40, draggable: false })] }), _jsx("div", { className: `bday-pc__env-flap${flapOpen ? ' bday-pc__env-flap--open' : ''}`, "aria-hidden": true, children: _jsx("span", { className: "bday-pc__env-flap-edge" }) }), _jsxs("button", { type: "button", className: `bday-pc__seal${sealCrack ? ' bday-pc__seal--crack' : ''}`, "aria-label": "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u043A\u0443", onClick: openCard, onKeyDown: onSealKey, children: [_jsx("img", { className: "bday-pc__seal-logo", src: "/logo.svg", alt: "", width: 26, height: 38, draggable: false }), _jsx("span", { className: "bday-pc__seal-ring", "aria-hidden": true })] })] }), _jsx("p", { className: `bday-pc__hint${stage !== 'envelope' ? ' bday-pc__hint--fade' : ''}`, children: hint })] }) }), _jsx("div", { className: `bday-pc__card-scene${stage !== 'envelope' ? ' bday-pc__card-scene--show' : ''}`, children: _jsxs("div", { className: "bday-pc__card", children: [_jsxs("div", { className: `bday-pc__card-back${reveal ? ' bday-pc__card-back--reveal' : ''}`, children: [_jsx("div", { className: "bday-pc__card-shine", "aria-hidden": true }), _jsx("p", { className: "bday-pc__inside-eyebrow", children: insideEyebrow }), _jsx("h1", { id: "bday-pc-title", className: "bday-pc__to-name", children: toLine }), _jsxs("div", { className: "bday-pc__divider", "aria-hidden": true, children: [_jsx("span", {}), _jsx("i", {}), _jsx("span", {})] }), _jsx("div", { className: "bday-pc__letter", children: paragraphs.map((paragraph, index) => (_jsx("p", { className: "bday-pc__message", children: paragraph }, index))) }), isFirm ? null : (_jsxs("div", { className: "bday-pc__from-wrap", children: ["\u2014 ", _jsx("span", { className: "bday-pc__from-name", children: fromLabel })] }))] }), _jsxs("div", { className: `bday-pc__cover${coverOpen ? ' bday-pc__cover--open' : ''}`, children: [_jsxs("div", { className: "bday-pc__cover-face bday-pc__cover-face--front", children: [_jsx("div", { className: "bday-pc__cover-pattern", "aria-hidden": true }), _jsx("p", { className: "bday-pc__cover-sub", children: "Kosta Legal" }), _jsx("h2", { className: "bday-pc__cover-title", children: coverTitle }), _jsx("svg", { className: "bday-pc__flourish", viewBox: "0 0 90 18", "aria-hidden": true, children: _jsx("path", { d: "M2 9 C 20 -2, 30 20, 45 9 C 60 -2, 70 20, 88 9" }) }), _jsx("p", { className: "bday-pc__cover-badge", children: coverBadge })] }), _jsxs("div", { className: "bday-pc__cover-face bday-pc__cover-face--inside", "aria-hidden": true, children: [_jsx("div", { className: "bday-pc__cover-inside-deco" }), _jsx("span", { className: "bday-pc__cover-inside-mark", children: "KL" })] })] }), _jsx("span", { className: "bday-pc__sparkle", style: { left: '12%', top: '68%', animationDelay: '0s' }, "aria-hidden": true }), _jsx("span", { className: "bday-pc__sparkle", style: { left: '82%', top: '58%', animationDelay: '0.9s' }, "aria-hidden": true }), _jsx("span", { className: "bday-pc__sparkle", style: { left: '38%', top: '84%', animationDelay: '1.8s' }, "aria-hidden": true }), _jsx("span", { className: "bday-pc__sparkle", style: { left: '68%', top: '76%', animationDelay: '0.45s' }, "aria-hidden": true }), _jsx("span", { className: "bday-pc__sparkle bday-pc__sparkle--lg", style: { left: '50%', top: '30%', animationDelay: '0.2s' }, "aria-hidden": true })] }) })] }), _jsx("div", { className: `bday-pc__actions${reveal ? ' bday-pc__actions--show' : ''}`, children: reveal ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "bday-pc__replay", onClick: replay, children: "\u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0437\u0430\u043D\u043E\u0432\u043E" }), _jsx("button", { type: "button", className: "bday-pc__done", onClick: onClose, children: "\u0421\u043F\u0430\u0441\u0438\u0431\u043E" })] })) : null })] })] }), document.body);
}
