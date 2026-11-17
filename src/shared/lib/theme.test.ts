/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY, applyTheme, getInitialTheme } from './theme';

describe('theme', () => {
    afterEach(() => {
        window.localStorage.clear();
        document.body.removeAttribute('data-theme');
        vi.unstubAllGlobals();
    });

    it('prefers the stored theme', () => {
        window.localStorage.setItem(THEME_KEY, 'dark');
        expect(getInitialTheme()).toBe('dark');
    });

    it('falls back to the system preference and ignores invalid values', () => {
        window.localStorage.setItem(THEME_KEY, 'purple');
        vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('dark') }));
        window.matchMedia = globalThis.matchMedia;
        expect(getInitialTheme()).toBe('dark');
    });

    it('applies the theme to the body and persists it', () => {
        applyTheme('dark');
        expect(document.body.getAttribute('data-theme')).toBe('dark');
        expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
    });
});
