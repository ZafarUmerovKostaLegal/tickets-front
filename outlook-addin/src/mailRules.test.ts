import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMailRule = vi.fn();
const saveSettings = vi.fn();

vi.mock('./api', () => ({ createMailRule: (...args: unknown[]) => createMailRule(...args) }));
vi.mock('./settings', () => ({ saveSettings: (...args: unknown[]) => saveSettings(...args) }));

import { migrateLocalRules, toFilingRule } from './mailRules';
import type { FilingRule } from './settings';

const local = (match: string): FilingRule => ({
  id: match, match, matterId: 'm1', matterName: 'Falcon', clientName: 'Acme', folderId: null, folderPath: [], autoFile: true, enabled: true,
});

describe('server mail rules in the add-in', () => {
  beforeEach(() => {
    createMailRule.mockReset();
    saveSettings.mockReset();
  });

  it('shows domains with @ and keeps the shared / editable flags', () => {
    const rule = toFilingRule({
      id: 'r1', scope: 'shared', match: 'acme.com', matterId: 'm1', matterName: 'Falcon', matterCode: 'KL-1',
      clientId: 'c1', clientName: 'Acme', folderId: 'f1', folderPath: 'Correspondence / Court', enabled: true, hits: 3, canEdit: false,
    });
    expect(rule).toMatchObject({ match: '@acme.com', scope: 'shared', canEdit: false, folderPath: [{ id: 'f1', name: 'Correspondence / Court' }] });
  });

  it('moves local rules to the server and keeps the ones that failed', async () => {
    createMailRule.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('403'));
    const moved = await migrateLocalRules([local('ivan@acme.com'), local('@beta.com')]);
    expect(moved).toBe(1);
    expect(createMailRule).toHaveBeenCalledWith({ match: 'ivan@acme.com', matterId: 'm1', folderId: null });
    expect(saveSettings).toHaveBeenCalledWith({ rules: [expect.objectContaining({ match: '@beta.com' })] });
  });
});
