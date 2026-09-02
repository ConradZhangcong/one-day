import { expect, test } from '@playwright/test';

test('键盘、200% 字号和响应式布局不阻断快速新增', async ({ page }, testInfo) => {
  await page.goto('/inbox');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });

  const input = page.getByRole('textbox', { name: '任务标题' });
  await input.focus();
  const focusIsVisible = await input.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
  });
  expect(focusIsVisible).toBe(true);

  const title = `键盘任务-${testInfo.project.name}`;
  await input.fill(title);
  await input.press('Enter');
  await expect(
    page.getByRole('button', { name: `编辑${title}`, exact: true }).first(),
  ).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});

test('浅色和深色模式均保留可读的前景背景差异', async ({ page }) => {
  const colors: string[] = [];
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
    colors.push(
      await page.locator('body').evaluate((body) => {
        const style = getComputedStyle(body);
        return `${style.backgroundColor}|${style.color}`;
      }),
    );
  }
  expect(colors[0]).not.toBe(colors[1]);
  for (const colorsForScheme of colors) {
    const [background, foreground] = colorsForScheme.split('|');
    expect(background).not.toBe(foreground);
  }
});

test('移动等效视口的核心页面中位加载时间不超过三秒', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chrome',
    'Measured once on the mobile Chromium profile',
  );
  const samples: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    const start = performance.now();
    await page.goto(`/today?performance-run=${index}`);
    await expect(page.getByRole('heading', { name: '今天' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '任务标题' })).toBeVisible();
    samples.push(performance.now() - start);
  }
  samples.sort((left, right) => left - right);
  console.info(
    JSON.stringify({ mobileFirstInteractiveMedianMs: Math.round(samples[2] ?? 0) }),
  );
  expect(samples[2]).toBeLessThanOrEqual(3_000);
});
