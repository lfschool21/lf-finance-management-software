import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

test.describe('Demo Mode End-to-End Suite', () => {
  test('Test A: Explore Demo launches real interactive demo workspace with dynamic seeded data', async ({ page }) => {
    await page.goto('/login');
    const exploreBtn = page.getByRole('button', { name: 'Explore Demo' });
    await expect(exploreBtn).toBeVisible();
    await exploreBtn.click();

    // Verify bootstrap completes and navigates to dashboard
    await expect(page.getByRole('region', { name: 'Demo mode indicator' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Demo Mode')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset Demo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exit Demo' })).toBeVisible();

    // Verify Dashboard metrics and attention items
    await expect(page.getByText('Financial Position')).toBeVisible();
    await expect(page.getByText('Needs Attention')).toBeVisible();
    // At least one recurring expense is overdue relative to dynamic date
    await expect(page.getByText(/recurring expense item/i)).toBeVisible();

    // Verify sample students exist on /students
    await page.goto('/students');
    await expect(page.getByText('Aarav Patel')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('DEMO-101')).toBeVisible();
  });

  test('Test B: Real CRUD operations across features with persistence across page reloads', async ({ page }) => {
    test.setTimeout(60_000);
    // 1. Enter demo mode
    await page.goto('/login');
    await page.getByRole('button', { name: 'Explore Demo' }).click();
    await expect(page.getByRole('region', { name: 'Demo mode indicator' })).toBeVisible({ timeout: 30_000 });

    // 2. Add Student
    await page.goto('/students');
    await page.getByRole('button', { name: 'Add Student' }).click();
    await page.locator('#student-name').fill('Rohan Verma');
    await page.locator('#admission-number').fill('LF-TEST-999');
    await page.getByLabel('Choose class').click();
    await page.getByRole('button', { name: 'Class 5', exact: true }).click();
    await page.locator('#annual-fee').fill('28000');
    await page.getByRole('button', { name: 'Add Student', exact: true }).click();
    await expect(page.getByText('Rohan Verma')).toBeVisible({ timeout: 10_000 });

    // 3. Add Income (Lunch Fees)
    await page.goto('/income');
    await page.getByRole('button', { name: 'Add Income' }).click();
    await page.getByRole('button', { name: 'Lunch Fees' }).click();
    await page.locator('#amount').fill('4500');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('✅ Income recorded', { exact: true })).toBeVisible({ timeout: 10_000 });

    // 4. Add Expense
    await page.goto('/expenses');
    await page.getByRole('button', { name: 'Add Expense' }).click();
    await page.getByText('🏫 School Expense').click();
    await page.getByRole('button', { name: 'Academic Supplies', exact: true }).click();
    await page.locator('#exp-amount').fill('1500');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('✅ Expense recorded', { exact: true })).toBeVisible({ timeout: 10_000 });

    // 5. Transfer
    await page.goto('/transfers');
    await page.getByRole('button', { name: 'Transfer Money' }).click();
    await page.locator('#tr-amount').fill('1000');
    // Select from account
    await page.getByText('Select source').click();
    await page.getByRole('option').first().click();
    // Select to account
    await page.getByText('Select destination').click();
    await page.getByRole('option').last().click();
    await page.getByRole('button', { name: 'Transfer' }).click();
    await expect(page.getByText('✅ Transfer recorded', { exact: true })).toBeVisible({ timeout: 10_000 });

    // 6. Recoverables
    await page.goto('/recoverables');
    await page.getByRole('button', { name: 'Give Advance' }).click();
    const advModal = page.getByRole('dialog');
    await advModal.locator('input').first().fill('Sunil Cleaner');
    await advModal.locator('input[type="number"]').fill('2000');
    await advModal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Sunil Cleaner')).toBeVisible({ timeout: 10_000 });

    // 7. Search for newly created student
    await page.goto('/search');
    const searchInput = page.getByPlaceholder('Search transactions, student, admission number...');
    await searchInput.fill('Rohan Verma');
    await expect(page.getByText('Rohan Verma')).toBeVisible();

    // 8. Refresh and verify persistence
    await page.reload();
    await page.waitForURL('/search');
    await expect(page.getByRole('region', { name: 'Demo mode indicator' })).toBeVisible();
    await searchInput.fill('Sunil Cleaner');
    await expect(page.getByText('Sunil Cleaner')).toBeVisible();
  });

  test('Test C: Reset Demo erases edits and restores original canonical demo dataset', async ({ page }) => {
    // Enter demo mode
    await page.goto('/login');
    await page.getByRole('button', { name: 'Explore Demo' }).click();
    await expect(page.getByRole('region', { name: 'Demo mode indicator' })).toBeVisible({ timeout: 30_000 });

    // Add a temporary student
    await page.goto('/students');
    await page.getByRole('button', { name: 'Add Student' }).click();
    await page.locator('#student-name').fill('Temporary Ephemeral Student');
    await page.getByLabel('Choose class').click();
    await page.getByRole('button', { name: 'Class 1', exact: true }).click();
    await page.locator('#annual-fee').fill('10000');
    await page.getByRole('button', { name: 'Add Student', exact: true }).click();
    await expect(page.getByText('Temporary Ephemeral Student')).toBeVisible({ timeout: 10_000 });

    // Click Reset Demo in banner
    await page.getByRole('button', { name: 'Reset Demo' }).click();
    await expect(page.getByText('Reset Demo Workspace?')).toBeVisible();
    await page.getByRole('button', { name: 'Reset Demo Data' }).click();

    // Verify redirected back to dashboard and student is gone
    await page.waitForURL('/', { timeout: 15_000 });
    await page.goto('/students');
    await expect(page.getByText('Temporary Ephemeral Student')).not.toBeVisible();
    await expect(page.getByText('Aarav Patel')).toBeVisible();
  });

  test('Test D: Exit Demo clears session, cleans up database rows, and redirects to login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Explore Demo' }).click();
    await expect(page.getByRole('region', { name: 'Demo mode indicator' })).toBeVisible({ timeout: 30_000 });

    // Click Exit Demo
    await page.getByRole('button', { name: 'Exit Demo' }).click();
    await page.waitForURL('/login', { timeout: 10_000 });

    // Verify banner is gone
    await expect(page.getByRole('region', { name: 'Demo mode indicator' })).not.toBeVisible();

    // Attempting to visit protected route redirects to /login
    await page.goto('/');
    await page.waitForURL('/login', { timeout: 10_000 });
  });

  test('Test E: Multi-session isolation between two parallel browser contexts', async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    try {
      // Session A enters demo
      await pageA.goto('/login');
      await pageA.getByRole('button', { name: 'Explore Demo' }).click();
      await expect(pageA.getByRole('region', { name: 'Demo mode indicator' })).toBeVisible({ timeout: 30_000 });

      // Session B enters demo
      await pageB.goto('/login');
      await pageB.getByRole('button', { name: 'Explore Demo' }).click();
      await expect(pageB.getByRole('region', { name: 'Demo mode indicator' })).toBeVisible({ timeout: 30_000 });

      // Session A adds unique student
      await pageA.goto('/students');
      await pageA.getByRole('button', { name: 'Add Student' }).click();
      await pageA.locator('#student-name').fill('Session A Student Only');
      await pageA.getByLabel('Choose class').click();
      await pageA.getByRole('button', { name: 'Class 2', exact: true }).click();
      await pageA.locator('#annual-fee').fill('15000');
      await pageA.getByRole('button', { name: 'Add Student', exact: true }).click();
      await expect(pageA.getByText('Session A Student Only')).toBeVisible({ timeout: 10_000 });

      // Session B verifies that Session A student is NOT visible
      await pageB.goto('/students');
      await expect(pageB.getByText('Session A Student Only')).not.toBeVisible();
      await expect(pageB.getByText('Aarav Patel')).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('Test F: Wipe All Data in Demo redirects to Setup Wizard with DemoBanner still accessible to Reset Demo', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Explore Demo' }).click();
    await expect(page.getByRole('region', { name: 'Demo mode indicator' })).toBeVisible({ timeout: 30_000 });

    // Navigate to Settings
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Wipe All Data' }).click();
    await expect(page.getByText('⚠️ Wipe All Data')).toBeVisible();

    await page.getByPlaceholder('Type the phrase exactly...').fill('DELETE EVERYTHING PERMANENTLY');
    await page.getByRole('button', { name: 'Wipe Everything' }).click();

    // User is redirected to /setup
    await page.waitForURL('/setup', { timeout: 15_000 });
    await expect(page.getByText('First-Time Setup')).toBeVisible();

    // DemoBanner is still visible at the top of /setup!
    await expect(page.getByRole('region', { name: 'Demo mode indicator' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset Demo' })).toBeVisible();

    // Click Reset Demo from /setup
    await page.getByRole('button', { name: 'Reset Demo' }).click();
    await page.getByRole('button', { name: 'Reset Demo Data' }).click();

    // User is returned to populated dashboard!
    await page.waitForURL('/', { timeout: 15_000 });
    await expect(page.getByText('Financial Position')).toBeVisible();
  });

  test('Test G: Responsive layout from mobile (320px) to desktop (1280px)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 600 });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Explore Demo' }).click();
    await expect(page.getByRole('region', { name: 'Demo mode indicator' })).toBeVisible({ timeout: 30_000 });

    const banner = page.getByRole('region', { name: 'Demo mode indicator' });
    await expect(banner).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset Demo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exit Demo' })).toBeVisible();

    // Expand to 1280px desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(banner).toBeVisible();
    await expect(page.getByText('You are exploring sample data. Changes in this workspace are disposable.')).toBeVisible();
  });

  test('Test H: Backup, modify, and restore in Demo mode', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Explore Demo' }).click();
    await expect(page.getByRole('region', { name: 'Demo mode indicator' })).toBeVisible({ timeout: 30_000 });

    // Go to Settings and create a backup
    await page.goto('/settings');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Create Backup' }).click();
    const download = await downloadPromise;

    const tmpFilePath = path.join(os.tmpdir(), `test-demo-backup-${Date.now()}.lfbackup`);
    await download.saveAs(tmpFilePath);
    expect(fs.existsSync(tmpFilePath)).toBe(true);

    try {
      // Modify demo data by adding a new student
      await page.goto('/students');
      await page.getByRole('button', { name: 'Add Student' }).click();
      await page.locator('#student-name').fill('Post-Backup Student');
      await page.getByLabel('Choose class').click();
      await page.getByRole('button', { name: 'Class 3', exact: true }).click();
      await page.locator('#annual-fee').fill('12000');
      await page.getByRole('button', { name: 'Add Student', exact: true }).click();
      await expect(page.getByText('Post-Backup Student')).toBeVisible({ timeout: 10_000 });

      // Return to Settings and restore the original backup
      await page.goto('/settings');
      page.on('dialog', (dialog) => dialog.accept());
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Restore from Backup' }).click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(tmpFilePath);

      // Verify restore success toast
      await expect(page.getByText('✅ Backup restored successfully', { exact: true })).toBeVisible({ timeout: 15_000 });

      // Navigate back to /students and verify post-backup student is gone
      await page.goto('/students');
      await expect(page.getByText('Post-Backup Student')).not.toBeVisible();
      await expect(page.getByText('Aarav Patel')).toBeVisible();
    } finally {
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
    }
  });
});
