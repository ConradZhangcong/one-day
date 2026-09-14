import { test as base, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
export { expect };
export const test = base.extend<{ account: string }>({
  account: [
    async ({ context, baseURL }, use) => {
      const username = `e2e_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
      const response = await context.request.post(`${baseURL}/api/register`, {
        headers: { Origin: baseURL!, 'X-One-Day-Request': '1' },
        data: {
          username,
          password: 'test-only-password-2026',
          timeZone: 'Asia/Shanghai',
        },
      });
      expect(response.ok()).toBe(true);
      await use(username);
    },
    { auto: true },
  ],
});
