/**
 * Snow bank along the bottom of the viewport: it fills up from landing
 * flakes plus a light ambient deposit, and a toy plow clears it once it is
 * deep enough (behaviour from the WinterForWindows / snow-rs overlay).
 * Pure simulation + drawing — the render loop lives in snowScene.ts.
 */

const COLUMN = 4;
const MAX_SLOPE = 1.35;
const PLOW_TRIGGER = 0.62;
const PLOW_SPEED = 190;
const PLOW_LENGTH = 64;
const PLOW_COOLDOWN = 14;
const GRAVITY = 420;
const AMBIENT_RATE = 8;

type Particle = { x: number; y: number; r: number; vx: number; vy: number; life: number; maxLife: number };
type Glint = { x: number; life: number; size: number };

export type Bank = {
    w: number;
    max: number;
    h: Float32Array;
    plowActive: boolean;
    plowX: number;
    plowDir: number;
    nextDir: number;
    plowTimer: number;
    time: number;
    particles: Particle[];
    glints: Glint[];
};

export function createBank(max: number): Bank {
    return {
        w: 0,
        max,
        h: new Float32Array(0),
        plowActive: false,
        plowX: -80,
        plowDir: 1,
        nextDir: 1,
        plowTimer: 6,
        time: 0,
        particles: [],
        glints: [],
    };
}

export function resizeBank(b: Bank, width: number): void {
    const n = Math.max(8, Math.ceil(width / COLUMN));
    if (b.h.length === n && b.w === width)
        return;
    const next = new Float32Array(n);
    const prev = b.h;
    if (prev.length > 0) {
        for (let i = 0; i < n; i += 1)
            next[i] = prev[Math.min(prev.length - 1, Math.floor((i / n) * prev.length))];
    }
    b.h = next;
    b.w = width;
}

export function bankHeightAt(b: Bank, x: number): number {
    const c = Math.floor(x / COLUMN);
    return c >= 0 && c < b.h.length ? b.h[c] : 0;
}

/** A flake landed at `x`: pile a soft bump over a few columns. */
export function depositSnow(b: Bank, x: number, amount: number): void {
    if (b.plowActive && Math.abs(x - b.plowX) < PLOW_LENGTH + 20)
        return;
    const c = Math.floor(x / COLUMN);
    for (let k = -2; k <= 2; k += 1) {
        const i = c + k;
        if (i < 0 || i >= b.h.length)
            continue;
        const w = k === 0 ? 1 : Math.abs(k) === 1 ? 0.55 : 0.2;
        b.h[i] = Math.min(b.max, b.h[i] + amount * w);
    }
}

function relax(h: Float32Array): void {
    for (let pass = 0; pass < 2; pass += 1) {
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
}

function meanFill(b: Bank): number {
    if (b.h.length === 0)
        return 0;
    let sum = 0;
    for (let i = 0; i < b.h.length; i += 1)
        sum += b.h[i];
    return sum / (b.h.length * b.max);
}

function spawnSpray(b: Bank, groundY: number, amount: number): void {
    for (let i = 0; i < amount; i += 1) {
        const maxLife = 0.45 + Math.random() * 0.55;
        b.particles.push({
            x: b.plowX + b.plowDir * (4 + Math.random() * 10),
            y: groundY - 2 - Math.random() * (b.max + 6),
            r: 0.8 + Math.random() * 1.6,
            vx: b.plowDir * (40 + Math.random() * 120),
            vy: -(50 + Math.random() * 140),
            life: maxLife,
            maxLife,
        });
    }
}

export function stepBank(b: Bank, dt: number, groundY: number): void {
    b.time += dt;
    const n = b.h.length;

    // Light ambient deposit so the bank grows evenly, not only under flakes.
    const deposits = Math.ceil(b.w / 90);
    for (let i = 0; i < deposits; i += 1) {
        if (Math.random() < 0.5) {
            const c = Math.floor(Math.random() * n);
            b.h[c] = Math.min(b.max, b.h[c] + (0.35 + Math.random() * 0.9) * dt * AMBIENT_RATE);
        }
    }
    if (!b.plowActive)
        relax(b.h);

    // Sparkles on the surface.
    if (Math.random() < dt * 2.2) {
        const x = Math.random() * b.w;
        if (bankHeightAt(b, x) > 3)
            b.glints.push({ x, life: 1, size: 1.6 + Math.random() * 1.6 });
    }
    for (let i = b.glints.length - 1; i >= 0; i -= 1) {
        b.glints[i].life -= dt * 1.4;
        if (b.glints[i].life <= 0 || bankHeightAt(b, b.glints[i].x) < 2)
            b.glints.splice(i, 1);
    }

    if (!b.plowActive) {
        b.plowTimer -= dt;
        if (b.plowTimer <= 0 && meanFill(b) >= PLOW_TRIGGER) {
            b.plowDir = b.nextDir;
            b.nextDir = -b.nextDir;
            b.plowX = b.plowDir > 0 ? -PLOW_LENGTH - 12 : b.w + PLOW_LENGTH + 12;
            b.plowActive = true;
        }
    }
    else {
        const oldX = b.plowX;
        b.plowX += b.plowDir * PLOW_SPEED * dt;
        const c0 = Math.max(0, Math.floor(Math.min(oldX, b.plowX) / COLUMN));
        const c1 = Math.min(n - 1, Math.floor(Math.max(oldX, b.plowX) / COLUMN));
        let sprayed = 0;
        for (let c = c0; c <= c1; c += 1) {
            const height = b.h[c];
            if (height > 0.2) {
                b.h[c] = 0;
                if (height > 1.2 && sprayed < 6 && Math.random() < 0.65) {
                    spawnSpray(b, groundY, 1 + Math.floor(Math.random() * 2));
                    sprayed += 1;
                }
            }
        }
        const finished = b.plowDir > 0 ? b.plowX - PLOW_LENGTH > b.w + 14 : b.plowX + PLOW_LENGTH < -14;
        if (finished) {
            b.plowActive = false;
            b.plowTimer = PLOW_COOLDOWN;
        }
    }

    for (let i = b.particles.length - 1; i >= 0; i -= 1) {
        const p = b.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
            b.particles.splice(i, 1);
            continue;
        }
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
    }
}

/* ---------- Drawing ---------- */

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, r: number) {
    const rr = Math.min(r, w / 2, hh / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + hh, rr);
    ctx.arcTo(x + w, y + hh, x, y + hh, rr);
    ctx.arcTo(x, y + hh, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    ctx.fill();
}

/** Smooth surface through the column tops (midpoint quadratic curves). */
function tracePile(ctx: CanvasRenderingContext2D, b: Bank, groundY: number) {
    const n = b.h.length;
    ctx.moveTo(0, groundY - b.h[0]);
    for (let i = 0; i < n - 1; i += 1) {
        const x = (i + 0.5) * COLUMN;
        const xn = (i + 1.5) * COLUMN;
        ctx.quadraticCurveTo(x, groundY - b.h[i], (x + xn) / 2, groundY - (b.h[i] + b.h[i + 1]) / 2);
    }
    ctx.lineTo(b.w, groundY - b.h[n - 1]);
}

function drawPile(ctx: CanvasRenderingContext2D, b: Bank, groundY: number, dark: boolean) {
    if (b.h.length === 0)
        return;
    ctx.beginPath();
    tracePile(ctx, b, groundY);
    ctx.lineTo(b.w, groundY + 2);
    ctx.lineTo(0, groundY + 2);
    ctx.closePath();

    const g = ctx.createLinearGradient(0, groundY - b.max, 0, groundY);
    if (dark) {
        g.addColorStop(0, 'rgba(244,248,255,0.96)');
        g.addColorStop(0.6, 'rgba(214,226,244,0.94)');
        g.addColorStop(1, 'rgba(160,182,214,0.9)');
    }
    else {
        g.addColorStop(0, 'rgba(255,255,255,0.99)');
        g.addColorStop(0.55, 'rgba(240,245,252,0.97)');
        g.addColorStop(1, 'rgba(196,212,232,0.94)');
    }
    ctx.fillStyle = g;
    ctx.fill();

    ctx.beginPath();
    tracePile(ctx, b, groundY);
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.55)' : 'rgba(120,148,186,0.38)';
    ctx.lineWidth = 1;
    ctx.stroke();

    for (const gl of b.glints) {
        const y = groundY - bankHeightAt(b, gl.x) + 2.5;
        const a = Math.sin(gl.life * Math.PI);
        const s = gl.size * (0.6 + a * 0.6);
        ctx.globalAlpha = a;
        ctx.fillStyle = dark ? '#ffffff' : '#9db8da';
        ctx.beginPath();
        ctx.moveTo(gl.x, y - s * 1.8);
        ctx.lineTo(gl.x + s * 0.35, y - s * 0.35);
        ctx.lineTo(gl.x + s * 1.8, y);
        ctx.lineTo(gl.x + s * 0.35, y + s * 0.35);
        ctx.lineTo(gl.x, y + s * 1.8);
        ctx.lineTo(gl.x - s * 0.35, y + s * 0.35);
        ctx.lineTo(gl.x - s * 1.8, y);
        ctx.lineTo(gl.x - s * 0.35, y - s * 0.35);
        ctx.closePath();
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawPlow(ctx: CanvasRenderingContext2D, b: Bank, groundY: number) {
    const bob = Math.sin(b.time * 22) * 0.4;
    ctx.save();
    ctx.translate(b.plowX, groundY);
    ctx.scale(b.plowDir, 1);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(7, -4, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#26292e';
    ctx.beginPath();
    ctx.arc(-52, -5.5, 5.5, 0, Math.PI * 2);
    ctx.arc(-20, -5.5, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8bec6';
    ctx.beginPath();
    ctx.arc(-52, -5.5, 2, 0, Math.PI * 2);
    ctx.arc(-20, -5.5, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#26292e';
    ctx.fillRect(-63, -13 + bob, 52, 5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-47, -28 + bob, 13, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    roundRect(ctx, -63, -28 + bob, 31, 16, 2);
    ctx.fillStyle = '#e0730a';
    roundRect(ctx, -31, -31 + bob, 19, 19, 3);
    ctx.fillStyle = '#bfe3ff';
    roundRect(ctx, -25, -28 + bob, 11, 8, 1.5);
    ctx.fillStyle = '#f59e0b';
    roundRect(ctx, -13, -21 + bob, 8, 9, 2);

    if ((b.time * 3) % 1 < 0.5) {
        ctx.fillStyle = 'rgba(255,200,60,0.28)';
        ctx.beginPath();
        ctx.arc(-21.5, -33 + bob, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd23f';
    }
    else {
        ctx.fillStyle = '#b46a00';
    }
    roundRect(ctx, -24, -35 + bob, 5, 4, 1.5);

    ctx.strokeStyle = '#26292e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, -9);
    ctx.lineTo(-1, -8);
    ctx.stroke();

    ctx.fillStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, -18);
    ctx.lineTo(1, -18);
    ctx.lineTo(5, -1);
    ctx.lineTo(2, 0);
    ctx.lineTo(-1, -1);
    ctx.lineTo(-2, -9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

export function drawBank(ctx: CanvasRenderingContext2D, b: Bank, groundY: number, dark: boolean): void {
    drawPile(ctx, b, groundY, dark);
    if (b.particles.length > 0) {
        ctx.fillStyle = '#ffffff';
        for (const p of b.particles) {
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
    if (b.plowActive)
        drawPlow(ctx, b, groundY);
}
