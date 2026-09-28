import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import IncomePage from '@/pages/IncomePage';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import { OTHER_CATEGORY, TUITION_CATEGORY } from '@/types/finance';

describe('Investments All-Years Reconciliation on IncomePage', () => {
  beforeEach(() => {
    useStudentStore.setState({ students: [], enrollments: [] });
    useFinanceStore.setState({
      academicYears: [
        {
          id: 'year-2025',
          label: '2025-26',
          startDate: new Date('2025-06-01'),
          endDate: new Date('2026-04-30'),
          targetTuitionFees: 100000,
          carryForwardFees: 0,
          status: 'closed',
        },
        {
          id: 'year-2026',
          label: '2026-27',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2027-04-30'),
          targetTuitionFees: 120000,
          carryForwardFees: 0,
          status: 'active',
        },
      ],
      currentYearId: 'year-2026',
      accounts: [
        { id: 'acc-1', name: 'Main School Bank', type: 'school_bank', startingBalance: 0, isArchived: false },
      ],
      incomeEntries: [
        {
          id: 'inc-tuition-curr',
          academicYearId: 'year-2026',
          category: TUITION_CATEGORY,
          amount: 25000,
          date: new Date('2026-07-10'),
          accountId: 'acc-1',
          isLateCollection: false,
          originalYearId: null,
          studentEnrollmentId: null,
          paymentMethod: 'cash',
          paymentReference: null,
          notes: 'Tuition deposit',
          tags: [],
        },
        {
          id: 'inv-prev-1',
          academicYearId: 'year-2025',
          category: OTHER_CATEGORY,
          amount: 50000,
          date: new Date('2025-09-15'),
          accountId: 'acc-1',
          isLateCollection: false,
          originalYearId: null,
          studentEnrollmentId: null,
          paymentMethod: null,
          paymentReference: null,
          notes: 'Term deposit interest 2025',
          tags: ['investment'],
        },
        {
          id: 'inv-curr-1',
          academicYearId: 'year-2026',
          category: OTHER_CATEGORY,
          amount: 20000,
          date: new Date('2026-08-20'),
          accountId: 'acc-1',
          isLateCollection: false,
          originalYearId: null,
          studentEnrollmentId: null,
          paymentMethod: null,
          paymentReference: null,
          notes: 'Equipment grant donation',
          tags: ['grant'],
        },
      ],
    });
  });

  it('renders previous-year and current-year investments in the Investment/Extra tab', () => {
    render(
      <MemoryRouter initialEntries={['/income']}>
        <IncomePage />
      </MemoryRouter>
    );

    // Click the Investment / Extra tab
    const otherTab = screen.getByRole('tab', { name: /Investment \/ Extra/i });
    fireEvent.pointerDown(otherTab, { button: 0 });
    fireEvent.click(otherTab);

    // Verify summary metrics include both current and previous year
    // Total Investments: ₹70,000
    expect(screen.getByText('Total Investments')).toBeInTheDocument();
    expect(screen.getByText('₹70,000')).toBeInTheDocument();

    // Current AY Investments: ₹20,000
    expect(screen.getByText('Current AY Investments')).toBeInTheDocument();
    expect(screen.getByText('₹20,000')).toBeInTheDocument();

    // Previous-Year Investments: ₹50,000
    expect(screen.getByText('Previous-Year Investments')).toBeInTheDocument();
    expect(screen.getByText('₹50,000')).toBeInTheDocument();

    // Both entries should be listed in the transaction list
    expect(screen.getByText('Term deposit interest 2025')).toBeInTheDocument();
    expect(screen.getByText('Equipment grant donation')).toBeInTheDocument();

    // The previous year entry should display its academic year badge (AY 2025-26)
    expect(screen.getByText(/AY 2025-26/)).toBeInTheDocument();

    // Filter by Current AY only
    const currentBtn = screen.getByRole('button', { name: /Current AY Investments/i });
    fireEvent.click(currentBtn);
    expect(screen.getByText('Equipment grant donation')).toBeInTheDocument();
    expect(screen.queryByText('Term deposit interest 2025')).not.toBeInTheDocument();

    // Filter by Previous-Year only
    const prevBtn = screen.getByRole('button', { name: /Previous-Year Investments/i });
    fireEvent.click(prevBtn);
    expect(screen.getByText('Term deposit interest 2025')).toBeInTheDocument();
    expect(screen.queryByText('Equipment grant donation')).not.toBeInTheDocument();

    // Filter back to All
    const allBtn = screen.getByRole('button', { name: /All Investments/i });
    fireEvent.click(allBtn);
    expect(screen.getByText('Term deposit interest 2025')).toBeInTheDocument();
    expect(screen.getByText('Equipment grant donation')).toBeInTheDocument();
  });

  it('displays Previous-Year Investments in category breakdown on All Income tab', () => {
    render(
      <MemoryRouter initialEntries={['/income']}>
        <IncomePage />
      </MemoryRouter>
    );

    // All Income tab is selected by default
    expect(screen.getByText('Breakdown by Category')).toBeInTheDocument();
    expect(screen.getByText('Previous-Year Investments')).toBeInTheDocument();
    expect(screen.getByText('Term deposit interest 2025')).toBeInTheDocument();
  });
});
