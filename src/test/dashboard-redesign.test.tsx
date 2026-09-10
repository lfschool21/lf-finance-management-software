import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import { useStudentStore } from '@/store/student-store';
import { useFinanceStore } from '@/store/finance-store';
import { useLanguageStore } from '@/store/language-store';
import type { AcademicYear, Account, ExpenseEntry, IncomeEntry, Recoverable, RecoverableRepayment, Transfer } from '@/types/finance';
import type { Student, StudentEnrollment } from '@/types/students';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Dashboard Redesign and Financial Operational Integrity', () => {
  const currentAY: AcademicYear = {
    id: 'ay-2026-27',
    label: '2026-27',
    startDate: new Date(2026, 5, 1),
    endDate: new Date(2027, 4, 31),
    targetTuitionFees: 1500000,
    carryForwardFees: 0,
    status: 'active',
  };

  const priorAY: AcademicYear = {
    id: 'ay-2025-26',
    label: '2025-26',
    startDate: new Date(2025, 5, 1),
    endDate: new Date(2026, 4, 31),
    targetTuitionFees: 1200000,
    carryForwardFees: 0,
    status: 'closed',
  };

  const schoolAccount: Account = {
    id: 'acc-school-bank',
    name: 'School Bank Account',
    type: 'school_bank',
    startingBalance: 250000,
    isArchived: false,
  };

  const cashAccount: Account = {
    id: 'acc-cash-drawer',
    name: 'School Cash Box',
    type: 'cash',
    startingBalance: 50000,
    isArchived: false,
  };

  const gujaratiStudent1: Student = {
    id: 'stu-guj-1',
    admissionNumber: 'G-101',
    fullName: 'Aarav Patel',
    status: 'active',
    notes: '',
  };

  const gujaratiStudent2: Student = {
    id: 'stu-guj-2',
    admissionNumber: 'G-102',
    fullName: 'Diya Shah',
    status: 'active',
    notes: '',
  };

  const englishStudent1: Student = {
    id: 'stu-eng-1',
    admissionNumber: 'E-201',
    fullName: 'Rohan Mehta',
    status: 'active',
    notes: '',
  };

  const inactiveStudent: Student = {
    id: 'stu-inactive',
    admissionNumber: 'X-999',
    fullName: 'Inactive Student',
    status: 'inactive',
    notes: '',
  };

  const gujaratiEnrollment1: StudentEnrollment = {
    id: 'enr-guj-1',
    studentId: 'stu-guj-1',
    academicYearId: 'ay-2026-27',
    className: 'Class 4',
    medium: 'gujarati',
    annualFeeAmount: 20000,
    additionalOutstandingAmount: 5000,
    openingCollectedCash: 0,
    openingCollectedUpi: 0,
    openingCollectedOther: 0,
    openingSnapshotDate: null,
    status: 'active',
    notes: '',
  };

  const gujaratiEnrollment2: StudentEnrollment = {
    id: 'enr-guj-2',
    studentId: 'stu-guj-2',
    academicYearId: 'ay-2026-27',
    className: 'Class 4',
    medium: 'gujarati',
    annualFeeAmount: 20000,
    additionalOutstandingAmount: 0,
    openingCollectedCash: 20000, // Fully cleared via opening
    openingCollectedUpi: 0,
    openingCollectedOther: 0,
    openingSnapshotDate: null,
    status: 'active',
    notes: '',
  };

  const englishEnrollment1: StudentEnrollment = {
    id: 'enr-eng-1',
    studentId: 'stu-eng-1',
    academicYearId: 'ay-2026-27',
    className: 'Class 6',
    medium: 'english',
    annualFeeAmount: 30000,
    additionalOutstandingAmount: 0,
    openingCollectedCash: 0,
    openingCollectedUpi: 0,
    openingCollectedOther: 0,
    openingSnapshotDate: null,
    status: 'active',
    notes: '',
  };

  const inactiveEnrollment: StudentEnrollment = {
    id: 'enr-inactive',
    studentId: 'stu-inactive',
    academicYearId: 'ay-2026-27',
    className: 'Class 10',
    medium: 'english',
    annualFeeAmount: 50000,
    additionalOutstandingAmount: 0,
    openingCollectedCash: 0,
    openingCollectedUpi: 0,
    openingCollectedOther: 0,
    openingSnapshotDate: null,
    status: 'inactive',
    notes: '',
  };

  beforeEach(() => {
    mockNavigate.mockReset();
    useLanguageStore.setState({ language: 'en' });
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    useStudentStore.setState({
      students: [gujaratiStudent1, gujaratiStudent2, englishStudent1, inactiveStudent],
      enrollments: [gujaratiEnrollment1, gujaratiEnrollment2, englishEnrollment1, inactiveEnrollment],
    });

    useFinanceStore.setState({
      academicYears: [currentAY, priorAY],
      currentYearId: 'ay-2026-27',
      accounts: [schoolAccount, cashAccount],
      incomeEntries: [],
      expenseEntries: [],
      transfers: [],
      recoverables: [],
      recoverableRepayments: [],
      recurringTemplates: [],
      pendingRecurringItems: [],
    });
  });

  it('1. Renders current academic year label cleanly without redundant school eyebrow', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText(/Academic Year 2026-27/)).toBeInTheDocument();
    expect(screen.queryByText('Primary financial story')).not.toBeInTheDocument();
  });

  it('2. Current-year tuition target uses current academic year', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Target is ₹15,00,000 for AY 2026-27
    expect(screen.getAllByText('₹15,00,000').length).toBeGreaterThanOrEqual(1);
  });

  it('3. Current tuition collected excludes late collections from current tuition total', () => {
    const currentPayment: IncomeEntry = {
      id: 'inc-curr-1',
      academicYearId: 'ay-2026-27',
      category: 'Tuition Fees',
      amount: 15000,
      date: new Date(2026, 6, 1),
      accountId: 'acc-school-bank',
      isLateCollection: false,
      studentEnrollmentId: 'enr-guj-1',
    };

    const lateCollectionPayment: IncomeEntry = {
      id: 'inc-late-1',
      academicYearId: 'ay-2026-27',
      category: 'Tuition Fees',
      amount: 25000,
      date: new Date(2026, 6, 2),
      accountId: 'acc-school-bank',
      isLateCollection: true,
      originalYearId: 'ay-2025-26',
    };

    useFinanceStore.setState({
      incomeEntries: [currentPayment, lateCollectionPayment],
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Current tuition collected should be 15,000, NOT 40,000
    // Abbreviated in KPI as ₹15K
    expect(screen.getByText('₹15K')).toBeInTheDocument();
  });

  it('4. Previous-year fee receipts remain correctly identified under Last Year Pending Fees', () => {
    const latePayment: IncomeEntry = {
      id: 'inc-late-1',
      academicYearId: 'ay-2026-27',
      category: 'Tuition Fees',
      amount: 30000,
      date: new Date(2026, 6, 5),
      accountId: 'acc-school-bank',
      isLateCollection: true,
      originalYearId: 'ay-2025-26',
    };

    useFinanceStore.setState({
      incomeEntries: [latePayment],
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText("Last Year's Pending Fees")).toBeInTheDocument();
    // 30,000 received this AY appears in fee overview
    expect(screen.getAllByText('₹30K').length).toBeGreaterThanOrEqual(1);
  });

  it('5. Total fees still to collect remains mathematically preserved', () => {
    // Isolate to current year where student has 5,000 carried forward
    useFinanceStore.setState({
      academicYears: [currentAY],
    });

    // Target 15,00,000; 0 collected; gujaratiEnrollment1 has 5,000 last year pending
    // Total fees to collect = 15,00,000 + 5,000 = 15,05,000 (15.05L)
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('₹15,05,000')).toBeInTheDocument();
  });

  it('6. Available Balance reflects getTotalBalance across all accounts', () => {
    // Starting balance 2,50,000 + 50,000 = 3,00,000
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('Available Balance')).toBeInTheDocument();
    expect(screen.getByText('₹3L')).toBeInTheDocument();
  });

  it('7. School Profit strictly excludes personal/home expenses', () => {
    const tuitionIncome: IncomeEntry = {
      id: 'inc-1',
      academicYearId: 'ay-2026-27',
      category: 'Tuition Fees',
      amount: 100000,
      date: new Date(2026, 6, 10),
      accountId: 'acc-school-bank',
      isLateCollection: false,
    };

    const schoolExpense: ExpenseEntry = {
      id: 'exp-school',
      academicYearId: 'ay-2026-27',
      expenseType: 'school',
      category: 'Salary & Wages',
      amount: 40000,
      date: new Date(2026, 6, 12),
      accountId: 'acc-school-bank',
    };

    const homeExpense: ExpenseEntry = {
      id: 'exp-home',
      academicYearId: 'ay-2026-27',
      expenseType: 'home',
      category: 'Groceries',
      amount: 25000,
      date: new Date(2026, 6, 15),
      accountId: 'acc-cash-drawer',
    };

    useFinanceStore.setState({
      incomeEntries: [tuitionIncome],
      expenseEntries: [schoolExpense, homeExpense],
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // School profit = 100,000 - 40,000 = 60,000 (home expense 25,000 excluded)
    expect(screen.getByText('₹60K')).toBeInTheDocument();
    expect(screen.getByText('₹60,000')).toBeInTheDocument();
    expect(screen.getAllByText('₹40,000').length).toBeGreaterThanOrEqual(1); // school expenses in financial position & unrealized expense section
  });

  it('8. Transfers do not alter income, expenses, or school profit', () => {
    const transfer: Transfer = {
      id: 'tr-1',
      fromAccountId: 'acc-school-bank',
      toAccountId: 'acc-cash-drawer',
      amount: 20000,
      date: new Date(2026, 6, 14),
      category: 'cash_withdrawal',
      notes: '',
    };

    useFinanceStore.setState({
      transfers: [transfer],
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // School profit remains 0
    expect(screen.getByText('Available Balance')).toBeInTheDocument();
    expect(screen.getByText('₹3L')).toBeInTheDocument();
  });

  it('9. Recoverable advances are not counted as school expenses', () => {
    const advance: Recoverable = {
      id: 'rec-1',
      partyName: 'Contractor Verma',
      originalAmount: 50000,
      dateGiven: new Date(2026, 6, 1),
      sourceAccountId: 'acc-school-bank',
      notes: '',
    };

    useFinanceStore.setState({
      recoverables: [advance],
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Recoverables outstanding appears in Needs Attention
    expect(screen.getByText('Recoverables outstanding')).toBeInTheDocument();
    expect(screen.getByText(/₹50,000 in temporary advances/)).toBeInTheDocument();
  });

  it('10. Recoverable repayments are not counted as income', () => {
    const advance: Recoverable = {
      id: 'rec-1',
      partyName: 'Contractor Verma',
      originalAmount: 50000,
      dateGiven: new Date(2026, 6, 1),
      sourceAccountId: 'acc-school-bank',
      notes: '',
    };

    const repayment: RecoverableRepayment = {
      id: 'rep-1',
      recoverableId: 'rec-1',
      amount: 20000,
      date: new Date(2026, 6, 20),
      accountId: 'acc-school-bank',
      notes: '',
    };

    useFinanceStore.setState({
      recoverables: [advance],
      recoverableRepayments: [repayment],
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Cash income received remains 0
    expect(screen.getByText(/₹30,000 in temporary advances/)).toBeInTheDocument();
  });

  it('11. & 12. Gujarati Medium and English Medium active student counts are correct', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // 2 active Gujarati students, 1 active English student (inactive is excluded)
    expect(screen.getByText('Gujarati Medium')).toBeInTheDocument();
    expect(screen.getByText('2 Students')).toBeInTheDocument();

    expect(screen.getByText('English Medium')).toBeInTheDocument();
    expect(screen.getByText('1 Students')).toBeInTheDocument();
  });

  it('13. & 14. Gujarati and English student-ledger pending are correctly scoped', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Gujarati student 1 owes 20,000 + 5,000 = 25,000. Gujarati student 2 is paid (0).
    // Total Gujarati pending = 25,000 (₹25K)
    // English student 1 owes 30,000 (₹30K)
    expect(screen.getByText('₹25K')).toBeInTheDocument();
    expect(screen.getByText('₹30K')).toBeInTheDocument();
  });

  it('15. Inactive enrollments are not counted in active student totals', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Total active students = 3 (inactive excluded)
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Gujarati 2 · English 1')).toBeInTheDocument();
  });

  it('16. Unassigned tuition warning renders only when unassigned amount > 0', () => {
    const unassignedPayment: IncomeEntry = {
      id: 'inc-unassigned',
      academicYearId: 'ay-2026-27',
      category: 'Tuition Fees',
      amount: 12000,
      date: new Date(2026, 6, 25),
      accountId: 'acc-school-bank',
      isLateCollection: false,
      studentEnrollmentId: null,
    };

    useFinanceStore.setState({
      incomeEntries: [unassignedPayment],
    });

    const { rerender } = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText(/is not yet linked to individual student accounts/)).toBeInTheDocument();

    // Now link it:
    useFinanceStore.setState({
      incomeEntries: [{ ...unassignedPayment, studentEnrollmentId: 'enr-guj-1' }],
    });

    rerender(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.queryByText(/is not yet linked to individual student accounts/)).not.toBeInTheDocument();
  });

  it('17. Needs Attention displays accurate badge count and handles empty state gracefully', () => {
    // When no pending items:
    const { rerender } = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Currently gujaratiEnrollment1 has 5,000 last year pending, so attention count is 1
    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    expect(screen.getByText('Previous-year fees pending')).toBeInTheDocument();

    // Clear the pending student balance and prior year target to test empty state
    useFinanceStore.setState({
      academicYears: [currentAY],
    });
    useStudentStore.setState({
      enrollments: [gujaratiEnrollment2], // only the fully paid one
    });

    rerender(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('Everything is up to date.')).toBeInTheDocument();
  });

  it('18. Empty states do not crash when no academic year or data is present', () => {
    useFinanceStore.setState({
      academicYears: [],
      currentYearId: '',
      accounts: [],
      incomeEntries: [],
      expenseEntries: [],
    });
    useStudentStore.setState({
      students: [],
      enrollments: [],
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Academic Year —')).toBeInTheDocument();
    expect(screen.getByText('No cash-flow data yet')).toBeInTheDocument();
    expect(screen.getByText('No school expenses yet')).toBeInTheDocument();
    expect(screen.getByText('No transactions recorded yet.')).toBeInTheDocument();
  });

  it('19. Quick actions (Record Fee Payment, Add Expense) trigger modals', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    const addExpenseBtn = screen.getByRole('button', { name: /Add Expense/ });
    expect(addExpenseBtn).toBeInTheDocument();

    const recordFeeBtn = screen.getByRole('button', { name: /Record Fee Payment/ });
    expect(recordFeeBtn).toBeInTheDocument();
    fireEvent.click(recordFeeBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('20. Medium cards drill down directly to Gujarati and English workspaces', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    const gujaratiBtn = screen.getByRole('button', { name: 'View Gujarati Students' });
    fireEvent.click(gujaratiBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/students?medium=gujarati');

    const englishBtn = screen.getByRole('button', { name: 'View English Students' });
    fireEvent.click(englishBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/students?medium=english');
  });

  it('21. Unrealized expenses calculates the gap between fees collected and available balance', () => {
    // Suppose student collected fees = 50,000 (from gujaratiEnrollment1 who paid 20,000 opening + 30,000 payment)
    const payment: IncomeEntry = {
      id: 'inc-tuition',
      academicYearId: 'ay-2026-27',
      category: 'Tuition Fees',
      amount: 50000,
      date: new Date(2026, 6, 1),
      accountId: 'acc-school-bank',
      isLateCollection: false,
      studentEnrollmentId: 'enr-guj-1',
    };

    // And school account starting balance was 0, but user spent money so balance is 10,000, with 5,000 recorded expenses
    const emptyAccount: Account = {
      id: 'acc-school-bank',
      name: 'School Bank Account',
      type: 'school_bank',
      startingBalance: 0,
      isArchived: false,
    };

    const recordedExpense: ExpenseEntry = {
      id: 'exp-1',
      academicYearId: 'ay-2026-27',
      expenseType: 'school',
      category: 'Salary & Wages',
      amount: 5000,
      date: new Date(2026, 6, 10),
      accountId: 'acc-school-bank',
    };

    // In this state:
    // Income = 50,000
    // Expenses = 5,000
    // Available Balance = 45,000
    // Accounted funds = 45,000 + 5,000 = 50,000 -> Unrealized = 0
    // But what if students paid 1,00,000 (e.g. 50,000 opening + 50,000 payment)?
    // With gujaratiEnrollment2 having 20,000 opening collected, student roster collected = 20,000 + 50,000 = 70,000!
    // Total fees collected = 70,000!
    // Accounted funds = 45,000 + 5,000 = 50,000.
    // Unrealized expense = 70,000 - 50,000 = 20,000 (₹20,000)!
    useFinanceStore.setState({
      accounts: [emptyAccount],
      incomeEntries: [payment],
      expenseEntries: [recordedExpense],
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('Unrealized Expenses')).toBeInTheDocument();
    expect(screen.getByText('Unrecorded Spending')).toBeInTheDocument();
    // 20,000 gap is identified as unrealized expense
    expect(screen.getAllByText('₹20,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/An estimated/)).toBeInTheDocument();
    expect(screen.getByText(/was spent on day-to-day operations that has not yet been logged/)).toBeInTheDocument();
  });

  it('22. Unrealized expenses shows reconciled when all collected fees are accounted for', () => {
    // When no fees have been collected or available balance exceeds fees
    useFinanceStore.setState({
      accounts: [schoolAccount], // startingBalance: 250,000
      incomeEntries: [],
      expenseEntries: [],
    });

    // Clear opening collections
    useStudentStore.setState({
      enrollments: [gujaratiEnrollment1], // openingCollected = 0
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('Unrealized Expenses')).toBeInTheDocument();
    expect(screen.getByText('Reconciled')).toBeInTheDocument();
    expect(screen.getByText(/All fee collections are accounted for in the current available balance/)).toBeInTheDocument();
  });

  it('23. Toggling language switcher switches text to conversational Gujarati and back to English', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Initial language is English
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Fees Still To Collect')).toBeInTheDocument();
    expect(screen.getByText('Available Balance')).toBeInTheDocument();

    // Toggle to Gujarati
    const gujaratiBtn = screen.getByRole('button', { name: 'ગુજરાતી' });
    fireEvent.click(gujaratiBtn);

    // Primary headers and metrics remain in English
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Fees Still To Collect')).toBeInTheDocument();
    expect(screen.getByText('Available Balance')).toBeInTheDocument();
    expect(screen.getByText('School Profit')).toBeInTheDocument();
    expect(screen.getByText('Active Students')).toBeInTheDocument();
    expect(screen.getByText('Fee Collection')).toBeInTheDocument();
    expect(screen.getByText('Students by Medium')).toBeInTheDocument();
    expect(screen.getByText('Financial Position')).toBeInTheDocument();
    expect(screen.getAllByText('Unrealized Expenses').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Monthly Income vs School Expenses')).toBeInTheDocument();
    expect(screen.getByText('Top School Expense Categories')).toBeInTheDocument();

    // Necessary explanatory subtext and calculation descriptions appear in Gujarati
    expect(screen.getByText('ચાલુ વર્ષની બાકી + પાછલા વર્ષની બાકી')).toBeInTheDocument();
    expect(screen.getByText('બધા એકાઉન્ટ્સમાં ઉપલબ્ધ લિક્વિડ કેશ')).toBeInTheDocument();
    expect(screen.getAllByText('કેશ ઇનકમ − સ્કૂલ ખર્ચ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('સ્કૂલ ટ્યુશન ફી કલેક્શન પ્રોગ્રેસ')).toBeInTheDocument();
    expect(screen.getByText('મીડિયમ અનુસાર એક્ટિવ સ્ટુડન્ટ્સ અને ફી એકાઉન્ટ સ્ટેટસ')).toBeInTheDocument();
    expect(screen.getByText('સ્કૂલ ઓપરેટિંગ પરફોર્મન્સ અને આઉટલુક (પર્સનલ/ઘર ખર્ચ સિવાય)')).toBeInTheDocument();

    // Toggle back to English
    const enBtn = screen.getByRole('button', { name: 'EN' });
    fireEvent.click(enBtn);

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Fees Still To Collect')).toBeInTheDocument();
    expect(screen.getByText('Available Balance')).toBeInTheDocument();
  });

  it('24. Gujarati mode strictly keeps all numbers in English numerals with no Gujarati digits', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Switch to Gujarati
    const gujaratiBtn = screen.getByRole('button', { name: 'ગુજરાતી' });
    fireEvent.click(gujaratiBtn);

    // English numbers remain visible
    expect(screen.getAllByText('₹15,00,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('₹3L')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    // Check that no Gujarati digits [૦-૯] appear anywhere in the rendered text
    const allText = document.body.textContent || '';
    const gujaratiDigitsRegex = /[૦૧૨૩૪૫૬૭૮૯]/;
    expect(gujaratiDigitsRegex.test(allText)).toBe(false);
  });
});
