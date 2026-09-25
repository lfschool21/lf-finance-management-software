import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import StudentsPage from '@/pages/StudentsPage';
import { useStudentStore } from '@/store/student-store';
import { useFinanceStore } from '@/store/finance-store';
import { calculateAverageFees, calculateClassAverageFees } from '@/lib/student-fees';
import type { AcademicYear, Account, IncomeEntry } from '@/types/finance';
import type { Student, StudentEnrollment } from '@/types/students';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Average Fees Calculation and UI Feature', () => {
  const testAY: AcademicYear = {
    id: 'ay-2026-27',
    label: '2026-27',
    startDate: new Date(2026, 5, 1),
    endDate: new Date(2027, 4, 31),
    targetTuitionFees: 100000,
    carryForwardFees: 0,
    status: 'active',
  };

  const testAccount: Account = {
    id: 'acc-school',
    name: 'School Account',
    type: 'school_bank',
    startingBalance: 100000,
    isArchived: false,
  };

  const students: Student[] = [
    { id: 's1', admissionNumber: 'G-101', fullName: 'Aarav Patel', status: 'active', notes: '' },
    { id: 's2', admissionNumber: 'G-102', fullName: 'Diya Shah', status: 'active', notes: '' },
    { id: 's3', admissionNumber: 'E-201', fullName: 'Rohan Mehta', status: 'active', notes: '' },
  ];

  const enrollments: StudentEnrollment[] = [
    {
      id: 'e1',
      studentId: 's1',
      academicYearId: 'ay-2026-27',
      className: 'Class 1',
      medium: 'gujarati',
      annualFeeAmount: 20000, // Gujarati Class 1
      additionalOutstandingAmount: 0,
      openingCollectedCash: 5000,
      openingCollectedUpi: 0,
      openingCollectedOther: 0,
      openingSnapshotDate: null,
      status: 'active',
      notes: '',
    },
    {
      id: 'e2',
      studentId: 's2',
      academicYearId: 'ay-2026-27',
      className: 'Class 2',
      medium: 'gujarati',
      annualFeeAmount: 30000, // Gujarati Class 2
      additionalOutstandingAmount: 0,
      openingCollectedCash: 10000,
      openingCollectedUpi: 0,
      openingCollectedOther: 0,
      openingSnapshotDate: null,
      status: 'active',
      notes: '',
    },
    {
      id: 'e3',
      studentId: 's3',
      academicYearId: 'ay-2026-27',
      className: 'Class 1',
      medium: 'english',
      annualFeeAmount: 40000, // English Class 1
      additionalOutstandingAmount: 0,
      openingCollectedCash: 20000,
      openingCollectedUpi: 0,
      openingCollectedOther: 0,
      openingSnapshotDate: null,
      status: 'active',
      notes: '',
    },
  ];

  const payments: IncomeEntry[] = [
    {
      id: 'inc-1',
      academicYearId: 'ay-2026-27',
      category: 'Tuition Fees',
      amount: 5000,
      date: new Date(2026, 6, 15),
      accountId: 'acc-school',
      isLateCollection: false,
      originalYearId: null,
      studentEnrollmentId: 'e1',
      paymentMethod: 'cash',
      paymentReference: '',
      notes: 'Tuition installment',
      tags: [],
    },
  ];

  beforeEach(() => {
    mockNavigate.mockReset();
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    useFinanceStore.setState({
      academicYears: [testAY],
      currentYearId: 'ay-2026-27',
      accounts: [testAccount],
      incomeEntries: payments,
      expenseEntries: [],
      transfers: [],
      recoverables: [],
      recoverableRepayments: [],
      recurringExpenses: [],
      pendingRecurringItems: [],
    });

    useStudentStore.setState({
      students,
      enrollments,
    });
  });

  describe('1. Domain calculation functions', () => {
    it('accurately calculates overall and medium average fees', () => {
      // Total annual fees = 20k + 30k + 40k = 90k across 3 students -> avg = 30k
      const overall = calculateAverageFees(enrollments, payments);
      expect(overall.totalStudents).toBe(3);
      expect(overall.totalAnnualFee).toBe(90000);
      expect(overall.avgAnnualFeeCharged).toBe(30000);
      // Total collected = (5k opening + 5k recorded) + 10k opening + 20k opening = 40k -> avg = 13333
      expect(overall.totalCollected).toBe(40000);
      expect(overall.avgCollected).toBe(13333);

      // Gujarati: 2 students, total annual fees = 50k -> avg = 25k
      const guj = calculateAverageFees(enrollments.filter((e) => e.medium === 'gujarati'), payments);
      expect(guj.totalStudents).toBe(2);
      expect(guj.totalAnnualFee).toBe(50000);
      expect(guj.avgAnnualFeeCharged).toBe(25000);

      // English: 1 student, total annual fees = 40k -> avg = 40k
      const eng = calculateAverageFees(enrollments.filter((e) => e.medium === 'english'), payments);
      expect(eng.totalStudents).toBe(1);
      expect(eng.totalAnnualFee).toBe(40000);
      expect(eng.avgAnnualFeeCharged).toBe(40000);
    });

    it('returns zeroes gracefully when student count is 0', () => {
      const empty = calculateAverageFees([], []);
      expect(empty.totalStudents).toBe(0);
      expect(empty.avgAnnualFeeCharged).toBe(0);
      expect(empty.avgCollected).toBe(0);
      expect(empty.avgPending).toBe(0);
    });

    it('calculates class average fees details', () => {
      const classDetails = calculateClassAverageFees(enrollments, payments);
      expect(classDetails.length).toBe(3); // Class 1 Guj, Class 2 Guj, Class 1 Eng
      const class1Guj = classDetails.find((c) => c.className === 'Class 1' && c.medium === 'gujarati');
      expect(class1Guj?.avgAnnualFeeCharged).toBe(20000);
      const class2Guj = classDetails.find((c) => c.className === 'Class 2' && c.medium === 'gujarati');
      expect(class2Guj?.avgAnnualFeeCharged).toBe(30000);
      const class1Eng = classDetails.find((c) => c.className === 'Class 1' && c.medium === 'english');
      expect(class1Eng?.avgAnnualFeeCharged).toBe(40000);
    });
  });

  describe('2. Dashboard Average Fee UI Integration', () => {
    it('renders Average Fee Per Student section and cards on Dashboard', () => {
      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      );

      // Verify Average Fee section header
      expect(screen.getByText('Average Fee Per Student')).toBeInTheDocument();
      expect(screen.getByText('Avg Fee Charged by School')).toBeInTheDocument();

      // Overall average charged: ₹30,000 / student
      expect(screen.getByText('₹30,000')).toBeInTheDocument();

      // Gujarati & English medium average fee cards
      expect(screen.getByText('Gujarati Medium Avg')).toBeInTheDocument();
      expect(screen.getByText('English Medium Avg')).toBeInTheDocument();
      expect(screen.getByText('₹25,000')).toBeInTheDocument();
    });

    it('opens Average Fee Calculator Modal from Dashboard button', () => {
      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      );

      // Find "Calculate Avg Fees" button on Dashboard
      const calcButtons = screen.getAllByRole('button', { name: /Calculate Avg Fees/i });
      expect(calcButtons.length).toBeGreaterThan(0);
      fireEvent.click(calcButtons[0]);

      // Verify calculator modal opened
      expect(screen.getByText('Average Fee Calculator & Simulator')).toBeInTheDocument();
      expect(screen.getByText('Revenue & Fee Projection Simulator')).toBeInTheDocument();
      expect(screen.getByText('Class-by-Class Average Fees')).toBeInTheDocument();
    });
  });

  describe('3. Students Page Average Fee UI Integration', () => {
    it('renders Calculate Avg Fees button in header and Average Fee in overview', () => {
      render(
        <MemoryRouter>
          <StudentsPage />
        </MemoryRouter>
      );

      // Verify header action button exists
      const calcButtons = screen.getAllByRole('button', { name: /Calculate Avg Fees/i });
      expect(calcButtons.length).toBeGreaterThanOrEqual(1);

      // Verify operational KPIs card for Avg Fee Charged
      const avgFeeLabels = screen.getAllByText('Avg Fee Charged');
      expect(avgFeeLabels.length).toBeGreaterThanOrEqual(1);

      // Gujarati medium is default active -> avg fee charged should be ₹25,000
      const avgValues = screen.getAllByText('₹25,000');
      expect(avgValues.length).toBeGreaterThanOrEqual(1);
    });

    it('displays Avg Fee Charged on ClassCards in the class grid', () => {
      render(
        <MemoryRouter>
          <StudentsPage />
        </MemoryRouter>
      );

      // Class 1 (20k) and Class 2 (30k) in Gujarati medium
      expect(screen.getByText('Class 1')).toBeInTheDocument();
      expect(screen.getByText('Class 2')).toBeInTheDocument();

      const avgFeeLabels = screen.getAllByText('Avg Fee Charged');
      expect(avgFeeLabels.length).toBeGreaterThan(0);
    });

    it('opens and interacts with the Average Fee Calculator Modal', () => {
      render(
        <MemoryRouter>
          <StudentsPage />
        </MemoryRouter>
      );

      const calcButtons = screen.getAllByRole('button', { name: /Calculate Avg Fees/i });
      fireEvent.click(calcButtons[0]);

      // Verify modal title
      expect(screen.getByText('Average Fee Calculator & Simulator')).toBeInTheDocument();

      // Test simulator inputs
      const feeInput = screen.getByLabelText(/Target Avg Fee \/ Student/i);
      expect(feeInput).toBeInTheDocument();

      // Simulate change in target fee to ₹35,000
      fireEvent.change(feeInput, { target: { value: '35000' } });

      // Simulator displays projected revenue
      expect(screen.getByText('Projected Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('Projected Cash Inflow')).toBeInTheDocument();

      // Test Close button
      const closeButtons = screen.getAllByRole('button', { name: /Close/i });
      fireEvent.click(closeButtons[0]);

      expect(screen.queryByText('Average Fee Calculator & Simulator')).not.toBeInTheDocument();
    });
  });
});
