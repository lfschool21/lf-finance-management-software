import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import Dashboard from '@/pages/Dashboard';
import IncomePage from '@/pages/IncomePage';
import StudentsPage from '@/pages/StudentsPage';
import type { AcademicYear, Account, IncomeEntry } from '@/types/finance';
import type { Student, StudentEnrollment } from '@/types/students';

describe('Cross-Page Financial Reconciliation: Dashboard, IncomePage, and StudentsPage', () => {
  const currentAY: AcademicYear = {
    id: 'ay-2026-27',
    label: '2026-27',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2027-05-31'),
    targetTuitionFees: 999999, // Should be overridden by roster
    status: 'active',
    carryForwardFees: 0,
  };

  const pastAY: AcademicYear = {
    id: 'ay-2025-26',
    label: '2025-26',
    startDate: new Date('2025-06-01'),
    endDate: new Date('2026-05-31'),
    targetTuitionFees: 500000,
    status: 'closed',
    carryForwardFees: 0,
  };

  const schoolAccount: Account = {
    id: 'acc-school',
    name: 'School Bank A/C',
    type: 'school_bank',
    startingBalance: 100000,
    isArchived: false,
  };

  const studentAlpha: Student = {
    id: 'stu-alpha',
    admissionNumber: 'ENG-001',
    fullName: 'Alpha Student',
    status: 'active',
    notes: '',
  };

  const studentBeta: Student = {
    id: 'stu-beta',
    admissionNumber: 'GUJ-001',
    fullName: 'Beta Student',
    status: 'active',
    notes: '',
  };

  // Alpha: English medium, 30,000 annual fee, 8,000 carryover debt
  const enrollmentAlpha: StudentEnrollment = {
    id: 'enr-alpha',
    studentId: 'stu-alpha',
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

  // Beta: Gujarati medium, 45,000 annual fee, 0 carryover debt
  const enrollmentBeta: StudentEnrollment = {
    id: 'enr-beta',
    studentId: 'stu-beta',
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

  // 1. Current tuition payment for Alpha (₹10,000)
  const paymentAlphaCurrent: IncomeEntry = {
    id: 'inc-alpha-curr',
    category: 'Tuition Fees',
    amount: 10000,
    date: new Date(2026, 6, 10),
    academicYearId: 'ay-2026-27',
    accountId: 'acc-school',
    isLateCollection: false,
    studentEnrollmentId: 'enr-alpha',
  };

  // 2. Current tuition payment for Beta (₹15,000)
  const paymentBetaCurrent: IncomeEntry = {
    id: 'inc-beta-curr',
    category: 'Tuition Fees',
    amount: 15000,
    date: new Date(2026, 6, 12),
    academicYearId: 'ay-2026-27',
    accountId: 'acc-school',
    isLateCollection: false,
    studentEnrollmentId: 'enr-beta',
  };

  // 3. Unassigned tuition payment (₹5,000)
  const paymentUnassigned: IncomeEntry = {
    id: 'inc-unassigned',
    category: 'Tuition Fees',
    amount: 5000,
    date: new Date(2026, 6, 15),
    academicYearId: 'ay-2026-27',
    accountId: 'acc-school',
    isLateCollection: false,
    studentEnrollmentId: null,
  };

  // 4. Prior-year late payment for Alpha (₹3,000)
  const paymentAlphaPrior: IncomeEntry = {
    id: 'inc-alpha-late',
    category: 'Tuition Fees',
    amount: 3000,
    date: new Date(2026, 6, 20),
    academicYearId: 'ay-2026-27',
    accountId: 'acc-school',
    isLateCollection: true,
    originalYearId: 'ay-2025-26',
    studentEnrollmentId: 'enr-alpha',
  };

  beforeEach(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    useFinanceStore.setState({
      academicYears: [pastAY, currentAY],
      currentYearId: 'ay-2026-27',
      accounts: [schoolAccount],
      incomeEntries: [paymentAlphaCurrent, paymentBetaCurrent, paymentUnassigned, paymentAlphaPrior],
      expenseEntries: [],
      transfers: [],
      recoverables: [],
      recoverableRepayments: [],
      recurringTemplates: [],
      pendingRecurringItems: [],
    });

    useStudentStore.setState({
      students: [studentAlpha, studentBeta],
      enrollments: [enrollmentAlpha, enrollmentBeta],
    });
  });

  it('verifies Dashboard, IncomePage, and StudentsPage display identical financial figures', () => {
    // Expected Figures:
    // Target = 30,000 (Alpha) + 45,000 (Beta) = 75,000
    // Current Tuition Collected = 10,000 + 15,000 + 5,000 = 30,000
    // Current Remaining = 75,000 - 30,000 = 45,000
    // Prior Year Received This AY = 3,000
    // Prior Year Pending Still to Collect = 8,000 - 3,000 = 5,000
    // Total Fees Still to Collect = 45,000 + 5,000 = 50,000

    // 1. Test Dashboard
    const { unmount: unmountDashboard } = render(
      <MemoryRouter initialEntries={['/']}>
        <Dashboard />
      </MemoryRouter>
    );

    // Dashboard Target
    expect(screen.getAllByText('₹75,000').length).toBeGreaterThanOrEqual(1);
    // Dashboard Current Collected (₹30K)
    expect(screen.getAllByText('₹30K').length).toBeGreaterThanOrEqual(1);
    // Dashboard Remaining (₹45,000)
    expect(screen.getAllByText('₹45,000').length).toBeGreaterThanOrEqual(1);
    // Dashboard Prior Year Received (₹3,000 / ₹3K)
    expect(screen.getAllByText(/₹3,000|₹3K/).length).toBeGreaterThanOrEqual(1);
    // Dashboard Prior Year Pending (₹5,000 / ₹5K)
    expect(screen.getAllByText(/₹5,000|₹5K/).length).toBeGreaterThanOrEqual(1);
    // Dashboard Total Fees Still to Collect (₹50,000 / ₹50K)
    expect(screen.getAllByText(/₹50,000|₹50K/).length).toBeGreaterThanOrEqual(1);

    unmountDashboard();

    // 2. Test IncomePage
    const { unmount: unmountIncome } = render(
      <MemoryRouter initialEntries={['/income']}>
        <IncomePage />
      </MemoryRouter>
    );

    // IncomePage Target
    expect(screen.getByLabelText(/Current-Year Tuition Target: ₹75,000/i)).toBeInTheDocument();
    // IncomePage Current Collected
    expect(screen.getByLabelText(/Current-Year Tuition Collected: ₹30,000/i)).toBeInTheDocument();
    // IncomePage Current Remaining
    expect(screen.getByLabelText(/Current-Year Tuition Remaining: ₹45,000/i)).toBeInTheDocument();
    // IncomePage Prior Year Received
    expect(screen.getByLabelText(/Previous-Year Fees Received This AY: ₹3,000/i)).toBeInTheDocument();
    // IncomePage Prior Year Pending
    expect(screen.getByLabelText(/Previous-Year Fees Still Pending: ₹5,000/i)).toBeInTheDocument();
    // IncomePage Total Fees Still to Collect
    expect(screen.getAllByText('₹50,000').length).toBeGreaterThanOrEqual(1);

    unmountIncome();

    // 3. Test StudentsPage
    render(
      <MemoryRouter initialEntries={['/students']}>
        <StudentsPage />
      </MemoryRouter>
    );

    // Combined Collected includes 15,000 (Guj) + 10,000 (Eng) + 5,000 (Unassigned) = ₹30,000
    expect(screen.getAllByText('₹30,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/incl\. ₹5,000 unassigned/i)).toBeInTheDocument();

    // Gujarati Card: Target = ₹45,000, Collected = ₹15,000, Pending = ₹30,000
    const gujCard = screen.getByTestId('gujarati-collection-summary');
    expect(gujCard).toHaveTextContent('₹45,000');
    expect(gujCard).toHaveTextContent('₹15,000');
    expect(gujCard).toHaveTextContent('₹30,000');

    // English Card: Target = ₹30,000, Collected = ₹10,000, Total Pending = 20,000 current + 5,000 prior = ₹25,000
    const engCard = screen.getByTestId('english-collection-summary');
    expect(engCard).toHaveTextContent('₹30,000');
    expect(engCard).toHaveTextContent('₹10,000');
    expect(engCard).toHaveTextContent('₹25,000');
  });
});
