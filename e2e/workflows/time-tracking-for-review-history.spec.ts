import { test, expect } from '../fixtures/test';

const SHOTS = process.env.FM_SHOTS_DIR ?? '';

test.describe('@e2e Отчёты на проверке: история статусов', () => {
    test('показывает, когда сменили приоритет, и ленту событий', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await loginAs('admin');
        const item = {
            id: 'req-1', snapshotId: 's1', projectId: 'p1', dateFrom: '2026-11-01', dateTo: '2026-11-30',
            title: 'Fergana Hospital', status: 'pending_partners', reviewPriority: 'red', submittedByAuthUserId: 1,
            requiredPartnerAuthUserIds: [1, 2], pendingPartnerAuthUserIds: [2],
            signatures: [{ partnerAuthUserId: 1, confirmedAt: '2026-11-25T08:00:00Z' }],
            createdAt: '2026-11-25T04:23:00Z', updatedAt: '2026-11-25T05:40:00Z',
            priorityChangedAt: '2026-11-25T05:40:00Z', priorityChangedBy: 1,
            projectName: 'Fergana Hospital', clientName: 'Vision Invest',
        };
        await page.route('**/api/v1/time-tracking/reports/partner-confirmations/pending**', (route) => route.fulfill({ json: {
            items: [item], page: 1, pageSize: 25, total: 1, priorityCounts: { all: 1, red: 1, yellow: 0, green: 0 }, signaturePendingCount: 0,
        } }));
        await page.route('**/api/v1/time-tracking/reports/partner-confirmations/req-1/history', (route) => route.fulfill({ json: [
            { id: 'e1', kind: 'submitted', from: '', to: 'yellow', actorAuthUserId: 1, at: '2026-11-25T04:23:00Z' },
            { id: 'e2', kind: 'priority', from: 'yellow', to: 'red', actorAuthUserId: 1, at: '2026-11-25T05:40:00Z' },
            { id: 'e3', kind: 'signed', from: '', to: '1', actorAuthUserId: 1, at: '2026-11-25T08:00:00Z' },
        ] }));
        await page.goto('/time-tracking?tab=reports');
        await page.getByRole('tab', { name: /Сформированные для проверки/ }).click();
        await expect(page.locator('.tt-for-review__priority-since')).toBeVisible({ timeout: 30_000 });
        await page.getByRole('button', { name: 'История статусов' }).first().click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toContainText('Приоритет: Не срочно → Срочно');
        await expect(dialog.locator('.tt-frh__item')).toHaveCount(3);
        if (SHOTS) {
            await page.waitForTimeout(400);
            await page.screenshot({ path: `${SHOTS}/for-review-history.png` });
        }
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
    });
});
