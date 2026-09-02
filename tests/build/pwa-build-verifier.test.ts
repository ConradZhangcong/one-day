import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];
const verifier = path.resolve('scripts/verify-pwa-build.mjs');

async function createFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'one-day-pwa-'));
  temporaryDirectories.push(directory);
  const icons = [
    'pwa-192x192.png',
    'pwa-512x512.png',
    'pwa-maskable-512x512.png',
    'apple-touch-icon.png',
  ];
  for (const icon of icons)
    await cp(path.resolve('public', icon), path.join(directory, icon));
  await writeFile(
    path.join(directory, 'manifest.webmanifest'),
    JSON.stringify({
      id: '/',
      name: 'One Day · 轻量规划',
      short_name: 'One Day',
      description: '本地优先的个人待办与多维日历应用',
      lang: 'zh-CN',
      scope: '/',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#1f1f1f',
      icons: [
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: 'pwa-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    }),
  );
  await writeFile(
    path.join(directory, 'index.html'),
    '<link rel="manifest"><link rel="apple-touch-icon"><meta name="theme-color">',
  );
  await writeFile(path.join(directory, 'workbox-fixture.js'), 'workbox');
  await writeFile(
    path.join(directory, 'sw.js'),
    ['index.html', 'manifest.webmanifest', ...icons].join('\n'),
  );
  return directory;
}

function verify(directory: string) {
  return spawnSync(process.execPath, [verifier, directory], { encoding: 'utf8' });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('PWA build verifier', () => {
  it('accepts a complete build contract', async () => {
    const directory = await createFixture();
    const result = verify(directory);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('PWA build verified');
  });

  it('rejects manifest drift and missing assets', async () => {
    const directory = await createFixture();
    const manifestPath = path.join(directory, 'manifest.webmanifest');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<
      string,
      unknown
    >;
    manifest.start_url = '/today';
    await writeFile(manifestPath, JSON.stringify(manifest));
    const manifestResult = verify(directory);
    expect(manifestResult.status).not.toBe(0);
    expect(manifestResult.stderr).toContain('manifest start_url must be');

    const freshDirectory = await createFixture();
    await rm(path.join(freshDirectory, 'pwa-512x512.png'));
    const assetResult = verify(freshDirectory);
    expect(assetResult.status).not.toBe(0);
    expect(assetResult.stderr).toContain('pwa-512x512.png');
  });
});
