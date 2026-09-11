import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import StudentDetailPage from '@/pages/StudentDetailPage';
import StudentsPage from '@/pages/StudentsPage';
import { RecordPreviousPaymentModal } from '@/components/students/RecordPreviousPaymentModal';
import { AddHistoricalFeeModal } from '@/components/students/AddHistoricalFeeModal';
import type { Student, StudentEnrollment } from '@/types/students';
import type { AcademicYear, Account, IncomeEntry } from '@/types/finance';

describe('Student Fee Card & Previous-Year Payment Simplification Acceptance Tests', () => {
  const currentYear: AcademicYear = {
    id: 'ay-2026',
    label: '2026-27',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2027-05-31'),
    targetTuitionFees: 200000,
    status: 'active',
    carryForwardFees: 0,
  };

  const pastYear: AcademicYear = {
    id: 'ay-2025',
    label: '2025-26',
    startDate: new Date('2025-06-01'),
    endDate: new Date('2026-05-31'),
    targetTuitionFees: 150000,
    status: 'closed',
    carryForwardFees: 0,
  };

  const cashAccount: Account = {
    id: 'acc-cash-1',
    name: 'Admin Cash Box',
    type: 'cash',
    startingBalance: 15000,
    isArchived: false,
  };

  const bankUpiAccount: Account = {
    id: 'acc-bank-1',
    name: 'HDFC School Bank A/C',
    type: 'school_bank',
    startingBalance: 100000,
    isArchived: false,
  };

  const testStudent: Student = {
    id: 'stu-dev-1',
    admissionNumber: 'ADM-2026-01',
    fullName: 'Dev Patel',
    status: 'active',
    notes: 'Sample student',
  };

  const currentEnrollment: StudentEnrollment = {
    id: 'enr-curr-1',
    studentId: 'stu-dev-1',
    academicYearId: 'ay-2026',
    className: 'Class 5',
    medium: 'english',
    annualFeeAmount: 25000,
    additionalOutstandingAmount: 0,
    openingCollectedCash: 0,
    openingCollectedUpi: 0,
    openingCollectedOther: 0,
    openingSnapshotDate: null,
    status: 'active',
    notes: '',
  };

  const previousEnrollment: StudentEnrollment = {
    id: 'enr-past-1',
    studentId: 'stu-dev-1',
    academicYearId: 'ay-2025',
    className: 'Class 4',
    medium: 'english',
    annualFeeAmount: 8000,
    additionalOutstandingAmount: 0,
    openingCollectedCash: 0,
    openingCollectedUpi: 0,
    openingCollectedOther: 0,
    openingSnapshotDate: null,
    status: 'active',
    notes: 'Prior year dues',
  };

  beforeEach(() => {
    useFinanceStore.setState({
      academicYears: [pastYear, currentYear],
      currentYearId: 'ay-2026',
      accounts: [cashAccount, bankUpiAccount],
      incomeEntries: [],
      expenseEntries: [],
      transfers: [],
      recoverables: [],
      recoverableRepayments: [],
      addIncome: vi.fn(async (input: any) => {
        const id = 'inc-' + Math.random().toString(36).substring(2, 9);
        const newEntry: IncomeEntry = {
          id,
          category: (input.category || (input.type === 'tuition' ? 'Tuition Fees' : input.type)) as any,
          amount: input.amount,
          date: input.date instanceof Date ? input.date : new Date(input.date),
          academicYearId: input.academic_year_id,
          accountId: input.account_id,
          isLateCollection: Boolean(input.is_late_collection),
          originalYearId: input.original_year_id || null,
          studentEnrollmentId: input.student_enrollment_id || null,
          paymentMethod: input.payment_method || null,
          paymentReference: input.payment_reference || null,
          notes: input.notes || '',
          tags: input.tags || [],
        };
        useFinanceStore.setState((state) => ({
          incomeEntries: [newEntry, ...state.incomeEntries],
        }));
      }),
    });

    useStudentStore.setState({
      students: [testStudent],
      enrollments: [previousEnrollment, currentEnrollment],
    });
  });

  it('Scenario A: Current-Year Payment reduces current pending fees, leaves previous-year dues untouched', async () => {
    render(
      <MemoryRouter initialEntries={['/students/stu-dev-1']}>
        <Routes>
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial State on Student Fee Card
    // Card 1: Current Academic Year
    expect(screen.getByText('Total Current-Year Fee')).toBeInTheDocument();
    expect(screen.getAllByText('₹25,000').length).toBeGreaterThanOrEqual(2); // Current total fee & pending
    // Card 2: Previous-Year Due
    expect(screen.getByText('Original Outstanding')).toBeInTheDocument();
    expect(screen.getAllByText('₹8,000').length).toBeGreaterThanOrEqual(1); // Previous original fee

    // Open Current-Year Payment modal
    const recordCurrentBtn = screen.getByRole('button', { name: 'Record Current-Year Payment' });
    fireEvent.click(recordCurrentBtn);

    // Enter payment of ₹10,000 for Current Year
    const amountInput = screen.getByLabelText(/Amount \(₹\)/i);
    fireEvent.change(amountInput, { target: { value: '10000' } });

    // Submit payment
    const submitBtn = screen.getByRole('button', { name: /Record Current-Year Payment|Save/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(useFinanceStore.getState().incomeEntries).toHaveLength(1);
    });

    const recordedPayment = useFinanceStore.getState().incomeEntries[0];
    expect(recordedPayment.amount).toBe(10000);
    expect(recordedPayment.isLateCollection).toBe(false);
    expect(recordedPayment.studentEnrollmentId).toBe('enr-curr-1');

    // Verify Accounting Separation:
    // Current-year pending fees reduced: 25000 - 10000 = ₹15,000
    // Previous-year pending fees UNTOUCHED: still ₹8,000
    expect(screen.getAllByText('₹15,000').length).toBeGreaterThanOrEqual(1); // Current pending
    expect(screen.getAllByText('₹8,000').length).toBeGreaterThanOrEqual(1); // Previous pending remains 8,000
  });

  it('Scenario B: Previous-Year Payment reduces previous pending, does NOT touch current pending, and increases current year cash collections', async () => {
    // Start with current enrollment having ₹25,000 pending and past having ₹8,000 pending
    render(
      <MemoryRouter initialEntries={['/students/stu-dev-1']}>
        <Routes>
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify button exists in header and in Card 2
    const prevPaymentButtons = screen.getAllByRole('button', { name: /Record Previous-Year Payment/i });
    expect(prevPaymentButtons.length).toBeGreaterThanOrEqual(1);

    // Click Record Previous-Year Payment
    fireEvent.click(prevPaymentButtons[0]);

    // Dedicated modal opens with Student, Previous Class, and Previous-Year Pending context
    expect(await screen.findByRole('heading', { name: 'Record Previous-Year Payment' })).toBeInTheDocument();
    expect(screen.getAllByText('Dev Patel').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Class 4/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('₹8,000').length).toBeGreaterThanOrEqual(1);

    // Verify method selection tiles (Cash vs UPI)
    expect(screen.getByRole('button', { name: /Cash/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /UPI/i })).toBeInTheDocument();

    // Cap test: attempting to pay ₹10,000 when pending is ₹8,000 is rejected
    const dialog = screen.getByRole('dialog');
    const amountInput = within(dialog).getByLabelText(/Payment Amount \(₹\) \*/i);
    fireEvent.change(amountInput, { target: { value: '10000' } });
    const saveBtn = within(dialog).getByRole('button', { name: 'Record Previous-Year Payment' });
    fireEvent.click(saveBtn);

    expect(await within(dialog).findByText(/cannot exceed/i)).toBeInTheDocument();

    // Now enter valid payment of ₹3,000
    fireEvent.change(amountInput, { target: { value: '3000' } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(useFinanceStore.getState().incomeEntries).toHaveLength(1);
    });

    const previousCollection = useFinanceStore.getState().incomeEntries[0];
    expect(previousCollection.amount).toBe(3000);
    expect(previousCollection.isLateCollection).toBe(true);
    expect(previousCollection.academicYearId).toBe('ay-2026'); // Counted in current fiscal year!
    expect(previousCollection.originalYearId).toBe('ay-2025'); // Linked to previous academic year
    expect(previousCollection.studentEnrollmentId).toBe('enr-past-1');

    // Verify Accounting Separation on UI:
    // Current-year pending fees MUST REMAIN ₹25,000 (untouched!)
    // Previous-year pending fees reduced: 8000 - 3000 = ₹5,000
    expect(screen.getAllByText('₹25,000').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('₹5,000').length).toBeGreaterThanOrEqual(1);
  });

  it('Scenario C: Previous-Year balance fully paid displays "Dues cleared", current-year pending fees untouched', async () => {
    // Record payment of the entire ₹8,000 previous due
    const fullPastPayment: IncomeEntry = {
      id: 'inc-past-full',
      category: 'Tuition Fees',
      amount: 8000,
      date: new Date('2026-07-10'),
      academicYearId: 'ay-2026',
      accountId: 'acc-cash-1',
      isLateCollection: true,
      originalYearId: 'ay-2025',
      studentEnrollmentId: 'enr-past-1',
      paymentMethod: 'cash',
      paymentReference: null,
      notes: 'Fully settled Class 4 dues',
      tags: [],
    };

    useFinanceStore.setState({
      incomeEntries: [fullPastPayment],
    });

    render(
      <MemoryRouter initialEntries={['/students/stu-dev-1']}>
        <Routes>
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Card 2 shows positive confirmation
    expect(screen.getAllByText(/Dues Cleared/i).length).toBeGreaterThanOrEqual(1);

    // Current-year pending fees are still ₹25,000 (completely untouched!)
    expect(screen.getAllByText('₹25,000').length).toBeGreaterThanOrEqual(2);
  });

  it('Scenario D: Account and Method Resolution (Cash selects cash account, UPI selects bank account)', async () => {
    render(
      <RecordPreviousPaymentModal
        open={true}
        onClose={() => {}}
        student={testStudent}
        previousEnrollment={previousEnrollment}
        previousPending={8000}
        previousClass="Class 4"
      />
    );

    // Default is Cash -> auto-selects Admin Cash Box
    expect(screen.getByText('Admin Cash Box')).toBeInTheDocument();

    // Switch to UPI
    const upiTile = screen.getByRole('button', { name: /UPI/i });
    fireEvent.click(upiTile);

    // Destination account dropdown appears and lists HDFC School Bank A/C
    expect(screen.getByText(/HDFC School Bank A\/C/i)).toBeInTheDocument();

    // Fill ₹4,000 UPI payment with reference
    const amountInput = screen.getByLabelText(/Payment Amount \(₹\) \*/i);
    fireEvent.change(amountInput, { target: { value: '4000' } });

    const refInput = screen.getByLabelText(/UPI Reference \/ UTR/i);
    fireEvent.change(refInput, { target: { value: 'UPI-REF-998877' } });

    const saveBtn = screen.getByRole('button', { name: 'Record Previous-Year Payment' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(useFinanceStore.getState().incomeEntries).toHaveLength(1);
    });

    const entry = useFinanceStore.getState().incomeEntries[0];
    expect(entry.paymentMethod).toBe('upi');
    expect(entry.accountId).toBe('acc-bank-1');
    expect(entry.paymentReference).toBe('UPI-REF-998877');
  });

  it('Scenario E: Add Previous-Year Fee removes Academic Year dropdown and auto-infers Previous Class', () => {
    render(
      <AddHistoricalFeeModal
        open={true}
        onClose={() => {}}
        student={testStudent}
        existingEnrollments={[currentEnrollment]}
      />
    );

    // Verify Academic Year dropdown does NOT exist in the form
    expect(screen.queryByLabelText(/Academic Year \*/i)).not.toBeInTheDocument();

    // Verify Previous Class is auto-inferred as "Class 4" from current "Class 5"
    const classInput = screen.getByLabelText(/Previous Class \*/i) as HTMLInputElement;
    expect(classInput.value).toBe('Class 4');

    // Verify primary input is Previous-Year Pending Fee
    expect(screen.getByLabelText(/Pending Fee Left \(₹\)/i)).toBeInTheDocument();
  });

  it('Scenario F: Student list Card quick action triggers Record Previous-Year Payment', async () => {
    render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>
    );

    // In redesigned hierarchy: navigate to Class 5 card
    const classCard = await screen.findByRole('button', { name: /Class 5/i });
    fireEvent.click(classCard);

    // In Students list, Dev Patel has previous year dues (8000)
    // The warning box / action displays "Record Previous-Year Payment"
    const recordBtn = await screen.findByRole('button', { name: 'Record Previous-Year Payment' });
    expect(recordBtn).toBeInTheDocument();

    // Clicking it directly opens the dedicated Record Previous-Year Payment modal
    fireEvent.click(recordBtn);

    expect(await screen.findByRole('heading', { name: 'Record Previous-Year Payment' })).toBeInTheDocument();
    expect(screen.getAllByText('Dev Patel').length).toBeGreaterThanOrEqual(2);
  });

  it('Scenario G: Recording previous-year payment for student with carry-forward dues creates historical enrollment in preceding year', async () => {
    // Student with only current enrollment having additionalOutstandingAmount = 5000
    const carryStudent: Student = {
      id: 'stu-carry-1',
      admissionNumber: 'ADM-2026-99',
      fullName: 'Aarav Sharma',
      status: 'active',
      notes: null,
    };

    const carryCurrentEnrollment: StudentEnrollment = {
      id: 'enr-carry-curr',
      studentId: 'stu-carry-1',
      academicYearId: 'ay-2026',
      className: 'Class 6',
      medium: 'english',
      annualFeeAmount: 30000,
      additionalOutstandingAmount: 5000,
      openingCollectedCash: 0,
      openingCollectedUpi: 0,
      openingCollectedOther: 0,
      openingSnapshotDate: null,
      status: 'active',
      notes: '',
    };

    useStudentStore.setState({
      students: [carryStudent],
      enrollments: [carryCurrentEnrollment],
      saveStudent: vi.fn(async (_studentInput: any, enrollmentInput: any) => {
        const id = enrollmentInput.id || 'enr-hist-' + Math.random().toString(36).substring(2, 7);
        const saved: StudentEnrollment = {
          id,
          studentId: carryStudent.id,
          academicYearId: enrollmentInput.academic_year_id,
          className: enrollmentInput.class_name,
          medium: enrollmentInput.medium,
          annualFeeAmount: enrollmentInput.annual_fee_amount,
          additionalOutstandingAmount: enrollmentInput.additional_outstanding_amount || 0,
          openingCollectedCash: 0,
          openingCollectedUpi: 0,
          openingCollectedOther: 0,
          openingSnapshotDate: null,
          status: 'active',
          notes: enrollmentInput.notes || '',
        };
        useStudentStore.setState((state) => ({
          enrollments: state.enrollments.some((e) => e.id === saved.id)
            ? state.enrollments.map((e) => (e.id === saved.id ? saved : e))
            : [...state.enrollments, saved],
        }));
      }),
    });

    render(
      <MemoryRouter initialEntries={['/students/stu-carry-1']}>
        <Routes>
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify Previous-Year Outstanding card shows ₹5,000
    expect(screen.getByText('Original Outstanding')).toBeInTheDocument();
    expect(screen.getAllByText('₹5,000').length).toBeGreaterThanOrEqual(1);

    // Open Record Previous-Year Payment modal
    const prevPaymentBtns = screen.getAllByRole('button', { name: /Record Previous-Year Payment/i });
    fireEvent.click(prevPaymentBtns[0]);

    const dialog = await screen.findByRole('dialog');
    const amountInput = within(dialog).getByLabelText(/Payment Amount \(₹\) \*/i);
    fireEvent.change(amountInput, { target: { value: '2000' } });

    const saveBtn = within(dialog).getByRole('button', { name: 'Record Previous-Year Payment' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(useFinanceStore.getState().incomeEntries).toHaveLength(1);
    });

    const recorded = useFinanceStore.getState().incomeEntries[0];
    expect(recorded.amount).toBe(2000);
    expect(recorded.isLateCollection).toBe(true);
    expect(recorded.academicYearId).toBe('ay-2026');
    expect(recorded.originalYearId).toBe('ay-2025');
    // studentEnrollmentId should NOT be the current enrollment id ('enr-carry-curr'),
    // but rather the resolved/created historical enrollment id
    expect(recorded.studentEnrollmentId).not.toBe('enr-carry-curr');

    // Also verify saveStudent was called to create the historical enrollment in ay-2025
    const finalEnrollments = useStudentStore.getState().enrollments;
    const historicalEnr = finalEnrollments.find(
      (e) => e.studentId === carryStudent.id && e.academicYearId === 'ay-2025'
    );
    expect(historicalEnr).toBeDefined();
    expect(historicalEnr?.id).toBe(recorded.studentEnrollmentId);
  });
});
