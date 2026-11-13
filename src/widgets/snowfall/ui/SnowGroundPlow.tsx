import { useEffect, useRef } from 'react';
import './SnowGroundPlow.css';

/** Port of WinterForWindows / snow-rs taskbar pile + plow (simplified for the hub). */
const COLUMN = 4;
const PILE_MAX = 22;
const MAX_SLOPE = 1.35;
const PLOW_TRIGGER = 0.62;
const PLOW_SPEED = 190;
const PLOW_LENGTH = 64;
const PLOW_COOLDOWN = 12;
const GRAVITY = 420;
const CANVAS_H = 56;

type Particle = {
    x: number;
    y: number;
    r: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
};

type Sim = {
    w: number;
    h: Float32Array;
    plowActive: boolean;
    plowX: number;
    plowDir: number;
    nextDir: number;
    plowTimer: number;
    time: number;
    particles: Particle[];
};

function meanFill(h: Float32Array, max: number): number {
    if (h.length === 0 || max <= 0)
        return 0;
    let sum = 0;
    for (let i = 0; i < h.length; i += 1)
        sum += h[i];
    return sum / (h.length * max);
}

function relax(h: Float32Array, maxSlope: number): void {
    for (let pass = 0; pass < 2; pass += 1) {
        for (let i = 0; i < h.length - 1; i += 1) {
            const d = h[i] - h[i + 1];
            if (d > maxSlope) {
                const m = (d - maxSlope) * 0.5;
                h[i] -= m;
                h[i + 1] += m;
            }
            else if (d < -maxSlope) {
                const m = (-d - maxSlope) * 0.5;
                h[i] += m;
                h[i + 1] -= m;
            }
        }
    }
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    hh: number,
    r: number,
) {
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

function drawPile(ctx: CanvasRenderingContext2D, sim: Sim, groundY: number) {
    const n = sim.h.length;
    if (n === 0)
        return;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(0, groundY - sim.h[0]);
    for (let i = 0; i < n; i += 1) {
        const x = (i + 0.5) * COLUMN;
        const y = groundY - sim.h[i];
        if (i === 0)
            ctx.lineTo(x, y);
        else
            ctx.lineTo(x, y);
    }
    ctx.lineTo(sim.w, groundY - sim.h[n - 1]);
    ctx.lineTo(sim.w, groundY + 2);
    ctx.lineTo(0, groundY + 2);
    ctx.closePath();

    const g = ctx.createLinearGradient(0, groundY - PILE_MAX, 0, groundY);
    g.addColorStop(0, 'rgba(255,255,255,0.98)');
    g.addColorStop(0.55, 'rgba(241,246,252,0.96)');
    g.addColorStop(1, 'rgba(198,214,232,0.92)');
    ctx.fillStyle = g;
    ctx.fill();

    ctx.strokeStyle = 'rgba(120,148,186,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY - sim.h[0]);
    for (let i = 0; i < n; i += 1)
        ctx.lineTo((i + 0.5) * COLUMN, groundY - sim.h[i]);
    ctx.stroke();
}

function drawPlow(ctx: CanvasRenderingContext2D, sim: Sim, groundY: number) {
    const bob = Math.sin(sim.time * 22) * 0.4;
    ctx.save();
    ctx.translate(sim.plowX, groundY);
    ctx.scale(sim.plowDir, 1);

    // thrown snow puff at blade
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(7, -4, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // wheels
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

    // chassis / body (bob)
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

    const beaconOn = (sim.time * 3) % 1 < 0.5;
    if (beaconOn) {
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

    // arm + blade
    ctx.strokeStyle = '#26292e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, -9);
    ctx.lineTo(-1, -8);
    ctx.stroke();

    ctx.fillStyle = '#9ca3af';
    ctx.strokeStyle = '#26292e';
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

function spawnSpray(sim: Sim, groundY: number, amount: number) {
    for (let i = 0; i < amount; i += 1) {
        const maxLife = 0.45 + Math.random() * 0.55;
        sim.particles.push({
            x: sim.plowX + sim.plowDir * (4 + Math.random() * 10),
            y: groundY - 2 - Math.random() * (PILE_MAX + 6),
            r: 0.8 + Math.random() * 1.6,
            vx: sim.plowDir * (40 + Math.random() * 120),
            vy: -(50 + Math.random() * 140),
            life: maxLife,
            maxLife,
        });
    }
}

function ensureColumns(sim: Sim, width: number) {
    const n = Math.max(8, Math.ceil(width / COLUMN));
    if (sim.h.length === n && sim.w === width)
        return;
    const next = new Float32Array(n);
    const prev = sim.h;
    if (prev.length > 0) {
        for (let i = 0; i < n; i += 1) {
            const src = Math.min(prev.length - 1, Math.floor((i / n) * prev.length));
            next[i] = prev[src];
        }
    }
    sim.h = next;
    sim.w = width;
}

/**
 * Fixed bottom snow bank that accumulates, then a toy plow clears it —
 * behaviour taken from the WinterForWindows / snow-rs overlay.
 */
export function SnowGroundPlow() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const reduce = typeof window !== 'undefined'
            && !!window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce)
            return;

        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;

        const sim: Sim = {
            w: 0,
            h: new Float32Array(0),
            plowActive: false,
            plowX: -80,
            plowDir: 1,
            nextDir: 1,
            plowTimer: 4,
            time: 0,
            particles: [],
        };

        let raf = 0;
        let last = performance.now();
        let alive = true;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = window.innerWidth;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(CANVAS_H * dpr);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${CANVAS_H}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ensureColumns(sim, w);
        };
        resize();
        window.addEventListener('resize', resize);

        const tick = (now: number) => {
            if (!alive)
                return;
            const raw = Math.min(0.05, (now - last) / 1000);
            last = now;
            const dt = document.hidden ? 0 : raw;
            sim.time += dt;
            const groundY = CANVAS_H - 2;

            if (dt > 0) {
                // Accumulate snow across the bank
                const deposits = Math.ceil(sim.w / 90);
                for (let i = 0; i < deposits; i += 1) {
                    if (Math.random() < 0.55) {
                        const c = Math.floor(Math.random() * sim.h.length);
                        const bump = 0.35 + Math.random() * 0.9;
                        sim.h[c] = Math.min(PILE_MAX, sim.h[c] + bump * dt * 14);
                    }
                }
                // Soft wind drift along the bank
                if (sim.h.length > 2 && Math.random() < 0.4) {
                    const c = 1 + Math.floor(Math.random() * (sim.h.length - 2));
                    const move = (Math.random() - 0.5) * 0.4;
                    sim.h[c] = Math.max(0, Math.min(PILE_MAX, sim.h[c] + move));
                }
                if (!sim.plowActive)
                    relax(sim.h, MAX_SLOPE);

                const fill = meanFill(sim.h, PILE_MAX);

                if (!sim.plowActive) {
                    sim.plowTimer -= dt;
                    if (sim.plowTimer <= 0 && fill >= PLOW_TRIGGER) {
                        sim.plowDir = sim.nextDir;
                        sim.nextDir = -sim.nextDir;
                        sim.plowX = sim.plowDir > 0
                            ? -PLOW_LENGTH - 12
                            : sim.w + PLOW_LENGTH + 12;
                        sim.plowActive = true;
                    }
                }
                else {
                    const oldX = sim.plowX;
                    sim.plowX += sim.plowDir * PLOW_SPEED * dt;
                    const lo = Math.min(oldX, sim.plowX);
                    const hi = Math.max(oldX, sim.plowX);
                    const c0 = Math.max(0, Math.floor(lo / COLUMN));
                    const c1 = Math.min(sim.h.length - 1, Math.floor(hi / COLUMN));
                    let sprayed = 0;
                    for (let c = c0; c <= c1; c += 1) {
                        const height = sim.h[c];
                        if (height > 0.2) {
                            sim.h[c] = 0;
                            if (height > 1.2 && sprayed < 6 && Math.random() < 0.65) {
                                spawnSpray(sim, groundY, 1 + Math.floor(Math.random() * 2));
                                sprayed += 1;
                            }
                        }
                    }

                    const finished = sim.plowDir > 0
                        ? sim.plowX - PLOW_LENGTH > sim.w + 14
                        : sim.plowX + PLOW_LENGTH < -14;
                    if (finished) {
                        sim.plowActive = false;
                        sim.plowTimer = PLOW_COOLDOWN;
                    }
                }

                // Ballistic spray
                for (let i = sim.particles.length - 1; i >= 0; i -= 1) {
                    const p = sim.particles[i];
                    p.life -= dt;
                    if (p.life <= 0) {
                        sim.particles.splice(i, 1);
                        continue;
                    }
                    p.vy += GRAVITY * dt;
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                }
            }

            ctx.clearRect(0, 0, sim.w || canvas.width, CANVAS_H);
            drawPile(ctx, sim, groundY);
            for (const p of sim.particles) {
                const a = Math.max(0, p.life / p.maxLife);
                ctx.globalAlpha = a;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            if (sim.plowActive)
                drawPlow(ctx, sim, groundY);

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);

        return () => {
            alive = false;
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return <canvas className="snow-ground-plow" aria-hidden ref={canvasRef} />;
}
