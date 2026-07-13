import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'src/pages/time-tracking/ui');
const cssPath = path.join(dir, 'TimeTrackingPage.css');
const lines = fs.readFileSync(cssPath, 'utf8').split('\n');

const usersRange = [1194, 2022];
const usersSlice = lines.slice(usersRange[0] - 1, usersRange[1]);
fs.writeFileSync(path.join(dir, 'TimeUsersShared.css'), `${usersSlice.join('\n')}\n`);

const extracted = new Set();
for (let i = usersRange[0] - 1; i < usersRange[1]; i++)
    extracted.add(i);

const importLine = "@import './TimeUsersShared.css';";
let headerEnd = 0;
while (headerEnd < lines.length && (lines[headerEnd].startsWith('@import') || lines[headerEnd].trim() === ''))
    headerEnd += 1;

const header = lines.slice(0, headerEnd);
if (!header.some((line) => line.includes('TimeUsersShared.css')))
    header.splice(header.length - 1, 0, importLine);

const body = lines.slice(headerEnd).filter((_, index) => !extracted.has(index + headerEnd));
fs.writeFileSync(cssPath, `${header.join('\n')}${body.join('\n')}`);

console.log('[extract-tt-users-css] wrote TimeUsersShared.css, lines:', usersSlice.length);
