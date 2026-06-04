export type AcademicYearStatus = 'active' | 'closed' | 'pending_collections';
export type AccountType = 'school_bank' | 'personal_bank' | 'cash';
export type ExpenseTopType = 'school' | 'home';
export type TransferCategory = 'school_to_personal' | 'personal_to_school' | 'cash_deposit' | 'cash_withdrawal' | 'internal';
export type RecurrenceInterval = 'monthly' | 'bimonthly' | 'quarterly';

export const SCHOOL_EXPENSE_CATEGORIES = [
  'Salary & Wages',
  'Land Rent',
  'Electricity Bill',
  'Internet & Phone Bill',
  'Infrastructure & Maintenance',
  'Academic Supplies',
  'Events & Functions',
  'Transportation',
  'Emergency / Unexpected',
  'Other School Expense',
] as const;

export const HOME_EXPENSE_CATEGORIES = [
  'Car Fuel',
  'Groceries',
  'Phone Recharge',
  'Medical / Health',
  'Household Bills',
  'Personal Shopping',
  'Family & Kids',
  'Emergency / Unexpected',
  'Other Home Expense',
] as const;

export const FIXED_EXPENSE_CATEGORIES = [
  'Salary & Wages',
  'Land Rent',
  'Electricity Bill',
  'Internet & Phone Bill',
] as const;

/** All income categories. The type column in income_entries stores these values. */
export const INCOME_CATEGORIES = [
  'Tuition Fees',
  'Lunch Fees',
  'Donation / Grant',
  'Government Aid',
  'Event / Function Income',
  'Late Fine',
  'Bank Interest',
  'Rental Income',
  'Miscellaneous',
] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number] | string;

/** The category string that counts toward tuition fee progress tracking */
export const TUITION_CATEGORY = 'Tuition Fees';

export type SchoolExpenseCategory = (typeof SCHOOL_EXPENSE_CATEGORIES)[number];
export type HomeExpenseCategory = (typeof HOME_EXPENSE_CATEGORIES)[number];

export interface AcademicYear {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
  targetTuitionFees: number;
  carryForwardFees: number;
  status: AcademicYearStatus;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  startingBalance: number;
  isArchived: boolean;
}

export interface IncomeEntry {
  id: string;
  academicYearId: string;
  /** Stores the income category name, e.g. 'Tuition Fees', 'Lunch Fees', 'Donation / Grant' */
  category: string;
  amount: number;
  date: Date;
  accountId: string;
  isLateCollection: boolean;
  originalYearId: string | null;
  notes: string;
  tags: string[];
}

export interface ExpenseEntry {
  id: string;
  academicYearId: string;
  expenseType: ExpenseTopType;
  category: string;
  amount: number;
  date: Date;
  accountId: string;
  description: string;
  tags: string[];
  isRecurringInstance: boolean;
  recurringTemplateId: string | null;
}

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: Date;
  category: TransferCategory;
  notes: string;
}

export interface RecurringTemplate {
  id: string;
  expenseType: ExpenseTopType;
  category: string;
  defaultAmount: number;
  recurrenceInterval: RecurrenceInterval;
  lastGeneratedDate: Date | null;
  isActive: boolean;
}

export interface PendingCollection {
  academicYear: AcademicYear;
  totalTarget: number;
  totalCollected: number;
  remainingPending: number;
  yearsOverdue: number;
}
