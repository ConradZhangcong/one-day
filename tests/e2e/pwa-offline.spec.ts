import { expect, test } from '@playwright/test';

test('受 Service Worker 控制后可离线重启并读写 IndexedDB', async ({
  context,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Service Worker lifecycle is Chromium-only',
  );

  await page.goto('/today');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) {
    await page.reload();
  }
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  const onlineTitle = '离线前创建的任务';
  await page.goto('/inbox');
  const quickAdd = page.locator('form.quick-add');
  await quickAdd.getByRole('textbox', { name: '任务标题' }).fill(onlineTitle);
  await quickAdd.getByRole('button', { name: '今天', exact: true }).click();
  await quickAdd.getByRole('textbox', { name: '任务标题' }).press('Enter');
  await expect(
    page.getByRole('button', { name: `编辑${onlineTitle}`, exact: true }).first(),
  ).toBeVisible();

  await context.setOffline(true);
  await page.close();
  const offlinePage = await context.newPage();
  await offlinePage.goto('/today', { waitUntil: 'domcontentloaded' });
  await expect(offlinePage.getByRole('heading', { name: '今天' })).toBeVisible();
  await expect(
    offlinePage.getByRole('button', { name: `编辑${onlineTitle}`, exact: true }).first(),
  ).toBeVisible();

  const offlineTitle = '断网时创建的任务';
  await offlinePage.goto('/inbox');
  const offlineQuickAdd = offlinePage.locator('form.quick-add');
  await offlineQuickAdd.getByRole('textbox', { name: '任务标题' }).fill(offlineTitle);
  await offlineQuickAdd.getByRole('button', { name: '今天', exact: true }).click();
  await offlineQuickAdd.getByRole('textbox', { name: '任务标题' }).press('Enter');
  await expect(
    offlinePage.getByRole('button', { name: `编辑${offlineTitle}`, exact: true }).first(),
  ).toBeVisible();
  await offlinePage.goto('/calendar/agenda', { waitUntil: 'domcontentloaded' });
  await expect(
    offlinePage.getByRole('button', { name: new RegExp(onlineTitle) }),
  ).toBeVisible();

  await context.setOffline(false);
  await offlinePage.reload();
  await offlinePage.goto('/today');
  await expect(
    offlinePage.getByRole('button', { name: `编辑${onlineTitle}`, exact: true }).first(),
  ).toHaveCount(1);
  await expect(
    offlinePage.getByRole('button', { name: `编辑${offlineTitle}`, exact: true }).first(),
  ).toHaveCount(1);
});
