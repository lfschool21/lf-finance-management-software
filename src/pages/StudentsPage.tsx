import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import {
  getStudentFeeSummary,
  getStudentPreviousPending,
  groupRosterByClassWithPrevious,
  summarizeRoster,
} from '@/lib/student-fees';
import type { Student, StudentEnrollment, StudentMedium } from '@/types/students';
import { Button } from '@/components/ui/button';
import { StudentPageHeader } from '@/components/students/StudentPageHeader';
import { StudentMediumSwitcher } from '@/components/students/StudentMediumSwitcher';
import { StudentOverview } from '@/components/students/StudentOverview';
import { ClassCard } from '@/components/students/ClassCard';
import { ClassStudentList } from '@/components/students/ClassStudentList';
import { StudentGlobalSearch } from '@/components/students/StudentGlobalSearch';
import type { StudentRowData } from '@/components/students/StudentTable';
import { RecordPreviousPaymentModal } from '@/components/students/RecordPreviousPaymentModal';
import { getPreviousClassName } from '@/utils/class-progression';

import { AddStudentModal } from '@/components/AddStudentModal';
import { StudentImportWizard } from '@/components/StudentImportWizard';
import { AddIncomeModal } from '@/components/AddIncomeModal';
import { RemoveAllStudentsModal } from '@/components/students/RemoveAllStudentsModal';
import { downloadStudentImportTemplate } from '@/lib/student-import';
import { AverageFeeCalculatorModal } from '@/components/AverageFeeCalculatorModal';

export default function StudentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { academicYears, currentYearId, incomeEntries } = useFinanceStore();
  const { students, enrollments } = useStudentStore();

  // Selected Academic Year
  const [yearId, setYearId] = useState(currentYearId);

  // Active roster for selected academic year
  const roster = useMemo(
    () => enrollments.filter((item) => item.academicYearId === yearId && item.status === 'active'),
    [enrollments, yearId]
  );

  // URL-driven Medium & Class state
  const mediumParam = searchParams.get('medium');
  const activeMedium = useMemo<StudentMedium>(() => {
    if (mediumParam === 'gujarati' || mediumParam === 'english') return mediumParam;
    // Default to first medium with students, or gujarati
    const hasGuj = roster.some((r) => r.medium === 'gujarati');
    const hasEng = roster.some((r) => r.medium === 'english');
    if (hasGuj) return 'gujarati';
    if (hasEng) return 'english';
    return 'gujarati';
  }, [mediumParam, roster]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRemoveAllModal, setShowRemoveAllModal] = useState(false);
  const [showAvgFeeCalc, setShowAvgFeeCalc] = useState(false);
  const [editingData, setEditingData] = useState<{
    student: Student;
    enrollment: StudentEnrollment;
  } | null>(null);
  const [paymentEnrollmentId, setPaymentEnrollmentId] = useState<string | undefined>(undefined);
  const [previousPaymentTarget, setPreviousPaymentTarget] = useState<StudentRowData | null>(null);

  // Keep academic year synchronized
  useEffect(() => {
    if (!yearId || !academicYears.some((item) => item.id === yearId)) {
      const fallback =
        currentYearId ||
        academicYears.find((item) => item.status === 'active')?.id ||
        academicYears[0]?.id ||
        '';
      if (fallback) setYearId(fallback);
    }
  }, [currentYearId, academicYears, yearId]);

  const year = useMemo(
    () => academicYears.find((item) => item.id === yearId),
    [academicYears, yearId]
  );

  const selectedClass = searchParams.get('class');

  // Medium-split rosters
  const gujaratiRoster = useMemo(() => roster.filter((r) => r.medium === 'gujarati'), [roster]);
  const englishRoster = useMemo(() => roster.filter((r) => r.medium === 'english'), [roster]);
  const gujaratiCount = gujaratiRoster.length;
  const englishCount = englishRoster.length;

  // Medium summaries and collection stats
  const gujaratiSummary = useMemo(
    () => summarizeRoster(gujaratiRoster, incomeEntries),
    [gujaratiRoster, incomeEntries]
  );
  const englishSummary = useMemo(
    () => summarizeRoster(englishRoster, incomeEntries),
    [englishRoster, incomeEntries]
  );

  const gujaratiPrevPending = useMemo(() => {
    return gujaratiRoster.reduce(
      (sum, e) => sum + getStudentPreviousPending(e.studentId, yearId, enrollments, incomeEntries),
      0
    );
  }, [gujaratiRoster, yearId, enrollments, incomeEntries]);

  const englishPrevPending = useMemo(() => {
    return englishRoster.reduce(
      (sum, e) => sum + getStudentPreviousPending(e.studentId, yearId, enrollments, incomeEntries),
      0
    );
  }, [englishRoster, yearId, enrollments, incomeEntries]);

  const gujaratiCurrentPending = useMemo(() => {
    return gujaratiRoster.reduce(
      (sum, e) => sum + Math.max(0, e.annualFeeAmount - getStudentFeeSummary(e, incomeEntries).collected),
      0
    );
  }, [gujaratiRoster, incomeEntries]);

  const englishCurrentPending = useMemo(() => {
    return englishRoster.reduce(
      (sum, e) => sum + Math.max(0, e.annualFeeAmount - getStudentFeeSummary(e, incomeEntries).collected),
      0
    );
  }, [englishRoster, incomeEntries]);

  const gujaratiStats = useMemo(() => {
    const target = gujaratiSummary.currentAnnualFee;
    const collected = gujaratiSummary.collected;
    const pct = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;
    const count = gujaratiRoster.length;
    return {
      studentsCount: count,
      totalAnnualFee: target,
      totalObligation: gujaratiSummary.obligation,
      collected,
      currentPending: Math.round(gujaratiCurrentPending * 100) / 100,
      previousPending: Math.round(gujaratiPrevPending * 100) / 100,
      totalPending: Math.round((gujaratiCurrentPending + gujaratiPrevPending) * 100) / 100,
      collectionPercent: pct,
      avgAnnualFeeCharged: count > 0 ? Math.round(target / count) : 0,
      avgCollected: count > 0 ? Math.round(collected / count) : 0,
    };
  }, [gujaratiSummary, gujaratiRoster.length, gujaratiCurrentPending, gujaratiPrevPending]);

  const englishStats = useMemo(() => {
    const target = englishSummary.currentAnnualFee;
    const collected = englishSummary.collected;
    const pct = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;
    const count = englishRoster.length;
    return {
      studentsCount: count,
      totalAnnualFee: target,
      totalObligation: englishSummary.obligation,
      collected,
      currentPending: Math.round(englishCurrentPending * 100) / 100,
      previousPending: Math.round(englishPrevPending * 100) / 100,
      totalPending: Math.round((englishCurrentPending + englishPrevPending) * 100) / 100,
      collectionPercent: pct,
      avgAnnualFeeCharged: count > 0 ? Math.round(target / count) : 0,
      avgCollected: count > 0 ? Math.round(collected / count) : 0,
    };
  }, [englishSummary, englishRoster.length, englishCurrentPending, englishPrevPending]);

  const activeCollected = activeMedium === 'gujarati' ? gujaratiStats.collected : englishStats.collected;

  // Unassigned tuition: recorded in finance with category 'Tuition Fees' but not linked to student
  const unassignedCurrentTuition = useMemo(() => {
    const currentYearIncome = incomeEntries.filter((i) => i.academicYearId === yearId);
    const recordedTuition = currentYearIncome
      .filter((i) => i.category === 'Tuition Fees' && !i.isLateCollection)
      .reduce((sum, i) => sum + i.amount, 0);
    const linkedTuition = currentYearIncome
      .filter((i) => !i.isLateCollection && i.studentEnrollmentId)
      .reduce((sum, i) => sum + i.amount, 0);
    return Math.max(0, recordedTuition - linkedTuition);
  }, [incomeEntries, yearId]);

  // Medium-scoped roster
  const mediumScopedRoster = useMemo(() => {
    return activeMedium === 'gujarati' ? gujaratiRoster : englishRoster;
  }, [activeMedium, gujaratiRoster, englishRoster]);

  // Fast student lookup map
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    for (const s of students) {
      map.set(s.id, s);
    }
    return map;
  }, [students]);

  // Group roster by class with previous pending calculation
  const classCardSummaries = useMemo(() => {
    return groupRosterByClassWithPrevious(
      mediumScopedRoster,
      enrollments,
      incomeEntries,
      yearId,
    );
  }, [mediumScopedRoster, enrollments, incomeEntries, yearId]);

  // Medium-wide financial totals from class cards
  const { totalCurrentPending, totalPreviousPending, totalAllPending } = useMemo(() => {
    let current = 0;
    let previous = 0;
    for (const c of classCardSummaries) {
      current += c.currentYearPending;
      previous += c.previousYearPending;
    }
    current = Math.round(current * 100) / 100;
    previous = Math.round(previous * 100) / 100;
    const total = Math.round((current + previous) * 100) / 100;
    return {
      totalCurrentPending: current,
      totalPreviousPending: previous,
      totalAllPending: total,
    };
  }, [classCardSummaries]);

  // Students for the currently selected class
  const classRows = useMemo(() => {
    if (!selectedClass) return [];
    const rows: StudentRowData[] = [];
    const classEnrollments = mediumScopedRoster.filter((e) => e.className === selectedClass);

    for (const enrollment of classEnrollments) {
      const student = studentMap.get(enrollment.studentId);
      if (!student) continue;

      const fees = getStudentFeeSummary(enrollment, incomeEntries);
      const previous = getStudentPreviousPending(
        enrollment.studentId,
        yearId,
        enrollments,
        incomeEntries,
      );

      rows.push({ student, enrollment, fees, previous });
    }

    return rows;
  }, [selectedClass, mediumScopedRoster, studentMap, incomeEntries, yearId, enrollments]);

  // Navigation handlers
  const handleMediumChange = (newMedium: StudentMedium) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('medium', newMedium);
      next.delete('class');
      return next;
    });
  };

  const handleSelectClass = (className: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('medium', activeMedium);
      next.set('class', className);
      return next;
    });
  };

  const handleBackToClasses = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('class');
      return next;
    });
  };

  // Previous payment context calculation
  const previousPaymentContext = useMemo(() => {
    if (!previousPaymentTarget) return null;
    const targetStudentEnrollments = enrollments.filter(
      (e) => e.studentId === previousPaymentTarget.student.id
    );
    const historical = targetStudentEnrollments.find(
      (e) => e.academicYearId !== yearId
    );
    if (historical) {
      return {
        enrollment: historical,
        pending: getStudentFeeSummary(historical, incomeEntries).pending,
        className: historical.className,
      };
    }
    const prevYear = academicYears.find((y) => y.id !== yearId);
    return {
      enrollment: {
        ...previousPaymentTarget.enrollment,
        id: previousPaymentTarget.enrollment.id,
        academicYearId: prevYear?.id || yearId,
        className: getPreviousClassName(previousPaymentTarget.enrollment.className),
        annualFeeAmount: previousPaymentTarget.previous,
        additionalOutstandingAmount: 0,
      },
      pending: previousPaymentTarget.previous,
      className: getPreviousClassName(previousPaymentTarget.enrollment.className),
    };
  }, [previousPaymentTarget, enrollments, yearId, incomeEntries, academicYears]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 1. Page Header with active medium in title */}
      <StudentPageHeader
        academicYears={academicYears}
        selectedYearId={yearId}
        onYearChange={setYearId}
        onAddStudent={() => setShowAddModal(true)}
        onImportStudents={() => setShowImportModal(true)}
        onDownloadTemplate={downloadStudentImportTemplate}
        onRemoveAllStudents={() => setShowRemoveAllModal(true)}
        onOpenCalculator={() => setShowAvgFeeCalc(true)}
        totalStudentsCount={students.length}
        activeMedium={activeMedium}
      />

      {/* 2. Global Cross-Medium Search */}
      <StudentGlobalSearch
        students={students}
        enrollments={enrollments}
        selectedYearId={yearId}
        onSelectStudent={(id) => navigate(`/students/${id}`)}
      />

      {/* 3. Medium Workspace Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <StudentMediumSwitcher
          activeMedium={activeMedium}
          onChange={handleMediumChange}
          gujaratiCount={gujaratiCount}
          englishCount={englishCount}
        />
      </div>

      {/* 4. Two-View Rendering: Class Grid vs Class Student List */}
      {!selectedClass ? (
        <div className="space-y-5">
          {/* Overview of key metrics for the active medium & fee collections */}
          <StudentOverview
            totalStudents={mediumScopedRoster.length}
            currentYearPending={totalCurrentPending}
            previousYearPending={totalPreviousPending}
            totalPending={totalAllPending}
            activeMedium={activeMedium}
            activeCollected={activeCollected}
            onMediumChange={handleMediumChange}
            gujaratiStats={gujaratiStats}
            englishStats={englishStats}
            onOpenCalculator={() => setShowAvgFeeCalc(true)}
            unassignedTuition={unassignedCurrentTuition}
          />

          {/* Class Cards Grid */}
          <section aria-label={`${activeMedium === 'gujarati' ? 'Gujarati' : 'English'} Classes`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                {activeMedium === 'gujarati' ? 'Gujarati Medium Classes' : 'English Medium Classes'}
              </h2>
              <span className="text-xs text-muted-foreground font-mono-nums">
                {classCardSummaries.length} {classCardSummaries.length === 1 ? 'Class' : 'Classes'}
              </span>
            </div>

            {classCardSummaries.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center bg-card">
                <p className="text-sm font-medium text-foreground">No classes found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No students enrolled in {activeMedium === 'gujarati' ? 'Gujarati' : 'English'} Medium for this academic year.
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 gap-1.5 text-xs font-semibold"
                >
                  Add First Student
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {classCardSummaries.map((cls) => (
                  <ClassCard
                    key={cls.className}
                    summary={cls}
                    medium={activeMedium}
                    onSelectClass={handleSelectClass}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <ClassStudentList
          className={selectedClass}
          medium={activeMedium}
          rows={classRows}
          onBack={handleBackToClasses}
          onSelectStudent={(id) => navigate(`/students/${id}`)}
          onRecordPayment={(enrollmentId) => setPaymentEnrollmentId(enrollmentId)}
          onRecordPreviousPayment={(row) => setPreviousPaymentTarget(row)}
          onEditStudent={(std, enr) => setEditingData({ student: std, enrollment: enr })}
        />
      )}

      {/* Add / Edit Student Modal */}
      <AddStudentModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        defaultYearId={yearId}
        defaultMedium={activeMedium}
      />

      {editingData && (
        <AddStudentModal
          open={!!editingData}
          onClose={() => setEditingData(null)}
          student={editingData.student}
          enrollment={editingData.enrollment}
          defaultYearId={yearId}
          defaultMedium={editingData.enrollment.medium}
        />
      )}

      {/* Roster Import Wizard */}
      <StudentImportWizard
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        defaultYearId={yearId}
        defaultMedium={activeMedium}
      />

      {/* Quick Record Payment Modal */}
      <AddIncomeModal
        isOpen={!!paymentEnrollmentId}
        onClose={() => setPaymentEnrollmentId(undefined)}
        presetStudentEnrollmentId={paymentEnrollmentId}
        tuitionOnly={true}
      />

      {/* Remove All Students Confirmation Modal */}
      <RemoveAllStudentsModal
        open={showRemoveAllModal}
        onClose={() => setShowRemoveAllModal(false)}
        yearId={yearId}
        yearLabel={year?.label}
        yearStudentCount={roster.length}
        totalStudentCount={students.length}
      />

      {/* Quick Record Previous-Year Payment Modal */}
      {previousPaymentTarget && previousPaymentContext && (
        <RecordPreviousPaymentModal
          open={!!previousPaymentTarget}
          onClose={() => setPreviousPaymentTarget(null)}
          student={previousPaymentTarget.student}
          previousEnrollment={previousPaymentContext.enrollment}
          previousPending={previousPaymentContext.pending}
          previousClass={previousPaymentContext.className}
        />
      )}

      {/* Average Fee Calculator & Simulator Modal */}
      <AverageFeeCalculatorModal
        open={showAvgFeeCalc}
        onClose={() => setShowAvgFeeCalc(false)}
        academicYearId={yearId}
        academicYearLabel={year?.label}
        initialMedium={activeMedium}
      />
    </div>
  );
}
