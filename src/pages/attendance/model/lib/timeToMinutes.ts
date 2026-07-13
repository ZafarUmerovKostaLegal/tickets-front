export function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map((v) => Number(v));
    if (!Number.isFinite(h) || !Number.isFinite(m))
        return 0;
    return h * 60 + m;
}
