#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.join(process.cwd(), 'src/pages/time-tracking/ui/TimeTrackingPage.css');
const lines = fs.readFileSync(cssPath, 'utf8').split('\n');

const ranges = [
    { file: 'TimesheetPanel.css', start: 8657, end: 14354 },
    { file: 'ReportsPanel.css', start: 14356, end: 15829 },
    { file: 'StatisticsPanel.css', start: 15832, end: lines.length },
];

const extracted = new Set();
for (const { file, start, end } of ranges) {
    const slice = lines.slice(start - 1, end).join('\n');
    fs.writeFileSync(path.join(process.cwd(), 'src/pages/time-tracking/ui', file), slice + '\n');
    for (let i = start - 1; i < end; i++)
        extracted.add(i);
}

const chartsFallback = lines[39];
const remaining = lines.filter((_, i) => !extracted.has(i));
fs.writeFileSync(cssPath, remaining.join('\n'));

const statsPath = path.join(process.cwd(), 'src/pages/time-tracking/ui/StatisticsPanel.css');
const statsContent = fs.readFileSync(statsPath, 'utf8');
if (!statsContent.includes('charts-fallback')) {
    fs.writeFileSync(statsPath, chartsFallback + '\n\n' + statsContent);
}

console.log('[split-tt-panel-css] extracted', ranges.map((r) => r.file).join(', '));
