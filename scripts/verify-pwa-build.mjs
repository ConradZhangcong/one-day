import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const EXPECTED_ICONS = [
  { src: 'pwa-192x192.png', sizes: '192x192', purpose: 'any' },
  { src: 'pwa-512x512.png', sizes: '512x512', purpose: 'any' },
  { src: 'pwa-maskable-512x512.png', sizes: '512x512', purpose: 'maskable' },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pngDimensions(bytes) {
  const signature = '89504e470d0a1a0a';
  assert(bytes.subarray(0, 8).toString('hex') === signature, 'asset is not a PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export async function verifyPwaBuild(distDirectory) {
  const manifestPath = path.join(distDirectory, 'manifest.webmanifest');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert(manifest.id === '/', 'manifest id must be /');
  assert(manifest.scope === '/', 'manifest scope must be /');
  assert(manifest.start_url === '/', 'manifest start_url must be /');
  assert(manifest.display === 'standalone', 'manifest display must be standalone');
  assert(manifest.lang === 'zh-CN', 'manifest language must be zh-CN');
  assert(manifest.theme_color === '#1f1f1f', 'manifest theme color drifted');
  assert(manifest.background_color === '#ffffff', 'manifest background color drifted');

  for (const expected of EXPECTED_ICONS) {
    const icon = manifest.icons?.find((candidate) => candidate.src === expected.src);
    assert(icon !== undefined, `manifest is missing ${expected.src}`);
    assert(icon.type === 'image/png', `${expected.src} must be image/png`);
    assert(
      icon.sizes === expected.sizes,
      `${expected.src} has the wrong size declaration`,
    );
    assert(icon.purpose === expected.purpose, `${expected.src} has the wrong purpose`);
    const bytes = await readFile(path.join(distDirectory, expected.src));
    const dimensions = pngDimensions(bytes);
    const expectedSize = Number(expected.sizes.split('x')[0]);
    assert(
      dimensions.width === expectedSize && dimensions.height === expectedSize,
      `${expected.src} pixels do not match its manifest declaration`,
    );
  }

  const appleIcon = await readFile(path.join(distDirectory, 'apple-touch-icon.png'));
  const appleDimensions = pngDimensions(appleIcon);
  assert(
    appleDimensions.width === 180 && appleDimensions.height === 180,
    'apple-touch-icon.png must be 180x180',
  );

  const html = await readFile(path.join(distDirectory, 'index.html'), 'utf8');
  assert(html.includes('rel="manifest"'), 'built HTML must link the manifest');
  assert(html.includes('rel="apple-touch-icon"'), 'built HTML must link the Apple icon');
  assert(html.includes('name="theme-color"'), 'built HTML must declare theme colors');

  const files = await readdir(distDirectory);
  assert(files.includes('sw.js'), 'build must generate sw.js');
  assert(
    files.some((file) => /^workbox-.+\.js$/.test(file)),
    'build must emit Workbox',
  );
  const serviceWorker = await readFile(path.join(distDirectory, 'sw.js'), 'utf8');
  for (const required of [
    'index.html',
    'manifest.webmanifest',
    ...EXPECTED_ICONS.map((icon) => icon.src),
  ])
    assert(serviceWorker.includes(required), `service worker must precache ${required}`);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';
if (invokedPath === import.meta.url) {
  const distDirectory = path.resolve(process.argv[2] ?? 'dist');
  await verifyPwaBuild(distDirectory);
  console.log(`PWA build verified: ${distDirectory}`);
}
