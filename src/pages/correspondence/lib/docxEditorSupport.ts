/** Runtime checks for @docx-editor.dev (HarfBuzz WASM + modern JS). */
export function canRunInBrowserDocxEditor(): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined')
        return false;
    if (typeof WebAssembly !== 'object' || typeof WebAssembly.instantiate !== 'function')
        return false;
    // HarfBuzz glue uses BigInt typed arrays (Safari 15+ / Chromium ~67+ / Firefox 68+).
    if (typeof BigInt64Array === 'undefined' || typeof BigUint64Array === 'undefined')
        return false;
    return true;
}

export const DOCX_EDITOR_BROWSER_HINT =
    'Встроенный редактор работает в Chrome / Edge 89+, Firefox 89+ и Safari 15+. '
    + 'На старых браузерах используйте «Word Online» или загрузите готовый .docx.';
