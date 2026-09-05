import { describe, expect, it } from 'vitest';
import type { IncomeEntry } from '@/types/finance';
import type { StudentEnrollment } from '@/types/students';
import { getStudentFeeSummary, groupRosterByClass, normalizeMedium, summarizeRoster } from './student-fees';

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
});
