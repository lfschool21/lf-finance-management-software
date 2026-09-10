import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import StudentDetailPage from '@/pages/StudentDetailPage';
import Dashboard from '@/pages/Dashboard';
import IncomePage from '@/pages/IncomePage';
import { AddHistoricalFeeModal } from '@/components/students/AddHistoricalFeeModal';
import type { StudentInput, EnrollmentInput } from '@/services/students';

describe('Previous-Year Fee Simplification & Live Propagation', () => {
  beforeEach(() => {
    useFinanceStore.setState({
      academicYears: [
        {
          id: 'ay-2025',
          label: '2025-26',
          startDate: new Date('2025-06-01'),
          endDate: new Date('2026-05-31'),
          targetTuitionFees: 0,
          status: 'closed',
          carryForwardFees: 0,
        },
        {
          id: 'ay-2026',
          label: '2026-27',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2027-05-31'),
          targetTuitionFees: 100000,
          status: 'active',
          carryForwardFees: 0,
        },
      ],
      currentYearId: 'ay-2026',
      accounts: [
        { id: 'acc-cash', name: 'Cash Account', type: 'cash', startingBalance: 10000, isArchived: false },
      ],
      incomeEntries: [],
      expenseEntries: [],
      transfers: [],
      recoverables: [],
      recoverableRepayments: [],
    });

    useStudentStore.setState({
      students: [
        {
          id: 'stu-1',
          fullName: 'Kavya Shah',
          admissionNumber: 'GR-501',
          status: 'active',
          notes: '',
        },
      ],
      enrollments: [
        {
          id: 'enr-current',
          studentId: 'stu-1',
          academicYearId: 'ay-2026',
          className: 'Class 5',
          medium: 'english',
          annualFeeAmount: 20000,
          additionalOutstandingAmount: 0,
          openingCollectedCash: 0,
          openingCollectedUpi: 0,
          openingCollectedOther: 0,
          openingSnapshotDate: null,
          status: 'active',
          notes: '',
        },
      ],
    });
  });

  it('AddHistoricalFeeModal keeps only how much fee is left and saves cleanly', async () => {
    let savedEnrollmentPayload: EnrollmentInput | null = null;
    useStudentStore.setState({
      saveStudent: async (_student: StudentInput, enrollment: EnrollmentInput) => {
        savedEnrollmentPayload = enrollment;
      },
    });

    const student = useStudentStore.getState().students[0];
    const existingEnrollments = useStudentStore.getState().enrollments;

    render(
      <AddHistoricalFeeModal
        open={true}
        onClose={() => {}}
        student={student}
        existingEnrollments={existingEnrollments}
      />
    );

    // Verify modal title and context
    expect(screen.getByRole('heading', { name: 'Add Previous-Year Fee' })).toBeInTheDocument();
    expect(screen.getByText('Kavya Shah')).toBeInTheDocument();

    // Verify only Pending Fee Left is requested as the primary input (no confusing annual vs cash/upi opening breakdown)
    const amountLeftInput = screen.getByLabelText(/Pending Fee Left \(₹\)/i);
    expect(amountLeftInput).toBeInTheDocument();
    expect(screen.queryByLabelText(/Annual Fee \(₹\)/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Cash \(₹\)/i)).not.toBeInTheDocument();

    // Type the amount left (e.g. 7500)
    fireEvent.change(amountLeftInput, { target: { value: '7500' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: 'Save Fee Record' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(savedEnrollmentPayload).not.toBeNull();
    });

    // Check that annual_fee_amount was set directly to amountLeft with zero opening collections
    expect(savedEnrollmentPayload.academic_year_id).toBe('ay-2025');
    expect(savedEnrollmentPayload.annual_fee_amount).toBe(7500);
    expect(savedEnrollmentPayload.opening_collected_cash).toBe(0);
    expect(savedEnrollmentPayload.opening_collected_upi).toBe(0);
  });

  it('adding previous year fee directly propagates to Dashboard pending metrics', () => {
    // Before adding previous year fee:
    // Dashboard should have 0 lastYearPending and 100,000 totalFeesStillToCollect (current target: 100,000)
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('AY 2026-27')).toBeInTheDocument();
    unmount();

    // Now add a previous year fee enrollment for Kavya Shah for AY 2025-26 with ₹7,500 left
    useStudentStore.setState((state) => ({
      enrollments: [
        ...state.enrollments,
        {
          id: 'enr-past',
          studentId: 'stu-1',
          academicYearId: 'ay-2025',
          className: 'Class 4',
          medium: 'english',
          annualFeeAmount: 7500,
          additionalOutstandingAmount: 0,
          openingCollectedCash: 0,
          openingCollectedUpi: 0,
          openingCollectedOther: 0,
          openingSnapshotDate: null,
          status: 'active',
          notes: '',
        },
      ],
    }));

    // Render Dashboard again
    render(
      <MemoryRouter initialEntries={['/']}>
        <Dashboard />
      </MemoryRouter>
    );

    // The Previous-Year Fees section on dashboard must reflect the ₹7,500
    // Total fees still to collect: Current remaining (100,000) + Prior pending (7,500) = ₹1,07,500
    expect(screen.getByText('₹1,07,500')).toBeInTheDocument();
    // Prior pending card shows ₹7.5K
    expect(screen.getByText('₹7.5K')).toBeInTheDocument();
  });

  it('adding previous year fee directly propagates to IncomePage and StudentDetailPage', () => {
    // Add previous year fee record with ₹6,000 left
    useStudentStore.setState((state) => ({
      enrollments: [
        ...state.enrollments,
        {
          id: 'enr-past-2',
          studentId: 'stu-1',
          academicYearId: 'ay-2025',
          className: 'Class 4',
          medium: 'english',
          annualFeeAmount: 6000,
          additionalOutstandingAmount: 0,
          openingCollectedCash: 0,
          openingCollectedUpi: 0,
          openingCollectedOther: 0,
          openingSnapshotDate: null,
          status: 'active',
          notes: '',
        },
      ],
    }));

    // Check StudentDetailPage
    const { unmount: unmountStudent } = render(
      <MemoryRouter initialEntries={['/students/stu-1']}>
        <Routes>
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Overview warning callout must display Last Year's Pending Fees: ₹6,000
    expect(screen.getByText(/Last Year's Pending Fees:/)).toBeInTheDocument();
    expect(screen.getByText('₹6,000')).toBeInTheDocument();

    // Click Previous Years tab
    fireEvent.click(screen.getByRole('tab', { name: /Previous Years/ }));
    expect(screen.getByText('Academic Year 2025-26')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Record Past Payment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit fee record/i })).toBeInTheDocument();

    unmountStudent();

    // Check IncomePage
    render(
      <MemoryRouter initialEntries={['/income']}>
        <IncomePage />
      </MemoryRouter>
    );

    // Total fees still to collect: 100,000 target + 6,000 prior = ₹1,06,000
    expect(screen.getByText('₹1,06,000')).toBeInTheDocument();
  });
});
