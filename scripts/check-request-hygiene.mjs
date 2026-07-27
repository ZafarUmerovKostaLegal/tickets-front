import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, 'src');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const DIRECT_FETCH_ALLOWLIST = new Set([
    'src/shared/api/client.ts',
    'src/shared/lib/auth.ts',
    'src/shared/lib/clientErrorReporter.ts',
    'src/shared/lib/queryCache.ts',
    'src/entities/expenses/model/cbuRates.ts',
    'src/entities/todo/lib/todoTheme.ts',
    'src/pages/invoice-preview/lib/invoiceCoverLogoRaster.ts',
    'src/pages/invoice-preview/lib/buildInvoicePreviewPdf.ts',
]);

async function collectFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory())
            return collectFiles(fullPath);
        return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
    }));
    return nested.flat();
}

function projectPath(file) {
    return path.relative(ROOT, file).replaceAll('\\', '/');
}

const files = await collectFiles(SOURCE_ROOT);
const violations = [];
const totals = {
    apiFetchCalls: 0,
    queryCaches: 0,
    abortControllers: 0,
    configuredReuseWindows: 0,
};

for (const file of files) {
    const rel = projectPath(file);
    const source = await readFile(file, 'utf8');
    totals.apiFetchCalls += source.match(/\bapiFetch\s*\(/g)?.length ?? 0;
    totals.queryCaches += source.match(/\bcreateQueryCache\s*</g)?.length ?? 0;
    totals.abortControllers += source.match(/new\s+AbortController\s*\(/g)?.length ?? 0;
    totals.configuredReuseWindows += source.match(/\bgetReuseWindowMs\s*:/g)?.length ?? 0;

    if (/\baxios\s*\./.test(source))
        violations.push(`${rel}: axios bypasses the shared request coordinator`);
    if (/\buseEffect\s*\(\s*async\b/.test(source))
        violations.push(`${rel}: async useEffect cannot cancel or clean up safely`);
    if (!DIRECT_FETCH_ALLOWLIST.has(rel) && /(^|[^\w.])fetch\s*\(/m.test(source))
        violations.push(`${rel}: direct fetch must go through shared apiFetch or be explicitly allowlisted`);
}

console.log(`[request-hygiene] apiFetch calls: ${totals.apiFetchCalls}`);
console.log(`[request-hygiene] query caches: ${totals.queryCaches}`);
console.log(`[request-hygiene] AbortController usages: ${totals.abortControllers}`);
console.log(`[request-hygiene] endpoint reuse policies: ${totals.configuredReuseWindows}`);

if (violations.length > 0) {
    for (const violation of violations)
        console.error(`[request-hygiene] ERROR ${violation}`);
    process.exitCode = 1;
}
else {
    console.log('[request-hygiene] OK request traffic stays behind the shared coordinator');
}
