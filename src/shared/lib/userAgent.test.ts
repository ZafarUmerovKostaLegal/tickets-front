import { describe, expect, it } from 'vitest';
import { describeUserAgent } from './userAgent';

describe('describeUserAgent', () => {
    it.each([
        ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', 'Chrome', 'Windows', 'desktop'],
        ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0', 'Edge', 'Windows', 'desktop'],
        ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', 'Safari', 'iPhone', 'phone'],
        ['Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36', 'Chrome', 'Android', 'phone'],
        ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 'Safari', 'macOS', 'desktop'],
        ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0', 'Firefox', 'macOS', 'desktop'],
        ['', '', '', 'desktop'],
    ])('%s', (ua, browser, os, kind) => {
        expect(describeUserAgent(ua)).toEqual({ browser, os, kind });
    });
});
