#!/usr/bin/env node
/**
 * Puts what the installers need next to the add-in in dist/, so the Hub serves it at
 * https://tickets.kostalegal.com/outlook-addin/…
 *   manifests/*.xml          — Windows / macOS installers refresh from here; the Outlook
 *                              organisation deployment reads the manifest by URL
 *   install-mac.sh           — curl -fsSL …/install-mac.sh | bash
 *   KostaFileForOffice.exe   — when built beforehand with `npm run installer` (Windows only)
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
mkdirSync(join(dist, 'manifests'), { recursive: true });
for (const name of ['KostaFile.manifest.xml', 'KostaFile.Office.manifest.xml'])
  copyFileSync(join(root, name), join(dist, 'manifests', name));
copyFileSync(join(root, 'installer', 'mac', 'install-mac.sh'), join(dist, 'install-mac.sh'));
const exe = join(root, 'installer', 'out', 'KostaFileForOffice.exe');
if (existsSync(exe))
  copyFileSync(exe, join(dist, 'KostaFileForOffice.exe'));
console.log(`installer files → dist (manifests, install-mac.sh${existsSync(exe) ? ', KostaFileForOffice.exe' : ''})`);
