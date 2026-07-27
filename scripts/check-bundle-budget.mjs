#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const distDir = path.join(process.cwd(), 'dist');
const assetsDir = path.join(distDir, 'assets');
const htmlPath = path.join(distDir, 'index.html');

const limits = {
    initialJsKb: 1100,
    initialJsGzipKb: 330,
    initialCssKb: 360,
    initialCssGzipKb: 65,
    ordinaryJsChunkKb: 700,
    cssChunkKb: 360,
};

const optionalChunkLimits = [
    { prefix: 'pdf-lib-', rawKb: 1150, gzipKb: 520 },
    { prefix: 'exceljs-', rawKb: 560, gzipKb: 175 },
    { prefix: 'recharts-', rawKb: 410, gzipKb: 125 },
    { prefix: 'docx-', rawKb: 380, gzipKb: 115 },
];

if (!fs.existsSync(assetsDir) || !fs.existsSync(htmlPath)) {
    console.error('[bundle-budget] dist output not found — run npm run build first');
    process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const indexHtml = fs.readFileSync(htmlPath, 'utf8');
const initialAssets = [...indexHtml.matchAll(/(?:src|href)=["'][^"']*\/assets\/([^"']+\.(?:js|css))["']/g)]
    .map((match) => match[1]);
const uniqueInitialAssets = [...new Set(initialAssets)];
let failed = false;

function measure(file) {
    const raw = fs.readFileSync(path.join(assetsDir, file));
    return {
        file,
        rawKb: raw.length / 1024,
        gzipKb: gzipSync(raw).length / 1024,
    };
}

function fail(message) {
    failed = true;
    console.error(`[bundle-budget] FAIL ${message}`);
}

function pass(message) {
    console.log(`[bundle-budget] OK ${message}`);
}

function checkTotal(label, measured, rawLimit, gzipLimit) {
    const rawKb = measured.reduce((sum, item) => sum + item.rawKb, 0);
    const gzipKb = measured.reduce((sum, item) => sum + item.gzipKb, 0);
    const detail = `${label}: ${rawKb.toFixed(1)} KB / gzip ${gzipKb.toFixed(1)} KB (${measured.map((item) => item.file).join(', ')})`;
    if (rawKb > rawLimit || gzipKb > gzipLimit)
        fail(`${detail}; limits ${rawLimit} KB / gzip ${gzipLimit} KB`);
    else
        pass(detail);
}

const initialMeasured = uniqueInitialAssets
    .filter((file) => fs.existsSync(path.join(assetsDir, file)))
    .map(measure);
const initialJs = initialMeasured.filter((item) => item.file.endsWith('.js'));
const initialCss = initialMeasured.filter((item) => item.file.endsWith('.css'));

checkTotal('initial JS', initialJs, limits.initialJsKb, limits.initialJsGzipKb);
checkTotal('initial CSS', initialCss, limits.initialCssKb, limits.initialCssGzipKb);

for (const { prefix } of optionalChunkLimits) {
    const eagerlyLoaded = initialJs.find((item) => item.file.startsWith(prefix));
    if (eagerlyLoaded)
        fail(`${eagerlyLoaded.file} is an optional heavy chunk but is preloaded by index.html`);
}

for (const limit of optionalChunkLimits) {
    const matches = files.filter((file) => file.startsWith(limit.prefix) && file.endsWith('.js'));
    if (matches.length === 0) {
        console.warn(`[bundle-budget] optional chunk not emitted: ${limit.prefix}*.js`);
        continue;
    }
    for (const file of matches) {
        const item = measure(file);
        if (item.rawKb > limit.rawKb || item.gzipKb > limit.gzipKb)
            fail(`${file}: ${item.rawKb.toFixed(1)} KB / gzip ${item.gzipKb.toFixed(1)} KB; limits ${limit.rawKb} KB / gzip ${limit.gzipKb} KB`);
        else
            pass(`${file}: ${item.rawKb.toFixed(1)} KB / gzip ${item.gzipKb.toFixed(1)} KB`);
    }
}

const optionalPrefixes = optionalChunkLimits.map((limit) => limit.prefix);
for (const file of files.filter((name) => name.endsWith('.js'))) {
    if (optionalPrefixes.some((prefix) => file.startsWith(prefix)))
        continue;
    const item = measure(file);
    if (item.rawKb > limits.ordinaryJsChunkKb)
        fail(`${file}: ${item.rawKb.toFixed(1)} KB exceeds the ordinary JS chunk limit ${limits.ordinaryJsChunkKb} KB`);
}

for (const file of files.filter((name) => name.endsWith('.css'))) {
    const item = measure(file);
    if (item.rawKb > limits.cssChunkKb)
        fail(`${file}: ${item.rawKb.toFixed(1)} KB exceeds the CSS chunk limit ${limits.cssChunkKb} KB`);
}

process.exit(failed ? 1 : 0);
