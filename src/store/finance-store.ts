import { create } from 'zustand';
import type {
  AcademicYear,
  Account,
  IncomeEntry,
  ExpenseEntry,
  Transfer,
  RecurringTemplate,
  Recoverable,
  RecoverableRepayment,
} from '@/types/finance';
import { FIXED_EXPENSE_CATEGORIES } from '@/types/finance';
import * as academicYearsService from '@/services/academicYears';
import * as accountsService from '@/services/accounts';
import * as incomeService from '@/services/income';
import * as expensesService from '@/services/expenses';
import * as transfersService from '@/services/transfers';
import * as recurringService from '@/services/recurring';
import * as recoverablesService from '@/services/recoverables';
import { supabase } from '@/services/supabase';
import {
  findAcademicYearForDate,
  getAccountBalance as calculateAccountBalance,
  getAccountMovement,
  getFeeOutstanding,
  isRecurringDue,
  parseDateOnly,
} from '@/lib/finance-domain';

function toDate(d: string | Date): Date {
  return d instanceof Date ? d : parseDateOnly(d);
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

/** Translate DB enum stored in the type column to a display category name */
function dbTypeToCategory(dbType: string): string {
  if (dbType === 'tuition') return 'Tuition Fees';
  if (dbType === 'lunch')   return 'Lunch Fees';
  if (dbType === 'other')   return 'Other Income';
  return dbType; // pass through if already a display name (legacy rows)
}

function mapIncome(row: incomeService.DbIncomeEntry): IncomeEntry {
  return {
    id: row.id,
    academicYearId: row.academic_year_id,
    category: dbTypeToCategory(row.type),  // normalise DB enum → display name
    amount: Number(row.amount),
    date: toDate(row.date),
    accountId: row.account_id,
    isLateCollection: row.is_late_collection ?? false,
    originalYearId: row.original_year_id,
    studentEnrollmentId: row.student_enrollment_id,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference || '',
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
    subCategory: row.sub_category || '',
    amount: Number(row.amount),
    date: toDate(row.date),
    accountId: row.account_id,
    description: row.description || '',
    tags: row.tags || [],
    isRecurringInstance: row.is_recurring_instance,
    recurringTemplateId: row.recurring_template_id,
  };
}

function mapRecoverable(row: recoverablesService.DbRecoverable): Recoverable {
  return {
    id: row.id,
    partyName: row.party_name,
    originalAmount: Number(row.original_amount),
    dateGiven: toDate(row.date_given),
    sourceAccountId: row.source_account_id,
    notes: row.notes || '',
  };
}

function mapRepayment(row: recoverablesService.DbRecoverableRepayment): RecoverableRepayment {
  return {
    id: row.id,
    recoverableId: row.recoverable_id,
    amount: Number(row.amount),
    date: toDate(row.date),
    accountId: row.account_id,
    notes: row.notes || '',
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
  totalOwed: number;    // targetTuitionFees + carryForwardFees
  collected: number;    // direct + late-collection payments attributed to this year
  remaining: number;    // max(0, totalOwed - collected)
  targetGap: number;    // max(0, targetTuitionFees - collected) — excludes carry-forward
  carryForward: number; // carryForwardFees value
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
  recoverables: Recoverable[];
  recoverableRepayments: RecoverableRepayment[];
  currentYearId: string;
  isSetupComplete: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  initializedForUserId: string | null;
  error: string | null;
  isDarkMode: boolean;
  pendingRecurringItems: PendingRecurringItem[];
  toggleDarkMode: () => void;
  reset: () => void;
  init: (force?: boolean, targetUserId?: string) => Promise<void>;
  addIncome: (data: incomeService.IncomeInsert) => Promise<void>;
  updateIncome: (id: string, data: Partial<incomeService.IncomeInsert>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  addExpense: (data: expensesService.ExpenseInsert) => Promise<void>;
  updateExpense: (id: string, data: Partial<expensesService.ExpenseInsert>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addTransfer: (data: transfersService.TransferInsert) => Promise<void>;
  updateTransfer: (id: string, data: transfersService.TransferInsert) => Promise<void>;
  deleteTransfer: (id: string) => Promise<void>;
  addRecoverable: (data: recoverablesService.RecoverableInsert) => Promise<void>;
  updateRecoverable: (id: string, data: Partial<recoverablesService.RecoverableInsert>) => Promise<void>;
  deleteRecoverable: (id: string) => Promise<void>;
  addRecoverableRepayment: (data: recoverablesService.RepaymentInsert) => Promise<void>;
  updateRecoverableRepayment: (id: string, data: Partial<recoverablesService.RepaymentInsert>) => Promise<void>;
  deleteRecoverableRepayment: (id: string) => Promise<void>;
  getAccountNetMovement: (accountId: string) => ReturnType<typeof getAccountMovement>;
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
  recoverables: [],
  recoverableRepayments: [],
  currentYearId: '',
  isSetupComplete: false,
  isLoading: false,
  isInitialized: false,
  initializedForUserId: null,
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

  reset: () => {
    set({
      academicYears: [],
      accounts: [],
      incomeEntries: [],
      expenseEntries: [],
      transfers: [],
      recurringTemplates: [],
      recoverables: [],
      recoverableRepayments: [],
      currentYearId: '',
      isSetupComplete: false,
      isLoading: false,
      isInitialized: false,
      initializedForUserId: null,
      error: null,
      pendingRecurringItems: [],
    });
  },

  init: async (force = false, targetUserId?: string) => {
    let currentUserId = targetUserId || null;
    if (!currentUserId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        currentUserId = session?.user?.id || null;
        if (!currentUserId) {
          const { data: { user } } = await supabase.auth.getUser();
          currentUserId = user?.id || null;
        }
      } catch {
        currentUserId = null;
      }
    }

    if (!currentUserId) {
      get().reset();
      return;
    }

    if (get().isInitialized && !get().error && get().initializedForUserId === currentUserId && !force) {
      return;
    }

    if (get().initializedForUserId && get().initializedForUserId !== currentUserId) {
      get().reset();
    }

    set({ isLoading: true, error: null });

    const maxRetries = 2;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const [yearsRes, accRes, incRes, expRes, trRes, recRes, recoverablesRes] = await Promise.all([
          academicYearsService.getAll(),
          accountsService.getAllIncludingArchived(),
          incomeService.getAll(),
          expensesService.getAll(),
          transfersService.getAll(),
          recurringService.getAll(),
          recoverablesService.getAll(),
        ]);

        const loadError = yearsRes.error || accRes.error || incRes.error || expRes.error || trRes.error || recRes.error || recoverablesRes.error;
        if (loadError) throw loadError;

        const years = (yearsRes.data || []).map(mapAcademicYear);
        const accounts = (accRes.data || []).map(mapAccount);
        const incomeEntries = (incRes.data || []).map(mapIncome);
        const expenseEntries = (expRes.data || []).map(mapExpense);
        const transfers = (trRes.data || []).map(mapTransfer);
        const recurringTemplates = (recRes.data || []).map(mapRecurring);
        const recoverables = (recoverablesRes.recoverables || []).map(mapRecoverable);
        const recoverableRepayments = (recoverablesRes.repayments || []).map(mapRepayment);

        const today = new Date();
        const activeYear = findAcademicYearForDate(years, today);
        const currentYearId = activeYear?.id || '';

        // Check pending recurring
        const currentMonth = today.getMonth();
        const currentFullYear = today.getFullYear();
        const pendingRecurringItems: PendingRecurringItem[] = [];

        for (const template of recurringTemplates) {
          if (!template.isActive) continue;

          const templateEntries = expenseEntries
            .filter((entry) => entry.isRecurringInstance && entry.recurringTemplateId === template.id)
            .sort((a, b) => b.date.getTime() - a.date.getTime());
          const latestRecordedDate = templateEntries[0]?.date || null;
          const effectiveLastDate = template.lastGeneratedDate && latestRecordedDate
            ? (template.lastGeneratedDate > latestRecordedDate ? template.lastGeneratedDate : latestRecordedDate)
            : template.lastGeneratedDate || latestRecordedDate;

          const hasThisMonth = expenseEntries.some(
            (e) =>
              e.isRecurringInstance &&
              e.recurringTemplateId === template.id &&
              e.date.getMonth() === currentMonth &&
              e.date.getFullYear() === currentFullYear
          );

          if (!hasThisMonth && isRecurringDue(template.recurrenceInterval, effectiveLastDate, today)) {
            const lastAmount = templateEntries[0]?.amount || template.defaultAmount;
            pendingRecurringItems.push({ template, lastAmount });
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
          recoverables,
          recoverableRepayments,
          currentYearId,
          isSetupComplete: accounts.length > 0 || years.length > 0,
          isLoading: false,
          isInitialized: true,
          initializedForUserId: currentUserId,
          error: null,
          isDarkMode: savedDark,
          pendingRecurringItems,
        });
        return;
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 350));
        }
      }
    }

    set({
      isLoading: false,
      isInitialized: false,
      initializedForUserId: currentUserId,
      error: lastError instanceof Error ? lastError.message : 'Failed to load data',
    });
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

  addRecoverable: async (data) => {
    const { data: created, error } = await recoverablesService.createRecoverable(data);
    if (error || !created) throw error || new Error('Failed to create recoverable');
    set((state) => ({ recoverables: [mapRecoverable(created), ...state.recoverables] }));
  },
  updateRecoverable: async (id, data) => {
    const { data: updated, error } = await recoverablesService.updateRecoverable(id, data);
    if (error || !updated) throw error || new Error('Failed to update recoverable');
    set((state) => ({ recoverables: state.recoverables.map((r) => r.id === id ? mapRecoverable(updated) : r) }));
  },
  deleteRecoverable: async (id) => {
    const { error } = await recoverablesService.deleteRecoverable(id);
    if (error) throw error;
    set((state) => ({ recoverables: state.recoverables.filter((r) => r.id !== id) }));
  },
  addRecoverableRepayment: async (data) => {
    const { data: created, error } = await recoverablesService.createRepayment(data);
    if (error || !created) throw error || new Error('Failed to create repayment');
    set((state) => ({ recoverableRepayments: [mapRepayment(created), ...state.recoverableRepayments] }));
  },
  updateRecoverableRepayment: async (id, data) => {
    const { data: updated, error } = await recoverablesService.updateRepayment(id, data);
    if (error || !updated) throw error || new Error('Failed to update repayment');
    set((state) => ({ recoverableRepayments: state.recoverableRepayments.map((r) => r.id === id ? mapRepayment(updated) : r) }));
  },
  deleteRecoverableRepayment: async (id) => {
    const { error } = await recoverablesService.deleteRepayment(id);
    if (error) throw error;
    set((state) => ({ recoverableRepayments: state.recoverableRepayments.filter((r) => r.id !== id) }));
  },

  getAccountNetMovement: (accountId: string) => {
    const state = get();
    return getAccountMovement(accountId, state.incomeEntries, state.expenseEntries, state.transfers, state.recoverables, state.recoverableRepayments);
  },

  getAccountBalance: (accountId: string) => {
    const state = get();
    const account = state.accounts.find((a) => a.id === accountId);
    if (!account) return 0;
    return calculateAccountBalance(account, get().getAccountNetMovement(accountId));
  },

  getTotalBalance: () => {
    const state = get();
    return state.accounts
      .reduce((sum, a) => sum + get().getAccountBalance(a.id), 0);
  },

  getYearForDate: (date: Date) => {
    const state = get();
    return findAcademicYearForDate(state.academicYears, date);
  },

  getYearProfitBreakdown: (yearId: string): YearProfitBreakdown => {
    const state = get();
    const fixedCats = FIXED_EXPENSE_CATEGORIES as readonly string[];

    // Profit is cash-period based. Late tuition affects the original fee obligation,
    // but remains income in the academic year in which cash was received.
    const yearIncome = state.incomeEntries.filter((i) => i.academicYearId === yearId);
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

    // Projected income = already collected + target gap still to collect this year
    // (carry-forward is past debt recovery, not a revenue projection)
    const pending = get().getPendingForYear(yearId);
    const projectedIncome = breakdown.totalIncome + pending.targetGap;

    return projectedIncome - projectedExpenses;
  },

  /**
   * Single source of truth for how much is still owed for a given year.
   * Counts:
   *  - direct tuition entries booked to this year (not late collections)
   *  - late-collection entries whose originalYearId === this year
   *  - carryForwardFees (manually set balance from a previous year)
   */
  getPendingForYear: (yearId: string): YearPendingInfo => {
    const state = get();
    const year = state.academicYears.find((y) => y.id === yearId);
    if (!year) {
      return { yearId, totalOwed: 0, collected: 0, remaining: 0, targetGap: 0, carryForward: 0 };
    }

    return { yearId, ...getFeeOutstanding(year, state.incomeEntries) };
  },

  getAllPendingTotal: () => {
    const state = get();
    return state.academicYears.reduce((sum, y) => sum + get().getPendingForYear(y.id).remaining, 0);
  },

  refreshAccounts: async () => {
    const { data, error } = await accountsService.getAllIncludingArchived();
    if (error) throw error;
    if (data) set({ accounts: data.map(mapAccount) });
  },

  refreshAcademicYears: async () => {
    const { data, error } = await academicYearsService.getAll();
    if (error) throw error;
    if (data) {
      const years = data.map(mapAcademicYear);
      const activeYear = years.find((y) => y.status === 'active') || years[0];
      set((state) => ({
        academicYears: years,
        currentYearId: state.currentYearId && years.some((y) => y.id === state.currentYearId)
          ? state.currentYearId
          : (activeYear?.id || ''),
      }));
    }
  },

  refreshRecurringTemplates: async () => {
    const { data, error } = await recurringService.getAll();
    if (error) throw error;
    if (data) set({ recurringTemplates: data.map(mapRecurring) });
  },
}));
