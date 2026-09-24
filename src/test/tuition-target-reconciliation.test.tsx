import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import IncomePage from '@/pages/IncomePage';
import Dashboard from '@/pages/Dashboard';
import ReportsPage from '@/pages/ReportsPage';
import type { AcademicYear, Account } from '@/types/finance';
import type { Student, StudentEnrollment } from '@/types/students';

describe('Tuition Target Reconciliation & Single Source of Truth', () => {
  const currentAY: AcademicYear = {
    id: 'ay-2026-27',
    label: '2026-27',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2027-05-31'),
    targetTuitionFees: 999999, // Stale or arbitrary manual figure in DB
    status: 'active',
    carryForwardFees: 0,
  };

  const emptyAY: AcademicYear = {
    id: 'ay-empty',
    label: '2027-28',
    startDate: new Date('2027-06-01'),
    endDate: new Date('2028-05-31'),
    targetTuitionFees: 250000, // Manual target when no students enrolled
    status: 'closed',
    carryForwardFees: 0,
  };

  const account: Account = {
    id: 'acc-1',
    name: 'Cash Box',
    type: 'cash',
    startingBalance: 10000,
    isArchived: false,
  };

  const studentA: Student = {
    id: 'stu-a',
    admissionNumber: 'A-001',
    fullName: 'Student Alpha',
    status: 'active',
    notes: '',
  };

  const studentB: Student = {
    id: 'stu-b',
    admissionNumber: 'B-002',
    fullName: 'Student Beta',
    status: 'active',
    notes: '',
  };

  const studentArchived: Student = {
    id: 'stu-archived',
    admissionNumber: 'C-003',
    fullName: 'Student Archived',
    status: 'inactive',
    notes: '',
  };

  // Student Alpha: 30,000 annual fee + 8,000 carried forward debt
  const enrollmentA: StudentEnrollment = {
    id: 'enr-a',
    studentId: 'stu-a',
    academicYearId: 'ay-2026-27',
    className: 'Class 5',
    medium: 'english',
    annualFeeAmount: 30000,
    additionalOutstandingAmount: 8000,
    openingCollectedCash: 0,
    openingCollectedUpi: 0,
    openingCollectedOther: 0,
    openingSnapshotDate: null,
    status: 'active',
    notes: '',
  };

  // Student Beta: 45,000 annual fee + 0 debt
  const enrollmentB: StudentEnrollment = {
    id: 'enr-b',
    studentId: 'stu-b',
    academicYearId: 'ay-2026-27',
    className: 'Class 6',
    medium: 'gujarati',
    annualFeeAmount: 45000,
    additionalOutstandingAmount: 0,
    openingCollectedCash: 0,
    openingCollectedUpi: 0,
    openingCollectedOther: 0,
    openingSnapshotDate: null,
    status: 'active',
    notes: '',
  };

  // Inactive enrollment: 25,000 annual fee (should NOT be added to target)
  const enrollmentArchived: StudentEnrollment = {
    id: 'enr-archived',
    studentId: 'stu-archived',
    academicYearId: 'ay-2026-27',
    className: 'Class 5',
    medium: 'english',
    annualFeeAmount: 25000,
    additionalOutstandingAmount: 0,
    openingCollectedCash: 0,
    openingCollectedUpi: 0,
    openingCollectedOther: 0,
    openingSnapshotDate: null,
    status: 'inactive',
    notes: '',
  };

  beforeEach(() => {
    // Polyfill ResizeObserver for recharts ResponsiveContainer
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    useFinanceStore.setState({
      academicYears: [currentAY, emptyAY],
      currentYearId: 'ay-2026-27',
      accounts: [account],
      incomeEntries: [],
      expenseEntries: [],
      transfers: [],
      recoverables: [],
      recoverableRepayments: [],
      recurringTemplates: [],
      pendingRecurringItems: [],
    });

    useStudentStore.setState({
      students: [studentA, studentB, studentArchived],
      enrollments: [enrollmentA, enrollmentB, enrollmentArchived],
    });
  });

  it('1. IncomePage displays Current-Year Tuition Target matching active enrolled students (₹75,000), ignoring stale DB target and carry-forward debt', () => {
    render(
      <MemoryRouter initialEntries={['/income']}>
        <IncomePage />
      </MemoryRouter>
    );

    // Active students: Alpha (30,000) + Beta (45,000) = 75,000.
    // Must NOT be 9,99,999 (stale DB field) or 83,000 (with 8,000 debt).
    // Target is displayed in KPI card formatted as ₹75,000 / ₹75K
    expect(screen.getByLabelText(/Current-Year Tuition Target: ₹75,000/i)).toBeInTheDocument();
  });

  it('2. Dashboard displays Current-Year Tuition Target matching active enrolled students (₹75,000)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Dashboard />
      </MemoryRouter>
    );

    // In KPI / Fee Overview: target is ₹75,000 / ₹75K
    expect(screen.getAllByText('₹75,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Last Year's Pending Fees")).toBeInTheDocument();
  });

  it('3. ReportsPage displays Current-Year Tuition Target (₹75,000) under Fee Collection Status and Student Reports', () => {
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <ReportsPage />
      </MemoryRouter>
    );

    // Switch to Profit & Loss (yearly) tab
    const profitTab = screen.getByRole('tab', { name: /Profit & Loss/i });
    fireEvent.pointerDown(profitTab, { button: 0 });
    fireEvent.click(profitTab);

    // Fee Collection Status Target (this year) must be ₹75,000
    expect(screen.getByText('Target (this year)')).toBeInTheDocument();
    expect(screen.getAllByText('₹75,000').length).toBeGreaterThanOrEqual(1);

    // Switch to Student Fees tab
    const studentTab = screen.getByRole('tab', { name: /Student Fees/i });
    fireEvent.pointerDown(studentTab, { button: 0 });
    fireEvent.click(studentTab);
    expect(screen.getByText('Current-Year Tuition Fees')).toBeInTheDocument();
    expect(screen.getAllByText('₹75,000').length).toBeGreaterThanOrEqual(1);
  });

  it('4. Academic Year with 0 enrolled students gracefully falls back to manual targetTuitionFees', () => {
    useFinanceStore.setState({
      currentYearId: 'ay-empty',
    });

    render(
      <MemoryRouter initialEntries={['/income']}>
        <IncomePage />
      </MemoryRouter>
    );

    // Empty AY target is ₹2,50,000
    expect(screen.getByLabelText(/Current-Year Tuition Target: ₹2,50,000/i)).toBeInTheDocument();
  });

  it('5. Prior-year carry-forward dues (₹8,000) are cleanly separated under Last Year Pending and do not inflate the tuition target', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Dashboard />
      </MemoryRouter>
    );

    // Target = 75,000; Last Year Pending = 8,000; Total fees to collect = 83,000
    expect(screen.getByText('₹83,000')).toBeInTheDocument();
    // Prior pending card shows ₹8K
    expect(screen.getByText('₹8K')).toBeInTheDocument();
  });
});
