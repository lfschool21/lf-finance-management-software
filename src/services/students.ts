import { requireUserId, supabase } from './supabase';
import type { Json } from '@/integrations/supabase/types';
import type { RosterImportRow, StudentMedium, StudentStatus } from '@/types/students';

export interface DbStudent {
  id: string; user_id: string; admission_number: string | null; full_name: string;
  status: StudentStatus; notes: string | null; created_at: string; updated_at: string;
}
export interface DbStudentEnrollment {
  id: string; user_id: string; student_id: string; academic_year_id: string; class_name: string;
  medium: StudentMedium; annual_fee_amount: number; additional_outstanding_amount: number;
  opening_collected_cash: number; opening_collected_upi: number; opening_collected_other: number;
  opening_snapshot_date: string | null; status: StudentStatus; notes: string | null;
  created_at: string; updated_at: string;
}

export interface StudentInput {
  id?: string; admission_number: string | null; full_name: string; status: StudentStatus; notes: string | null;
}
export interface EnrollmentInput {
  id?: string; academic_year_id: string; class_name: string; medium: StudentMedium;
  annual_fee_amount: number; additional_outstanding_amount: number;
  opening_collected_cash: number; opening_collected_upi: number; opening_collected_other: number;
  opening_snapshot_date: string | null; status: StudentStatus; notes: string | null;
}

export async function getAll() {
  const userId = await requireUserId();
  const [studentsResult, enrollmentsResult] = await Promise.all([
    supabase.from('students').select('*').eq('user_id', userId).order('full_name'),
    supabase.from('student_enrollments').select('*').eq('user_id', userId).order('class_name'),
  ]);
  return {
    students: studentsResult.data as DbStudent[] | null,
    enrollments: enrollmentsResult.data as DbStudentEnrollment[] | null,
    error: studentsResult.error || enrollmentsResult.error,
  };
}

export async function save(student: StudentInput, enrollment: EnrollmentInput) {
  const { data, error } = await supabase.rpc('save_student_with_enrollment', {
    p_student: student as unknown as Json,
    p_enrollment: enrollment as unknown as Json,
  });
  return { data: data as unknown as { student: DbStudent; enrollment: DbStudentEnrollment } | null, error };
}

export async function archive(studentId: string) {
  const { error } = await supabase.rpc('archive_student', { p_student_id: studentId });
  return { error };
}

export async function importRoster(academicYearId: string, rows: RosterImportRow[]) {
  const payload = rows.map((row) => ({
    student_id: row.studentId || null,
    admission_number: row.admissionNumber || null,
    full_name: row.fullName,
    class_name: row.className,
    medium: row.medium,
    annual_fee_amount: row.annualFeeAmount,
    additional_outstanding_amount: row.additionalOutstandingAmount,
    opening_collected_cash: row.openingCollectedCash,
    opening_collected_upi: row.openingCollectedUpi,
    opening_collected_other: row.openingCollectedOther,
    opening_snapshot_date: row.openingSnapshotDate || null,
    previous_academic_year_id: row.previousAcademicYearId || null,
    previous_class_name: row.previousClassName || null,
    previous_medium: row.previousMedium || null,
    previous_annual_fee_amount: row.previousAnnualFeeAmount ?? null,
    previous_opening_collected_cash: row.previousOpeningCollectedCash ?? 0,
    previous_opening_collected_upi: row.previousOpeningCollectedUpi ?? 0,
    previous_opening_collected_other: row.previousOpeningCollectedOther ?? 0,
  }));
  const { data, error } = await supabase.rpc('import_student_roster', {
    p_academic_year_id: academicYearId,
    p_rows: payload as unknown as Json,
  });
  return { data: data as { added: number; updated: number; failed: number; total: number } | null, error };
}
