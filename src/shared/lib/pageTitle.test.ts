import { describe, expect, it } from 'vitest';
import { resolvePageTitleSection } from './pageTitle';

const t = (key: string) => {
    const map: Record<string, string> = {
        'brand.title': 'Тикет-система',
        'brand.subtitle': 'Kosta Legal',
        'nav.home': 'Главная',
        'nav.timeTracking': 'Учёт времени',
        'nav.tickets': 'IT-заявки',
        'pageTitle.login': 'Вход',
        'timeTrackingPage.tabs.reports': 'Отчёты',
    };
    return map[key] ?? key;
};

describe('resolvePageTitleSection', () => {
    it('returns home title on /home', () => {
        expect(resolvePageTitleSection('/home', '', t)).toBe('Главная');
    });

    it('returns login title on /', () => {
        expect(resolvePageTitleSection('/', '', t)).toBe('Вход');
    });

    it('returns time tracking tab title when tab query is present', () => {
        expect(resolvePageTitleSection('/time-tracking', '?tab=reports', t)).toBe('Отчёты');
    });

    it('returns section title for static routes', () => {
        expect(resolvePageTitleSection('/tickets', '', t)).toBe('IT-заявки');
    });
});
