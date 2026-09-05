export type StudentStatus = 'active' | 'inactive' | 'left';
export type StudentMedium = 'english' | 'gujarati';

export interface Student {
  id: string;
  admissionNumber: string;
  fullName: string;
  status: StudentStatus;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentEnrollment {
  id: string;
  studentId: string;
  academicYearId: string;
  className: string;
  medium: StudentMedium;
  annualFeeAmount: number;
  additionalOutstandingAmount: number;
  openingCollectedCash: number;
  openingCollectedUpi: number;
  openingCollectedOther: number;
  openingSnapshotDate: string | null;
  status: StudentStatus;
  notes: string;
}

export interface StudentFeeSummary {
  obligation: number;
  openingCollected: number;
  recordedCollected: number;
  collected: number;
  pending: number;
  collectionPercent: number;
  cash: number;
  upi: number;
  other: number;
  unknown: number;
  status: 'not_paid' | 'partially_paid' | 'paid';
}

export interface RosterImportRow {
  rowNumber: number;
  studentId?: string;
  admissionNumber: string;
  fullName: string;
  className: string;
  medium: StudentMedium | null;
  annualFeeAmount: number | null;
  additionalOutstandingAmount: number;
  openingCollectedCash: number;
  openingCollectedUpi: number;
  openingCollectedOther: number;
  openingSnapshotDate: string;
  previousAcademicYearId?: string;
  previousClassName?: string;
  previousMedium?: StudentMedium;
  previousAnnualFeeAmount?: number;
  previousOpeningCollectedCash?: number;
  previousOpeningCollectedUpi?: number;
  previousOpeningCollectedOther?: number;
  action: 'new' | 'update' | 'possible_duplicate' | 'conflict';
  inferredOpening: boolean;
  warnings: string[];
  errors: string[];
}

export const MEDIUM_LABELS: Record<StudentMedium, string> = {
  english: 'English',
  gujarati: 'Gujarati',
};
