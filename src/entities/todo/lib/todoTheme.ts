export type ThemeVars = {
    isDark: boolean;
    accent: string;
    text: string;
    muted: string;
    surface: string;
    surface2: string;
    panelBg: string;
    border: string;
    shadow: string;
    headerBg: string;
    navShadow: string;
    columnTodayBg: string;
    columnTodayText: string;
    columnWeekBg: string;
    columnWeekText: string;
    columnLaterBg: string;
    columnLaterText: string;
};
function clamp01(n: number): number {
    return Math.max(0, Math.min(1, n));
}
function luminance(r: number, g: number, b: number): number {
    const srgb = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}
function rgbToHsl(r: number, g: number, b: number) {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const d = max - min;
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        switch (max) {
            case rr:
                h = ((gg - bb) / d + (gg < bb ? 6 : 0)) * 60;
                break;
            case gg:
                h = ((bb - rr) / d + 2) * 60;
                break;
            default:
                h = ((rr - gg) / d + 4) * 60;
                break;
        }
    }
    return { h, s, l };
}
function toHex(n: number): string {
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}
function rgbToHex(r: number, g: number, b: number): string {
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function hslToRgb(h: number, s: number, l: number): {
    r: number;
    g: number;
    b: number;
} {
    const h01 = ((h % 360) + 360) / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const t = [h01 + 1 / 3, h01, h01 - 1 / 3].map((tc) => {
        let t2 = tc;
        if (t2 < 0)
            t2 += 1;
        if (t2 > 1)
            t2 -= 1;
        if (t2 < 1 / 6)
            return p + (q - p) * 6 * t2;
        if (t2 < 1 / 2)
            return q;
        if (t2 < 2 / 3)
            return p + (q - p) * (2 / 3 - t2) * 6;
        return p;
    });
    return { r: t[0] * 255, g: t[1] * 255, b: t[2] * 255 };
}
function darkenHex(hex: string, factor: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 0xff) * factor);
    const g = Math.round(((n >> 8) & 0xff) * factor);
    const b = Math.round((n & 0xff) * factor);
    return rgbToHex(r, g, b);
}
function darkChromeFromPhotoHue(avgR: number, avgG: number, avgB: number, lightness: number, alpha: number): string {
    const { h, s } = rgbToHsl(avgR, avgG, avgB);
    const sat = clamp01(s * 0.38 + 0.04);
    const l = clamp01(lightness);
    const { r, g, b } = hslToRgb(h, sat, l);
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
}
export function deriveColumnColors(accentHex: string): Pick<ThemeVars, 'columnTodayBg' | 'columnTodayText' | 'columnWeekBg' | 'columnWeekText' | 'columnLaterBg' | 'columnLaterText'> {
    const n = parseInt(accentHex.slice(1), 16);
    const r = (n >> 16) & 0xff;
    const g = (n >> 8) & 0xff;
    const b = n & 0xff;
    const { h, s } = rgbToHsl(r, g, b);
    const textLight = '#e8eae8';
    const today = hslToRgb((h + 40) % 360, Math.min(0.5, s * 1.2), 0.22);
    const week = hslToRgb((h + 80) % 360, Math.min(0.45, s * 1.1), 0.2);
    const later = hslToRgb(h, 0.08, 0.14);
    return {
        columnTodayBg: rgbToHex(today.r, today.g, today.b),
        columnTodayText: textLight,
        columnWeekBg: rgbToHex(week.r, week.g, week.b),
        columnWeekText: textLight,
        columnLaterBg: rgbToHex(later.r, later.g, later.b),
        columnLaterText: textLight,
    };
}
export async function deriveThemeFromImage(imageUrl: string): Promise<ThemeVars> {
    const img = new Image();
    img.decoding = 'async';
    img.src = imageUrl;
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image_load_failed'));
    });
    const canvas = document.createElement('canvas');
    const size = 56;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx)
        throw new Error('no_canvas');
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;
    let best = { score: -1, r: 37, g: 99, b: 235 };
    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 220)
            continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        rSum += r;
        gSum += g;
        bSum += b;
        count += 1;
        const hsl = rgbToHsl(r, g, b);
        const lum = luminance(r, g, b);
        const sat = hsl.s;
        const lScore = 1 - Math.abs(lum - 0.55) * 1.6;
        const score = sat * 1.4 + clamp01(lScore);
        if (sat > 0.25 && lum > 0.12 && lum < 0.92 && score > best.score) {
            best = { score, r, g, b };
        }
    }
    const avgR = count ? rSum / count : 240;
    const avgG = count ? gSum / count : 243;
    const avgB = count ? bSum / count : 246;
    const avgLum = luminance(avgR, avgG, avgB);
    const isDark = avgLum < 0.42;
    const accent = darkenHex(rgbToHex(best.r, best.g, best.b), 0.86);
    const text = isDark ? '#f1f5f9' : '#0f172a';
    const muted = isDark ? 'rgba(226,232,240,0.88)' : 'rgba(15,23,42,0.62)';
    const surface = isDark
        ? darkChromeFromPhotoHue(avgR, avgG, avgB, 0.118, 0.86)
        : 'rgba(240,241,243,0.94)';
    const surface2 = isDark
        ? darkChromeFromPhotoHue(avgR, avgG, avgB, 0.096, 0.9)
        : 'rgba(232,234,237,0.96)';
    const panelBg = isDark ? '#1e293b' : '#ffffff';
    const border = isDark ? 'rgba(148,163,184,0.58)' : 'rgba(148,163,184,0.38)';
    const shadow = isDark ? '0 14px 34px rgba(0,0,0,0.52)' : '0 14px 34px rgba(15,23,42,0.18)';
    const navShadow = isDark ? '0 8px 22px rgba(0,0,0,0.48)' : '0 8px 18px rgba(15,23,42,0.12)';
    const headerBg = isDark
        ? darkChromeFromPhotoHue(avgR, avgG, avgB, 0.078, 0.94)
        : 'rgba(238,240,243,0.95)';
    const columns = deriveColumnColors(accent);
    return { isDark, accent, text, muted, surface, surface2, panelBg, border, shadow, headerBg, navShadow, ...columns };
}
