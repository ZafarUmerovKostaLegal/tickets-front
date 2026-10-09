import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'public', 'twemoji');
const marker = path.join(dest, 'svg', '1f525.svg');

if (fs.existsSync(marker)) {
    console.log('[twemoji] assets already present at public/twemoji');
    process.exit(0);
}

const packageAssets = path.join(root, 'node_modules', 'twemoji', 'assets');
const packageMarker = path.join(packageAssets, 'svg', '1f525.svg');
if (!fs.existsSync(packageMarker)) {
    console.error('[twemoji] node_modules/twemoji/assets is missing; emoji images will be absent');
    process.exit(0);
}

fs.cpSync(packageAssets, dest, { recursive: true });
console.log('[twemoji] copied from node_modules/twemoji');
