const COLUMN = 4;
const MAX_SLOPE = 1.1;
const GROW_SECONDS = 24;
const SETTLE_RATE = 0.35;

type Glint = { x: number; life: number; size: number };

export type Bank = {
    w: number;
    max: number;
    h: Float32Array;
    back: Float32Array;
    grow: number;
    time: number;
    phase: [number, number, number];
    glints: Glint[];
};

export function createBank(max: number): Bank {
    return {
        w: 0,
        max,
        h: new Float32Array(0),
        back: new Float32Array(0),
        grow: 0,
        time: 0,
        phase: [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28],
        glints: [],
    };
}

export function resizeBank(b: Bank, width: number): void {
    const n = Math.max(8, Math.ceil(width / COLUMN) + 1);
    if (b.h.length === n && b.w === width)
        return;
    const next = new Float32Array(n);
    const prev = b.h;
    if (prev.length > 0) {
        for (let i = 0; i < n; i += 1)
            next[i] = prev[Math.min(prev.length - 1, Math.floor((i / n) * prev.length))];
    }
    b.h = next;
    b.back = new Float32Array(n);
    b.w = width;
}

export function bankHeightAt(b: Bank, x: number): number {
    const c = Math.floor(x / COLUMN);
    return c >= 0 && c < b.h.length ? b.h[c] : 0;
}

export function depositSnow(b: Bank, x: number, amount: number): void {
    const c = Math.floor(x / COLUMN);
    for (let k = -2; k <= 2; k += 1) {
        const i = c + k;
        if (i < 0 || i >= b.h.length)
            continue;
        const w = k === 0 ? 1 : Math.abs(k) === 1 ? 0.55 : 0.2;
        b.h[i] = Math.min(b.max * 1.15, b.h[i] + amount * w);
    }
}

function duneProfile(u: number, p: [number, number, number], shift: number): number {
    const tau = Math.PI * 2;
    const v = 0.5
        + 0.26 * Math.sin(tau * (u * 1.25 + shift) + p[0])
        + 0.16 * Math.sin(tau * (u * 3.1 - shift * 0.6) + p[1])
        + 0.07 * Math.sin(tau * (u * 7.4 + shift * 0.3) + p[2]);
    return Math.max(0.14, Math.min(1, v));
}

function relax(h: Float32Array): void {
    for (let i = 0; i < h.length - 1; i += 1) {
        const d = h[i] - h[i + 1];
        if (d > MAX_SLOPE) {
            const m = (d - MAX_SLOPE) * 0.5;
            h[i] -= m;
            h[i + 1] += m;
        }
        else if (d < -MAX_SLOPE) {
            const m = (-d - MAX_SLOPE) * 0.5;
            h[i] += m;
            h[i + 1] -= m;
        }
    }
}

export function stepBank(b: Bank, dt: number): void {
    b.time += dt;
    b.grow = Math.min(1, b.grow + dt / GROW_SECONDS);
    const ease = b.grow * b.grow * (3 - 2 * b.grow);
    const n = b.h.length;
    const shift = b.time * 0.0025;
    const k = Math.min(1, dt * SETTLE_RATE);

    for (let i = 0; i < n; i += 1) {
        const u = (i * COLUMN) / Math.max(1, b.w);
        const target = b.max * ease * duneProfile(u, b.phase, shift);
        b.h[i] += (target - b.h[i]) * k;
        b.back[i] = b.max * 1.35 * ease * duneProfile(u * 0.8 + 0.37, b.phase, -shift * 0.7);
    }
    relax(b.h);

    if (Math.random() < dt * 2.6) {
        const x = Math.random() * b.w;
        if (bankHeightAt(b, x) > 4)
            b.glints.push({ x, life: 1, size: 1.4 + Math.random() * 1.6 });
    }
    for (let i = b.glints.length - 1; i >= 0; i -= 1) {
        b.glints[i].life -= dt * 1.2;
        if (b.glints[i].life <= 0)
            b.glints.splice(i, 1);
    }
}

function tracePile(ctx: CanvasRenderingContext2D, h: Float32Array, groundY: number) {
    const n = h.length;
    ctx.moveTo(0, groundY - h[0]);
    for (let i = 0; i < n - 1; i += 1) {
        const x = i * COLUMN;
        const xn = (i + 1) * COLUMN;
        ctx.quadraticCurveTo(x, groundY - h[i], (x + xn) / 2, groundY - (h[i] + h[i + 1]) / 2);
    }
    ctx.lineTo((n - 1) * COLUMN, groundY - h[n - 1]);
}

function fillPile(ctx: CanvasRenderingContext2D, b: Bank, h: Float32Array, groundY: number, fill: CanvasGradient | string) {
    ctx.beginPath();
    tracePile(ctx, h, groundY);
    ctx.lineTo(b.w + COLUMN, groundY + 2);
    ctx.lineTo(0, groundY + 2);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
}

export function drawBank(ctx: CanvasRenderingContext2D, b: Bank, groundY: number, dark: boolean): void {
    if (b.h.length === 0 || b.grow <= 0)
        return;
    const top = groundY - b.max * 1.4;

    const backFill = ctx.createLinearGradient(0, top, 0, groundY);
    if (dark) {
        backFill.addColorStop(0, 'rgba(200,216,240,0.38)');
        backFill.addColorStop(1, 'rgba(150,172,206,0.3)');
    }
    else {
        backFill.addColorStop(0, 'rgba(226,236,248,0.75)');
        backFill.addColorStop(1, 'rgba(196,212,234,0.6)');
    }
    fillPile(ctx, b, b.back, groundY, backFill);

    const front = ctx.createLinearGradient(0, groundY - b.max, 0, groundY);
    if (dark) {
        front.addColorStop(0, 'rgba(255,255,255,1)');
        front.addColorStop(0.5, 'rgba(236,243,252,0.97)');
        front.addColorStop(1, 'rgba(200,216,238,0.95)');
    }
    else {
        front.addColorStop(0, 'rgba(255,255,255,1)');
        front.addColorStop(0.5, 'rgba(244,248,253,0.98)');
        front.addColorStop(1, 'rgba(208,222,240,0.96)');
    }
    fillPile(ctx, b, b.h, groundY, front);

    ctx.beginPath();
    tracePile(ctx, b.h, groundY);
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.7)' : 'rgba(140,166,200,0.32)';
    ctx.lineWidth = 1;
    ctx.stroke();

    for (const gl of b.glints) {
        const y = groundY - bankHeightAt(b, gl.x) + 3;
        const a = Math.sin(gl.life * Math.PI);
        const s = gl.size * (0.6 + a * 0.6);
        ctx.globalAlpha = a;
        ctx.fillStyle = dark ? '#ffffff' : '#9fb9db';
        ctx.beginPath();
        ctx.moveTo(gl.x, y - s * 1.9);
        ctx.lineTo(gl.x + s * 0.32, y - s * 0.32);
        ctx.lineTo(gl.x + s * 1.9, y);
        ctx.lineTo(gl.x + s * 0.32, y + s * 0.32);
        ctx.lineTo(gl.x, y + s * 1.9);
        ctx.lineTo(gl.x - s * 0.32, y + s * 0.32);
        ctx.lineTo(gl.x - s * 1.9, y);
        ctx.lineTo(gl.x - s * 0.32, y - s * 0.32);
        ctx.closePath();
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}
