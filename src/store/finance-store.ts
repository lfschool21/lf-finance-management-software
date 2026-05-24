import { create } from 'zustand';
import type {
  AcademicYear,
  Account,
  IncomeEntry,
  ExpenseEntry,
  Transfer,
  RecurringTemplate,
} from '@/types/finance';
import { FIXED_EXPENSE_CATEGORIES } from '@/types/finance';
import * as academicYearsService from '@/services/academicYears';
import * as accountsService from '@/services/accounts';
import * as incomeService from '@/services/income';
import * as expensesService from '@/services/expenses';
import * as transfersService from '@/services/transfers';
import * as recurringService from '@/services/recurring';

function toDate(d: string | Date): Date {
  return d instanceof Date ? d : new Date(d);
}

function mapAcademicYear(row: academicYearsService.DbAcademicYear): AcademicYear {
  return {
    id: row.id,
    label: row.label,
    startDate: toDate(row.start_date),
    endDate: toDate(row.end_date),
    targetTuitionFees: Number(row.target_tuition_fees),
    carryForwardFees: Number(row.carry_forward_fees ?? 0),
    status: row.status,
  };
}

function mapAccount(row: accountsService.DbAccount): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    startingBalance: Number(row.starting_balance),
    isArchived: row.is_archived,
  };
}

function mapIncome(row: incomeService.DbIncomeEntry): IncomeEntry {
  return {
    id: row.id,
    academicYearId: row.academic_year_id,
    type: row.type,
    amount: Number(row.amount),
    date: toDate(row.date),
    accountId: row.account_id,
    isLateCollection: row.is_late_collection,
    originalYearId: row.original_year_id,
    notes: row.notes || '',
    tags: row.tags || [],
  };
}

function mapExpense(row: expensesService.DbExpenseEntry): ExpenseEntry {
  return {
    id: row.id,
    academicYearId: row.academic_year_id,
    expenseType: row.expense_type,
    category: row.category,
    amount: Number(row.amount),
    date: toDate(row.date),
    accountId: row.account_id,
    description: row.description || '',
    tags: row.tags || [],
    isRecurringInstance: row.is_recurring_instance,
    recurringTemplateId: row.recurring_template_id,
  };
}

function mapTransfer(row: transfersService.DbTransfer): Transfer {
  return {
    id: row.id,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    amount: Number(row.amount),
    date: toDate(row.date),
    category: row.category,
    notes: row.notes || '',
  };
}

function mapRecurring(row: recurringService.DbRecurringTemplate): RecurringTemplate {
  return {
    id: row.id,
    expenseType: row.expense_type,
    category: row.category,
    defaultAmount: Number(row.default_amount),
    recurrenceInterval: row.recurrence_interval,
    lastGeneratedDate: row.last_generated_date ? toDate(row.last_generated_date) : null,
    isActive: row.is_active,
  };
}

export interface PendingRecurringItem {
  template: RecurringTemplate;
  lastAmount: number;
}

export interface YearPendingInfo {
  yearId: string;
  totalOwed: number;       // targetTuitionFees + carryForwardFees
  collected: number;       // direct + late-collection payments
  remaining: number;       // totalOwed - collected (floored at 0)
  targetGap: number;       // max(0, targetTuitionFees - collected)
  carryForward: number;    // carryForwardFees value
}

export interface YearProfitBreakdown {
  totalIncome: number;
  fixedExpenses: number;
  grossProfit: number;
  extraExpenses: number;
  netProfit: number;
  fixedBreakdown: { category: string; amount: number }[];
  extraBreakdown: { category: string; amount: number }[];
}

interface FinanceState {
  academicYears: AcademicYear[];
  accounts: Account[];
  incomeEntries: IncomeEntry[];
  expenseEntries: ExpenseEntry[];
  transfers: Transfer[];
  recurringTemplates: RecurringTemplate[];
  currentYearId: string;
  isSetupComplete: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  isDarkMode: boolean;
  pendingRecurringItems: PendingRecurringItem[];
  toggleDarkMode: () => void;
  init: () => Promise<void>;
  addIncome: (data: incomeService.IncomeInsert) => Promise<void>;
  updateIncome: (id: string, data: Partial<incomeService.IncomeInsert>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  addExpense: (data: expensesService.ExpenseInsert) => Promise<void>;
  updateExpense: (id: string, data: Partial<expensesService.ExpenseInsert>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addTransfer: (data: transfersService.TransferInsert) => Promise<void>;
  updateTransfer: (id: string, data: Partial<transfersService.TransferInsert>) => Promise<void>;
  deleteTransfer: (id: string) => Promise<void>;
  getAccountBalance: (accountId: string) => number;
  getTotalBalance: () => number;
  getYearForDate: (date: Date) => AcademicYear | undefined;
  getYearProfitBreakdown: (yearId: string) => YearProfitBreakdown;
  getAllTimeCumulativeProfit: () => number;
  getProjectedProfit: (yearId: string) => number;
  refreshAccounts: () => Promise<void>;
  refreshAcademicYears: () => Promise<void>;
  refreshRecurringTemplates: () => Promise<void>;
  getPendingForYear: (yearId: string) => YearPendingInfo;
  getAllPendingTotal: () => number;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  academicYears: [],
  accounts: [],
  incomeEntries: [],
  expenseEntries: [],
  transfers: [],
  recurringTemplates: [],
  currentYearId: '',
  isSetupComplete: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  isDarkMode: false,
  pendingRecurringItems: [],

  toggleDarkMode: () =>
    set((state) => {
      const next = !state.isDarkMode;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('darkMode', next ? '1' : '0');
      return { isDarkMode: next };
    }),

  init: async () => {
    set({ isLoading: true, error: null });
    try {
      const [yearsRes, accRes, incRes, expRes, trRes, recRes] = await Promise.all([
        academicYearsService.getAll(),
        accountsService.getAll(),
        incomeService.getAll(),
        expensesService.getAll(),
        transfersService.getAll(),
        recurringService.getAll(),
      ]);

      const years = (yearsRes.data || []).map(mapAcademicYear);
      const accounts = (accRes.data || []).map(mapAccount);
      const incomeEntries = (incRes.data || []).map(mapIncome);
      const expenseEntries = (expRes.data || []).map(mapExpense);
      const transfers = (trRes.data || []).map(mapTransfer);
      const recurringTemplates = (recRes.data || []).map(mapRecurring);

      const today = new Date();
      const activeYear = years.find(
        (y) => today >= y.startDate && today <= y.endDate
      );
      const currentYearId = activeYear?.id || years[0]?.id || '';

      // Check pending recurring
      const currentMonth = today.getMonth();
      const currentFullYear = today.getFullYear();
      const pendingRecurringItems: PendingRecurringItem[] = [];

      for (const template of recurringTemplates) {
        if (!template.isActive) continue;

        const hasThisMonth = expenseEntries.some(
          (e) =>
            e.isRecurringInstance &&
            e.category === template.category &&
            e.date.getMonth() === currentMonth &&
            e.date.getFullYear() === currentFullYear
        );

        if (!hasThisMonth) {
          let needsGeneration = true;
          if (template.recurrenceInterval === 'bimonthly' && template.lastGeneratedDate) {
            const lastGen = template.lastGeneratedDate;
            const monthsDiff = (currentFullYear - lastGen.getFullYear()) * 12 + (currentMonth - lastGen.getMonth());
            if (monthsDiff < 2) needsGeneration = false;
          }

          if (needsGeneration) {
            // Find last month's amount for reference
            const prevEntries = expenseEntries
              .filter((e) => e.isRecurringInstance && e.category === template.category)
              .sort((a, b) => b.date.getTime() - a.date.getTime());
            const lastAmount = prevEntries[0]?.amount || template.defaultAmount;

            pendingRecurringItems.push({ template, lastAmount });
          }
        }
      }

      // Restore dark mode
      const savedDark = localStorage.getItem('darkMode') === '1';
      if (savedDark) document.documentElement.classList.add('dark');

      set({
        academicYears: years,
        accounts,
        incomeEntries,
        expenseEntries,
        transfers,
        recurringTemplates,
        currentYearId,
        isSetupComplete: accounts.length > 0,
        isLoading: false,
        isInitialized: true,
        error: null,
        isDarkMode: savedDark,
        pendingRecurringItems,
      });
    } catch (err) {
      set({
        isLoading: false,
        isInitialized: true,
        error: err instanceof Error ? err.message : 'Failed to load data',
      });
    }
  },

  addIncome: async (data) => {
    const { data: created, error } = await incomeService.create(data);
    if (error || !created) throw error || new Error('Failed to create income');
    set((state) => ({
      incomeEntries: [mapIncome(created), ...state.incomeEntries],
    }));
  },

  updateIncome: async (id, data) => {
    const { data: updated, error } = await incomeService.update(id, data);
    if (error || !updated) throw error || new Error('Failed to update income');
    set((state) => ({
      incomeEntries: state.incomeEntries.map((e) => (e.id === id ? mapIncome(updated) : e)),
    }));
  },

  deleteIncome: async (id) => {
    const { error } = await incomeService.deleteEntry(id);
    if (error) throw error;
    set((state) => ({
      incomeEntries: state.incomeEntries.filter((e) => e.id !== id),
    }));
  },

  addExpense: async (data) => {
    const { data: created, error } = await expensesService.create(data);
    if (error || !created) throw error || new Error('Failed to create expense');
    set((state) => ({
      expenseEntries: [mapExpense(created), ...state.expenseEntries],
    }));
  },

  updateExpense: async (id, data) => {
    const { data: updated, error } = await expensesService.update(id, data);
    if (error || !updated) throw error || new Error('Failed to update expense');
    set((state) => ({
      expenseEntries: state.expenseEntries.map((e) => (e.id === id ? mapExpense(updated) : e)),
    }));
  },

  deleteExpense: async (id) => {
    const { error } = await expensesService.deleteEntry(id);
    if (error) throw error;
    set((state) => ({
      expenseEntries: state.expenseEntries.filter((e) => e.id !== id),
    }));
  },

  addTransfer: async (data) => {
    const { data: created, error } = await transfersService.create(data);
    if (error || !created) throw error || new Error('Failed to create transfer');
    set((state) => ({
      transfers: [mapTransfer(created), ...state.transfers],
    }));
  },

  updateTransfer: async (id, data) => {
    const { data: updated, error } = await transfersService.update(id, data);
    if (error || !updated) throw error || new Error('Failed to update transfer');
    set((state) => ({
      transfers: state.transfers.map((t) => (t.id === id ? mapTransfer(updated) : t)),
    }));
  },

  deleteTransfer: async (id) => {
    const { error } = await transfersService.deleteEntry(id);
    if (error) throw error;
    set((state) => ({
      transfers: state.transfers.filter((t) => t.id !== id),
    }));
  },

  getAccountBalance: (accountId: string) => {
    const state = get();
    const account = state.accounts.find((a) => a.id === accountId);
    if (!account) return 0;
    const income = state.incomeEntries
      .filter((i) => i.accountId === accountId)
      .reduce((s, i) => s + i.amount, 0);
    const expenses = state.expenseEntries
      .filter((e) => e.accountId === accountId)
      .reduce((s, e) => s + e.amount, 0);
    const transfersIn = state.transfers
      .filter((t) => t.toAccountId === accountId)
      .reduce((s, t) => s + t.amount, 0);
    const transfersOut = state.transfers
      .filter((t) => t.fromAccountId === accountId)
      .reduce((s, t) => s + t.amount, 0);
    return account.startingBalance + income - expenses + transfersIn - transfersOut;
  },

  getTotalBalance: () => {
    const state = get();
    return state.accounts
      .filter((a) => !a.isArchived)
      .reduce((sum, a) => sum + get().getAccountBalance(a.id), 0);
  },

  getYearForDate: (date: Date) => {
    const state = get();
    return state.academicYears.find(
      (y) => date >= y.startDate && date <= y.endDate
    );
  },

  getYearProfitBreakdown: (yearId: string): YearProfitBreakdown => {
    const state = get();
    const fixedCats = FIXED_EXPENSE_CATEGORIES as readonly string[];

    // Income: regular + late collections attributed to this year
    const yearIncome = state.incomeEntries.filter(
      (i) => i.academicYearId === yearId || (i.isLateCollection && i.originalYearId === yearId)
    );
    const totalIncome = yearIncome.reduce((s, i) => s + i.amount, 0);

    // School expenses only
    const yearSchoolExpenses = state.expenseEntries.filter(
      (e) => e.academicYearId === yearId && e.expenseType === 'school'
    );

    const fixedMap = new Map<string, number>();
    const extraMap = new Map<string, number>();

    yearSchoolExpenses.forEach((e) => {
      if (fixedCats.includes(e.category)) {
        fixedMap.set(e.category, (fixedMap.get(e.category) || 0) + e.amount);
      } else {
        extraMap.set(e.category, (extraMap.get(e.category) || 0) + e.amount);
      }
    });

    const fixedExpenses = Array.from(fixedMap.values()).reduce((s, v) => s + v, 0);
    const extraExpenses = Array.from(extraMap.values()).reduce((s, v) => s + v, 0);

    return {
      totalIncome,
      fixedExpenses,
      grossProfit: totalIncome - fixedExpenses,
      extraExpenses,
      netProfit: totalIncome - fixedExpenses - extraExpenses,
      fixedBreakdown: Array.from(fixedMap.entries()).map(([category, amount]) => ({ category, amount })),
      extraBreakdown: Array.from(extraMap.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    };
  },

  getAllTimeCumulativeProfit: () => {
    const state = get();
    return state.academicYears.reduce((sum, y) => {
      return sum + get().getYearProfitBreakdown(y.id).netProfit;
    }, 0);
  },

  getProjectedProfit: (yearId: string) => {
    const state = get();
    const year = state.academicYears.find((y) => y.id === yearId);
    if (!year) return 0;

    const today = new Date();
    const monthsElapsed = Math.max(1,
      (today.getFullYear() - year.startDate.getFullYear()) * 12 +
      (today.getMonth() - year.startDate.getMonth()) + 1
    );
    const totalMonths = Math.max(1,
      (year.endDate.getFullYear() - year.startDate.getFullYear()) * 12 +
      (year.endDate.getMonth() - year.startDate.getMonth()) + 1
    );
    const remainingMonths = Math.max(0, totalMonths - monthsElapsed);

    const breakdown = get().getYearProfitBreakdown(yearId);
    const currentSchoolExpenses = breakdown.fixedExpenses + breakdown.extraExpenses;
    const avgMonthlyExpense = currentSchoolExpenses / monthsElapsed;
    const projectedExpenses = currentSchoolExpenses + (avgMonthlyExpense * remainingMonths);

    // Projected income = current + uncollected from target (carry-forward is already owed, not future income)
    const pending = get().getPendingForYear(yearId);
    const uncollected = Math.max(0, pending.targetGap);
    const projectedIncome = breakdown.totalIncome + uncollected;

    return projectedIncome - projectedExpenses;
  },

  /**
   * Single source of truth for how much is still owed for a given academic year.
   * Accounts for:
   *   - tuition paid directly to this year
   *   - late-collection payments that reference this year as the original year
   *   - carryForwardFees (manually set)
   */
  getPendingForYear: (yearId: string): YearPendingInfo => {
    const state = get();
    const year = state.academicYears.find((y) => y.id === yearId);
    if (!year) {
      return { yearId, totalOwed: 0, collected: 0, remaining: 0, targetGap: 0, carryForward: 0 };
    }
    // Collect all tuition payments that count toward this year:
    //   1. Direct entries booked to this year (not marked as late collection)
    //   2. Late-collection entries whose originalYearId === this year
    const collected = state.incomeEntries
      .filter(
        (i) =>
          i.type === 'tuition' &&
          (
            (i.academicYearId === yearId && !i.isLateCollection) ||
            (i.isLateCollection && i.originalYearId === yearId)
          )
      )
      .reduce((s, i) => s + i.amount, 0);

    const carryForward = year.carryForwardFees || 0;
    const targetGap = Math.max(0, year.targetTuitionFees - collected);
    const totalOwed = year.targetTuitionFees + carryForward;
    const remaining = Math.max(0, totalOwed - collected);

    return { yearId, totalOwed, collected, remaining, targetGap, carryForward };
  },

  getAllPendingTotal: () => {
    const state = get();
    return state.academicYears.reduce((sum, y) => {
      return sum + get().getPendingForYear(y.id).remaining;
    }, 0);
  },

  refreshAccounts: async () => {
    const { data } = await accountsService.getAll();
    if (data) set({ accounts: data.map(mapAccount) });
  },

  refreshAcademicYears: async () => {
    const { data } = await academicYearsService.getAll();
    if (data) set({ academicYears: data.map(mapAcademicYear) });
  },

  refreshRecurringTemplates: async () => {
    const { data } = await recurringService.getAll();
    if (data) set({ recurringTemplates: data.map(mapRecurring) });
  },
}));
