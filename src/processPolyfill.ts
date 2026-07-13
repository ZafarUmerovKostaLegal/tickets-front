

import process from 'process/browser.js';

if (typeof globalThis !== 'undefined') {
    const g = globalThis as typeof globalThis & { process?: typeof process };
    if (g.process == null)
        g.process = process;
}
