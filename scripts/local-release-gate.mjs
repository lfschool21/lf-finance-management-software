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

async function anonymousClient() {
  const supabase = client();
  const result = await supabase.auth.signInAnonymously();
  assert.equal(result.error, null, `Anonymous auth failed: ${result.error?.message}`);
  assert.ok(result.data.session, 'Anonymous auth did not return a session');
  assert.ok(result.data.user, 'Anonymous auth did not return a user');
  assert.equal(result.data.user.is_anonymous, true, 'User is not marked as anonymous');
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
  'students',
  'student_enrollments',
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

  const balancesBeforeImport = Object.fromEntries(initialAccounts.map((account) => [account.id, Number(account.starting_balance)]));
  const importResult = expectNoError(await owner.rpc('import_student_roster', {
    p_academic_year_id: ids.currentYear,
    p_rows: [{
      admission_number: 'IM-001', full_name: 'Imported Student', class_name: 'Class 7', medium: 'english',
      annual_fee_amount: 60000, additional_outstanding_amount: 0,
      opening_collected_cash: 7000, opening_collected_upi: 5000, opening_collected_other: 0,
      opening_snapshot_date: '2026-06-05', previous_academic_year_id: ids.oldYear,
      previous_class_name: 'Class 6', previous_medium: 'english', previous_annual_fee_amount: 20000,
      previous_opening_collected_cash: 4000, previous_opening_collected_upi: 0, previous_opening_collected_other: 0,
    }],
  }), 'Import valid student roster row');
  assert.deepEqual(importResult, { added: 1, failed: 0, total: 1, updated: 0 });

  const duplicateResult = expectNoError(await owner.rpc('import_student_roster', {
    p_academic_year_id: ids.currentYear,
    p_rows: [{
      admission_number: ' im-001 ', full_name: 'Imported Student Updated', class_name: 'Class 7A', medium: 'gujarati',
      annual_fee_amount: 65000, additional_outstanding_amount: 1000,
      opening_collected_cash: 7000, opening_collected_upi: 5000, opening_collected_other: 0,
      opening_snapshot_date: '2026-06-05', previous_academic_year_id: ids.oldYear,
      previous_class_name: 'Class 6', previous_medium: 'gujarati', previous_annual_fee_amount: 25000,
      previous_opening_collected_cash: 4000, previous_opening_collected_upi: 0, previous_opening_collected_other: 0,
    }],
  }), 'Re-import duplicate admission number as update');
  assert.deepEqual(duplicateResult, { added: 0, failed: 0, total: 1, updated: 1 });
  const importedStudents = expectNoError(
    await owner.from('students').select('*').ilike('admission_number', 'im-001'),
    'Load duplicate-import result',
  );
  assert.equal(importedStudents.length, 1, 'Duplicate admission import created another student');
  assert.equal(importedStudents[0].full_name, 'Imported Student Updated');
  const importedCurrentEnrollment = expectNoError(
    await owner.from('student_enrollments').select('*')
      .eq('student_id', importedStudents[0].id).eq('academic_year_id', ids.currentYear).single(),
    'Load updated imported enrollment',
  );
  assert.equal(importedCurrentEnrollment.class_name, 'Class 7A');
  assert.equal(importedCurrentEnrollment.medium, 'gujarati');

  const invalidImport = await owner.rpc('import_student_roster', {
    p_academic_year_id: ids.currentYear,
    p_rows: [
      {
        admission_number: 'IM-ROLLBACK', full_name: 'Must Roll Back', class_name: 'Class 2', medium: 'english',
        annual_fee_amount: 20000, additional_outstanding_amount: 0,
        opening_collected_cash: 0, opening_collected_upi: 0, opening_collected_other: 0,
      },
      {
        admission_number: 'IM-INVALID', full_name: 'Invalid Over Collection', class_name: 'Class 2', medium: 'english',
        annual_fee_amount: 1000, additional_outstanding_amount: 0,
        opening_collected_cash: 2000, opening_collected_upi: 0, opening_collected_other: 0,
      },
    ],
  });
  assert.ok(invalidImport.error, 'Invalid roster import unexpectedly succeeded');
  assert.equal(
    (expectNoError(await owner.from('students').select('id').in('admission_number', ['IM-ROLLBACK', 'IM-INVALID']), 'Check invalid import rollback')).length,
    0,
    'Invalid roster import partially committed rows',
  );
  const afterImport = await loadFinanceData(owner);
  assert.equal(afterImport.income_entries.length, 0, 'Opening import incorrectly created income');
  for (const account of afterImport.accounts) {
    assert.equal(balanceFor(account.id, afterImport), balancesBeforeImport[account.id], `Import changed account ${account.name} balance`);
  }
  pass('CSV/Excel-equivalent roster import, duplicate update, invalid-row rollback, and opening-balance isolation');

  const createdStudentAccount = expectNoError(await owner.rpc('save_student_with_enrollment', {
    p_student: { admission_number: 'RG-001', full_name: 'Release Gate Student', status: 'active' },
    p_enrollment: { academic_year_id: ids.currentYear, class_name: 'Class 6', medium: 'english', annual_fee_amount: 150000, additional_outstanding_amount: 0, opening_collected_cash: 5000, opening_collected_upi: 5000, opening_collected_other: 0, opening_snapshot_date: '2026-06-05', status: 'active' },
  }), 'Add release-gate student with current-year fee account');
  const student = createdStudentAccount.student;
  let currentEnrollment = createdStudentAccount.enrollment;
  const historicalStudentAccount = expectNoError(await owner.rpc('save_student_with_enrollment', {
    p_student: { id: student.id, admission_number: 'RG-001', full_name: 'Release Gate Student', status: 'active' },
    p_enrollment: { academic_year_id: ids.oldYear, class_name: 'Class 5', medium: 'english', annual_fee_amount: 50000, additional_outstanding_amount: 0, opening_collected_cash: 10000, opening_collected_upi: 0, opening_collected_other: 0, opening_snapshot_date: '2026-06-04', status: 'active' },
  }), 'Add historical student fee account');
  const oldEnrollment = historicalStudentAccount.enrollment;
  const editedStudentAccount = expectNoError(await owner.rpc('save_student_with_enrollment', {
    p_student: { id: student.id, admission_number: 'RG-001', full_name: 'Release Gate Student', status: 'active' },
    p_enrollment: { id: currentEnrollment.id, academic_year_id: ids.currentYear, class_name: 'Class 6', medium: 'english', annual_fee_amount: 150000, additional_outstanding_amount: 0, opening_collected_cash: 5000, opening_collected_upi: 5000, opening_collected_other: 0, opening_snapshot_date: '2026-06-05', status: 'active', notes: 'RPC edit verified' },
  }), 'Edit existing student fee account');
  currentEnrollment = editedStudentAccount.enrollment;

  expectNoError(await owner.from('income_entries').insert([
    {
      user_id: ownerAuth.user.id, academic_year_id: ids.currentYear, type: 'tuition', amount: 100000,
      date: '2026-08-01', account_id: ids.schoolAccount, is_late_collection: false,
      original_year_id: null, notes: 'Current tuition release gate', tags: ['release-gate'],
      student_enrollment_id: currentEnrollment.id, payment_method: 'upi', payment_reference: 'UPI-RG-001',
    },
    {
      user_id: ownerAuth.user.id, academic_year_id: ids.currentYear, type: 'tuition', amount: 30000,
      date: '2026-08-02', account_id: ids.schoolAccount, is_late_collection: true,
      original_year_id: ids.oldYear, notes: 'Old fees release gate', tags: ['release-gate'],
      student_enrollment_id: oldEnrollment.id, payment_method: 'cash', payment_reference: 'CASH-RG-001',
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
  const currentStudentPayments = data.income_entries.filter((row) => row.student_enrollment_id === currentEnrollment.id);
  const oldStudentPayments = data.income_entries.filter((row) => row.student_enrollment_id === oldEnrollment.id);
  const currentOpening = Number(currentEnrollment.opening_collected_cash)
    + Number(currentEnrollment.opening_collected_upi) + Number(currentEnrollment.opening_collected_other);
  const oldOpening = Number(oldEnrollment.opening_collected_cash)
    + Number(oldEnrollment.opening_collected_upi) + Number(oldEnrollment.opening_collected_other);
  const currentPaid = currentStudentPayments.reduce((sum, row) => sum + Number(row.amount), 0);
  const oldPaid = oldStudentPayments.reduce((sum, row) => sum + Number(row.amount), 0);
  assert.equal(currentStudentPayments.length, 1, 'Current-year fee was counted more than once');
  assert.equal(oldStudentPayments.length, 1, 'Previous-year fee was counted more than once');
  assert.equal(currentPaid, 100000);
  assert.equal(oldPaid, 30000);
  assert.equal(Number(currentEnrollment.annual_fee_amount) - currentOpening - currentPaid, 40000, 'Current student pending balance is wrong');
  assert.equal(Number(oldEnrollment.annual_fee_amount) - oldOpening - oldPaid, 10000, 'Previous student pending balance is wrong');
  assert.equal(currentPaid + oldPaid, 130000, 'Student-linked income total is wrong');
  assert.equal(financialSummary(data, ids).currentTuition, currentPaid, 'Opening current-year history was double-counted as income');
  assert.equal(financialSummary(data, ids).oldFees, oldPaid, 'Opening previous-year history was double-counted as income');
  pass('student current/previous fees, pending balances, Income, accounts, Dashboard/Reports semantics, and no double counting');

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
    version: '3.0',
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

  // -------------------------------------------------------------
  // Demo Mode Security, Isolation, Seeding, and Lifecycle
  // -------------------------------------------------------------
  // 1. Registered permanent users must NOT be allowed to invoke demo-only RPCs
  const regEnsure = await owner.rpc('ensure_demo_workspace');
  assert.ok(regEnsure.error, 'Registered user unexpectedly allowed to invoke ensure_demo_workspace');
  assert.ok(regEnsure.error.message.includes('anonymous demo sessions'), 'Expected security error message');
  const regReset = await owner.rpc('reset_demo_workspace');
  assert.ok(regReset.error, 'Registered user unexpectedly allowed to invoke reset_demo_workspace');
  const regDiscard = await owner.rpc('discard_demo_workspace');
  assert.ok(regDiscard.error, 'Registered user unexpectedly allowed to invoke discard_demo_workspace');
  pass('registered permanent user blocked from demo workspace RPCs');

  // 2. Anonymous Client A seeds demo workspace
  const demoA = await anonymousClient();
  expectNoError(await demoA.supabase.rpc('ensure_demo_workspace'), 'Demo A ensure_demo_workspace');
  const demoAData = await loadFinanceData(demoA.supabase);
  assert.equal(demoAData.academic_years.length, 2, 'Demo A academic years count');
  assert.equal(demoAData.accounts.length, 4, 'Demo A accounts count');
  assert.equal(demoAData.students.length, 14, 'Demo A students count');
  assert.equal(demoAData.student_enrollments.length, 16, 'Demo A student enrollments count');
  assert.equal(demoAData.recurring_templates.length, 4, 'Demo A recurring templates count');
  assert.ok(demoAData.income_entries.length > 0, 'Demo A income entries populated');
  assert.ok(demoAData.expense_entries.length > 0, 'Demo A expense entries populated');
  assert.ok(demoAData.transfers.length > 0, 'Demo A transfers populated');
  assert.ok(demoAData.recoverables.length > 0, 'Demo A recoverables populated');
  assert.ok(demoAData.recoverable_repayments.length > 0, 'Demo A recoverable repayments populated');

  // Verify all rows in demoA belong to demoA.user.id
  for (const table of financeTables) {
    for (const row of demoAData[table]) {
      assert.equal(row.user_id, demoA.user.id, `Demo A row in ${table} does not belong to Demo A user`);
    }
  }

  // Verify account balances reconcile with transactions
  for (const acc of demoAData.accounts) {
    const computedBal = balanceFor(acc.id, demoAData);
    assert.ok(Number.isFinite(computedBal), `Computed balance for account ${acc.name} is not finite`);
  }

  // Verify at least one recurring template is overdue (no generated expense this month or last_generated_date older)
  const overdueTemplates = demoAData.recurring_templates.filter(
    (t) => t.is_active && (!t.last_generated_date || new Date(t.last_generated_date) < new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  assert.ok(overdueTemplates.length >= 1, 'At least one recurring template must be overdue relative to current date');
  pass('demo workspace seeding, ownership, dynamic dates, and financial consistency');

  // 3. Anonymous Client B - Multi-tenant isolation and non-colliding UUIDs
  const demoB = await anonymousClient();
  expectNoError(await demoB.supabase.rpc('ensure_demo_workspace'), 'Demo B ensure_demo_workspace');
  const demoBData = await loadFinanceData(demoB.supabase);
  assert.notEqual(demoA.user.id, demoB.user.id, 'Demo A and Demo B must have distinct auth.uids');
  // Confirm Demo B cannot see Demo A data
  assert.deepEqual(expectNoError(await demoB.supabase.from('students').select('*').eq('user_id', demoA.user.id), 'Demo B cross-read Demo A students'), []);
  // Confirm IDs are unique (no shared UUIDs)
  const demoAStudentIds = new Set(demoAData.students.map((s) => s.id));
  for (const bStudent of demoBData.students) {
    assert.ok(!demoAStudentIds.has(bStudent.id), `Row UUID collision between Demo A and Demo B for student ${bStudent.admission_number}`);
  }
  pass('anonymous sessions multi-tenant RLS isolation and distinct UUID generation');

  // 4. Demo A modify, backup, wipe, and restore
  const demoABackup = {
    version: '3.0',
    date: new Date().toISOString(),
    data: demoAData,
  };
  expectNoError(await demoA.supabase.rpc('wipe_finance_data'), 'Demo A wipe');
  const demoAPostWipe = await loadFinanceData(demoA.supabase);
  assert.equal(demoAPostWipe.accounts.length, 0, 'Demo A accounts wiped');
  // Demo B data still exists
  const demoBPostAWipe = await loadFinanceData(demoB.supabase);
  assert.equal(demoBPostAWipe.accounts.length, 4, 'Demo B accounts unaffected by Demo A wipe');

  // Demo A restores backup
  expectNoError(await demoA.supabase.rpc('restore_finance_backup', { p_backup: demoABackup }), 'Demo A restore');
  const demoAPostRestore = await loadFinanceData(demoA.supabase);
  assert.equal(demoAPostRestore.accounts.length, 4, 'Demo A accounts restored');
  for (const table of financeTables) {
    for (const row of demoAPostRestore[table]) {
      assert.equal(row.user_id, demoA.user.id, `Restored row in ${table} does not belong to Demo A`);
    }
  }
  pass('demo mode backup, wipe, and restore with user ownership validation');

  // 5. Demo A Reset Demo Workspace
  expectNoError(await demoA.supabase.rpc('reset_demo_workspace'), 'Demo A reset_demo_workspace');
  const demoAPostReset = await loadFinanceData(demoA.supabase);
  assert.equal(demoAPostReset.accounts.length, 4, 'Demo A accounts after reset');
  assert.equal(demoAPostReset.students.length, 14, 'Demo A students after reset');
  pass('reset_demo_workspace cleanly restores canonical dataset');

  // 6. Demo A Discard Demo Workspace (Exit Demo)
  expectNoError(await demoA.supabase.rpc('discard_demo_workspace'), 'Demo A discard_demo_workspace');
  const demoAPostDiscard = await loadFinanceData(demoA.supabase);
  for (const table of financeTables) {
    assert.equal(demoAPostDiscard[table].length, 0, `Demo A ${table} not cleared after discard`);
  }
  // Demo B still has data!
  const demoBFinal = await loadFinanceData(demoB.supabase);
  assert.equal(demoBFinal.accounts.length, 4, 'Demo B unaffected by Demo A discard');
  pass('discard_demo_workspace deletes only caller records without reseeding');

  console.log('LOCAL RELEASE GATE PASSED');
}

main().catch((error) => {
  console.error(`LOCAL RELEASE GATE FAILED | ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
