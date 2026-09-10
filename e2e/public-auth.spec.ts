import { test, expect } from '@playwright/test';

test('login screen is usable', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Little Flowers School' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explore Demo' })).toBeVisible();
});

test('registration validates locally without creating a remote user', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('button', { name: 'Explore Demo' })).toBeVisible();
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password', { exact: true }).fill('abcdefgh');
  await page.getByLabel('Confirm Password').fill('abcdefgi');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByText('Passwords do not match.')).toBeVisible();
});
