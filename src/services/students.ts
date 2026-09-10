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

export interface RemoveAllStudentsOptions {
  academicYearId?: string;
  deletePayments?: boolean;
}

export async function removeAll(options?: RemoveAllStudentsOptions): Promise<{
  removedStudents: number;
  removedEnrollments: number;
  error?: unknown;
}> {
  const userId = await requireUserId();
  const academicYearId = options?.academicYearId;
  const deletePayments = Boolean(options?.deletePayments);

  try {
    if (academicYearId) {
      // 1. Fetch enrollments for this specific academic year
      const { data: enrollments, error: fetchErr } = await supabase
        .from('student_enrollments')
        .select('id, student_id')
        .eq('user_id', userId)
        .eq('academic_year_id', academicYearId);

      if (fetchErr) throw fetchErr;
      if (!enrollments || enrollments.length === 0) {
        return { removedStudents: 0, removedEnrollments: 0 };
      }

      const enrollmentIds = enrollments.map((e) => e.id);
      const studentIds = Array.from(new Set(enrollments.map((e) => e.student_id)));

      // 2. Handle linked income entries in batches of 100
      for (let i = 0; i < enrollmentIds.length; i += 100) {
        const chunk = enrollmentIds.slice(i, i + 100);
        if (deletePayments) {
          const { error: delIncomeErr } = await supabase
            .from('income_entries')
            .delete()
            .eq('user_id', userId)
            .in('student_enrollment_id', chunk);
          if (delIncomeErr) throw delIncomeErr;
        } else {
          const { error: unlinkIncomeErr } = await supabase
            .from('income_entries')
            .update({ student_enrollment_id: null })
            .eq('user_id', userId)
            .in('student_enrollment_id', chunk);
          if (unlinkIncomeErr) throw unlinkIncomeErr;
        }
      }

      // 3. Delete student enrollments for this academic year
      const { error: delEnrollmentsErr } = await supabase
        .from('student_enrollments')
        .delete()
        .eq('user_id', userId)
        .eq('academic_year_id', academicYearId);

      if (delEnrollmentsErr) throw delEnrollmentsErr;

      // 4. Check if these students have any remaining enrollments in OTHER academic years
      let removedStudentsCount = 0;
      if (studentIds.length > 0) {
        const { data: remaining, error: remErr } = await supabase
          .from('student_enrollments')
          .select('student_id')
          .eq('user_id', userId)
          .in('student_id', studentIds);

        if (remErr) throw remErr;

        const remainingStudentIds = new Set((remaining || []).map((r) => r.student_id));
        const studentsToDelete = studentIds.filter((id) => !remainingStudentIds.has(id));

        if (studentsToDelete.length > 0) {
          for (let i = 0; i < studentsToDelete.length; i += 100) {
            const chunk = studentsToDelete.slice(i, i + 100);
            const { error: delStudentsErr } = await supabase
              .from('students')
              .delete()
              .eq('user_id', userId)
              .in('id', chunk);
            if (delStudentsErr) throw delStudentsErr;
          }
          removedStudentsCount = studentsToDelete.length;
        }
      }

      return {
        removedStudents: removedStudentsCount,
        removedEnrollments: enrollmentIds.length,
      };
    } else {
      // Remove ALL students across ALL academic years
      const [{ count: studentCount }, { count: enrollmentCount }] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('student_enrollments').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      ]);

      // 1. Handle linked income entries
      if (deletePayments) {
        const { error: delIncomeErr } = await supabase
          .from('income_entries')
          .delete()
          .eq('user_id', userId)
          .not('student_enrollment_id', 'is', null);
        if (delIncomeErr) throw delIncomeErr;
      } else {
        const { error: unlinkIncomeErr } = await supabase
          .from('income_entries')
          .update({ student_enrollment_id: null })
          .eq('user_id', userId)
          .not('student_enrollment_id', 'is', null);
        if (unlinkIncomeErr) throw unlinkIncomeErr;
      }

      // 2. Delete all student enrollments
      const { error: delEnrollmentsErr } = await supabase
        .from('student_enrollments')
        .delete()
        .eq('user_id', userId);
      if (delEnrollmentsErr) throw delEnrollmentsErr;

      // 3. Delete all students
      const { error: delStudentsErr } = await supabase
        .from('students')
        .delete()
        .eq('user_id', userId);
      if (delStudentsErr) throw delStudentsErr;

      return {
        removedStudents: studentCount || 0,
        removedEnrollments: enrollmentCount || 0,
      };
    }
  } catch (error) {
    return {
      removedStudents: 0,
      removedEnrollments: 0,
      error,
    };
  }
}

export async function deleteEnrollment(enrollmentId: string) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('student_enrollments')
    .delete()
    .eq('id', enrollmentId)
    .eq('user_id', userId);
  return { error };
}
