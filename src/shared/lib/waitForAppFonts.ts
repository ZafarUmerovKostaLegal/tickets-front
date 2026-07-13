import { isTauriMobileBuild } from '@shared/config/tauriPlatform';

const APP_FONT_FAMILY = 'Montserrat';
const APP_FONT_WEIGHTS = [400, 500, 600, 700, 800] as const;
const FONT_WAIT_TIMEOUT_MS = 2500;

export async function waitForAppFonts(): Promise<void> {
    if (typeof document === 'undefined' || !document.fonts)
        return;

    if (isTauriMobileBuild()) {
        try {
            await Promise.race([
                document.fonts.ready,
                new Promise<void>((resolve) => setTimeout(resolve, 400)),
            ]);
        }
        catch {

        }
        return;
    }

    const timeout = new Promise<void>((resolve) => {
        setTimeout(resolve, FONT_WAIT_TIMEOUT_MS);
    });
    const loads = Promise.all(APP_FONT_WEIGHTS.map((weight) => document.fonts
        .load(`${weight} 1rem ${APP_FONT_FAMILY}`)
        .catch(() => undefined)));
    await Promise.race([loads, timeout]);
    try {
        await document.fonts.ready;
    }
    catch {

    }
}
