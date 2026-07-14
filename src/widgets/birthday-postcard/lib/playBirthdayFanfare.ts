/** Short celebratory fanfare via Web Audio (no external assets). */
export function playBirthdayFanfare(): void {
    try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC)
            return;
        const ctx = new AC();
        const master = ctx.createGain();
        master.gain.value = 0.22;
        master.connect(ctx.destination);

        const chord: Array<[number, number, number]> = [
            [523.25, 0, 0.28],
            [659.25, 0.1, 0.32],
            [783.99, 0.2, 0.36],
            [1046.5, 0.32, 0.55],
            [783.99, 0.55, 0.35],
            [1046.5, 0.7, 0.65],
            [1318.5, 0.85, 0.8],
        ];

        const start = ctx.currentTime + 0.05;
        for (const [freq, offset, dur] of chord) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const t0 = start + offset;
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(0.9, t0 + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            osc.connect(gain);
            gain.connect(master);
            osc.start(t0);
            osc.stop(t0 + dur + 0.05);
        }

        window.setTimeout(() => {
            void ctx.close().catch(() => undefined);
        }, 2500);
    }
    catch {
        /* ignore autoplay / unsupported */
    }
}
