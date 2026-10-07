import process from 'process/browser.js';
if (typeof globalThis !== 'undefined') {
    const g = globalThis;
    if (g.process == null)
        g.process = process;
}
