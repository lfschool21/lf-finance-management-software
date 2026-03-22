import { create } from 'zustand';
import type {
  AcademicYear,
  Account,
  IncomeEntry,
  ExpenseEntry,
  Transfer,
  RecurringTemplate,
} from '@/types/finance';
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
  toggleDarkMode: () => void;
  init: () => Promise<void>;
  addIncome: (data: incomeService.IncomeInsert) => Promise<void>;
  addExpense: (data: expensesService.ExpenseInsert) => Promise<void>;
  addTransfer: (data: transfersService.TransferInsert) => Promise<void>;
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

  toggleDarkMode: () =>
    set((state) => {
      const next = !state.isDarkMode;
      document.documentElement.classList.toggle('dark', next);
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

      // Find active year (today between start and end)
      const today = new Date();
      const activeYear = years.find(
        (y) => today >= y.startDate && today <= y.endDate
      );
      const currentYearId = activeYear?.id || years[0]?.id || '';

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

  addExpense: async (data) => {
    const { data: created, error } = await expensesService.create(data);
    if (error || !created) throw error || new Error('Failed to create expense');
    set((state) => ({
      expenseEntries: [mapExpense(created), ...state.expenseEntries],
    }));
  },

  addTransfer: async (data) => {
    const { data: created, error } = await transfersService.create(data);
    if (error || !created) throw error || new Error('Failed to create transfer');
    set((state) => ({
      transfers: [mapTransfer(created), ...state.transfers],
    }));
  },
}));
