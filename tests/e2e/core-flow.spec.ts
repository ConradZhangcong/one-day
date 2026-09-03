import { expect, test, type Page } from '@playwright/test';

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function createTaskForToday(page: Page, title: string) {
  await page.goto('/inbox');
  const quickAdd = page.locator('form.quick-add');
  await quickAdd.getByRole('textbox', { name: '任务标题' }).fill(title);
  await quickAdd.getByRole('button', { name: '今天', exact: true }).click();
  await quickAdd.getByRole('textbox', { name: '任务标题' }).press('Enter');
  await expect(
    page.getByRole('button', { name: `编辑${title}`, exact: true }).first(),
  ).toBeVisible();
}

test('核心任务事实跨列表和日历保持一致', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const title = `跨浏览器任务-${testInfo.project.name}`;

  await createTaskForToday(page, title);
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: '今天' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: `编辑${title}`, exact: true }).first(),
  ).toBeVisible();

  await page.goto('/calendar/agenda');
  await expect(page.getByRole('heading', { name: '日历' })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible();

  await page.goto('/today');
  const completeButton = page.getByRole('button', {
    name: `完成${title}`,
    exact: true,
  });
  await completeButton.click();
  await expect(completeButton).toBeHidden();
  await page.goto('/completed');
  await expect(
    page.getByRole('button', { name: `编辑${title}`, exact: true }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('深层路由刷新和历史导航可用', async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('/calendar/agenda');
  await expect(page.getByRole('heading', { name: '日历' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '日历' })).toBeVisible();
  await page.goto('/settings');
  await page.goBack();
  await expect(page.getByRole('heading', { name: '日历' })).toBeVisible();
  await page.goto('/not-a-real-route');
  await expect(page.getByText('页面不存在')).toBeVisible();
  await expect(page.getByRole('button', { name: '返回收件箱' })).toBeVisible();
  expect(errors).toEqual([]);
});
