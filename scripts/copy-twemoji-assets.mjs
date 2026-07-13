
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dest = path.join(root, 'public', 'twemoji');
const marker = path.join(dest, 'svg', '1f525.svg');

if (fs.existsSync(marker)) {
    console.log('[twemoji] assets already present at public/twemoji');
    process.exit(0);
}

const cacheDir = path.join(root, 'node_modules', '.twemoji-cache');
const archivePath = path.join(cacheDir, 'twemoji-14.0.2.tar.gz');
const TWEMOJI_TAG = 'v14.0.2';
const DOWNLOAD_URL = `https://github.com/twitter/twemoji/archive/refs/tags/${TWEMOJI_TAG}.tar.gz`;

fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(dest, { recursive: true });

console.log('[twemoji] downloading assets…');
const res = await fetch(DOWNLOAD_URL);
if (!res.ok) {
    console.error(`[twemoji] download failed: HTTP ${res.status}`);
    process.exit(1);
}
await pipeline(res.body, createWriteStream(archivePath));

const extractDir = path.join(cacheDir, 'extract');
fs.rmSync(extractDir, { recursive: true, force: true });
fs.mkdirSync(extractDir, { recursive: true });

execSync(`tar -xzf "${archivePath}" -C "${extractDir}"`, { stdio: 'inherit' });

const assetsSrc = path.join(extractDir, `twemoji-${TWEMOJI_TAG.slice(1)}`, 'assets');
if (!fs.existsSync(assetsSrc)) {
    console.error('[twemoji] assets folder not found in archive');
    process.exit(1);
}

fs.cpSync(assetsSrc, dest, { recursive: true });
console.log('[twemoji] copied to public/twemoji');
