import { beforeEach, describe, expect, it } from 'vitest';
import { useFinanceStore } from './finance-store';
import type { Account, AcademicYear, ExpenseEntry, IncomeEntry } from '@/types/finance';

const year: AcademicYear = {
  id: 'year', label: '2025-26', startDate: new Date(2025, 5, 5), endDate: new Date(2026, 5, 4),
  targetTuitionFees: 100, carryForwardFees: 20, status: 'active',
};
const accounts: Account[] = [
  { id: 'active', name: 'School', type: 'school_bank', startingBalance: 1_000, isArchived: false },
  { id: 'archived', name: 'Old Bank', type: 'personal_bank', startingBalance: 500, isArchived: true },
];

const income = (id: string, amount: number, late = false): IncomeEntry => ({
  id, academicYearId: 'year', category: 'Tuition Fees', amount, date: new Date(2026, 0, 10),
  accountId: 'active', isLateCollection: late, originalYearId: late ? 'previous' : null,
  studentEnrollmentId: null, paymentMethod: null, paymentReference: '', notes: '', tags: [],
});
const expense = (id: string, amount: number, expenseType: 'school' | 'home', category: string): ExpenseEntry => ({
  id, academicYearId: 'year', expenseType, category, subCategory: '', amount, date: new Date(2026, 0, 11),
  accountId: expenseType === 'school' ? 'active' : 'archived', description: '', tags: [],
  isRecurringInstance: false, recurringTemplateId: null,
});

beforeEach(() => {
  useFinanceStore.setState({
    academicYears: [year], accounts, incomeEntries: [], expenseEntries: [], transfers: [],
    recoverables: [], recoverableRepayments: [], recurringTemplates: [], currentYearId: 'year',
  });
});

describe('finance store accounting semantics', () => {
  it('keeps home expenses out of School Profit while cash-period old fees remain income', () => {
    useFinanceStore.setState({
      incomeEntries: [income('current', 70), income('old-fee-cash', 30, true)],
      expenseEntries: [expense('fixed', 20, 'school', 'Salary & Wages'), expense('extra', 10, 'school', 'Repairs'), expense('home', 40, 'home', 'Groceries')],
    });
    const result = useFinanceStore.getState().getYearProfitBreakdown('year');
    expect(result.totalIncome).toBe(100);
    expect(result.netProfit).toBe(70);
    expect(result.netProfit - 40).toBe(30); // Overall Position is reported separately.
  });

  it('keeps archived account money in the overall balance', () => {
    expect(useFinanceStore.getState().getTotalBalance()).toBe(1_500);
  });

  it('uses target plus preserved carry-forward for tuition outstanding', () => {
    useFinanceStore.setState({ incomeEntries: [income('current', 40), { ...income('old', 30, true), academicYearId: 'later', originalYearId: 'year' }] });
    expect(useFinanceStore.getState().getPendingForYear('year')).toMatchObject({
      totalOwed: 120, collected: 70, remaining: 50, carryForward: 20,
    });
  });
});
