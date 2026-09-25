import type { IncomeEntry, PaymentMethod } from '@/types/finance';
import type { Student, StudentEnrollment, StudentFeeSummary, StudentMedium } from '@/types/students';
import { compareClassNames } from '@/utils/student-order';

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
  const payments = incomeEntries.filter((entry) => {
    if (entry.id === excludeEntryId) return false;
    if (entry.category !== 'Tuition Fees') return false;
    if (entry.studentEnrollmentId !== enrollment.id) return false;
    // Exclude late payments belonging to a different academic year than this enrollment
    if (entry.isLateCollection && entry.originalYearId && entry.originalYearId !== enrollment.academicYearId) {
      return false;
    }
    return true;
  });

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
  const historicalPending = enrollments
    .filter((enrollment) => enrollment.studentId === studentId && enrollment.academicYearId !== currentYearId)
    .reduce((sum, enrollment) => sum + getStudentFeeSummary(enrollment, incomeEntries).pending, 0);

  const currentEnrollment = enrollments.find(
    (enrollment) => enrollment.studentId === studentId && enrollment.academicYearId === currentYearId,
  );

  const currentCarryPending = currentEnrollment
    ? (() => {
        if (!currentEnrollment.additionalOutstandingAmount) return 0;
        const carryPayments = incomeEntries
          .filter(
            (entry) =>
              entry.category === 'Tuition Fees' &&
              entry.isLateCollection &&
              (entry.studentEnrollmentId === currentEnrollment.id ||
                enrollments.some((enr) => enr.studentId === studentId && enr.id === entry.studentEnrollmentId))
          )
          .reduce((sum, entry) => sum + entry.amount, 0);
        return Math.max(0, currentEnrollment.additionalOutstandingAmount - carryPayments);
      })()
    : 0;

  return historicalPending > 0 ? Math.max(historicalPending, currentCarryPending) : currentCarryPending;
}

export interface RosterSummary {
  totalStudents: number;
  english: number;
  gujarati: number;
  pendingStudents: number;
  fullyPaidStudents: number;
  obligation: number;
  currentAnnualFee: number;
  collected: number;
  pending: number;
  avgAnnualFeeCharged?: number;
  avgCollected?: number;
  avgPending?: number;
}

export function summarizeRoster(enrollments: StudentEnrollment[], incomeEntries: IncomeEntry[]): RosterSummary {
  const active = enrollments.filter((enrollment) => enrollment.status === 'active');
  const summaries = active.map((enrollment) => getStudentFeeSummary(enrollment, incomeEntries));
  const currentAnnualFee = active.reduce((sum, e) => sum + (e.annualFeeAmount || 0), 0);
  const collected = summaries.reduce((sum, summary) => sum + summary.collected, 0);
  const pending = summaries.reduce((sum, summary) => sum + summary.pending, 0);
  const count = active.length;

  return {
    totalStudents: count,
    english: active.filter((enrollment) => enrollment.medium === 'english').length,
    gujarati: active.filter((enrollment) => enrollment.medium === 'gujarati').length,
    pendingStudents: summaries.filter((summary) => summary.pending > EPSILON).length,
    fullyPaidStudents: summaries.filter((summary) => summary.status === 'paid').length,
    obligation: summaries.reduce((sum, summary) => sum + summary.obligation, 0),
    currentAnnualFee,
    collected,
    pending,
    avgAnnualFeeCharged: count > 0 ? Math.round(currentAnnualFee / count) : 0,
    avgCollected: count > 0 ? Math.round(collected / count) : 0,
    avgPending: count > 0 ? Math.round(pending / count) : 0,
  };
}

export interface AverageFeeMetrics {
  totalStudents: number;
  totalAnnualFee: number;
  avgAnnualFeeCharged: number; // Avg annual tuition charged by the school per student
  totalObligation: number;
  avgObligation: number;
  totalCollected: number;
  avgCollected: number;
  totalPending: number;
  avgPending: number;
  collectionRate: number;
}

export function calculateAverageFees(
  enrollments: StudentEnrollment[],
  incomeEntries: IncomeEntry[],
): AverageFeeMetrics {
  const active = enrollments.filter((enrollment) => enrollment.status === 'active');
  const count = active.length;
  if (count === 0) {
    return {
      totalStudents: 0,
      totalAnnualFee: 0,
      avgAnnualFeeCharged: 0,
      totalObligation: 0,
      avgObligation: 0,
      totalCollected: 0,
      avgCollected: 0,
      totalPending: 0,
      avgPending: 0,
      collectionRate: 0,
    };
  }

  const summaries = active.map((enrollment) => getStudentFeeSummary(enrollment, incomeEntries));
  const totalAnnualFee = active.reduce((sum, e) => sum + (e.annualFeeAmount || 0), 0);
  const totalObligation = summaries.reduce((sum, summary) => sum + summary.obligation, 0);
  const totalCollected = summaries.reduce((sum, summary) => sum + summary.collected, 0);
  const totalPending = summaries.reduce((sum, summary) => sum + summary.pending, 0);

  return {
    totalStudents: count,
    totalAnnualFee,
    avgAnnualFeeCharged: Math.round(totalAnnualFee / count),
    totalObligation,
    avgObligation: Math.round(totalObligation / count),
    totalCollected,
    avgCollected: Math.round(totalCollected / count),
    totalPending,
    avgPending: Math.round(totalPending / count),
    collectionRate: totalAnnualFee > 0 ? Math.min(100, Math.round((totalCollected / totalAnnualFee) * 100)) : 0,
  };
}

export interface ClassAverageFeeDetail {
  className: string;
  medium: StudentMedium;
  totalStudents: number;
  totalAnnualFee: number;
  avgAnnualFeeCharged: number;
  totalCollected: number;
  avgCollected: number;
  totalPending: number;
  avgPending: number;
  collectionRate: number;
}

export function calculateClassAverageFees(
  enrollments: StudentEnrollment[],
  incomeEntries: IncomeEntry[],
): ClassAverageFeeDetail[] {
  const active = enrollments.filter((enrollment) => enrollment.status === 'active');
  const groups = new Map<string, StudentEnrollment[]>();

  for (const enrollment of active) {
    const key = `${enrollment.className}__${enrollment.medium}`;
    const values = groups.get(key) || [];
    values.push(enrollment);
    groups.set(key, values);
  }

  const results: ClassAverageFeeDetail[] = [];
  for (const [, classEnrollments] of groups.entries()) {
    const first = classEnrollments[0];
    const metrics = calculateAverageFees(classEnrollments, incomeEntries);
    results.push({
      className: first.className,
      medium: first.medium,
      totalStudents: metrics.totalStudents,
      totalAnnualFee: metrics.totalAnnualFee,
      avgAnnualFeeCharged: metrics.avgAnnualFeeCharged,
      totalCollected: metrics.totalCollected,
      avgCollected: metrics.avgCollected,
      totalPending: metrics.totalPending,
      avgPending: metrics.avgPending,
      collectionRate: metrics.collectionRate,
    });
  }

  return results.sort((a, b) => compareClassNames(a.className, b.className));
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
  })).sort((a, b) => compareClassNames(a.className, b.className));
}

export interface ClassCardSummary {
  className: string;
  totalStudents: number;
  currentYearPending: number;
  previousYearPending: number;
  totalPending: number;
  totalAnnualFee?: number;
  avgAnnualFee?: number;
}

export function groupRosterByClassWithPrevious(
  enrollments: StudentEnrollment[],
  allEnrollments: StudentEnrollment[],
  incomeEntries: IncomeEntry[],
  currentYearId: string,
): ClassCardSummary[] {
  const active = enrollments.filter((enrollment) => enrollment.status === 'active');
  const groups = new Map<string, ClassCardSummary>();

  for (const enrollment of active) {
    let summary = groups.get(enrollment.className);
    if (!summary) {
      summary = {
        className: enrollment.className,
        totalStudents: 0,
        currentYearPending: 0,
        previousYearPending: 0,
        totalPending: 0,
        totalAnnualFee: 0,
        avgAnnualFee: 0,
      };
      groups.set(enrollment.className, summary);
    }

    const feeSummary = getStudentFeeSummary(enrollment, incomeEntries);
    const prevPending = getStudentPreviousPending(
      enrollment.studentId,
      currentYearId,
      allEnrollments,
      incomeEntries,
    );

    // Current-year pending is strictly based on annualFeeAmount minus collections for this enrollment
    const currentPending = Math.max(0, enrollment.annualFeeAmount - feeSummary.collected);

    summary.totalStudents += 1;
    summary.currentYearPending = Math.round((summary.currentYearPending + currentPending) * 100) / 100;
    summary.previousYearPending = Math.round((summary.previousYearPending + prevPending) * 100) / 100;
    summary.totalPending = Math.round((summary.totalPending + currentPending + prevPending) * 100) / 100;
    summary.totalAnnualFee = Math.round(((summary.totalAnnualFee || 0) + (enrollment.annualFeeAmount || 0)) * 100) / 100;
    summary.avgAnnualFee = summary.totalStudents > 0 ? Math.round((summary.totalAnnualFee || 0) / summary.totalStudents) : 0;
  }

  return Array.from(groups.values()).sort((a, b) => compareClassNames(a.className, b.className));
}

export function findStudentForEnrollment(
  enrollmentId: string | null,
  enrollments: StudentEnrollment[],
  students: Student[],
): Student | undefined {
  const enrollment = enrollments.find((item) => item.id === enrollmentId);
  return students.find((student) => student.id === enrollment?.studentId);
}

