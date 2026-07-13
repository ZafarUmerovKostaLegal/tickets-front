#!/usr/bin/env node

import fs from 'node:fs';

import path from 'node:path';

import { gzipSync } from 'node:zlib';



const distAssets = path.join(process.cwd(), 'dist', 'assets');

const baselinePath = path.join(process.cwd(), 'scripts', 'bundle-budget-baseline.json');



const jsLimitsKb = {

    'index-': 900,

    'platform-': 700,

    'time-tracking-': 400,

    'tt-timesheet-': 450,

    'tt-reports-': 350,

    'tt-statistics-': 200,

    'tt-invoices-': 250,

    'recharts-': 400,

    'exceljs': 560,

};



const cssLimitsKb = {

    'index-': 120,

    'time-tracking-': 165,

    'tt-timesheet-': 220,

    'tt-reports-': 120,

    'tt-statistics-': 40,

};



if (!fs.existsSync(distAssets)) {

    console.error('[bundle-budget] dist/assets not found — run npm run build first');

    process.exit(1);

}



const files = fs.readdirSync(distAssets);

let failed = false;



function checkChunk(prefix, maxKb, ext) {

    const match = files.find((f) => f.startsWith(prefix) && f.endsWith(ext));

    if (!match) {

        console.warn(`[bundle-budget] skip: no chunk matching ${prefix}*.${ext}`);

        return null;

    }

    const filePath = path.join(distAssets, match);

    const raw = fs.readFileSync(filePath);

    const sizeKb = raw.length / 1024;

    const gzipKb = gzipSync(raw).length / 1024;

    if (sizeKb > maxKb) {

        console.error(`[bundle-budget] FAIL ${match}: ${sizeKb.toFixed(1)} KB > ${maxKb} KB (gzip ${gzipKb.toFixed(1)} KB)`);

        failed = true;

    }

    else {

        console.log(`[bundle-budget] OK ${match}: ${sizeKb.toFixed(1)} KB / gzip ${gzipKb.toFixed(1)} KB (limit ${maxKb} KB)`);

    }

    return { match, sizeKb, gzipKb };

}



const measured = {};

for (const [prefix, maxKb] of Object.entries(jsLimitsKb)) {

    const result = checkChunk(prefix, maxKb, '.js');

    if (result)

        measured[result.match] = { sizeKb: result.sizeKb, gzipKb: result.gzipKb };

}

for (const [prefix, maxKb] of Object.entries(cssLimitsKb)) {

    const result = checkChunk(prefix, maxKb, '.css');

    if (result)

        measured[result.match] = { sizeKb: result.sizeKb, gzipKb: result.gzipKb };

}



if (fs.existsSync(baselinePath)) {

    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

    for (const [file, prev] of Object.entries(baseline)) {

        const cur = measured[file];

        if (!cur || !prev || typeof prev !== 'object')

            continue;

        const prevSize = Number(prev.sizeKb);

        if (!Number.isFinite(prevSize))

            continue;

        const growth = cur.sizeKb - prevSize;

        const maxGrowthKb = Math.max(40, prevSize * 0.08);

        if (growth > maxGrowthKb) {

            console.error(`[bundle-budget] REGRESSION ${file}: +${growth.toFixed(1)} KB vs baseline (max +${maxGrowthKb.toFixed(1)} KB)`);

            failed = true;

        }

    }

}

else {

    fs.writeFileSync(baselinePath, JSON.stringify(measured, null, 2) + '\n');

    console.log('[bundle-budget] wrote baseline', baselinePath);

}



process.exit(failed ? 1 : 0);

