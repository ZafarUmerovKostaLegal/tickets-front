import { bankHeightAt, createBank, depositSnow, drawBank, resizeBank, stepBank } from './snowBank';

export type SnowSceneOptions = {
    count: number;
    bankMax: number;
};

type Layer = 0 | 1 | 2;

type Flake = {
    layer: Layer;
    x: number;
    y: number;
    size: number;
    vy: number;
    alpha: number;
    crystal: boolean;
    rot: number;
    vrot: number;
    swayAmp: number;
    swayFreq: number;
    phase: number;
    ivx: number;
    ivy: number;
};

const LAYER_WEIGHTS = [0.46, 0.34, 0.2];
const LAYER_DEPTH = [0.45, 0.75, 1] as const;
const MAX_DPR = 1.5;
const FRAME_MS = 1000 / 62;
const POINTER_R = 120;

function between(a: number, b: number): number {
    return a + Math.random() * (b - a);
}

type Sprites = { soft: HTMLCanvasElement; dot: HTMLCanvasElement; crystal: HTMLCanvasElement };

function sprite(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    if (ctx)
        draw(ctx, size);
    return c;
}

function radialDot(stops: Array<[number, string]>) {
    return (ctx: CanvasRenderingContext2D, s: number) => {
        const g = ctx.createRadialGradient(s * 0.42, s * 0.4, 0, s / 2, s / 2, s / 2);
        for (const [o, c] of stops)
            g.addColorStop(o, c);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
        ctx.fill();
    };
}

function crystalPath(ctx: CanvasRenderingContext2D, s: number) {
    const c = s / 2;
    const r = s * 0.4;
    ctx.beginPath();
    for (let k = 0; k < 6; k += 1) {
        const a = (k * Math.PI) / 3;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        ctx.moveTo(c, c);
        ctx.lineTo(c + ca * r, c + sa * r);
        for (const at of [0.48, 0.74]) {
            const bx = c + ca * r * at;
            const by = c + sa * r * at;
            const bl = r * (at < 0.6 ? 0.3 : 0.2);
            for (const side of [-1, 1]) {
                const ba = a + side * (Math.PI / 3.2);
                ctx.moveTo(bx, by);
                ctx.lineTo(bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl);
            }
        }
    }
}

function buildSprites(dark: boolean): Sprites {
    const soft = sprite(32, radialDot(dark
        ? [[0, 'rgba(255,255,255,0.95)'], [0.5, 'rgba(230,240,252,0.55)'], [1, 'rgba(220,232,250,0)']]
        : [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(206,220,238,0.8)'], [0.8, 'rgba(150,176,208,0.3)'], [1, 'rgba(150,176,208,0)']]));
    const dot = sprite(32, radialDot(dark
        ? [[0, '#ffffff'], [0.6, 'rgba(236,243,252,0.95)'], [0.85, 'rgba(200,220,245,0.45)'], [1, 'rgba(200,220,245,0)']]
        : [[0, '#ffffff'], [0.5, 'rgba(222,232,245,1)'], [0.78, 'rgba(140,166,200,0.75)'], [1, 'rgba(140,166,200,0)']]));
    const crystal = sprite(64, (ctx, s) => {
        ctx.lineCap = 'round';
        crystalPath(ctx, s);
        if (dark) {
            ctx.shadowColor = 'rgba(200,225,255,0.9)';
            ctx.shadowBlur = 5;
            ctx.strokeStyle = 'rgba(255,255,255,0.95)';
            ctx.lineWidth = 2.6;
            ctx.stroke();
        }
        else {
            ctx.strokeStyle = 'rgba(112,142,184,0.75)';
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.4;
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.fillStyle = dark ? '#ffffff' : '#e8f0fa';
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
    });
    return { soft, dot, crystal };
}

function pickLayer(): Layer {
    const r = Math.random();
    if (r < LAYER_WEIGHTS[0])
        return 0;
    return r < LAYER_WEIGHTS[0] + LAYER_WEIGHTS[1] ? 1 : 2;
}

function resetFlake(f: Flake, w: number, h: number, initial: boolean): void {
    const layer = f.layer;
    if (layer === 0) {
        f.crystal = false;
        f.size = between(2.5, 4.5);
        f.vy = between(20, 32);
        f.alpha = between(0.4, 0.62);
    }
    else if (layer === 1) {
        f.crystal = Math.random() < 0.25;
        f.size = f.crystal ? between(9, 13) : between(4, 6.5);
        f.vy = between(34, 52);
        f.alpha = between(0.62, 0.85);
    }
    else {
        f.crystal = Math.random() < 0.45;
        f.size = f.crystal ? between(12, 18) : between(6, 8.5);
        f.vy = between(52, 76);
        f.alpha = between(0.78, 0.95);
    }
    f.x = between(-30, w + 30);
    f.y = initial ? between(-20, h) : -f.size - between(0, 60);
    f.rot = between(0, Math.PI * 2);
    f.vrot = f.crystal ? between(0.3, 1.1) * (Math.random() < 0.5 ? -1 : 1) : 0;
    f.swayAmp = between(6, 16) * LAYER_DEPTH[layer];
    f.swayFreq = between(0.5, 1.2);
    f.phase = between(0, Math.PI * 2);
    f.ivx = 0;
    f.ivy = 0;
}

function makeFlakes(count: number, w: number, h: number): Flake[][] {
    const layers: Flake[][] = [[], [], []];
    for (let i = 0; i < count; i += 1) {
        const f = { layer: pickLayer() } as Flake;
        resetFlake(f, w, h, true);
        layers[f.layer].push(f);
    }
    return layers;
}

export function startSnowScene(canvas: HTMLCanvasElement, opts: SnowSceneOptions): () => void {
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return () => {};

    const isDark = () => document.body.getAttribute('data-theme') === 'dark';
    let dark = isDark();
    let sprites = buildSprites(dark);

    let w = window.innerWidth;
    let h = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const layers = makeFlakes(opts.count, w, h);
    const bank = opts.bankMax > 0 ? createBank(opts.bankMax) : null;

    const applySize = () => {
        const prevW = w;
        w = window.innerWidth;
        h = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        if (prevW > 0 && prevW !== w) {
            const k = w / prevW;
            for (const layer of layers)
                for (const f of layer) f.x *= k;
        }
        if (bank)
            resizeBank(bank, w);
    };
    applySize();

    let resizeRaf = 0;
    const onResize = () => {
        cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(applySize);
    };
    window.addEventListener('resize', onResize);

    const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, t: 0 };
    const onPointerMove = (e: PointerEvent) => {
        const now = performance.now();
        const dt = Math.max(8, now - pointer.t) / 1000;
        if (pointer.t > 0 && now - pointer.t < 120) {
            pointer.vx = pointer.vx * 0.6 + ((e.clientX - pointer.x) / dt) * 0.4;
            pointer.vy = pointer.vy * 0.6 + ((e.clientY - pointer.y) / dt) * 0.4;
        }
        else {
            pointer.vx = 0;
            pointer.vy = 0;
        }
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.t = now;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const themeObserver = new MutationObserver(() => {
        const next = isDark();
        if (next !== dark) {
            dark = next;
            sprites = buildSprites(dark);
        }
    });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

    let time = 0;
    let gust = 0;
    let gustTarget = 0;
    let gustTimer = between(8, 16);
    const windAt = () => 9 * Math.sin(time * 0.11) + 12 * Math.sin(time * 0.037 + 1.3) + gust;

    const step = (dt: number) => {
        time += dt;
        gustTimer -= dt;
        if (gustTimer <= 0) {
            if (gustTarget === 0) {
                gustTarget = between(28, 46) * (Math.random() < 0.5 ? -1 : 1);
                gustTimer = between(2.5, 4.5);
            }
            else {
                gustTarget = 0;
                gustTimer = between(12, 24);
            }
        }
        gust += (gustTarget - gust) * Math.min(1, dt * 0.8);
        const wind = windAt();

        const pointerLive = performance.now() - pointer.t < 160;
        const decay = Math.exp(-2.4 * dt);
        const groundY = h - 1;

        for (let l = 0; l < 3; l += 1) {
            const depth = LAYER_DEPTH[l];
            for (const f of layers[l]) {
                if (pointerLive) {
                    const dx = f.x - pointer.x;
                    const dy = f.y - pointer.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < POINTER_R * POINTER_R) {
                        const d = Math.sqrt(d2) || 1;
                        const k = (1 - d / POINTER_R) ** 2 * depth;
                        f.ivx += (pointer.vx * 0.5 + (dx / d) * 140) * k * dt;
                        f.ivy += (pointer.vy * 0.25 + (dy / d) * 60) * k * dt;
                    }
                }
                f.ivx = Math.max(-260, Math.min(260, f.ivx * decay));
                f.ivy = Math.max(-120, Math.min(120, f.ivy * decay));

                const sway = f.swayAmp * f.swayFreq * Math.cos(time * f.swayFreq + f.phase);
                f.x += (wind * depth + sway + f.ivx) * dt;
                f.y += (f.vy + f.ivy) * dt;
                f.rot += f.vrot * dt;

                if (f.x < -60)
                    f.x += w + 120;
                else if (f.x > w + 60)
                    f.x -= w + 120;

                if (bank && l > 0 && f.x >= 0 && f.x < w) {
                    if (f.y + f.size * 0.25 >= groundY - bankHeightAt(bank, f.x)) {
                        depositSnow(bank, f.x, f.size * (f.crystal ? 0.12 : 0.28));
                        resetFlake(f, w, h, false);
                        continue;
                    }
                }
                if (f.y > h + f.size)
                    resetFlake(f, w, h, false);
            }
        }
        if (bank)
            stepBank(bank, dt);
    };

    const drawLayer = (l: number) => {
        for (const f of layers[l]) {
            const img = f.crystal ? sprites.crystal : l === 0 ? sprites.soft : sprites.dot;
            const s = f.size;
            ctx.globalAlpha = f.alpha;
            if (f.crystal) {
                const c = Math.cos(f.rot) * dpr;
                const sn = Math.sin(f.rot) * dpr;
                ctx.setTransform(c, sn, -sn, c, f.x * dpr, f.y * dpr);
                ctx.drawImage(img, -s / 2, -s / 2, s, s);
            }
            else {
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.drawImage(img, f.x - s / 2, f.y - s / 2, s, s);
            }
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = 1;
    };

    const draw = () => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawLayer(0);
        drawLayer(1);
        if (bank)
            drawBank(ctx, bank, h - 1, dark);
        drawLayer(2);
    };

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        const elapsed = now - last;
        if (elapsed < FRAME_MS - 1)
            return;
        last = now;
        step(Math.min(0.05, elapsed / 1000));
        draw();
    };
    raf = requestAnimationFrame(tick);

    return () => {
        cancelAnimationFrame(raf);
        cancelAnimationFrame(resizeRaf);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('pointermove', onPointerMove);
        themeObserver.disconnect();
    };
}
