import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, UserPlus, FileSpreadsheet, RotateCcw, Loader2 } from 'lucide-react';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import {
  getStudentFeeSummary,
  getStudentPreviousPending,
  groupRosterByClass,
  summarizeRoster,
} from '@/lib/student-fees';
import type { Student, StudentEnrollment, StudentMedium } from '@/types/students';
import { Button } from '@/components/ui/button';
import { StudentPageHeader } from '@/components/students/StudentPageHeader';
import { StudentMediumSwitcher } from '@/components/students/StudentMediumSwitcher';
import { StudentOverview } from '@/components/students/StudentOverview';
import { StudentToolbar, type FeeFilterType } from '@/components/students/StudentToolbar';
import {
  StudentTable,
  type SortField,
  type SortDirection,
  type StudentRowData,
} from '@/components/students/StudentTable';
import { StudentCard } from '@/components/students/StudentCard';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AddStudentModal } from '@/components/AddStudentModal';
import { StudentImportWizard } from '@/components/StudentImportWizard';
import { AddIncomeModal } from '@/components/AddIncomeModal';
import { RemoveAllStudentsModal } from '@/components/students/RemoveAllStudentsModal';
import { downloadStudentImportTemplate } from '@/lib/student-import';
import {
  compareClassNames,
  compareAdmissionNumbers,
  compareStudentsLowestToHighest,
} from '@/utils/student-order';

const DEFAULT_PAGE_SIZE = 100;

export default function StudentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { academicYears, currentYearId, incomeEntries } = useFinanceStore();
  const { students, enrollments, isLoading: storeLoading } = useStudentStore();

  // Selected Academic Year
  const [yearId, setYearId] = useState(currentYearId);

  // Search and Filter states
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');

  // URL-synchronized medium state
  const mediumQuery = searchParams.get('medium');
  const initialMedium: 'all' | StudentMedium =
    mediumQuery === 'gujarati' || mediumQuery === 'english' ? mediumQuery : 'all';
  const [activeMedium, setActiveMedium] = useState<'all' | StudentMedium>(initialMedium);

  const [feeFilter, setFeeFilter] = useState<FeeFilterType>('all');

  // Sorting state: default to 'class' ascending (from lowest to highest class, then lowest to highest admission)
  const [sortField, setSortField] = useState<SortField>('class');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Pagination state: default 100 per page, supports viewing all students
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

  // View mode: default to professional 'cards' design
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRemoveAllModal, setShowRemoveAllModal] = useState(false);
  const [editingData, setEditingData] = useState<{
    student: Student;
    enrollment: StudentEnrollment;
  } | null>(null);
  const [paymentEnrollmentId, setPaymentEnrollmentId] = useState<string | undefined>(undefined);

  // Keep state in sync if URL query parameter changes
  useEffect(() => {
    const m = searchParams.get('medium');
    const valid: 'all' | StudentMedium = m === 'gujarati' || m === 'english' ? m : 'all';
    if (valid !== activeMedium) {
      setActiveMedium(valid);
    }
  }, [searchParams, activeMedium]);

  const handleMediumChange = (newMedium: 'all' | StudentMedium) => {
    setActiveMedium(newMedium);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (newMedium === 'all') {
          next.delete('medium');
        } else {
          next.set('medium', newMedium);
        }
        return next;
      },
      { replace: true }
    );
  };

  // Ensure valid academic year is selected
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

  // Reset page whenever search, medium, or filters change
  useEffect(() => {
    setPage(1);
  }, [query, classFilter, activeMedium, feeFilter, yearId]);

  const year = useMemo(
    () => academicYears.find((item) => item.id === yearId),
    [academicYears, yearId]
  );

  // Active roster for selected academic year
  const roster = useMemo(
    () => enrollments.filter((item) => item.academicYearId === yearId && item.status === 'active'),
    [enrollments, yearId]
  );

  // Dynamic medium student counts
  const allCount = roster.length;
  const gujaratiCount = useMemo(() => roster.filter((r) => r.medium === 'gujarati').length, [roster]);
  const englishCount = useMemo(() => roster.filter((r) => r.medium === 'english').length, [roster]);

  // Medium-scoped roster for active view
  const mediumScopedRoster = useMemo(() => {
    if (activeMedium === 'all') return roster;
    return roster.filter((r) => r.medium === activeMedium);
  }, [roster, activeMedium]);

  // Summary and class groupings scoped to the active medium
  const summary = useMemo(() => summarizeRoster(mediumScopedRoster, incomeEntries), [mediumScopedRoster, incomeEntries]);
  const classes = useMemo(() => groupRosterByClass(mediumScopedRoster, incomeEntries), [mediumScopedRoster, incomeEntries]);

  // Unique classes available for filter dropdown (from scoped roster, arranged from lowest to highest grade)
  const availableClasses = useMemo(
    () => Array.from(new Set(mediumScopedRoster.map((r) => r.className))).sort(compareClassNames),
    [mediumScopedRoster]
  );

  // Auto-reset class filter if current classFilter is not available in active medium
  useEffect(() => {
    if (classFilter !== 'all' && !availableClasses.includes(classFilter)) {
      setClassFilter('all');
    }
  }, [availableClasses, classFilter]);

  // Fast student lookup map
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    for (const s of students) {
      map.set(s.id, s);
    }
    return map;
  }, [students]);

  // Reconciliation amounts
  const linkedCurrent = useMemo(
    () =>
      incomeEntries
        .filter(
          (entry) =>
            entry.studentEnrollmentId &&
            roster.some((item) => item.id === entry.studentEnrollmentId)
        )
        .reduce((sum, entry) => sum + entry.amount, 0),
    [incomeEntries, roster]
  );

  const globalCurrent = useMemo(
    () =>
      incomeEntries
        .filter(
          (entry) =>
            entry.category === 'Tuition Fees' &&
            !entry.isLateCollection &&
            entry.academicYearId === yearId
        )
        .reduce((sum, entry) => sum + entry.amount, 0),
    [incomeEntries, yearId]
  );

  const unassignedTuition = globalCurrent - linkedCurrent;

  // Build full row data for mediumScopedRoster with memoization
  const allRows = useMemo(() => {
    const rows: StudentRowData[] = [];
    for (const enrollment of mediumScopedRoster) {
      const student = studentMap.get(enrollment.studentId);
      if (!student) continue;

      const fees = getStudentFeeSummary(enrollment, incomeEntries);
      const previous = getStudentPreviousPending(
        enrollment.studentId,
        yearId,
        enrollments,
        incomeEntries
      );

      rows.push({ student, enrollment, fees, previous });
    }
    return rows;
  }, [mediumScopedRoster, studentMap, incomeEntries, yearId, enrollments]);

  // Filter rows based on search query, class, fee status
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return allRows.filter(({ student, enrollment, fees, previous }) => {
      // Search matching (name or admission number)
      if (q) {
        const matchesName = student.fullName.toLowerCase().includes(q);
        const matchesAdm = student.admissionNumber.toLowerCase().includes(q);
        if (!matchesName && !matchesAdm) return false;
      }

      // Class filter
      if (classFilter !== 'all' && enrollment.className !== classFilter) {
        return false;
      }

      // Fee status filter
      if (feeFilter === 'paid' && fees.status !== 'paid') return false;
      if (feeFilter === 'partial' && fees.status !== 'partially_paid') return false;
      if (feeFilter === 'unpaid' && fees.status !== 'not_paid') return false;
      if (feeFilter === 'previous' && previous <= 0) return false;

      return true;
    });
  }, [allRows, query, classFilter, feeFilter]);

  // Sort filtered rows: default ascending order from lowest to highest
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'class':
          // 1. Lowest class to highest class
          comparison = compareClassNames(a.enrollment.className, b.enrollment.className);
          // 2. Lowest admission number to highest
          if (comparison === 0) {
            comparison = compareAdmissionNumbers(a.student.admissionNumber, b.student.admissionNumber);
          }
          // 3. Name A-Z
          if (comparison === 0) {
            comparison = a.student.fullName.localeCompare(b.student.fullName, undefined, { sensitivity: 'base' });
          }
          break;
        case 'admission':
          // 1. Lowest admission number to highest
          comparison = compareAdmissionNumbers(a.student.admissionNumber, b.student.admissionNumber);
          // 2. Lowest class to highest
          if (comparison === 0) {
            comparison = compareClassNames(a.enrollment.className, b.enrollment.className);
          }
          // 3. Name A-Z
          if (comparison === 0) {
            comparison = a.student.fullName.localeCompare(b.student.fullName, undefined, { sensitivity: 'base' });
          }
          break;
        case 'name':
          comparison = a.student.fullName.localeCompare(b.student.fullName, undefined, { sensitivity: 'base' });
          if (comparison === 0) {
            comparison = compareClassNames(a.enrollment.className, b.enrollment.className);
          }
          if (comparison === 0) {
            comparison = compareAdmissionNumbers(a.student.admissionNumber, b.student.admissionNumber);
          }
          break;
        case 'obligation':
          comparison = a.fees.obligation - b.fees.obligation;
          break;
        case 'collected':
          comparison = a.fees.collected - b.fees.collected;
          break;
        case 'pending':
          comparison = a.fees.pending - b.fees.pending;
          break;
        case 'previous':
          comparison = a.previous - b.previous;
          break;
        case 'default':
        default:
          comparison = compareStudentsLowestToHighest(a, b);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortField, sortDirection]);

  // Paginated rows
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  const displayedStart = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const displayedEnd = Math.min(page * pageSize, filteredRows.length);

  // Handle header sorting click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Reset search and filters
  const handleResetFilters = () => {
    setQuery('');
    setClassFilter('all');
    setFeeFilter('all');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 1. Page Header */}
      <StudentPageHeader
        academicYears={academicYears}
        selectedYearId={yearId}
        onYearChange={setYearId}
        onAddStudent={() => setShowAddModal(true)}
        onImportStudents={() => setShowImportModal(true)}
        onDownloadTemplate={downloadStudentImportTemplate}
        onRemoveAllStudents={() => setShowRemoveAllModal(true)}
        totalStudentsCount={students.length}
      />

      {/* 2. Top-Level Medium Workspace Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <StudentMediumSwitcher
          activeMedium={activeMedium}
          onChange={handleMediumChange}
          allCount={allCount}
          gujaratiCount={gujaratiCount}
          englishCount={englishCount}
        />
      </div>

      {/* 3. Compact Overview & Progressive Disclosure for Class Reconciliation */}
      <StudentOverview
        summary={summary}
        classes={classes}
        year={year}
        unassignedTuition={unassignedTuition}
        activeMedium={activeMedium}
      />

      {/* 4. Student Toolbar (Search & Filter + View Mode Toggle) */}
      <StudentToolbar
        searchQuery={query}
        onSearchChange={setQuery}
        classFilter={classFilter}
        onClassChange={setClassFilter}
        feeFilter={feeFilter}
        onFeeFilterChange={setFeeFilter}
        availableClasses={availableClasses}
        totalCount={mediumScopedRoster.length}
        filteredCount={filteredRows.length}
        activeMedium={activeMedium}
        displayedStart={displayedStart}
        displayedEnd={displayedEnd}
        pageSize={pageSize}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        onResetFilters={handleResetFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* 5. Student Roster Views (Professional Cards Grid [Default] + Dense Table) */}
      {storeLoading && allRows.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">Loading student records...</p>
        </div>
      ) : mediumScopedRoster.length === 0 ? (
        /* Empty state: No students enrolled in this academic year or selected medium */
        <div className="rounded-xl border border-dashed bg-card p-10 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              No {activeMedium === 'all' ? '' : activeMedium === 'gujarati' ? 'Gujarati Medium ' : 'English Medium '}
              students enrolled in AY {year?.label || 'this year'}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              {activeMedium === 'all'
                ? 'Add your first student manually or import your existing student roster from an Excel sheet.'
                : `There are currently no students in ${activeMedium === 'gujarati' ? 'Gujarati Medium' : 'English Medium'} for this academic year.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Button size="sm" onClick={() => setShowAddModal(true)} className="text-xs gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              <span>Add Student</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowImportModal(true)}
              className="text-xs gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Import Students</span>
            </Button>
          </div>
        </div>
      ) : filteredRows.length === 0 ? (
        /* Empty state: Search/Filters return 0 results */
        <div className="rounded-xl border border-dashed bg-card p-10 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="h-6 w-6 opacity-40" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">No students match your filters</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              Try modifying your search term or clearing filters to see all enrolled students.
            </p>
          </div>
          <div className="pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetFilters}
              className="text-xs gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear Filters</span>
            </Button>
          </div>
        </div>
      ) : (
        <section aria-label="Student Roster">
          {viewMode === 'cards' ? (
            /* Professional Responsive Card Grid View (Default) */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedRows.map((row) => (
                  <StudentCard
                    key={row.enrollment.id}
                    row={row}
                    onSelectStudent={(id) => navigate(`/students/${id}`)}
                    onRecordPayment={(enrollmentId) => setPaymentEnrollmentId(enrollmentId)}
                    onEditStudent={(std, enr) => setEditingData({ student: std, enrollment: enr })}
                    activeMedium={activeMedium}
                  />
                ))}
              </div>

              {/* Cards Grid Pagination Bar */}
              {filteredRows.length > pageSize && (
                <div className="flex items-center justify-between border rounded-xl bg-card px-4 py-3 text-xs text-muted-foreground shadow-xs">
                  <p>
                    Showing <span className="font-medium text-foreground">{displayedStart}</span> to{' '}
                    <span className="font-medium text-foreground">{displayedEnd}</span> of{' '}
                    <span className="font-medium text-foreground">{filteredRows.length}</span> students
                  </p>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="h-8 w-8 p-0"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="px-2 font-medium text-foreground">
                      Page {page} of {Math.ceil(filteredRows.length / pageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) =>
                          Math.min(Math.ceil(filteredRows.length / pageSize), p + 1)
                        )
                      }
                      disabled={page >= Math.ceil(filteredRows.length / pageSize)}
                      className="h-8 w-8 p-0"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Dense Spreadsheet Table View */
            <StudentTable
              rows={paginatedRows}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              onSelectStudent={(id) => navigate(`/students/${id}`)}
              onRecordPayment={(enrollmentId) => setPaymentEnrollmentId(enrollmentId)}
              onEditStudent={(std, enr) => setEditingData({ student: std, enrollment: enr })}
              page={page}
              pageSize={pageSize}
              totalRows={filteredRows.length}
              onPageChange={setPage}
              activeMedium={activeMedium}
            />
          )}
        </section>
      )}

      {/* Add / Edit Student Modal */}
      <AddStudentModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        defaultYearId={yearId}
        defaultMedium={activeMedium !== 'all' ? activeMedium : undefined}
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
        defaultMedium={activeMedium !== 'all' ? activeMedium : undefined}
      />

      {/* Quick Record Payment Modal from Table / Mobile Cards */}
      <AddIncomeModal
        isOpen={!!paymentEnrollmentId}
        onClose={() => setPaymentEnrollmentId(undefined)}
        presetStudentEnrollmentId={paymentEnrollmentId}
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


    </div>
  );
}
