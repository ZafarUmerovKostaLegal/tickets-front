import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
const FRAME_W = 345;
const FRAME_H = 300;
function coverScale(naturalW, naturalH, frameW, frameH) {
    return Math.max(frameW / naturalW, frameH / naturalH);
}
function clampOffset(zoom, naturalW, naturalH, frameW, frameH, x, y) {
    const scale = coverScale(naturalW, naturalH, frameW, frameH) * zoom;
    const maxX = Math.max(0, (naturalW * scale - frameW) / 2);
    const maxY = Math.max(0, (naturalH * scale - frameH) / 2);
    return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
    };
}
function exportCroppedPhoto(image, crop, frameW, frameH) {
    const scale = coverScale(crop.naturalW, crop.naturalH, frameW, frameH) * crop.zoom;
    const displayedW = crop.naturalW * scale;
    const displayedH = crop.naturalH * scale;
    const left = (frameW - displayedW) / 2 + crop.x;
    const top = (frameH - displayedH) / 2 + crop.y;
    const sx = Math.max(0, -left / scale);
    const sy = Math.max(0, -top / scale);
    const sw = Math.min(crop.naturalW - sx, frameW / scale);
    const sh = Math.min(crop.naturalH - sy, frameH / scale);
    const outW = 1150;
    const outH = Math.round(outW * frameH / frameW);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return Promise.reject(new Error('Не удалось подготовить фото'));
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Не удалось подготовить фото'));
                return;
            }
            resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.92);
    });
}
export function HrPhotoCropDialog({ src, busy, onCancel, onSave, }) {
    const imageRef = useRef(null);
    const frameRef = useRef(null);
    const dragRef = useRef(null);
    const [frame, setFrame] = useState({ w: FRAME_W, h: FRAME_H });
    const [crop, setCrop] = useState({ zoom: 1, x: 0, y: 0, naturalW: 1, naturalH: 1 });
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    useLayoutEffect(() => {
        const el = frameRef.current;
        if (!el)
            return undefined;
        const measure = () => {
            const w = el.clientWidth || FRAME_W;
            const h = el.clientHeight || FRAME_H;
            setFrame({ w, h });
            setCrop((prev) => ({ ...prev, ...clampOffset(prev.zoom, prev.naturalW, prev.naturalH, w, h, prev.x, prev.y) }));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        const onKey = (event) => {
            if (event.key === 'Escape' && !busy)
                onCancel();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onCancel]);
    const scale = coverScale(crop.naturalW, crop.naturalH, frame.w, frame.h) * crop.zoom;
    return createPortal(_jsxs("div", { className: "acct-hr acct-hr-crop", role: "presentation", children: [_jsx("button", { type: "button", className: "acct-hr-crop__backdrop", "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0443 \u0444\u043E\u0442\u043E", disabled: busy, onClick: onCancel }), _jsxs("div", { className: "acct-hr-crop__dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "acct-hr-crop-title", children: [_jsx("h2", { id: "acct-hr-crop-title", className: "acct-hr-crop__title", children: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0444\u043E\u0442\u043E" }), _jsx("p", { className: "acct-hr-crop__hint", children: "\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 \u0441\u043D\u0438\u043C\u043E\u043A \u0438 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u0435 \u043C\u0430\u0441\u0448\u0442\u0430\u0431. \u0420\u0430\u043C\u043A\u0430 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0441 \u0444\u043E\u0442\u043E \u043D\u0430 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0435." }), _jsx("div", { ref: frameRef, className: "acct-hr-crop__frame", onPointerDown: (event) => {
                            if (!ready)
                                return;
                            event.currentTarget.setPointerCapture(event.pointerId);
                            dragRef.current = { px: event.clientX, py: event.clientY, x: crop.x, y: crop.y };
                        }, onPointerMove: (event) => {
                            const drag = dragRef.current;
                            if (!drag)
                                return;
                            const next = clampOffset(crop.zoom, crop.naturalW, crop.naturalH, frame.w, frame.h, drag.x + event.clientX - drag.px, drag.y + event.clientY - drag.py);
                            setCrop((prev) => ({ ...prev, ...next }));
                        }, onPointerUp: () => {
                            dragRef.current = null;
                        }, onPointerCancel: () => {
                            dragRef.current = null;
                        }, children: _jsx("img", { ref: imageRef, src: src, alt: "", draggable: false, className: "acct-hr-crop__image", style: {
                                width: crop.naturalW * scale,
                                height: crop.naturalH * scale,
                                transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px))`,
                            }, onLoad: (event) => {
                                const img = event.currentTarget;
                                setCrop({
                                    zoom: 1,
                                    x: 0,
                                    y: 0,
                                    naturalW: img.naturalWidth || 1,
                                    naturalH: img.naturalHeight || 1,
                                });
                                setReady(true);
                            } }) }), _jsxs("label", { className: "acct-hr-crop__zoom", children: [_jsx("span", { children: "\u041C\u0430\u0441\u0448\u0442\u0430\u0431" }), _jsx("input", { type: "range", min: 1, max: 3, step: 0.01, value: crop.zoom, disabled: !ready || busy, onChange: (event) => {
                                    const zoom = Number(event.target.value);
                                    setCrop((prev) => {
                                        const next = clampOffset(zoom, prev.naturalW, prev.naturalH, frame.w, frame.h, prev.x, prev.y);
                                        return { ...prev, zoom, ...next };
                                    });
                                } })] }), error ? _jsx("p", { className: "acct-hr__error", role: "alert", children: error }) : null, _jsxs("div", { className: "acct-hr-crop__actions", children: [_jsx("button", { type: "button", className: "acct-hr__doc-btn", disabled: busy, onClick: onCancel, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "acct-hr__doc-btn acct-hr-crop__save", disabled: !ready || busy, onClick: () => {
                                    const image = imageRef.current;
                                    if (!image)
                                        return;
                                    setError('');
                                    void exportCroppedPhoto(image, crop, frame.w, frame.h).then(onSave).catch((e) => {
                                        setError(e instanceof Error ? e.message : 'Не удалось подготовить фото');
                                    });
                                }, children: busy ? 'Сохранение…' : 'Сохранить' })] })] })] }), document.body);
}
