import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import StudentDetailPage from '@/pages/StudentDetailPage';
import Dashboard from '@/pages/Dashboard';
import IncomePage from '@/pages/IncomePage';
import { AddHistoricalFeeModal } from '@/components/students/AddHistoricalFeeModal';
import { AddStudentModal } from '@/components/AddStudentModal';
import { AddIncomeModal } from '@/components/AddIncomeModal';
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

    // Overview card must display Previous-Year Outstanding: ₹6,000
    expect(screen.getByText(/Previous-Year Outstanding/i)).toBeInTheDocument();
    expect(screen.getAllByText('₹6,000').length).toBeGreaterThanOrEqual(1);

    // Click Payments tab (which keeps only Recorded Fee Payments)
    fireEvent.click(screen.getByRole('tab', { name: /Payments/ }));
    expect(screen.getByText('Recorded Fee Payments')).toBeInTheDocument();
    expect(screen.queryByText('Previous-Year Fee Records')).not.toBeInTheDocument();

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

  it('when added last year pending fees from edit student feature it updates student detail page and record late fees in AddIncomeModal', async () => {
    const student = useStudentStore.getState().students[0];
    const enrollment = useStudentStore.getState().enrollments[0];

    const savedEnrollments: EnrollmentInput[] = [];
    useStudentStore.setState({
      saveStudent: async (_student: StudentInput, enr: EnrollmentInput) => {
        savedEnrollments.push(enr);
        useStudentStore.setState((state) => ({
          enrollments: state.enrollments.some((e) => e.id === enr.id)
            ? state.enrollments.map((e) => e.id === enr.id ? { ...e, annualFeeAmount: enr.annual_fee_amount, additionalOutstandingAmount: enr.additional_outstanding_amount } : e)
            : [
                ...state.enrollments,
                {
                  id: enr.id || 'enr-prev-auto',
                  studentId: student.id,
                  academicYearId: enr.academic_year_id,
                  className: enr.class_name,
                  medium: enr.medium,
                  annualFeeAmount: enr.annual_fee_amount,
                  additionalOutstandingAmount: enr.additional_outstanding_amount,
                  openingCollectedCash: 0,
                  openingCollectedUpi: 0,
                  openingCollectedOther: 0,
                  openingSnapshotDate: null,
                  status: 'active',
                  notes: '',
                },
              ],
        }));
      },
    });

    const { unmount: unmountEdit } = render(
      <MemoryRouter>
        <AddStudentModal
          open={true}
          onClose={() => {}}
          student={student}
          enrollment={enrollment}
        />
      </MemoryRouter>
    );

    // Enter last year pending fees
    const extraInput = screen.getByLabelText(/Last Year's Pending Fees/i);
    fireEvent.change(extraInput, { target: { value: '4500' } });

    // Save
    const saveBtn = screen.getByRole('button', { name: /Save|Update/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(savedEnrollments.length).toBeGreaterThanOrEqual(1);
    });

    unmountEdit();

    // Verify AddIncomeModal now reflects last year's pending fee in the Apply To section
    const { unmount: unmountIncome } = render(
      <MemoryRouter>
        <AddIncomeModal
          isOpen={true}
          onClose={() => {}}
          presetStudentEnrollmentId="enr-current"
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Apply To')).toBeInTheDocument();
    expect(screen.getByText(/Previous-Year Fee/i)).toBeInTheDocument();
    expect(screen.getByText('₹4,500')).toBeInTheDocument();

    unmountIncome();

    // Verify StudentDetailPage reflects it
    render(
      <MemoryRouter initialEntries={['/students/stu-1']}>
        <Routes>
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Previous-Year Outstanding/i)).toBeInTheDocument();
    expect(screen.getAllByText('₹4,500').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /Record Previous-Year Payment/i }).length).toBeGreaterThanOrEqual(1);
  });
});
