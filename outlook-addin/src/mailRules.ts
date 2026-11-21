import { createMailRule, type MailRuleDto } from './api';
import { saveSettings, type FilingRule } from './settings';

export function toFilingRule(rule: MailRuleDto): FilingRule {
  return {
    id: rule.id,
    match: rule.match.includes('@') ? rule.match : `@${rule.match}`,
    matterId: rule.matterId,
    matterName: rule.matterName,
    clientName: rule.clientName,
    folderId: rule.folderId,
    folderPath: rule.folderId ? [{ id: rule.folderId, name: rule.folderPath }] : [],
    autoFile: true,
    enabled: rule.enabled,
    scope: rule.scope,
    canEdit: rule.canEdit,
  };
}

export async function migrateLocalRules(local: FilingRule[]): Promise<number> {
  let moved = 0;
  const left: FilingRule[] = [];
  for (const rule of local) {
    try {
      await createMailRule({ match: rule.match, matterId: rule.matterId, folderId: rule.folderId ?? null });
      moved += 1;
    } catch {
      left.push(rule);
    }
  }
  saveSettings({ rules: left });
  return moved;
}
