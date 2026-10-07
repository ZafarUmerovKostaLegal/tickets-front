import { Buffer } from 'buffer';
if (typeof globalThis !== 'undefined') {
    const g = globalThis;
    if (g.Buffer == null) {
        g.Buffer = Buffer;
    }
    if (g.global == null) {
        g.global = globalThis;
    }
}
