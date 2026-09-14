import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('深层路由登录、注册和退出不泄露上一账号内容', async ({ page }) => {
  const username = `auth_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  await page.goto('/inbox');
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '任务标题' })).toHaveCount(0);
  await page.getByRole('button', { name: '还没有账号？创建账号' }).click();
  await page.getByLabel('账号', { exact: true }).fill(username);
  await page.getByLabel('密码', { exact: true }).fill('test-only-password-2026');
  await page.getByRole('button', { name: '注册并登录' }).click();
  await expect(page.getByRole('heading', { name: '收件箱', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '任务标题' }).fill('账号私有任务');
  await page.getByRole('textbox', { name: '任务标题' }).press('Enter');
  await expect(
    page.getByRole('button', { name: '编辑账号私有任务', exact: true }).first(),
  ).toBeVisible();
  const logout = page.getByRole('button', { name: '退出登录' });
  if (!(await logout.first().isVisible()))
    await page.getByRole('button', { name: '更多', exact: true }).click();
  await logout.filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await expect(page.getByText('账号私有任务', { exact: true })).toHaveCount(0);
  await page.getByLabel('账号', { exact: true }).fill(username);
  await page.getByLabel('密码', { exact: true }).fill('test-only-password-2026');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '编辑账号私有任务', exact: true }).first(),
  ).toBeVisible();
});
