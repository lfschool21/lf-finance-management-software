import { create } from 'zustand';
import type { Student, StudentEnrollment, RosterImportRow } from '@/types/students';
import * as studentsService from '@/services/students';

const mapStudent = (row: studentsService.DbStudent): Student => ({
  id: row.id, admissionNumber: row.admission_number || '', fullName: row.full_name,
  status: row.status, notes: row.notes || '', createdAt: row.created_at, updatedAt: row.updated_at,
});
const mapEnrollment = (row: studentsService.DbStudentEnrollment): StudentEnrollment => ({
  id: row.id, studentId: row.student_id, academicYearId: row.academic_year_id,
  className: row.class_name, medium: row.medium, annualFeeAmount: Number(row.annual_fee_amount),
  additionalOutstandingAmount: Number(row.additional_outstanding_amount),
  openingCollectedCash: Number(row.opening_collected_cash), openingCollectedUpi: Number(row.opening_collected_upi),
  openingCollectedOther: Number(row.opening_collected_other), openingSnapshotDate: row.opening_snapshot_date,
  status: row.status, notes: row.notes || '',
});

interface StudentState {
  students: Student[];
  enrollments: StudentEnrollment[];
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  init: (force?: boolean) => Promise<void>;
  saveStudent: (student: studentsService.StudentInput, enrollment: studentsService.EnrollmentInput) => Promise<void>;
  archiveStudent: (studentId: string) => Promise<void>;
  importRoster: (academicYearId: string, rows: RosterImportRow[]) => Promise<{ added: number; updated: number; failed: number; total: number }>;
}

export const useStudentStore = create<StudentState>((set, get) => ({
  students: [], enrollments: [], isInitialized: false, isLoading: false, error: null,
  init: async (force = false) => {
    if (get().isInitialized && !force) return;
    set({ isLoading: true, error: null });
    try {
      const result = await studentsService.getAll();
      if (result.error) throw result.error;
      set({ students: (result.students || []).map(mapStudent), enrollments: (result.enrollments || []).map(mapEnrollment), isInitialized: true, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load students', isInitialized: true, isLoading: false });
    }
  },
  saveStudent: async (student, enrollment) => {
    const result = await studentsService.save(student, enrollment);
    if (result.error || !result.data) throw result.error || new Error('Failed to save student');
    const savedStudent = mapStudent(result.data.student);
    const savedEnrollment = mapEnrollment(result.data.enrollment);
    set((state) => ({
      students: state.students.some((item) => item.id === savedStudent.id)
        ? state.students.map((item) => item.id === savedStudent.id ? savedStudent : item)
        : [...state.students, savedStudent].sort((a, b) => a.fullName.localeCompare(b.fullName)),
      enrollments: state.enrollments.some((item) => item.id === savedEnrollment.id)
        ? state.enrollments.map((item) => item.id === savedEnrollment.id ? savedEnrollment : item)
        : [...state.enrollments, savedEnrollment],
    }));
  },
  archiveStudent: async (studentId) => {
    const { error } = await studentsService.archive(studentId);
    if (error) throw error;
    set((state) => ({
      students: state.students.map((student) => student.id === studentId ? { ...student, status: 'inactive' } : student),
      enrollments: state.enrollments.map((enrollment) => enrollment.studentId === studentId && enrollment.status === 'active' ? { ...enrollment, status: 'inactive' } : enrollment),
    }));
  },
  importRoster: async (academicYearId, rows) => {
    const result = await studentsService.importRoster(academicYearId, rows);
    if (result.error || !result.data) throw result.error || new Error('Import failed');
    await get().init(true);
    return result.data;
  },
}));
