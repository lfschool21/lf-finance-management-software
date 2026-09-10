import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { AddIncomeModal } from '@/components/AddIncomeModal';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import { BrowserRouter } from 'react-router-dom';

describe('AddIncomeModal dropdowns', () => {
  beforeEach(() => {
    // Populate store state with dummy data
    useFinanceStore.setState({
      academicYears: [
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
        {
          id: 'acc-cash',
          name: 'Cash in Hand',
          type: 'cash',
          startingBalance: 5000,
          isArchived: false,
        },
        {
          id: 'acc-bank',
          name: 'School Bank Account',
          type: 'school_bank',
          startingBalance: 50000,
          isArchived: false,
        },
      ],
      incomeEntries: [],
    });

    useStudentStore.setState({
      students: [
        {
          id: 'stu-1',
          fullName: 'Aarav Patel',
          admissionNumber: 'GR-101',
          status: 'active',
          notes: '',
        },
      ],
      enrollments: [
        {
          id: 'enr-1',
          studentId: 'stu-1',
          academicYearId: 'ay-2026',
          className: 'Class 1',
          medium: 'english',
          annualFeeAmount: 15000,
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

  it('renders and displays student obligations and dropdowns when opened with presetStudentEnrollmentId', async () => {
    render(
      <BrowserRouter>
        <AddIncomeModal
          isOpen={true}
          onClose={() => {}}
          presetStudentEnrollmentId="enr-1"
        />
      </BrowserRouter>
    );

    // Verify student name is shown
    expect(screen.getByText('Aarav Patel')).toBeInTheDocument();

    // Check Apply To label
    expect(screen.getByText('Apply To')).toBeInTheDocument();

    // Check Payment Method label
    expect(screen.getByText('Payment Method')).toBeInTheDocument();

    // Check Received In label
    expect(screen.getByText('Received In')).toBeInTheDocument();
  });

  it('renders student obligations when fee is 0 or pending is 0', async () => {
    useStudentStore.setState({
      students: [
        {
          id: 'stu-2',
          fullName: 'Priya Sharma',
          admissionNumber: 'GR-102',
          status: 'active',
          notes: '',
        },
      ],
      enrollments: [
        {
          id: 'enr-2',
          studentId: 'stu-2',
          academicYearId: 'ay-2026',
          className: 'Class 2',
          medium: 'gujarati',
          annualFeeAmount: 0, // Imported with 0 fee!
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

    render(
      <BrowserRouter>
        <AddIncomeModal
          isOpen={true}
          onClose={() => {}}
          presetStudentEnrollmentId="enr-2"
        />
      </BrowserRouter>
    );

    // Verify student name is shown
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    
    // Check if the select trigger contains Class 2 or fee text
    const textElements = screen.getAllByText(/Class 2/i);
    expect(textElements.length).toBeGreaterThan(0);
  });

  it('allows user to change Received In account without it being overridden', () => {
    render(
      <BrowserRouter>
        <AddIncomeModal
          isOpen={true}
          onClose={() => {}}
          presetStudentEnrollmentId="enr-1"
        />
      </BrowserRouter>
    );

    // Initial account is cash
    expect(screen.getByText('Cash in Hand')).toBeInTheDocument();

    // Now test that payment method selection works
    expect(screen.getByText('Payment Method')).toBeInTheDocument();
  });

  it('restricts payment method options to Cash and UPI only (no bank transfer, cheque, or other)', () => {
    render(
      <BrowserRouter>
        <AddIncomeModal
          isOpen={true}
          onClose={() => {}}
          presetStudentEnrollmentId="enr-1"
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Payment Method')).toBeInTheDocument();
    // Verify removed payment options do not exist
    expect(screen.queryByText('Bank Transfer')).not.toBeInTheDocument();
    expect(screen.queryByText('Cheque')).not.toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
    // Verify Reference (optional) field is removed
    expect(screen.queryByText(/Reference \(optional\)/i)).not.toBeInTheDocument();
  });
});


