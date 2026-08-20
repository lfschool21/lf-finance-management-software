import type {
  Account,
  AccountType,
  AcademicYear,
  ExpenseEntry,
  IncomeEntry,
  RecurrenceInterval,
  Recoverable,
  RecoverableRepayment,
  RecoverableStatus,
  Transfer,
  TransferCategory,
} from '@/types/finance';
import { LUNCH_CATEGORY, OTHER_CATEGORY, TUITION_CATEGORY } from '@/types/finance';

export type IncomeSource = 'current_tuition' | 'old_fees' | 'lunch' | 'other';

export interface IncomeBreakdown {
  currentTuition: number;
  oldFees: number;
  lunch: number;
  other: number;
  total: number;
}

export interface AccountMovement {
  income: number;
  expenses: number;
  transfersIn: number;
  transfersOut: number;
  advancesGiven: number;
  recoveriesReceived: number;
  net: number;
}

export function parseStrictNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePositiveAmount(value: string): number | null {
  const parsed = parseStrictNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

export function parseNonNegativeAmount(value: string): number | null {
  const parsed = parseStrictNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

export function dateKey(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function findAcademicYearForDate(years: AcademicYear[], date: Date | string): AcademicYear | undefined {
  const key = dateKey(date);
  return years.find((year) => key >= dateKey(year.startDate) && key <= dateKey(year.endDate));
}

export function incomeSource(entry: IncomeEntry): IncomeSource {
  if (entry.category === TUITION_CATEGORY) {
    return entry.isLateCollection ? 'old_fees' : 'current_tuition';
  }
  if (entry.category === LUNCH_CATEGORY) return 'lunch';
  return 'other';
}

export function getIncomeBreakdown(entries: IncomeEntry[]): IncomeBreakdown {
  const result: IncomeBreakdown = { currentTuition: 0, oldFees: 0, lunch: 0, other: 0, total: 0 };
  for (const entry of entries) {
    const source = incomeSource(entry);
    if (source === 'current_tuition') result.currentTuition += entry.amount;
    else if (source === 'old_fees') result.oldFees += entry.amount;
    else if (source === 'lunch') result.lunch += entry.amount;
    else result.other += entry.amount;
    result.total += entry.amount;
  }
  return result;
}

export function getFeeCollected(entries: IncomeEntry[], yearId: string, excludeEntryId?: string): number {
  return entries
    .filter((entry) =>
      entry.id !== excludeEntryId &&
      entry.category === TUITION_CATEGORY &&
      ((!entry.isLateCollection && entry.academicYearId === yearId) ||
        (entry.isLateCollection && entry.originalYearId === yearId)),
    )
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export function getFeeOutstanding(
  year: AcademicYear,
  entries: IncomeEntry[],
  excludeEntryId?: string,
): { totalOwed: number; collected: number; remaining: number; targetGap: number; carryForward: number } {
  const collected = getFeeCollected(entries, year.id, excludeEntryId);
  const carryForward = year.carryForwardFees || 0;
  const totalOwed = year.targetTuitionFees + carryForward;
  return {
    totalOwed,
    collected,
    remaining: Math.max(0, totalOwed - collected),
    targetGap: Math.max(0, year.targetTuitionFees - collected),
    carryForward,
  };
}

export function getAccountMovement(
  accountId: string,
  incomeEntries: IncomeEntry[],
  expenseEntries: ExpenseEntry[],
  transfers: Transfer[],
  recoverables: Recoverable[] = [],
  repayments: RecoverableRepayment[] = [],
): AccountMovement {
  const income = incomeEntries.filter((entry) => entry.accountId === accountId).reduce((s, e) => s + e.amount, 0);
  const expenses = expenseEntries.filter((entry) => entry.accountId === accountId).reduce((s, e) => s + e.amount, 0);
  const transfersIn = transfers.filter((entry) => entry.toAccountId === accountId).reduce((s, e) => s + e.amount, 0);
  const transfersOut = transfers.filter((entry) => entry.fromAccountId === accountId).reduce((s, e) => s + e.amount, 0);
  const advancesGiven = recoverables.filter((entry) => entry.sourceAccountId === accountId).reduce((s, e) => s + e.originalAmount, 0);
  const recoveriesReceived = repayments.filter((entry) => entry.accountId === accountId).reduce((s, e) => s + e.amount, 0);
  return {
    income,
    expenses,
    transfersIn,
    transfersOut,
    advancesGiven,
    recoveriesReceived,
    net: income - expenses + transfersIn - transfersOut - advancesGiven + recoveriesReceived,
  };
}

export function getAccountBalance(account: Account, movement: AccountMovement): number {
  return account.startingBalance + movement.net;
}

export function requiredStartingBalance(desiredCurrentBalance: number, movement: AccountMovement): number {
  return desiredCurrentBalance - movement.net;
}

export function inferTransferCategory(from: AccountType, to: AccountType): TransferCategory {
  if (from === 'cash' && to !== 'cash') return 'cash_deposit';
  if (from !== 'cash' && to === 'cash') return 'cash_withdrawal';
  if (from === 'school_bank' && to === 'personal_bank') return 'school_to_personal';
  if (from === 'personal_bank' && to === 'school_bank') return 'personal_to_school';
  return 'internal';
}

export function monthDistance(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
}

export function recurrenceMonths(interval: RecurrenceInterval): number {
  if (interval === 'bimonthly') return 2;
  if (interval === 'quarterly') return 3;
  return 1;
}

export function isRecurringDue(interval: RecurrenceInterval, lastReviewedDate: Date | null, asOf: Date): boolean {
  if (!lastReviewedDate) return true;
  return monthDistance(lastReviewedDate, asOf) >= recurrenceMonths(interval);
}

export function getRecoverableSummary(
  recoverable: Recoverable,
  repayments: RecoverableRepayment[],
): { recovered: number; outstanding: number; status: RecoverableStatus } {
  const recovered = repayments
    .filter((repayment) => repayment.recoverableId === recoverable.id)
    .reduce((sum, repayment) => sum + repayment.amount, 0);
  const outstanding = Math.max(0, recoverable.originalAmount - recovered);
  const status: RecoverableStatus = recovered <= 0
    ? 'outstanding'
    : outstanding <= 0
      ? 'recovered'
      : 'partially_recovered';
  return { recovered, outstanding, status };
}

export function isPreviousAcademicYear(original: AcademicYear, booking: AcademicYear): boolean {
  return dateKey(original.endDate) < dateKey(booking.startDate);
}

export const INCOME_SOURCE_LABELS: Record<IncomeSource, string> = {
  current_tuition: 'Current-Year Tuition Fees',
  old_fees: 'Previous-Year / Old Fee Collections',
  lunch: 'Lunch Fees',
  other: 'Investment / Extra Income',
};

export function categoryToDbType(category: string): 'tuition' | 'lunch' | 'other' {
  if (category === TUITION_CATEGORY) return 'tuition';
  if (category === LUNCH_CATEGORY) return 'lunch';
  if (category === OTHER_CATEGORY) return 'other';
  return 'other';
}
