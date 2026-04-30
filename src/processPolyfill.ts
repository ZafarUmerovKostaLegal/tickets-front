
/** Пакет `process` не поставляет типы для `browser.js`. */
// @ts-expect-error — типы для browser-энтри отсутствуют
import process from 'process/browser.js';

if (typeof globalThis !== 'undefined') {
    const g = globalThis as typeof globalThis & { process?: typeof process };
    if (g.process == null)
        g.process = process;
}
