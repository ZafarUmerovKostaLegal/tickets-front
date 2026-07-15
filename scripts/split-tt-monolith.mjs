/**
 * Split time-tracking api/monolith.ts into domain modules under api/domains/.
 * Run: node scripts/split-tt-monolith.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, '../src/entities/time-tracking/api');
const domainsDir = path.join(apiDir, 'domains');
const monolithPath = path.join(apiDir, 'monolith.ts');
const backupPath = path.join(apiDir, 'monolith.ts.bak');

if (!fs.existsSync(monolithPath)) {
  console.error('monolith.ts missing');
  process.exit(1);
}

const existing = fs.readFileSync(monolithPath, 'utf8');
if (existing.includes("export * from './domains/httpShared'")) {
  console.log('Already split; nothing to do.');
  process.exit(0);
}

fs.mkdirSync(domainsDir, { recursive: true });
fs.copyFileSync(monolithPath, backupPath);
const lines = existing.split(/\r?\n/);
while (lines.length && lines[lines.length - 1] === '') lines.pop();

function sliceRanges(ranges, skip = new Set()) {
  const out = [];
  for (const [a, b] of ranges) {
    for (let i = a; i <= b; i++) {
      if (skip.has(i)) continue;
      out.push(lines[i - 1]);
    }
    out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function promoteExports(src) {
  return src
    .replace(/^(?!export )async function /gm, 'export async function ')
    .replace(/^(?!export )function /gm, 'export function ')
    .replace(/^(?!export )const ([A-Za-z_][A-Za-z0-9_]*) = /gm, 'export const $1 = ');
}

const skipDashNum = new Set();
for (let i = 2573; i <= 2580; i++) skipDashNum.add(i);
const skipClientsMerge = new Set();
for (let i = 3095; i <= 3115; i++) skipClientsMerge.add(i);
const skipReportsThrow = new Set();
for (let i = 3441; i <= 3461; i++) skipReportsThrow.add(i);

const domains = [
  {
    file: 'httpShared.ts',
    header: '',
    body: () => {
      const main = sliceRanges([[24, 87], [273, 364], [3309, 3312]]);
      const dash = sliceRanges([[2573, 2580]]);
      const reportsThrow = sliceRanges([[3441, 3461]]);
      return promoteExports(main + '\n' + dash + '\n' + reportsThrow);
    },
  },
  {
    file: 'usersAndRates.ts',
    header: `import { apiFetch } from '@shared/api';
import type { User } from '@entities/user';
import { reportCacheInvalidateAll as _invalidateReportCache } from '../../lib/reportApiCache';
import { throwIfNotOk } from './httpShared';
`,
    body: () => promoteExports(sliceRanges([
      [88, 166], [258, 272], [365, 501], [585, 637], [819, 945],
    ])),
  },
  {
    file: 'timeEntries.ts',
    header: `import { apiFetch } from '@shared/api';
import { absorbTimeEntryRowEditUnlockHint, recordTimeEntryEditUnlockExpiry } from '../../lib/timeEntryEditUnlockStorage';
import { reportCacheInvalidateAll as _invalidateReportCache } from '../../lib/reportApiCache';
import { throwIfNotOk } from './httpShared';
`,
    body: () => promoteExports(sliceRanges([[168, 257], [648, 818]])),
  },
  {
    file: 'clients.ts',
    header: `import { apiFetch } from '@shared/api';
import {
    getTimeTrackingCached,
    setTimeTrackingCached,
} from '../../lib/timeTrackingListCache';
import { isActiveTimeManagerClientRow } from '../../lib/projectTimeEntry';
import {
    type PaginatedResult,
    type TimeTrackingPaginationParams,
    parseTimeTrackingPagedResponse,
    unwrapTimeTrackingListArray,
    throwIfNotOk,
} from './httpShared';
`,
    body: () => promoteExports(sliceRanges([
      [1230, 1513], [1629, 1702], [3095, 3115],
    ])),
  },
  {
    file: 'teamsAndLabor.ts',
    header: `import { apiFetch } from '@shared/api';
import { throwIfNotOk } from './httpShared';
import { readTimeTrackingUserStr } from './usersAndRates';
`,
    body: () => promoteExports(sliceRanges([
      [502, 584], [638, 647], [1704, 2271],
    ])),
  },
  {
    file: 'projects.ts',
    header: `import { apiFetch } from '@shared/api';
import {
    getTimeTrackingCached,
    setTimeTrackingCached,
    invalidateTimeTrackingListCache,
} from '../../lib/timeTrackingListCache';
import { isActiveTimeManagerProjectRow } from '../../lib/projectTimeEntry';
import {
    type PaginatedResult,
    type TimeTrackingPaginationParams,
    parseTimeTrackingPagedResponse,
    unwrapTimeTrackingListArray,
    throwIfNotOk,
    dashNum,
} from './httpShared';
`,
    body: () => promoteExports(sliceRanges(
      [[1514, 1628], [2273, 3094], [3116, 3308]],
      new Set([...skipDashNum, ...skipClientsMerge]),
    )),
  },
  {
    file: 'projectAccess.ts',
    header: `import { apiFetch } from '@shared/api';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { reportCacheInvalidateAll as _invalidateReportCache } from '../../lib/reportApiCache';
import { throwIfNotOk } from './httpShared';
import { listTimeTrackingUsers, type TimeTrackingUserRow } from './usersAndRates';
import {
    listAllClientProjectsMerged,
    type TimeManagerClientProjectRow,
    type TimeManagerProjectDashboardTeamMember,
} from './projects';
`,
    body: () => promoteExports(sliceRanges([[946, 1229]])),
  },
  {
    file: 'reports.ts',
    header: `import { apiFetch } from '@shared/api';
import { pickAllowedSnapshotOverrides } from '../../lib/reportSnapshotOverrides';
import {
    reportCacheGet,
    reportCacheSet,
} from '../../lib/reportApiCache';
import { buildReportDownloadFilename, reportExportProjectFallback } from '../../lib/reportDownloadFilename';
import { displayReportClientLabel, displayReportProjectLabel } from '../../lib/expenseReportDisplay';
import {
    reportsThrowIfNotOk,
} from './httpShared';
import { listAllTimeManagerClientsMerged, type TimeManagerClientRow } from './clients';
import { listAllClientProjectsMerged, type TimeManagerClientProjectRow } from './projects';
`,
    body: () => promoteExports(sliceRanges(
      [[3313, 3641], [4940, 6182]],
      skipReportsThrow,
    )),
  },
  {
    file: 'partnerConfirmations.ts',
    header: `import { apiFetch } from '@shared/api';
import { invalidatePartnerReportConfirmationsPendingCache } from '../partnerReportConfirmationsPending';
import {
    TimeTrackingHttpError,
    reportsThrowIfNotOk,
} from './httpShared';
`,
    body: () => promoteExports(sliceRanges([[3644, 4127]])),
  },
  {
    file: 'invoices.ts',
    header: `import { apiFetch } from '@shared/api';
import { throwIfNotOk, dashNum } from './httpShared';
`,
    body: () => promoteExports(sliceRanges([[4128, 4939]])),
  },
];

for (const d of domains) {
  const content = `${d.header.trim()}\n\n${d.body()}`.replace(/^\n+/, '');
  fs.writeFileSync(path.join(domainsDir, d.file), content.startsWith('import') || content.startsWith('export') ? content : content.replace(/^\n*/, ''), 'utf8');
  const final = (d.header ? d.header.trim() + '\n\n' : '') + d.body();
  fs.writeFileSync(path.join(domainsDir, d.file), final, 'utf8');
  console.log('wrote domains/' + d.file, final.split('\n').length, 'lines');
}

const barrel = `/** Thin barrel — implementations live under ./domains. */
export * from './domains/httpShared';
export * from './domains/usersAndRates';
export * from './domains/timeEntries';
export * from './domains/clients';
export * from './domains/teamsAndLabor';
export * from './domains/projects';
export * from './domains/projectAccess';
export * from './domains/reports';
export * from './domains/partnerConfirmations';
export * from './domains/invoices';

export { invalidateTimeTrackingListCache } from '../lib/timeTrackingListCache';
export { reportCacheInvalidateAll as invalidateReportApiCache } from '../lib/reportApiCache';
`;

fs.writeFileSync(monolithPath, barrel, 'utf8');
console.log('monolith.ts → barrel; backup at', backupPath);
