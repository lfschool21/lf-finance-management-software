import type { IncomeEntry, PaymentMethod } from '@/types/finance';
import type { Student, StudentEnrollment, StudentFeeSummary, StudentMedium } from '@/types/students';

const EPSILON = 0.005;

export function normalizeMedium(value: unknown): StudentMedium | null {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[._-]/g, ' ');
  if (['english', 'eng', 'e', 'english medium'].includes(normalized)) return 'english';
  if (['gujarati', 'guj', 'g', 'gujarati medium'].includes(normalized)) return 'gujarati';
  return null;
}

export function normalizeClassName(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeAdmissionNumber(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizeStudentName(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function openingCollected(enrollment: StudentEnrollment): number {
  return enrollment.openingCollectedCash + enrollment.openingCollectedUpi + enrollment.openingCollectedOther;
}

export function feeObligation(enrollment: StudentEnrollment): number {
  return enrollment.annualFeeAmount + enrollment.additionalOutstandingAmount;
}

export function getStudentFeeSummary(
  enrollment: StudentEnrollment,
  incomeEntries: IncomeEntry[],
  excludeEntryId?: string,
): StudentFeeSummary {
  const payments = incomeEntries.filter((entry) =>
    entry.id !== excludeEntryId && entry.studentEnrollmentId === enrollment.id && entry.category === 'Tuition Fees',
  );
  const byMethod = (method: PaymentMethod) => payments
    .filter((entry) => entry.paymentMethod === method)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const recordedCollected = payments.reduce((sum, entry) => sum + entry.amount, 0);
  const opening = openingCollected(enrollment);
  const obligation = feeObligation(enrollment);
  const collected = opening + recordedCollected;
  const pending = Math.max(0, obligation - collected);
  const status = collected <= EPSILON ? 'not_paid' : pending <= EPSILON ? 'paid' : 'partially_paid';
  const otherRecorded = byMethod('bank_transfer') + byMethod('cheque') + byMethod('other');
  const unknown = payments.filter((entry) => !entry.paymentMethod).reduce((sum, entry) => sum + entry.amount, 0);
  return {
    obligation,
    openingCollected: opening,
    recordedCollected,
    collected,
    pending,
    collectionPercent: obligation > 0 ? Math.min(100, (collected / obligation) * 100) : 0,
    cash: enrollment.openingCollectedCash + byMethod('cash'),
    upi: enrollment.openingCollectedUpi + byMethod('upi'),
    other: enrollment.openingCollectedOther + otherRecorded,
    unknown,
    status,
  };
}

export function getStudentPreviousPending(
  studentId: string,
  currentYearId: string,
  enrollments: StudentEnrollment[],
  incomeEntries: IncomeEntry[],
): number {
  return enrollments
    .filter((enrollment) => enrollment.studentId === studentId && enrollment.academicYearId !== currentYearId)
    .reduce((sum, enrollment) => sum + getStudentFeeSummary(enrollment, incomeEntries).pending, 0);
}

export interface RosterSummary {
  totalStudents: number;
  english: number;
  gujarati: number;
  pendingStudents: number;
  fullyPaidStudents: number;
  obligation: number;
  collected: number;
  pending: number;
}

export function summarizeRoster(enrollments: StudentEnrollment[], incomeEntries: IncomeEntry[]): RosterSummary {
  const active = enrollments.filter((enrollment) => enrollment.status === 'active');
  const summaries = active.map((enrollment) => getStudentFeeSummary(enrollment, incomeEntries));
  return {
    totalStudents: active.length,
    english: active.filter((enrollment) => enrollment.medium === 'english').length,
    gujarati: active.filter((enrollment) => enrollment.medium === 'gujarati').length,
    pendingStudents: summaries.filter((summary) => summary.pending > EPSILON).length,
    fullyPaidStudents: summaries.filter((summary) => summary.status === 'paid').length,
    obligation: summaries.reduce((sum, summary) => sum + summary.obligation, 0),
    collected: summaries.reduce((sum, summary) => sum + summary.collected, 0),
    pending: summaries.reduce((sum, summary) => sum + summary.pending, 0),
  };
}

export interface ClassRosterSummary extends RosterSummary { className: string }

export function groupRosterByClass(enrollments: StudentEnrollment[], incomeEntries: IncomeEntry[]): ClassRosterSummary[] {
  const groups = new Map<string, StudentEnrollment[]>();
  enrollments.filter((enrollment) => enrollment.status === 'active').forEach((enrollment) => {
    const values = groups.get(enrollment.className) || [];
    values.push(enrollment);
    groups.set(enrollment.className, values);
  });
  return Array.from(groups.entries()).map(([className, values]) => ({
    className,
    ...summarizeRoster(values, incomeEntries),
  })).sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));
}

export function findStudentForEnrollment(
  enrollmentId: string | null,
  enrollments: StudentEnrollment[],
  students: Student[],
): Student | undefined {
  const enrollment = enrollments.find((item) => item.id === enrollmentId);
  return students.find((student) => student.id === enrollment?.studentId);
}
