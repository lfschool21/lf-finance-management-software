import { expect, test, type Page } from '@playwright/test';

const email = 'release-gate-owner@local.test';
const password = 'LocalRelease123!';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
}

function statCard(page: Page, title: string) {
  return page.getByText(title, { exact: true }).locator('..').first();
}

function reportMiniCard(page: Page, label: string) {
  return page.locator('div.rounded-lg.border.bg-card.p-3').filter({ hasText: label }).first();
}

test('authenticated finance screens stay consistent after database reload', async ({ page }) => {
  await signIn(page);

  await expect(statCard(page, 'Cash Income')).toContainText('₹1.91L');
  await expect(statCard(page, 'School Expenses')).toContainText('₹1.06L');
  await expect(statCard(page, 'School Net Profit')).toContainText('₹85K');
  await expect(statCard(page, 'All Balances')).toContainText('₹1.55L');
  await expect(page.getByText('School Profit', { exact: true }).locator('..')).toContainText('₹85,000');
  await expect(page.getByText('After Personal Expenses', { exact: true }).locator('..')).toContainText('₹65,000');
  await expect(page.getByText(/Pending: ₹50,000 from previous years/)).toBeVisible();
  await page.reload();
  await expect(statCard(page, 'All Balances')).toContainText('₹1.55L');

  await page.goto('/income');
  await expect(page.getByRole('heading', { level: 1, name: 'Income' })).toBeVisible();
  await expect(statCard(page, 'Tuition Collected')).toContainText('₹1L');
  await expect(statCard(page, 'Total Income')).toContainText('₹1.91L');
  await expect(statCard(page, 'Remaining')).toContainText('₹9L');
  await expect(page.getByText('Previous-Year / Old Fee Collections', { exact: true }).locator('..')).toContainText('₹30,000');
  await expect(page.getByText('Investment / Extra Income', { exact: true }).locator('..')).toContainText('₹51,000');
  await page.getByRole('tab', { name: 'Old Fees' }).click();
  await expect(page.getByText('Old fees release gate')).toBeVisible();
  await page.getByRole('tab', { name: 'Lunch Fees' }).click();
  await expect(page.getByText('Lunch release gate')).toBeVisible();
  await page.getByRole('tab', { name: 'Investment / Extra' }).click();
  await expect(page.getByText('Investment income release gate')).toBeVisible();
  await page.reload();
  await expect(statCard(page, 'Tuition Collected')).toContainText('₹1L');

  await page.goto('/expenses');
  await expect(page.getByRole('heading', { level: 1, name: 'Expenses' })).toBeVisible();
  await expect(statCard(page, 'School')).toContainText('₹1.06L');
  await expect(statCard(page, 'Home')).toContainText('₹20K');
  await expect(statCard(page, 'Total')).toContainText('₹1.26L');
  await expect(page.getByText('School salary release gate')).toBeVisible();
  await expect(page.getByText('Home expense release gate')).toBeVisible();
  await page.getByRole('tab', { name: 'Recurring' }).click();
  await expect(page.getByText('August electricity release gate')).toBeVisible();
  await page.reload();
  await expect(statCard(page, 'Total')).toContainText('₹1.26L');

  await page.goto('/balances');
  await expect(page.getByRole('heading', { level: 1, name: 'Bank Balances' })).toBeVisible();
  await expect(statCard(page, 'All Accounts')).toContainText('₹1.55L');
  await expect(statCard(page, 'Bank Total')).toContainText('₹1.3L');
  await expect(statCard(page, 'School Bank')).toContainText('₹90K');
  await expect(statCard(page, 'Cash')).toContainText('₹25K');
  await expect(page.getByText('Release School', { exact: true }).locator('xpath=ancestor::div[contains(@class,"px-4")][1]')).toContainText('₹90,000');
  await expect(page.getByText('Closed Zero Account', { exact: true }).locator('xpath=ancestor::div[contains(@class,"px-4")][1]')).toContainText('Archived');
  await page.reload();
  await expect(statCard(page, 'All Accounts')).toContainText('₹1.55L');

  await page.goto('/reports');
  await expect(page.getByRole('heading', { level: 1, name: 'Reports & Analytics' })).toBeVisible();
  await expect(reportMiniCard(page, 'Income')).toContainText('₹1,91,000');
  await expect(reportMiniCard(page, 'School Profit')).toContainText('₹85,000');
  await expect(reportMiniCard(page, 'Overall Position')).toContainText('₹65,000');
  await page.getByRole('tab', { name: 'Yearly P&L' }).click();
  await expect(page.getByText('Profit & Loss — AY 2026-27')).toBeVisible();
  await expect(page.getByText('SCHOOL NET PROFIT', { exact: true }).locator('..')).toContainText('₹85,000');
  await expect(page.getByText('OVERALL POSITION', { exact: true }).locator('..')).toContainText('₹65,000');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Reports & Analytics' })).toBeVisible();

  await page.goto('/search');
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
  const search = page.getByPlaceholder('Search transactions, categories, notes...');
  await search.fill('investment income');
  await expect(page.getByText('Found 1 result')).toBeVisible();
  await expect(page.getByText('Investment / Extra Income', { exact: true })).toBeVisible();
  await expect(page.getByText('+₹50,000')).toBeVisible();
  await search.fill('trustee');
  await expect(page.getByText('Advance — Local Test Trustee')).toBeVisible();
  await expect(page.getByText('-₹40,000')).toBeVisible();
  await page.reload();
  await search.fill('old fees');
  await expect(page.getByText('Previous-Year / Old Fee Collections', { exact: true })).toBeVisible();
  await expect(page.getByText('+₹30,000')).toBeVisible();
});
