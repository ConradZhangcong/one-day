import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputs = [
  { source: 'public/icon.svg', output: 'public/pwa-192x192.png', size: 192 },
  { source: 'public/icon.svg', output: 'public/pwa-512x512.png', size: 512 },
  {
    source: 'public/icon-maskable.svg',
    output: 'public/pwa-maskable-512x512.png',
    size: 512,
  },
  { source: 'public/icon.svg', output: 'public/apple-touch-icon.png', size: 180 },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const asset of outputs) {
    const svg = await readFile(new URL(`../${asset.source}`, import.meta.url), 'utf8');
    await page.setViewportSize({ width: asset.size, height: asset.size });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${svg}`,
    );
    await page.screenshot({ path: `${root}${asset.output}`, omitBackground: false });
  }
} finally {
  await browser.close();
}
