import { expect, test } from './account-fixture';

test('离线重启显示连接失败，恢复网络后读取账号数据', async ({
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
  await expect(
    offlinePage.getByRole('heading', { name: '暂时无法打开 One Day' }),
  ).toBeVisible();
  await expect(offlinePage.getByRole('button', { name: '重新连接' })).toBeVisible();
  await expect(offlinePage.getByRole('textbox', { name: '任务标题' })).toHaveCount(0);

  await context.setOffline(false);
  await offlinePage.reload();
  await offlinePage.goto('/today');
  await expect(
    offlinePage.getByRole('button', { name: `编辑${onlineTitle}`, exact: true }).first(),
  ).toHaveCount(1);
});
