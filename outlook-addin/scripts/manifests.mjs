#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = `${pkg.version.split('-')[0]}.0`.split('.').slice(0, 4).join('.');

const ENVIRONMENTS = {
  prod: {
    outDir: root,
    ADDIN_BASE: 'https://tickets.kostalegal.com/outlook-addin/',
    HUB_ORIGIN: 'https://tickets.kostalegal.com',
    API_ORIGIN: 'https://ticketsback.kostalegal.com',
    DISPLAY_NAME: 'Kosta File',
    OUTLOOK_ID: '8f3c2a1e-6b4d-4e9a-9c71-a1b2c3d4e5f6',
    OFFICE_ID: 'a7e91c2b-4d5f-4a8e-9b01-c2d3e4f5a6b7',
    AZURE_CLIENT_ID: '21243156-4591-4da5-9389-590363bb0cb3',
  },
  dev: {
    outDir: join(root, 'manifests', 'dev'),
    ADDIN_BASE: 'https://localhost:3001/outlook-addin/',
    HUB_ORIGIN: 'https://localhost:3001',
    API_ORIGIN: 'https://ticketsback.kostalegal.com',
    DISPLAY_NAME: 'Kosta File (dev)',
    OUTLOOK_ID: '8f3c2a1e-6b4d-4e9a-9c71-0000000000d1',
    OFFICE_ID: 'a7e91c2b-4d5f-4a8e-9b01-0000000000d2',
    AZURE_CLIENT_ID: '21243156-4591-4da5-9389-590363bb0cb3',
  },
};

const TEMPLATES = ['KostaFile.manifest.xml', 'KostaFile.Office.manifest.xml'];

function render(template, env) {
  const values = {
    ...env,
    VERSION: version,
    ADDIN_HOST: new URL(env.ADDIN_BASE).host,
    API_HOST: new URL(env.API_ORIGIN).host,
  };
  const out = template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (!(key in values))
      throw new Error(`Unknown placeholder ${match}`);
    return values[key];
  });
  if (out.includes('{{'))
    throw new Error('Unresolved placeholder left in manifest');
  return out;
}

function normalize(xml) {
  return xml.replace(/\s+/g, ' ').replace(/\s*(\/?>)\s*/g, '$1').trim();
}

const check = process.argv.includes('--check');
let drift = false;

for (const [name, env] of Object.entries(ENVIRONMENTS)) {
  for (const file of TEMPLATES) {
    const template = readFileSync(join(root, 'manifests', 'templates', file), 'utf8');
    const output = render(template, env);
    const target = join(env.outDir, file);
    if (check) {
      if (name !== 'prod')
        continue;
      const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
      if (normalize(current) !== normalize(output)) {
        drift = true;
        console.error(`✗ ${file} differs from manifests/templates — run "npm run manifests"`);
      }
      continue;
    }
    mkdirSync(env.outDir, { recursive: true });
    writeFileSync(target, output);
    console.log(`✓ ${name}: ${target.replace(root, '.')} (v${version})`);
  }
}

if (check) {
  if (drift)
    process.exit(1);
  console.log(`✓ manifests are in sync (v${version})`);
}
