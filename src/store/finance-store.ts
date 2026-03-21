import { create } from 'zustand';
import type {
  AcademicYear,
  Account,
  IncomeEntry,
  ExpenseEntry,
  Transfer,
  RecurringTemplate,
} from '@/types/finance';

// Demo data for UI development
const DEMO_ACCOUNTS: Account[] = [
  { id: 'acc-1', name: 'School Account', type: 'school_bank', startingBalance: 500000, isArchived: false },
  { id: 'acc-2', name: 'HDFC Savings', type: 'personal_bank', startingBalance: 200000, isArchived: false },
  { id: 'acc-3', name: 'SBI Account', type: 'personal_bank', startingBalance: 150000, isArchived: false },
  { id: 'acc-4', name: 'ICICI Account', type: 'personal_bank', startingBalance: 100000, isArchived: false },
  { id: 'acc-5', name: 'Cash at Home', type: 'cash', startingBalance: 50000, isArchived: false },
];

const DEMO_YEARS: AcademicYear[] = [
  {
    id: 'ay-1',
    label: '2024-25',
    startDate: new Date(2024, 5, 5),
    endDate: new Date(2025, 5, 4),
    targetTuitionFees: 3000000,
    status: 'active',
  },
  {
    id: 'ay-0',
    label: '2023-24',
    startDate: new Date(2023, 5, 5),
    endDate: new Date(2024, 5, 4),
    targetTuitionFees: 2500000,
    status: 'pending_collections',
  },
];

const DEMO_INCOME: IncomeEntry[] = [
  { id: 'inc-1', academicYearId: 'ay-1', type: 'tuition', amount: 450000, date: new Date(2024, 6, 15), accountId: 'acc-1', isLateCollection: false, originalYearId: null, notes: 'July batch fees', tags: ['batch-1'] },
  { id: 'inc-2', academicYearId: 'ay-1', type: 'tuition', amount: 380000, date: new Date(2024, 7, 10), accountId: 'acc-1', isLateCollection: false, originalYearId: null, notes: 'August collection', tags: [] },
  { id: 'inc-3', academicYearId: 'ay-1', type: 'tuition', amount: 520000, date: new Date(2024, 8, 5), accountId: 'acc-1', isLateCollection: false, originalYearId: null, notes: 'September fees', tags: [] },
  { id: 'inc-4', academicYearId: 'ay-1', type: 'tuition', amount: 290000, date: new Date(2024, 9, 12), accountId: 'acc-2', isLateCollection: false, originalYearId: null, notes: 'October partial', tags: [] },
  { id: 'inc-5', academicYearId: 'ay-1', type: 'tuition', amount: 410000, date: new Date(2024, 10, 8), accountId: 'acc-1', isLateCollection: false, originalYearId: null, notes: 'November collection', tags: [] },
  { id: 'inc-6', academicYearId: 'ay-1', type: 'lunch', amount: 35000, date: new Date(2024, 6, 30), accountId: 'acc-1', isLateCollection: false, originalYearId: null, notes: 'July lunch', tags: [] },
  { id: 'inc-7', academicYearId: 'ay-1', type: 'lunch', amount: 38000, date: new Date(2024, 7, 30), accountId: 'acc-1', isLateCollection: false, originalYearId: null, notes: 'August lunch', tags: [] },
  { id: 'inc-8', academicYearId: 'ay-1', type: 'lunch', amount: 36000, date: new Date(2024, 8, 30), accountId: 'acc-5', isLateCollection: false, originalYearId: null, notes: 'September lunch', tags: [] },
  { id: 'inc-9', academicYearId: 'ay-1', type: 'lunch', amount: 34000, date: new Date(2024, 9, 30), accountId: 'acc-1', isLateCollection: false, originalYearId: null, notes: 'October lunch', tags: [] },
  { id: 'inc-10', academicYearId: 'ay-1', type: 'lunch', amount: 37000, date: new Date(2024, 10, 30), accountId: 'acc-1', isLateCollection: false, originalYearId: null, notes: 'November lunch', tags: [] },
];

const DEMO_EXPENSES: ExpenseEntry[] = [
  { id: 'exp-1', academicYearId: 'ay-1', expenseType: 'school', category: 'Salary & Wages', amount: 120000, date: new Date(2024, 6, 1), accountId: 'acc-1', description: 'July salaries', tags: [], isRecurringInstance: true, recurringTemplateId: null },
  { id: 'exp-2', academicYearId: 'ay-1', expenseType: 'school', category: 'Land Rent', amount: 45000, date: new Date(2024, 6, 5), accountId: 'acc-1', description: 'July rent', tags: [], isRecurringInstance: true, recurringTemplateId: null },
  { id: 'exp-3', academicYearId: 'ay-1', expenseType: 'school', category: 'Electricity Bill', amount: 12000, date: new Date(2024, 6, 15), accountId: 'acc-1', description: 'July electricity', tags: [], isRecurringInstance: true, recurringTemplateId: null },
  { id: 'exp-4', academicYearId: 'ay-1', expenseType: 'school', category: 'Salary & Wages', amount: 120000, date: new Date(2024, 7, 1), accountId: 'acc-1', description: 'August salaries', tags: [], isRecurringInstance: true, recurringTemplateId: null },
  { id: 'exp-5', academicYearId: 'ay-1', expenseType: 'school', category: 'Land Rent', amount: 45000, date: new Date(2024, 7, 5), accountId: 'acc-1', description: 'August rent', tags: [], isRecurringInstance: true, recurringTemplateId: null },
  { id: 'exp-6', academicYearId: 'ay-1', expenseType: 'school', category: 'Academic Supplies', amount: 25000, date: new Date(2024, 7, 20), accountId: 'acc-1', description: 'Books and stationery', tags: ['supplies'], isRecurringInstance: false, recurringTemplateId: null },
  { id: 'exp-7', academicYearId: 'ay-1', expenseType: 'school', category: 'Salary & Wages', amount: 125000, date: new Date(2024, 8, 1), accountId: 'acc-1', description: 'September salaries', tags: [], isRecurringInstance: true, recurringTemplateId: null },
  { id: 'exp-8', academicYearId: 'ay-1', expenseType: 'school', category: 'Events & Functions', amount: 55000, date: new Date(2024, 8, 15), accountId: 'acc-2', description: 'Teacher\'s Day celebration', tags: ['event'], isRecurringInstance: false, recurringTemplateId: null },
  { id: 'exp-9', academicYearId: 'ay-1', expenseType: 'home', category: 'Groceries', amount: 15000, date: new Date(2024, 6, 10), accountId: 'acc-5', description: 'Monthly groceries', tags: [], isRecurringInstance: false, recurringTemplateId: null },
  { id: 'exp-10', academicYearId: 'ay-1', expenseType: 'home', category: 'Car Fuel', amount: 5000, date: new Date(2024, 6, 20), accountId: 'acc-2', description: 'Petrol', tags: [], isRecurringInstance: false, recurringTemplateId: null },
  { id: 'exp-11', academicYearId: 'ay-1', expenseType: 'school', category: 'Salary & Wages', amount: 125000, date: new Date(2024, 9, 1), accountId: 'acc-1', description: 'October salaries', tags: [], isRecurringInstance: true, recurringTemplateId: null },
  { id: 'exp-12', academicYearId: 'ay-1', expenseType: 'school', category: 'Land Rent', amount: 45000, date: new Date(2024, 9, 5), accountId: 'acc-1', description: 'October rent', tags: [], isRecurringInstance: true, recurringTemplateId: null },
  { id: 'exp-13', academicYearId: 'ay-1', expenseType: 'school', category: 'Infrastructure & Maintenance', amount: 75000, date: new Date(2024, 10, 1), accountId: 'acc-1', description: 'Classroom repairs', tags: ['maintenance'], isRecurringInstance: false, recurringTemplateId: null },
];

const DEMO_TRANSFERS: Transfer[] = [
  { id: 'tr-1', fromAccountId: 'acc-1', toAccountId: 'acc-2', amount: 100000, date: new Date(2024, 7, 15), category: 'school_to_personal', notes: 'Monthly transfer' },
  { id: 'tr-2', fromAccountId: 'acc-5', toAccountId: 'acc-1', amount: 30000, date: new Date(2024, 8, 1), category: 'cash_deposit', notes: 'Cash fees deposit' },
];

interface FinanceState {
  academicYears: AcademicYear[];
  accounts: Account[];
  incomeEntries: IncomeEntry[];
  expenseEntries: ExpenseEntry[];
  transfers: Transfer[];
  recurringTemplates: RecurringTemplate[];
  currentYearId: string;
  isSetupComplete: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const useFinanceStore = create<FinanceState>((set) => ({
  academicYears: DEMO_YEARS,
  accounts: DEMO_ACCOUNTS,
  incomeEntries: DEMO_INCOME,
  expenseEntries: DEMO_EXPENSES,
  transfers: DEMO_TRANSFERS,
  recurringTemplates: [],
  currentYearId: 'ay-1',
  isSetupComplete: true,
  isDarkMode: false,
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.isDarkMode;
      document.documentElement.classList.toggle('dark', next);
      return { isDarkMode: next };
    }),
}));
