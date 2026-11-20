import { describe, expect, it } from 'vitest';
import { upstreamReason } from '../api';

describe('upstreamReason', () => {
    it('unwraps the service detail nested inside the gateway detail', () => {
        const body = JSON.stringify({ detail: JSON.stringify({ detail: 'Backfill already running' }) });
        expect(upstreamReason(body)).toBe('Backfill already running');
    });

    it('reads FastAPI validation lists', () => {
        const inner = JSON.stringify({ detail: [{ loc: ['query', 'year'], msg: 'Input should be a valid integer' }] });
        expect(upstreamReason(JSON.stringify({ detail: inner }))).toBe('year: Input should be a valid integer');
    });

    it('ignores HTML error pages', () => {
        expect(upstreamReason('<html><body>502 Bad Gateway</body></html>')).toBe('');
    });
});
