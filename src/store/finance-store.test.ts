import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFinanceStore } from './finance-store';
import type { Account, AcademicYear, ExpenseEntry, IncomeEntry } from '@/types/finance';
import * as incomeService from '@/services/income';
import * as expensesService from '@/services/expenses';

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
  vi.restoreAllMocks();
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

  it('keeps archived account movements in the overall balance while ignoring stored openings', () => {
    useFinanceStore.setState({
      incomeEntries: [income('active-income', 200), { ...income('archived-income', 75), accountId: 'archived' }],
    });
    expect(useFinanceStore.getState().getTotalBalance()).toBe(275);
  });

  it('uses target plus preserved carry-forward for tuition outstanding', () => {
    useFinanceStore.setState({ incomeEntries: [income('current', 40), { ...income('old', 30, true), academicYearId: 'later', originalYearId: 'year' }] });
    expect(useFinanceStore.getState().getPendingForYear('year')).toMatchObject({
      totalOwed: 120, collected: 70, remaining: 50, carryForward: 20,
    });
  });

  it('keeps an idempotent student-payment retry as one income row and one balance increase', async () => {
    const persisted = {
      id: 'same-payment', user_id: 'user', academic_year_id: 'year', type: 'tuition' as const,
      amount: 2_000, date: '2026-01-10', account_id: 'active', is_late_collection: false,
      original_year_id: null, student_enrollment_id: 'enrollment', payment_method: 'cash' as const,
      payment_reference: null, client_request_id: '11111111-1111-4111-8111-111111111111', notes: null,
      tags: [], created_at: '2026-01-10T00:00:00Z', updated_at: '2026-01-10T00:00:00Z',
    };
    vi.spyOn(incomeService, 'recordStudentPayment').mockResolvedValue({ data: persisted, error: null });
    const request = {
      client_request_id: persisted.client_request_id,
      student_enrollment_id: 'enrollment', academic_year_id: 'year', amount: 2_000,
      date: '2026-01-10', account_id: 'active', payment_method: 'cash' as const,
      original_year_id: null, payment_reference: null, notes: null,
    };

    await useFinanceStore.getState().recordStudentPayment(request);
    await useFinanceStore.getState().recordStudentPayment(request);

    expect(useFinanceStore.getState().incomeEntries).toHaveLength(1);
    expect(useFinanceStore.getState().getAccountBalance('active')).toBe(2_000);
  });

  it('does not change a balance when an expense write fails', async () => {
    useFinanceStore.setState({ incomeEntries: [income('existing', 3_000)] });
    vi.spyOn(expensesService, 'create').mockResolvedValue({ data: null, error: new Error('write failed') } as never);
    const before = useFinanceStore.getState().getAccountBalance('active');

    await expect(useFinanceStore.getState().addExpense({
      academic_year_id: 'year', expense_type: 'school', category: 'Rent', sub_category: null,
      amount: 1_000, date: '2026-01-10', account_id: 'active', description: null, tags: null,
      is_recurring_instance: false, recurring_template_id: null,
    })).rejects.toThrow('write failed');

    expect(useFinanceStore.getState().getAccountBalance('active')).toBe(before);
    expect(useFinanceStore.getState().expenseEntries).toHaveLength(0);
  });
});
