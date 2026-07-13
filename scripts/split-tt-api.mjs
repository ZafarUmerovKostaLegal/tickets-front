#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const apiPath = path.join(root, 'src/entities/time-tracking/api.ts');
const outDir = path.join(root, 'src/entities/time-tracking/api');
const lines = fs.readFileSync(apiPath, 'utf8').split('\n');

const headerEnd = 19;
const header = lines.slice(0, headerEnd).join('\n');

const chunks = [
    { name: 'shared.ts', start: 20, end: 113 },
    { name: 'users-entries.ts', start: 114, end: 1147 },
    { name: 'clients-teams.ts', start: 1148, end: 1804 },
    { name: 'projects-stats.ts', start: 1805, end: 3251 },
    { name: 'reports-invoices.ts', start: 3252, end: lines.length },
];

fs.mkdirSync(outDir, { recursive: true });

for (const chunk of chunks) {
    const body = lines.slice(chunk.start - 1, chunk.end).join('\n');
    const needsShared = chunk.name !== 'shared.ts';
    const imports = needsShared
        ? `${header}\nimport {\n    parseTimeTrackingPagedResponse,\n    unwrapTimeTrackingListArray,\n    type PaginatedResult,\n    type TimeTrackingPaginationParams,\n} from './shared';\n`
        : `${header}\n`;
    fs.writeFileSync(path.join(outDir, chunk.name), `${imports}\n${body}\n`);
}

const indexBody = chunks.map((c) => `export * from './${c.name.replace('.ts', '')}';`).join('\n');
fs.writeFileSync(path.join(outDir, 'index.ts'), `${indexBody}\n`);

const shim = `export * from './api/index';\n`;
fs.writeFileSync(apiPath, shim);

console.log('[split-tt-api] wrote', chunks.length, 'modules to', outDir);
