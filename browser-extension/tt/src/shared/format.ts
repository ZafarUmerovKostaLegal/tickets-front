export function formatClock(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0)
        return '0:00:00';
    const s = Math.floor(totalSeconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function todayYmd(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function baseDurationSeconds(snapshot: { durationSeconds?: number; hours?: number }): number {
    if (typeof snapshot.durationSeconds === 'number' && Number.isFinite(snapshot.durationSeconds))
        return Math.max(0, Math.trunc(snapshot.durationSeconds));
    const h = snapshot.hours ?? 0;
    if (!Number.isFinite(h) || h <= 0)
        return 0;
    return Math.max(0, Math.floor(h * 3600));
}

export function elapsedSeconds(payload: { startedAt: number; paused?: boolean; snapshot: { durationSeconds?: number; hours?: number } }): number {
    const base = baseDurationSeconds(payload.snapshot);
    if (payload.paused)
        return base;
    return base + Math.max(0, Math.floor((Date.now() - payload.startedAt) / 1000));
}

export function isDraftEntryId(id: string): boolean {
    return id.startsWith('te_');
}
