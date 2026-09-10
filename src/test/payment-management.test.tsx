import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StudentDetailPage from '@/pages/StudentDetailPage';
import Dashboard from '@/pages/Dashboard';
import { useStudentStore } from '@/store/student-store';
import { useFinanceStore } from '@/store/finance-store';
import type { IncomeInsert } from '@/services/income';

describe('Payment Edit, Delete, and Dashboard Fee Adjustment', () => {
  const testYear = {
    id: 'ay-current',
    label: '2026-27',
    startDate: new Date(2026, 5, 1),
    endDate: new Date(2027, 4, 31),
    targetTuitionFees: 50000,
    carryForwardFees: 0,
    status: 'active' as const,
  };

  const testAccount = {
    id: 'acc-1',
    name: 'Cash Box',
    type: 'cash' as const,
    isArchived: false,
    startingBalance: 10000,
  };

  const testStudent = {
    id: 'stu-test',
    admissionNumber: 'ADM-999',
    fullName: 'Rahul Sharma',
    status: 'active' as const,
    notes: '',
  };

  const testEnrollment = {
    id: 'enr-test',
    studentId: 'stu-test',
    academicYearId: 'ay-current',
    className: 'Class 5',
    medium: 'english' as const,
    annualFeeAmount: 30000,
    additionalOutstandingAmount: 5000, // Last Year's Pending Fees
    openingCollectedCash: 0,
    openingCollectedUpi: 0,
    openingCollectedOther: 0,
    openingSnapshotDate: null,
    status: 'active' as const,
    notes: '',
  };

  const testPayment = {
    id: 'inc-mistaken',
    category: 'Tuition Fees' as const,
    amount: 10000,
    date: new Date(2026, 6, 15),
    academicYearId: 'ay-current',
    accountId: 'acc-1',
    isLateCollection: false,
    originalYearId: null,
    studentEnrollmentId: 'enr-test',
    paymentMethod: 'cash' as const,
    paymentReference: 'RCPT-001',
    notes: 'Initial term fee',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Polyfill ResizeObserver for recharts ResponsiveContainer in jsdom
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    useStudentStore.setState({
      students: [testStudent],
      enrollments: [testEnrollment],
    });

    useFinanceStore.setState({
      academicYears: [testYear],
      currentYearId: 'ay-current',
      accounts: [testAccount],
      incomeEntries: [testPayment],
      expenseEntries: [],
      transfers: [],
      recoverables: [],
      recoverableRepayments: [],
      recurringTemplates: [],
      pendingRecurringItems: [],
      deleteIncome: vi.fn(async (id: string) => {
        useFinanceStore.setState((state) => ({
          incomeEntries: state.incomeEntries.filter((e) => e.id !== id),
        }));
      }),
      updateIncome: vi.fn(async (id: string, updates: Partial<IncomeInsert>) => {
        useFinanceStore.setState((state) => ({
          incomeEntries: state.incomeEntries.map((e) =>
            e.id === id ? { ...e, ...updates, amount: updates.amount ?? e.amount, date: updates.date ? new Date(updates.date) : e.date } : e
          ),
        }));
      }),
    });
  });

  it('renders student fee account with Last Year Pending label and displays Edit and Delete actions for payments', () => {
    render(
      <MemoryRouter initialEntries={['/students/stu-test']}>
        <Routes>
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify terminology: Annual fee + Last Year's Pending
    expect(screen.getByText(/Last Year's Pending: ₹5,000/)).toBeInTheDocument();

    // Total obligation = 30000 + 5000 = 35000
    // Payment recorded = 10000
    // Pending balance = 25000
    expect(screen.getByText('₹25,000')).toBeInTheDocument();

    // Switch to payments tab
    fireEvent.click(screen.getByRole('tab', { name: /Payments/ }));

    // Actions exist
    expect(screen.getByRole('button', { name: 'Edit payment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete payment' })).toBeInTheDocument();
  });

  it('opens confirmation modal and deletes a mistakenly recorded payment, restoring pending balance', async () => {
    render(
      <MemoryRouter initialEntries={['/students/stu-test']}>
        <Routes>
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Switch to payments tab
    fireEvent.click(screen.getByRole('tab', { name: /Payments/ }));

    // Click delete button
    fireEvent.click(screen.getByRole('button', { name: 'Delete payment' }));

    // Verify confirmation dialog appears with details
    expect(screen.getByText('Delete Mistaken Payment?')).toBeInTheDocument();
    expect(screen.getByText(/This will permanently remove this entry from the financial ledger/)).toBeInTheDocument();

    // Click "Delete Payment" button in dialog
    const confirmDeleteBtn = screen.getByRole('button', { name: 'Delete Payment' });
    fireEvent.click(confirmDeleteBtn);

    // Wait for deletion to complete and store to update
    await waitFor(() => {
      expect(useFinanceStore.getState().incomeEntries).toHaveLength(0);
    });

    // Verify payments tab shows empty state
    expect(screen.getByText('No payments recorded yet')).toBeInTheDocument();

    // Switch to Overview tab to verify restored student balance
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));

    // Student pending balance should now be restored to 35,000 (both Total Obligation and Current Pending are ₹35,000)
    expect(screen.getAllByText('₹35,000')).toHaveLength(2);
  });

  it('adjusts Dashboard with Last Year Remaining Fees and updates when payment is recorded or removed', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <Dashboard />
      </MemoryRouter>
    );

    // Check Last Year's Pending Fees card title exists
    expect(screen.getByText("Last Year's Pending Fees")).toBeInTheDocument();

    // Total fees still to collect:
    // With 10,000 payment:
    // currentRemaining: 50,000 target - 10,000 collected = 40,000
    // lastYearPending: student owes 5,000 last year pending, payment of 10,000 covered it -> 0 last year pending
    // Total fees to collect = 40,000
    expect(screen.getByText('₹40,000')).toBeInTheDocument();

    // If we delete the payment (e.g. was a mistake):
    useFinanceStore.setState({ incomeEntries: [] });

    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Dashboard />
      </MemoryRouter>
    );

    // Without payment:
    // currentRemaining: 50,000 target - 0 collected = 50,000
    // lastYearPending: 5,000 from student
    // Total fees still to collect = 50,000 + 5,000 = 55,000
    expect(screen.getByText('₹55,000')).toBeInTheDocument();
  });
});
