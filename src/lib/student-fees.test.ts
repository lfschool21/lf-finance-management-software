import { describe, expect, it } from 'vitest';
import type { IncomeEntry } from '@/types/finance';
import type { StudentEnrollment } from '@/types/students';
import {
  calculateAverageFees,
  calculateClassAverageFees,
  getStudentFeeSummary,
  groupRosterByClass,
  groupRosterByClassWithPrevious,
  normalizeMedium,
  summarizeRoster,
} from './student-fees';

const enrollment: StudentEnrollment = {
  id: 'e1', studentId: 's1', academicYearId: 'y1', className: 'Class 6', medium: 'english',
  annualFeeAmount: 30000, additionalOutstandingAmount: 2000,
  openingCollectedCash: 8000, openingCollectedUpi: 2000, openingCollectedOther: 0,
  openingSnapshotDate: '2026-08-01', status: 'active', notes: '',
};
const payment = (amount: number, method: IncomeEntry['paymentMethod']): IncomeEntry => ({
  id: `${amount}-${method}`, academicYearId: 'y1', category: 'Tuition Fees', amount, date: new Date(2026, 7, 21),
  accountId: 'a1', isLateCollection: false, originalYearId: null, studentEnrollmentId: 'e1',
  paymentMethod: method, paymentReference: '', notes: '', tags: [],
});

describe('student fee domain', () => {
  it('combines imported opening history and real linked payments without duplicating either', () => {
    const summary = getStudentFeeSummary(enrollment, [payment(5000, 'upi'), payment(3000, 'cash')]);
    expect(summary).toMatchObject({ obligation: 32000, openingCollected: 10000, recordedCollected: 8000, collected: 18000, pending: 14000, cash: 11000, upi: 7000, status: 'partially_paid' });
  });
  it('reports unpaid and fully paid states', () => {
    expect(getStudentFeeSummary({ ...enrollment, openingCollectedCash: 0, openingCollectedUpi: 0 }, []).status).toBe('not_paid');
    expect(getStudentFeeSummary(enrollment, [payment(22000, 'cash')]).status).toBe('paid');
  });
  it('normalizes supported medium aliases but does not guess unknown values', () => {
    expect(normalizeMedium(' ENG ')).toBe('english');
    expect(normalizeMedium('Guj')).toBe('gujarati');
    expect(normalizeMedium('Hindi')).toBeNull();
  });
  it('calculates strength and class groupings from active enrollments only', () => {
    const rows = [enrollment, { ...enrollment, id: 'e2', studentId: 's2', medium: 'gujarati' as const }, { ...enrollment, id: 'e3', studentId: 's3', className: 'Class 7', status: 'left' as const }];
    expect(summarizeRoster(rows, []).totalStudents).toBe(2);
    expect(summarizeRoster(rows, [])).toMatchObject({ english: 1, gujarati: 1, pendingStudents: 2 });
    expect(groupRosterByClass(rows, [])).toHaveLength(1);
  });
  it('calculates average fees per student and by class accurately', () => {
    const rows: StudentEnrollment[] = [
      { ...enrollment, id: 'e1', studentId: 's1', annualFeeAmount: 20000, className: 'Class 1', medium: 'gujarati' },
      { ...enrollment, id: 'e2', studentId: 's2', annualFeeAmount: 30000, className: 'Class 1', medium: 'gujarati' },
      { ...enrollment, id: 'e3', studentId: 's3', annualFeeAmount: 40000, className: 'Class 2', medium: 'english' },
      { ...enrollment, id: 'e4', studentId: 's4', annualFeeAmount: 10000, className: 'Class 2', status: 'transferred' },
    ];
    // 3 active students: total annual fee = 20k + 30k + 40k = 90k, avg = 30k
    const avg = calculateAverageFees(rows, []);
    expect(avg.totalStudents).toBe(3);
    expect(avg.totalAnnualFee).toBe(90000);
    expect(avg.avgAnnualFeeCharged).toBe(30000);

    const classAvgs = calculateClassAverageFees(rows, []);
    expect(classAvgs).toHaveLength(2);
    expect(classAvgs[0]).toMatchObject({
      className: 'Class 1',
      totalStudents: 2,
      totalAnnualFee: 50000,
      avgAnnualFeeCharged: 25000,
    });
    expect(classAvgs[1]).toMatchObject({
      className: 'Class 2',
      totalStudents: 1,
      totalAnnualFee: 40000,
      avgAnnualFeeCharged: 40000,
    });

    const classCards = groupRosterByClassWithPrevious(rows, rows, [], 'y1');
    expect(classCards[0].avgAnnualFee).toBe(25000);
    expect(classCards[1].avgAnnualFee).toBe(40000);
  });
});
