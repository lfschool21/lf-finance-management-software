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
  return page.locator('main').getByText(title, { exact: true }).locator('..').first();
}

function reportMiniCard(page: Page, label: string) {
  return page.locator('div.rounded-lg.border.bg-card.p-3').filter({ hasText: label }).first();
}

test('authenticated finance screens stay consistent after database reload', async ({ page }) => {
  await signIn(page);

  await expect(statCard(page, 'Cash Income Received')).toContainText('₹1,91,000');
  await expect(statCard(page, 'School Expenses')).toContainText('₹1,06,000');
  await expect(statCard(page, 'School Profit')).toContainText('₹85K');
  await expect(statCard(page, 'Available Balance')).toContainText('₹1.55L');
  await expect(page.getByText('Previous-year fees pending', { exact: true }).locator('..')).toContainText('₹50,000');
  await page.reload();
  await expect(statCard(page, 'Available Balance')).toContainText('₹1.55L');

  await page.goto('/income');
  await expect(page.getByRole('heading', { level: 1, name: 'Income' })).toBeVisible();
  await expect(statCard(page, 'Current-Year Tuition Collected')).toContainText('₹1L');
  await expect(statCard(page, 'Total Cash Income')).toContainText('₹1.91L');
  await expect(statCard(page, 'Current-Year Tuition Remaining')).toContainText('₹9L');
  await expect(statCard(page, 'Previous-Year Fees Received This AY')).toContainText('₹30K');
  await expect(
    page.locator('div.flex.items-center.justify-between.text-sm').filter({ hasText: 'Previous-Year Fees Received' }),
  ).toContainText('₹30,000');
  await expect(page.getByText('Investment / Extra Income', { exact: true }).locator('..')).toContainText('₹51,000');
  await page.getByRole('tab', { name: 'Previous-Year Fees Received' }).click();
  await expect(page.getByRole('button', { name: /Release Gate Student.*For AY 2025-26.*₹30,000/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Lunch Fees' }).click();
  await expect(page.getByText('Lunch release gate')).toBeVisible();
  await page.getByRole('tab', { name: 'Investment / Extra' }).click();
  await expect(page.getByText('Investment income release gate')).toBeVisible();
  await page.reload();
  await expect(statCard(page, 'Current-Year Tuition Collected')).toContainText('₹1L');

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
  await expect(page.getByRole('heading', { level: 1, name: 'Balances' })).toBeVisible();
  await expect(statCard(page, 'Total Liquid Balance')).toContainText('₹1.55L');
  await expect(statCard(page, 'Bank Total')).toContainText('₹1.3L');
  await expect(statCard(page, 'School Bank')).toContainText('₹90K');
  await expect(statCard(page, 'Cash')).toContainText('₹25K');
  await expect(page.getByText('Release School', { exact: true }).locator('xpath=ancestor::div[contains(@class,"px-4")][1]')).toContainText('₹90,000');
  await expect(page.getByText('Closed Zero Account', { exact: true }).locator('xpath=ancestor::div[contains(@class,"px-4")][1]')).toContainText('Archived');
  await page.reload();
  await expect(statCard(page, 'Total Liquid Balance')).toContainText('₹1.55L');

  await page.goto('/reports');
  await expect(page.getByRole('heading', { level: 1, name: 'Reports & Analytics' })).toBeVisible();
  await expect(reportMiniCard(page, 'Cash Income Received')).toContainText('₹1,91,000');
  await expect(reportMiniCard(page, 'School Profit')).toContainText('₹85,000');
  await expect(reportMiniCard(page, 'Cash Surplus After Home/Personal Expenses')).toContainText('₹65,000');
  await page.getByRole('tab', { name: 'Yearly P&L' }).click();
  await expect(page.getByText('Profit & Loss — AY 2026-27')).toBeVisible();
  await expect(page.getByText('SCHOOL PROFIT', { exact: true }).locator('..')).toContainText('₹85,000');
  await expect(page.getByText('CASH SURPLUS AFTER HOME/PERSONAL EXPENSES', { exact: true }).locator('..')).toContainText('₹65,000');
  await expect(page.getByText(/Fee Collection Status/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Reports & Analytics' })).toBeVisible();

  await page.goto('/search');
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
  const search = page.getByPlaceholder('Search transactions, student, admission number...');
  await search.fill('investment income');
  await expect(page.getByText('Found 1 result')).toBeVisible();
  await expect(page.getByText('Investment / Extra Income', { exact: true })).toBeVisible();
  await expect(page.getByText('+₹50,000')).toBeVisible();
  await search.fill('trustee');
  await expect(page.getByText('Advance — Local Test Trustee')).toBeVisible();
  await expect(page.getByText('-₹40,000')).toBeVisible();
  await page.reload();
  await search.fill('old fees');
  await expect(page.getByRole('button', { name: /Release Gate Student Income.*Previous-Year Fees Received.*₹30,000/ })).toBeVisible();
});

test('primary finance views remain usable across mobile and tablet widths', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await signIn(page);

  for (const width of [360, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2, name: 'Fee Collection Overview' })).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
  }

  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByText('More', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open more navigation options' }).click();
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();
  await expect(page.getByText('Track advances and repayments')).toBeVisible();
});

test('student roster, fee profile, and linked finance metadata remain coherent', async ({ page }) => {
  await signIn(page);
  await page.goto('/students');
  await expect(page.getByRole('heading', { level: 1, name: 'Students' })).toBeVisible();
  await expect(page.getByText('Release Gate Student', { exact: true }).first()).toBeVisible();
  await page.getByText('Release Gate Student', { exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Release Gate Student' })).toBeVisible();
  await expect(page.getByText('₹40,000').first()).toBeVisible();
  await expect(page.getByText(/Opening imported fee history/)).toBeVisible();
  await expect(page.getByText(/upi · Release School/i)).toBeVisible();

  await page.goto('/search');
  await page.getByPlaceholder('Search transactions, student, admission number...').fill('RG-001');
  const studentResults = page.getByRole('button', { name: /Release Gate Student Income/ });
  await expect(studentResults).toHaveCount(2);
  await expect(studentResults.first()).toBeVisible();

  for (const width of [320, 390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/students');
    await expect(page.getByRole('heading', { level: 1, name: 'Students' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  }

  await page.getByRole('button', { name: 'Add Student' }).click();
  await expect(page.getByRole('dialog').getByText('Fees already paid before using this app')).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/Leave all three as 0 for a new student/)).toBeVisible();
  await page.getByRole('button', { name: 'Choose class' }).click();
  await expect(page.getByRole('heading', { name: 'Choose class' })).toBeVisible();
  await page.getByRole('button', { name: 'Class 4' }).click();
  await expect(page.getByRole('button', { name: 'Choose class' })).toContainText('Class 4');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
});
