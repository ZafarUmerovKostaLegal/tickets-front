import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'src/pages/time-tracking/ui');
const cssPath = path.join(dir, 'TimeTrackingPage.css');
const lines = fs.readFileSync(cssPath, 'utf8').split('\n');

const shellRanges = [[304, 318], [397, 894], [1437, 1464], [1467, 1497], [5039, 5110]];
const formsRange = [5859, 6824];
const accent = [
    '',
    '.tt-reports__btn--accent {',
    '  background: var(--app-accent, #4f46e5);',
    '  color: #fff;',
    '  border: 1px solid transparent;',
    '}',
    '',
    '.tt-reports__btn--accent:hover {',
    '  background: #4338ca;',
    '}',
];

const extracted = new Set();
const shellParts = [];
for (const [start, end] of shellRanges) {
    shellParts.push(lines.slice(start - 1, end).join('\n'));
    for (let i = start - 1; i < end; i++)
        extracted.add(i);
}
shellParts.push(accent.join('\n'));
fs.writeFileSync(path.join(dir, 'TimePageShell.css'), `${shellParts.join('\n\n')}\n`);

const formsSlice = lines.slice(formsRange[0] - 1, formsRange[1]);
fs.writeFileSync(path.join(dir, 'TimeTrackingForms.css'), `${formsSlice.join('\n')}\n`);
for (let i = formsRange[0] - 1; i < formsRange[1]; i++)
    extracted.add(i);

const remaining = lines.filter((_, i) => !extracted.has(i));
const header = "@import './TimePageShell.css';\n@import './TimeTrackingForms.css';\n\n";
fs.writeFileSync(cssPath, header + remaining.join('\n'));

console.log('[extract-tt-css] shell + forms extracted, remaining lines:', remaining.length);
