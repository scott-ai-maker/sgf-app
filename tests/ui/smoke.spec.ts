import { expect, test } from '@playwright/test';

test.describe('Core UI smoke flows', () => {
  test('marketing home is reachable', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);

    // Validate we did not render an empty shell.
    await expect(page.locator('main,body')).toContainText(/\S+/);
  });

  test('dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('coach area redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/coach');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('login page renders form controls', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
  });
});
