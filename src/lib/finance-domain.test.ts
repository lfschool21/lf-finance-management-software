import { describe, expect, it } from 'vitest';
import type { Account, AcademicYear, ExpenseEntry, IncomeEntry, Recoverable, RecoverableRepayment, Transfer } from '@/types/finance';
import {
  findAcademicYearForDate,
  getAccountBalance,
  getAccountMovement,
  getFeeOutstanding,
  getIncomeBreakdown,
  getRecoverableSummary,
  inferTransferCategory,
  isRecurringDue,
  parsePositiveAmount,
  parseStrictNumber,
  requiredStartingBalance,
} from './finance-domain';

const account: Account = { id: 'a', name: 'Bank', type: 'school_bank', startingBalance: 100_000, isArchived: false };
const year: AcademicYear = {
  id: 'y1', label: '2025-26', startDate: new Date(2025, 5, 5), endDate: new Date(2026, 5, 4),
  targetTuitionFees: 80_000, carryForwardFees: 0, status: 'closed',
};

function income(overrides: Partial<IncomeEntry> = {}): IncomeEntry {
  return { id: crypto.randomUUID(), academicYearId: 'y2', category: 'Tuition Fees', amount: 30_000,
    date: new Date(2026, 7, 15), accountId: 'a', isLateCollection: true, originalYearId: 'y1', notes: '', tags: [], ...overrides };
}

describe('financial domain', () => {
  it('calculates current balance and translates a desired balance into opening balance', () => {
    const incomes = [income({ amount: 20_000, isLateCollection: false, originalYearId: null })];
    const expenses: ExpenseEntry[] = [{ id: 'e', academicYearId: 'y1', expenseType: 'school', category: 'Salary & Wages', subCategory: '', amount: 5_000, date: new Date(), accountId: 'a', description: '', tags: [], isRecurringInstance: false, recurringTemplateId: null }];
    const transfers: Transfer[] = [{ id: 't', fromAccountId: 'a', toAccountId: 'b', amount: 10_000, date: new Date(), category: 'internal', notes: '' }];
    const movement = getAccountMovement('a', incomes, expenses, transfers);
    expect(getAccountBalance(account, movement)).toBe(105_000);
    expect(requiredStartingBalance(90_000, movement)).toBe(85_000);
    expect(getAccountBalance({ ...account, startingBalance: 85_000 }, movement)).toBe(90_000);
  });

  it('keeps cash income sources separate', () => {
    const entries = [
      income({ amount: 100_000, isLateCollection: false, originalYearId: null }),
      income({ amount: 30_000 }),
      income({ category: 'Lunch Fees', amount: 10_000, isLateCollection: false, originalYearId: null }),
      income({ category: 'Other Income', amount: 50_000, isLateCollection: false, originalYearId: null }),
    ];
    expect(getIncomeBreakdown(entries)).toEqual({ currentTuition: 100_000, oldFees: 30_000, lunch: 10_000, other: 50_000, total: 190_000 });
  });

  it('attributes late tuition to the original obligation and excludes an edited row', () => {
    const payment = income({ id: 'late', amount: 30_000 });
    expect(getFeeOutstanding(year, [payment]).remaining).toBe(50_000);
    expect(getFeeOutstanding(year, [payment], 'late').remaining).toBe(80_000);
  });

  it('includes advances and recoveries only in liquid movement', () => {
    const advance: Recoverable = { id: 'r', partyName: 'Person A', originalAmount: 40_000, dateGiven: new Date(), sourceAccountId: 'a', notes: '' };
    const repayment: RecoverableRepayment = { id: 'p', recoverableId: 'r', amount: 15_000, date: new Date(), accountId: 'a', notes: '' };
    const movement = getAccountMovement('a', [], [], [], [advance], [repayment]);
    expect(movement.net).toBe(-25_000);
    expect(getRecoverableSummary(advance, [repayment])).toEqual({ recovered: 15_000, outstanding: 25_000, status: 'partially_recovered' });
  });

  it('uses deterministic transfer categories and recurrence intervals', () => {
    expect(inferTransferCategory('school_bank', 'personal_bank')).toBe('school_to_personal');
    expect(inferTransferCategory('cash', 'school_bank')).toBe('cash_deposit');
    expect(isRecurringDue('quarterly', new Date(2026, 5, 1), new Date(2026, 7, 1))).toBe(false);
    expect(isRecurringDue('quarterly', new Date(2026, 5, 1), new Date(2026, 8, 1))).toBe(true);
  });

  it('handles date-only boundaries and strict numbers', () => {
    expect(findAcademicYearForDate([year], '2025-06-05')?.id).toBe('y1');
    expect(findAcademicYearForDate([year], '2026-06-04')?.id).toBe('y1');
    expect(findAcademicYearForDate([year], '2026-06-05')).toBeUndefined();
    expect(parseStrictNumber('')).toBeNull();
    expect(parsePositiveAmount('Infinity')).toBeNull();
    expect(parsePositiveAmount('-1')).toBeNull();
    expect(parsePositiveAmount('10')).toBe(10);
  });

  it('changes tuition pending only for tuition, never lunch or investment income', () => {
    const currentTuition = income({ academicYearId: 'y1', amount: 10_000, isLateCollection: false, originalYearId: null });
    const lunch = income({ academicYearId: 'y1', category: 'Lunch Fees', amount: 5_000, isLateCollection: false, originalYearId: null });
    const investment = income({ academicYearId: 'y1', category: 'Other Income', amount: 7_000, isLateCollection: false, originalYearId: null });
    expect(getFeeOutstanding(year, [currentTuition]).remaining).toBe(70_000);
    expect(getFeeOutstanding(year, [currentTuition, lunch, investment]).remaining).toBe(70_000);
    expect(getAccountMovement('a', [currentTuition, lunch, investment], [], []).income).toBe(22_000);
  });

  it('replacing a transfer keeps one record, moves only cash, and preserves the combined total', () => {
    const accountB: Account = { id: 'b', name: 'Cash', type: 'cash', startingBalance: 50_000, isArchived: false };
    const edited: Transfer[] = [{ id: 'same-id', fromAccountId: 'a', toAccountId: 'b', amount: 10_000, date: new Date(), category: 'cash_withdrawal', notes: '' }];
    const balanceA = getAccountBalance(account, getAccountMovement('a', [], [], edited));
    const balanceB = getAccountBalance(accountB, getAccountMovement('b', [], [], edited));
    expect(edited).toHaveLength(1);
    expect(edited[0].id).toBe('same-id');
    expect(balanceA).toBe(90_000);
    expect(balanceB).toBe(60_000);
    expect(balanceA + balanceB).toBe(150_000);
  });

  it('recalculates an edited old-fee payment without counting the old row twice', () => {
    const original = income({ id: 'old-fee', amount: 30_000 });
    const before = getFeeOutstanding(year, [original]);
    const editCapacity = getFeeOutstanding(year, [original], original.id).remaining;
    const edited = { ...original, amount: 20_000 };
    const after = getFeeOutstanding(year, [edited]);
    expect(before.remaining).toBe(50_000);
    expect(editCapacity).toBe(80_000);
    expect(after.remaining).toBe(60_000);
  });

  it('uses each recurring interval exactly across year boundaries', () => {
    const november = new Date(2025, 10, 15);
    expect(isRecurringDue('monthly', november, new Date(2025, 11, 1))).toBe(true);
    expect(isRecurringDue('bimonthly', november, new Date(2025, 11, 1))).toBe(false);
    expect(isRecurringDue('bimonthly', november, new Date(2026, 0, 1))).toBe(true);
    expect(isRecurringDue('quarterly', november, new Date(2026, 0, 1))).toBe(false);
    expect(isRecurringDue('quarterly', november, new Date(2026, 1, 1))).toBe(true);
  });
});
