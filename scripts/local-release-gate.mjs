import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function readLocalEnvironment() {
  const values = {};
  const contents = readFileSync(resolve('.env.test.local'), 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    values[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }
  return values;
}

const environment = readLocalEnvironment();
const supabaseUrl = environment.VITE_SUPABASE_URL;
const supabaseKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY;
const ownerEmail = environment.LOCAL_RELEASE_GATE_EMAIL;
const ownerPassword = environment.LOCAL_RELEASE_GATE_PASSWORD;
const otherEmail = 'release-gate-other@local.test';
const otherPassword = 'OtherLocalRelease123!';
const allowedHosts = new Set(['127.0.0.1', 'localhost', '::1']);

assert.ok(supabaseUrl && supabaseKey && ownerEmail && ownerPassword, 'Local release-gate environment is incomplete');
const parsedUrl = new URL(supabaseUrl);
assert.ok(allowedHosts.has(parsedUrl.hostname), `Refusing non-local Supabase URL: ${parsedUrl.hostname}`);
assert.equal(parsedUrl.protocol, 'http:', 'Local release gate requires an HTTP loopback URL');

function client() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function pass(label) {
  console.log(`PASS | ${label}`);
}

function expectNoError(result, context) {
  assert.equal(result.error, null, `${context}: ${result.error?.message ?? 'unknown error'}`);
  return result.data;
}

async function authenticatedClient(email, password) {
  const supabase = client();
  let result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error?.message.toLowerCase().includes('invalid login credentials')) {
    result = await supabase.auth.signUp({ email, password });
  }
  assert.equal(result.error, null, `Local auth failed for ${email}: ${result.error?.message}`);
  assert.ok(result.data.session, `Local auth did not return a session for ${email}`);
  assert.ok(result.data.user, `Local auth did not return a user for ${email}`);
  return { supabase, user: result.data.user };
}

const financeTables = [
  'academic_years',
  'accounts',
  'income_entries',
  'expense_entries',
  'transfers',
  'recurring_templates',
  'recoverables',
  'recoverable_repayments',
];

async function loadFinanceData(supabase) {
  const data = {};
  for (const table of financeTables) {
    const result = await supabase.from(table).select('*').order('id');
    data[table] = expectNoError(result, `Load ${table}`);
  }
  return data;
}

function balanceFor(accountId, data) {
  const account = data.accounts.find((row) => row.id === accountId);
  assert.ok(account, `Account ${accountId} is missing`);
  const sum = (rows, predicate, field = 'amount') => rows
    .filter(predicate)
    .reduce((total, row) => total + Number(row[field]), 0);
  return Number(account.starting_balance)
    + sum(data.income_entries, (row) => row.account_id === accountId)
    - sum(data.expense_entries, (row) => row.account_id === accountId)
    + sum(data.transfers, (row) => row.to_account_id === accountId)
    - sum(data.transfers, (row) => row.from_account_id === accountId)
    - sum(data.recoverables, (row) => row.source_account_id === accountId, 'original_amount')
    + sum(data.recoverable_repayments, (row) => row.account_id === accountId);
}

function financialSummary(data, ids) {
  const currentTuition = data.income_entries
    .filter((row) => row.type === 'tuition' && !row.is_late_collection && row.academic_year_id === ids.currentYear)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const oldFees = data.income_entries
    .filter((row) => row.type === 'tuition' && row.is_late_collection && row.original_year_id === ids.oldYear)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const lunch = data.income_entries
    .filter((row) => row.type === 'lunch')
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const other = data.income_entries
    .filter((row) => row.type === 'other')
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const schoolExpenses = data.expense_entries
    .filter((row) => row.expense_type === 'school')
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const homeExpenses = data.expense_entries
    .filter((row) => row.expense_type === 'home')
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const currentYear = data.academic_years.find((row) => row.id === ids.currentYear);
  const oldYear = data.academic_years.find((row) => row.id === ids.oldYear);
  assert.ok(currentYear && oldYear, 'Release-gate academic years are missing');
  return {
    currentTuition,
    oldFees,
    lunch,
    other,
    schoolExpenses,
    homeExpenses,
    schoolProfit: currentTuition + oldFees + lunch + other - schoolExpenses,
    overallPosition: currentTuition + oldFees + lunch + other - schoolExpenses - homeExpenses,
    currentPending: Number(currentYear.target_tuition_fees) + Number(currentYear.carry_forward_fees) - currentTuition,
    oldPending: Number(oldYear.target_tuition_fees) + Number(oldYear.carry_forward_fees) - oldFees,
    schoolBalance: balanceFor(ids.schoolAccount, data),
    personalBalance: balanceFor(ids.personalAccount, data),
    cashBalance: balanceFor(ids.cashAccount, data),
    archivedBalance: balanceFor(ids.archivedAccount, data),
  };
}

function canonicalFinance(data) {
  return JSON.stringify(Object.fromEntries(financeTables.map((table) => [table, data[table]])));
}

async function main() {
  pass(`safety guard accepted loopback host ${parsedUrl.hostname}`);

  const ownerAuth = await authenticatedClient(ownerEmail, ownerPassword);
  const otherAuth = await authenticatedClient(otherEmail, otherPassword);
  const owner = ownerAuth.supabase;
  const other = otherAuth.supabase;
  pass('local Supabase Auth sessions established for two users');

  expectNoError(await owner.rpc('wipe_finance_data'), 'Initial owner wipe');
  expectNoError(await other.rpc('wipe_finance_data'), 'Initial other-user wipe');

  expectNoError(await owner.rpc('complete_initial_setup', {
    p_accounts: [
      { name: 'Release School', type: 'school_bank', starting_balance: 100000 },
      { name: 'Release Personal', type: 'personal_bank', starting_balance: 50000 },
      { name: 'Release Cash', type: 'cash', starting_balance: 10000 },
      { name: 'Closed Zero Account', type: 'personal_bank', starting_balance: 0 },
    ],
    p_year: {
      label: '2026-27',
      start_date: '2026-06-05',
      end_date: '2027-06-04',
      target_tuition_fees: 1000000,
      carry_forward_fees: 0,
      status: 'active',
    },
    p_templates: [
      { expense_type: 'school', category: 'Electricity Bill', default_amount: 5000, recurrence_interval: 'monthly' },
    ],
  }), 'Atomic initial setup');

  const initialAccounts = expectNoError(
    await owner.from('accounts').select('*').order('created_at'),
    'Load setup accounts',
  );
  const currentYear = expectNoError(
    await owner.from('academic_years').select('*').single(),
    'Load current academic year',
  );
  const template = expectNoError(
    await owner.from('recurring_templates').select('*').single(),
    'Load recurring template',
  );
  const accountByName = Object.fromEntries(initialAccounts.map((row) => [row.name, row]));
  const ids = {
    currentYear: currentYear.id,
    oldYear: '',
    schoolAccount: accountByName['Release School'].id,
    personalAccount: accountByName['Release Personal'].id,
    cashAccount: accountByName['Release Cash'].id,
    archivedAccount: accountByName['Closed Zero Account'].id,
    template: template.id,
  };

  const oldYear = expectNoError(await owner.from('academic_years').insert({
    user_id: ownerAuth.user.id,
    label: '2025-26',
    start_date: '2025-06-05',
    end_date: '2026-06-04',
    target_tuition_fees: 80000,
    carry_forward_fees: 0,
    status: 'pending_collections',
  }).select().single(), 'Create prior academic year');
  ids.oldYear = oldYear.id;
  pass('setup and non-overlapping current/prior academic years');

  expectNoError(await owner.from('income_entries').insert([
    {
      user_id: ownerAuth.user.id, academic_year_id: ids.currentYear, type: 'tuition', amount: 100000,
      date: '2026-08-01', account_id: ids.schoolAccount, is_late_collection: false,
      original_year_id: null, notes: 'Current tuition release gate', tags: ['release-gate'],
    },
    {
      user_id: ownerAuth.user.id, academic_year_id: ids.currentYear, type: 'tuition', amount: 30000,
      date: '2026-08-02', account_id: ids.schoolAccount, is_late_collection: true,
      original_year_id: ids.oldYear, notes: 'Old fees release gate', tags: ['release-gate'],
    },
    {
      user_id: ownerAuth.user.id, academic_year_id: ids.currentYear, type: 'lunch', amount: 10000,
      date: '2026-08-03', account_id: ids.schoolAccount, is_late_collection: false,
      original_year_id: null, notes: 'Lunch release gate', tags: ['release-gate'],
    },
    {
      user_id: ownerAuth.user.id, academic_year_id: ids.currentYear, type: 'other', amount: 50000,
      date: '2026-08-04', account_id: ids.schoolAccount, is_late_collection: false,
      original_year_id: null, notes: 'Investment income release gate', tags: ['release-gate'],
    },
    {
      user_id: ownerAuth.user.id, academic_year_id: ids.currentYear, type: 'other', amount: 1000,
      date: '2026-08-05', account_id: ids.archivedAccount, is_late_collection: false,
      original_year_id: null, notes: 'Archived account identity credit', tags: ['release-gate'],
    },
  ]), 'Create all income source types');

  expectNoError(await owner.from('expense_entries').insert([
    {
      user_id: ownerAuth.user.id, academic_year_id: ids.currentYear, expense_type: 'school',
      category: 'Salary & Wages', amount: 100000, date: '2026-08-06', account_id: ids.schoolAccount,
      description: 'School salary release gate', tags: ['release-gate'], is_recurring_instance: false,
    },
    {
      user_id: ownerAuth.user.id, academic_year_id: ids.currentYear, expense_type: 'home',
      category: 'Groceries', amount: 20000, date: '2026-08-07', account_id: ids.personalAccount,
      description: 'Home expense release gate', tags: ['release-gate'], is_recurring_instance: false,
    },
    {
      user_id: ownerAuth.user.id, academic_year_id: ids.currentYear, expense_type: 'school',
      category: 'Other School Expense', amount: 1000, date: '2026-08-08', account_id: ids.archivedAccount,
      description: 'Archived account identity debit', tags: ['release-gate'], is_recurring_instance: false,
    },
  ]), 'Create school and home expenses');

  expectNoError(await owner.rpc('record_recurring_expense', {
    p_template_id: ids.template,
    p_amount: 5000,
    p_date: '2026-08-15',
    p_academic_year_id: ids.currentYear,
    p_account_id: ids.schoolAccount,
    p_description: 'August electricity release gate',
  }), 'Record recurring expense');
  const duplicateRecurring = await owner.rpc('record_recurring_expense', {
    p_template_id: ids.template,
    p_amount: 5000,
    p_date: '2026-08-20',
    p_academic_year_id: ids.currentYear,
    p_account_id: ids.schoolAccount,
    p_description: 'Duplicate August electricity',
  });
  assert.ok(duplicateRecurring.error?.message.includes('already recorded'), 'Duplicate monthly recurring expense was not rejected');
  pass('income, expense, and recurring-expense integrity');

  const createdTransfer = expectNoError(await owner.rpc('save_transfer', {
    p_transfer_id: null,
    p_from_account_id: ids.schoolAccount,
    p_to_account_id: ids.personalAccount,
    p_amount: 25000,
    p_date: '2026-08-10',
    p_category: 'school_to_personal',
    p_notes: 'Release-gate transfer',
  }), 'Create atomic transfer');
  expectNoError(await owner.rpc('save_transfer', {
    p_transfer_id: createdTransfer.id,
    p_from_account_id: ids.schoolAccount,
    p_to_account_id: ids.personalAccount,
    p_amount: 10000,
    p_date: '2026-08-10',
    p_category: 'school_to_personal',
    p_notes: 'Edited release-gate transfer',
  }), 'Edit atomic transfer');
  const overdraft = await owner.rpc('save_transfer', {
    p_transfer_id: null,
    p_from_account_id: ids.schoolAccount,
    p_to_account_id: ids.personalAccount,
    p_amount: 10000000,
    p_date: '2026-08-11',
    p_category: 'school_to_personal',
    p_notes: 'Must fail',
  });
  assert.ok(overdraft.error?.message.includes('exceeds source account'), 'Transfer overdraft was not rejected');
  const directTransfer = await owner.from('transfers').insert({
    user_id: ownerAuth.user.id,
    from_account_id: ids.schoolAccount,
    to_account_id: ids.personalAccount,
    amount: 1,
    date: '2026-08-11',
    category: 'school_to_personal',
  });
  assert.ok(directTransfer.error, 'Direct transfer insert bypassed the atomic RPC policy');
  pass('transfer create/edit, overdraft prevention, and RPC-only writes');

  const recoverable = expectNoError(await owner.from('recoverables').insert({
    user_id: ownerAuth.user.id,
    party_name: 'Local Test Trustee',
    original_amount: 40000,
    date_given: '2026-08-12',
    source_account_id: ids.schoolAccount,
    notes: 'Release-gate advance',
  }).select().single(), 'Create recoverable advance');
  expectNoError(await owner.from('recoverable_repayments').insert({
    user_id: ownerAuth.user.id,
    recoverable_id: recoverable.id,
    amount: 15000,
    date: '2026-08-18',
    account_id: ids.cashAccount,
    notes: 'Partial release-gate repayment',
  }), 'Create recoverable repayment');
  const overRepayment = await owner.from('recoverable_repayments').insert({
    user_id: ownerAuth.user.id,
    recoverable_id: recoverable.id,
    amount: 30000,
    date: '2026-08-19',
    account_id: ids.cashAccount,
  });
  assert.ok(overRepayment.error?.message.includes('exceeds the remaining'), 'Recoverable over-repayment was not rejected');
  expectNoError(await owner.from('accounts').update({ is_archived: true }).eq('id', ids.archivedAccount), 'Archive zero-balance account');
  pass('recoverable advances, repayments, overpayment guard, and archived account history');

  let data = await loadFinanceData(owner);
  assert.deepEqual(financialSummary(data, ids), {
    currentTuition: 100000,
    oldFees: 30000,
    lunch: 10000,
    other: 51000,
    schoolExpenses: 106000,
    homeExpenses: 20000,
    schoolProfit: 85000,
    overallPosition: 65000,
    currentPending: 900000,
    oldPending: 50000,
    schoolBalance: 135000,
    personalBalance: 40000,
    cashBalance: 25000,
    archivedBalance: 0,
  });
  assert.equal(data.recoverable_repayments.length, 1);
  assert.equal(Number(data.recoverables[0].original_amount) - Number(data.recoverable_repayments[0].amount), 25000);
  assert.equal(data.accounts.find((row) => row.id === ids.archivedAccount)?.is_archived, true);
  pass('tuition, old fees, lunch, investment income, profit semantics, pending fees, and balances');

  const historyCounts = {
    income: data.income_entries.length,
    expense: data.expense_entries.length,
    transfer: data.transfers.length,
    recoverable: data.recoverables.length,
    repayment: data.recoverable_repayments.length,
  };
  expectNoError(await owner.rpc('set_account_current_balance', {
    p_account_id: ids.schoolAccount,
    p_name: 'Release School',
    p_type: 'school_bank',
    p_current_balance: 90000,
  }), 'Set exact current balance');
  data = await loadFinanceData(owner);
  assert.equal(balanceFor(ids.schoolAccount, data), 90000);
  assert.deepEqual({
    income: data.income_entries.length,
    expense: data.expense_entries.length,
    transfer: data.transfers.length,
    recoverable: data.recoverables.length,
    repayment: data.recoverable_repayments.length,
  }, historyCounts, 'Current-balance edit changed transaction history');
  pass('Current Balance editing preserves history and reaches the exact entered amount');

  const backup = {
    version: '2.0',
    date: new Date().toISOString(),
    data,
  };
  const backedUpCanonical = canonicalFinance(data);
  expectNoError(await owner.from('backups_log').insert({
    user_id: ownerAuth.user.id,
    backup_type: 'manual',
    file_size: Buffer.byteLength(JSON.stringify(backup)),
    status: 'success',
  }), 'Write local backup log');
  expectNoError(await owner.from('income_entries').insert({
    user_id: ownerAuth.user.id,
    academic_year_id: ids.currentYear,
    type: 'other',
    amount: 999,
    date: '2026-08-21',
    account_id: ids.cashAccount,
    is_late_collection: false,
    original_year_id: null,
    notes: 'Mutation before restore',
  }), 'Mutate before restore');
  expectNoError(await owner.rpc('restore_finance_backup', { p_backup: backup }), 'Restore valid backup');
  data = await loadFinanceData(owner);
  assert.equal(canonicalFinance(data), backedUpCanonical, 'Valid restore did not reproduce the exact backup');
  pass('backup and exact restore');

  const invalidBackup = structuredClone(backup);
  invalidBackup.data.income_entries[0].account_id = '99999999-9999-4999-8999-999999999999';
  const beforeInvalidRestore = canonicalFinance(await loadFinanceData(owner));
  const invalidRestore = await owner.rpc('restore_finance_backup', { p_backup: invalidBackup });
  assert.ok(invalidRestore.error, 'Invalid backup restore unexpectedly succeeded');
  const afterInvalidRestore = canonicalFinance(await loadFinanceData(owner));
  assert.equal(afterInvalidRestore, beforeInvalidRestore, 'Failed restore changed financial data instead of rolling back');
  pass('invalid restore rolls back atomically without changing financial data');

  expectNoError(await other.rpc('complete_initial_setup', {
    p_accounts: [{ name: 'Other Cash', type: 'cash', starting_balance: 777 }],
    p_year: {
      label: 'Other 2026-27', start_date: '2026-06-05', end_date: '2027-06-04',
      target_tuition_fees: 5000, carry_forward_fees: 0, status: 'active',
    },
    p_templates: [],
  }), 'Other-user setup');
  const otherAccounts = expectNoError(await other.from('accounts').select('*'), 'Load other-user accounts');
  assert.equal(otherAccounts.length, 1);
  assert.equal(otherAccounts[0].name, 'Other Cash');
  assert.deepEqual(expectNoError(await other.from('accounts').select('*').eq('id', ids.schoolAccount), 'Cross-user account read'), []);
  assert.deepEqual(expectNoError(await other.from('income_entries').select('*'), 'Cross-user income read'), []);
  const spoofedOwnerInsert = await other.from('accounts').insert({
    user_id: ownerAuth.user.id,
    name: 'Spoofed Owner Account',
    type: 'cash',
    starting_balance: 1,
  });
  assert.ok(spoofedOwnerInsert.error, 'RLS permitted a cross-user owner spoof');
  const crossOwnerExpense = await other.from('expense_entries').insert({
    user_id: otherAuth.user.id,
    academic_year_id: ids.currentYear,
    expense_type: 'school',
    category: 'Cross-user attempt',
    amount: 1,
    date: '2026-08-21',
    account_id: ids.schoolAccount,
  });
  assert.ok(crossOwnerExpense.error, 'Finance trigger permitted cross-user account/year references');
  expectNoError(await other.rpc('wipe_finance_data'), 'Other-user wipe');
  assert.equal((expectNoError(await other.from('accounts').select('*'), 'Other-user post-wipe load')).length, 0);
  assert.equal((expectNoError(await owner.from('accounts').select('*'), 'Owner load after other-user wipe')).length, 4);
  pass('RLS, cross-user references, and per-user wipe isolation');

  expectNoError(await owner.rpc('wipe_finance_data'), 'Owner wipe');
  const wiped = await loadFinanceData(owner);
  for (const table of financeTables) assert.equal(wiped[table].length, 0, `${table} was not wiped`);
  expectNoError(await owner.rpc('restore_finance_backup', { p_backup: backup }), 'Restore after wipe');
  assert.equal(canonicalFinance(await loadFinanceData(owner)), backedUpCanonical, 'Restore after wipe changed backup data');
  pass('owner wipe and restore-after-wipe');

  const reloadedAuth = await authenticatedClient(ownerEmail, ownerPassword);
  const reloadedData = await loadFinanceData(reloadedAuth.supabase);
  assert.equal(canonicalFinance(reloadedData), backedUpCanonical, 'Data changed after a fresh authenticated client reload');
  assert.deepEqual(financialSummary(reloadedData, ids), {
    currentTuition: 100000,
    oldFees: 30000,
    lunch: 10000,
    other: 51000,
    schoolExpenses: 106000,
    homeExpenses: 20000,
    schoolProfit: 85000,
    overallPosition: 65000,
    currentPending: 900000,
    oldPending: 50000,
    schoolBalance: 90000,
    personalBalance: 40000,
    cashBalance: 25000,
    archivedBalance: 0,
  });
  pass('persistence and financial consistency after authenticated reload');

  console.log('LOCAL RELEASE GATE PASSED');
}

main().catch((error) => {
  console.error(`LOCAL RELEASE GATE FAILED | ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
