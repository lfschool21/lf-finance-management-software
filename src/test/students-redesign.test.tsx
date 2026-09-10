import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import StudentsPage from '@/pages/StudentsPage';
import StudentDetailPage from '@/pages/StudentDetailPage';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';

describe('Students Experience Redesign', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useFinanceStore.setState({
      academicYears: [
        {
          id: 'ay-2026',
          label: '2026-27',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2027-05-31'),
          targetTuitionFees: 50000,
          carryForwardFees: 0,
          status: 'active',
        },
        {
          id: 'ay-2025',
          label: '2025-26',
          startDate: new Date('2025-06-01'),
          endDate: new Date('2026-05-31'),
          targetTuitionFees: 40000,
          carryForwardFees: 0,
          status: 'closed',
        },
      ],
      currentYearId: 'ay-2026',
      accounts: [
        {
          id: 'acc-cash',
          name: 'Cash Box',
          type: 'cash',
          startingBalance: 10000,
          isArchived: false,
        },
        {
          id: 'acc-bank',
          name: 'HDFC School Bank',
          type: 'school_bank',
          startingBalance: 100000,
          isArchived: false,
        },
      ],
      incomeEntries: [
        {
          id: 'inc-1',
          academicYearId: 'ay-2026',
          category: 'Tuition Fees',
          amount: 15000,
          date: new Date('2026-07-15'),
          accountId: 'acc-bank',
          isLateCollection: false,
          originalYearId: null,
          studentEnrollmentId: 'enr-1',
          paymentMethod: 'upi',
          paymentReference: 'UPI-987654',
          notes: 'Quarter 1 Tuition',
          tags: [],
        },
      ],
    });

    useStudentStore.setState({
      students: [
        {
          id: 'stu-1',
          fullName: 'Aarav Patel',
          admissionNumber: 'ADM-101',
          status: 'active',
          notes: 'Honor roll student',
        },
        {
          id: 'stu-2',
          fullName: 'Bhavna Shah',
          admissionNumber: 'ADM-102',
          status: 'active',
          notes: '',
        },
      ],
      enrollments: [
        {
          id: 'enr-1',
          studentId: 'stu-1',
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
        },
        {
          id: 'enr-1-prev',
          studentId: 'stu-1',
          academicYearId: 'ay-2025',
          className: 'Class 4',
          medium: 'english',
          annualFeeAmount: 20000,
          additionalOutstandingAmount: 0,
          openingCollectedCash: 15000,
          openingCollectedUpi: 0,
          openingCollectedOther: 0,
          openingSnapshotDate: '2025-06-01',
          status: 'active',
          notes: '',
        },
        {
          id: 'enr-2',
          studentId: 'stu-2',
          academicYearId: 'ay-2026',
          className: 'Class 3',
          medium: 'gujarati',
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
      isInitialized: true,
      isLoading: false,
    });
  });

  it('renders StudentsPage with redesigned compact header, metrics, and search', () => {
    render(
      <BrowserRouter>
        <StudentsPage />
      </BrowserRouter>
    );

    // Header elements
    expect(screen.getByRole('heading', { name: 'Students' })).toBeInTheDocument();
    expect(screen.getByText('Manage student records and fee accounts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Student/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import \/ Export/i })).toBeInTheDocument();

    // Compact Overview Metrics
    expect(screen.getByText('Total Students')).toBeInTheDocument();
    expect(screen.getByText('Fees Pending')).toBeInTheDocument();
    expect(screen.getByText('Fully Paid')).toBeInTheDocument();

    // Roster rows rendered in data table
    expect(screen.getAllByText('Aarav Patel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bhavna Shah').length).toBeGreaterThan(0);

    // Search bar functionality
    const searchInput = screen.getByPlaceholderText('Search by student name or admission number...');
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Bhavna' } });
    expect(screen.getAllByText('Bhavna Shah').length).toBeGreaterThan(0);
    expect(screen.queryByText('Aarav Patel')).not.toBeInTheDocument();
  });

  it('renders StudentDetailPage with 3 tabs, fee calculation, and payment history', () => {
    render(
      <MemoryRouter initialEntries={['/students/stu-1']}>
        <Routes>
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify student name and admission info rendered
    expect(screen.getByRole('heading', { name: 'Aarav Patel' })).toBeInTheDocument();
    expect(screen.getByText(/Admission ADM-101/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Record Payment/i })).toBeInTheDocument();

    // Check 3 tabs exist
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Payments/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Previous Years/ })).toBeInTheDocument();

    // Verify previous year dues callout is rendered with simple terminology (stu-1 has 5000 pending from Class 4)
    expect(screen.getByText(/Last Year's Pending Fees:/)).toBeInTheDocument();

    // Verify overview fee figures
    expect(screen.getByText('Current Fee Account')).toBeInTheDocument();
    expect(screen.getByText('Payment Collection Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('UPI')).toBeInTheDocument();
    expect(screen.queryByText('Bank / Other')).not.toBeInTheDocument();
    expect(screen.queryByText('Opening Imported')).not.toBeInTheDocument();

    // Clicking "View Previous Years" button from overview warning switches to previous-years tab
    const viewPreviousBtn = screen.getByRole('button', { name: 'View Previous Years' });
    fireEvent.click(viewPreviousBtn);
    expect(screen.getByText('Historical Academic Years')).toBeInTheDocument();
    expect(screen.getByText('Academic Year 2025-26')).toBeInTheDocument();

    // Switch to Payments tab
    const paymentsTab = screen.getByRole('tab', { name: /Payments/ });
    fireEvent.click(paymentsTab);
    expect(screen.getByText('Recorded Fee Payments')).toBeInTheDocument();
    expect(screen.queryByText('Opening Fee History')).not.toBeInTheDocument();
    expect(screen.getByText('UPI-987654')).toBeInTheDocument();
    // Verify Edit and Delete payment action buttons are rendered
    expect(screen.getByRole('button', { name: 'Edit payment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete payment' })).toBeInTheDocument();
  });

  it('renders and validates AddHistoricalFeeModal for student with previous years', () => {
    render(
      <MemoryRouter initialEntries={['/students/stu-1']}>
        <Routes>
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Switch to Previous Years tab
    const prevYearsTab = screen.getByRole('tab', { name: /Previous Years/ });
    fireEvent.click(prevYearsTab);

    // Click "Add Previous-Year Fee" button
    const addHistoricalBtn = screen.getByRole('button', { name: /Add Previous-Year Fee/i });
    fireEvent.click(addHistoricalBtn);

    // Modal opens with student context and simplified Pending Fee Left input
    expect(screen.getByRole('heading', { name: 'Add Previous-Year Fee' })).toBeInTheDocument();
    expect(screen.getByText(/Admission: ADM-101/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Pending Fee Left/i)).toBeInTheDocument();
  });

  it('renders Remove All Students in administrative menu and opens confirmation modal with safety guard', async () => {
    render(
      <BrowserRouter>
        <StudentsPage />
      </BrowserRouter>
    );

    // Open administrative dropdown menu
    const menuBtn = screen.getByRole('button', { name: /Import \/ Export/i });
    fireEvent.pointerDown(menuBtn, { button: 0 });
    fireEvent.keyDown(menuBtn, { key: 'Enter' });

    // Click "Remove All Students" menu item
    const removeAllMenuItem = await screen.findByText('Remove All Students');
    expect(removeAllMenuItem).toBeInTheDocument();
    fireEvent.click(removeAllMenuItem);

    // Modal should be open
    expect(screen.getByRole('heading', { name: 'Remove All Students' })).toBeInTheDocument();
    expect(screen.getByText(/Bulk remove student records and rosters/i)).toBeInTheDocument();

    // Radio scope options should exist
    expect(screen.getByText(/AY 2026-27 Only/i)).toBeInTheDocument();
    expect(screen.getByText(/All Students \(Entire Database\)/i)).toBeInTheDocument();

    // Delete payment transactions checkbox should exist
    expect(screen.getByText(/Also delete linked fee payment transactions/i)).toBeInTheDocument();

    // Confirm button should initially be disabled until "REMOVE" is typed
    const confirmInput = screen.getByPlaceholderText('Type REMOVE to confirm');
    expect(confirmInput).toBeInTheDocument();

    // Look for button inside modal
    const dialogConfirmBtn = screen.getByRole('button', { name: /Remove All Students \(2\)/i });
    expect(dialogConfirmBtn).toBeDisabled();

    // Type "REMOVE"
    fireEvent.change(confirmInput, { target: { value: 'REMOVE' } });
    expect(dialogConfirmBtn).toBeEnabled();
  });

  it('disables Remove All Students menu item when there are no students in the system', async () => {
    useStudentStore.setState({
      students: [],
      enrollments: [],
    });

    render(
      <BrowserRouter>
        <StudentsPage />
      </BrowserRouter>
    );

    const menuBtn = screen.getByRole('button', { name: /Import \/ Export/i });
    fireEvent.pointerDown(menuBtn, { button: 0 });
    fireEvent.keyDown(menuBtn, { key: 'Enter' });

    const removeAllMenuItem = await screen.findByText('Remove All Students');
    expect(removeAllMenuItem.closest('[role="menuitem"]')).toHaveAttribute('data-disabled', '');
  });

  it('separates Gujarati and English mediums with top-level switcher and counts', () => {
    render(
      <BrowserRouter>
        <StudentsPage />
      </BrowserRouter>
    );

    // Verify medium switcher tabs exist with accurate live counts
    const allTab = screen.getByRole('tab', { name: /All Students/i });
    const gujTab = screen.getByRole('tab', { name: /Gujarati Medium/i });
    const engTab = screen.getByRole('tab', { name: /English Medium/i });

    expect(allTab).toBeInTheDocument();
    expect(gujTab).toBeInTheDocument();
    expect(engTab).toBeInTheDocument();

    // In All mode, both Aarav (English) and Bhavna (Gujarati) are visible
    expect(screen.getAllByText('Aarav Patel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bhavna Shah').length).toBeGreaterThan(0);

    // Medium badges are visible in All mode
    expect(screen.getAllByText(/ENG · English/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/GUJ · Gujarati/i).length).toBeGreaterThan(0);
  });

  it('switches to Gujarati Medium view and isolates Gujarati enrollments and classes', () => {
    render(
      <BrowserRouter>
        <StudentsPage />
      </BrowserRouter>
    );

    // Click Gujarati Medium tab
    const gujTab = screen.getByRole('tab', { name: /Gujarati Medium/i });
    fireEvent.click(gujTab);

    // Only Bhavna Shah (Gujarati) should be visible, Aarav Patel (English) is filtered out
    expect(screen.getAllByText('Bhavna Shah').length).toBeGreaterThan(0);
    expect(screen.queryByText('Aarav Patel')).not.toBeInTheDocument();

    // Gujarati overview banner should be displayed
    expect(screen.getByText('Gujarati Medium Summary')).toBeInTheDocument();
    expect(screen.getByText('Gujarati Students')).toBeInTheDocument();

    // Counter shows Gujarati Medium students
    expect(screen.getByText(/Gujarati Medium students/i)).toBeInTheDocument();
  });

  it('switches to English Medium view and isolates English enrollments and classes', () => {
    render(
      <BrowserRouter>
        <StudentsPage />
      </BrowserRouter>
    );

    // Click English Medium tab
    const engTab = screen.getByRole('tab', { name: /English Medium/i });
    fireEvent.click(engTab);

    // Only Aarav Patel (English) should be visible, Bhavna Shah (Gujarati) is filtered out
    expect(screen.getAllByText('Aarav Patel').length).toBeGreaterThan(0);
    expect(screen.queryByText('Bhavna Shah')).not.toBeInTheDocument();

    // English overview banner should be displayed
    expect(screen.getByText('English Medium Summary')).toBeInTheDocument();
    expect(screen.getByText('English Students')).toBeInTheDocument();

    // Counter shows English Medium students
    expect(screen.getByText(/English Medium students/i)).toBeInTheDocument();
  });

  it('operates search strictly within active medium workspace', () => {
    render(
      <BrowserRouter>
        <StudentsPage />
      </BrowserRouter>
    );

    // Switch to English Medium
    const engTab = screen.getByRole('tab', { name: /English Medium/i });
    fireEvent.click(engTab);

    // Search for Bhavna (who is Gujarati)
    const searchInput = screen.getByPlaceholderText('Search by student name or admission number...');
    fireEvent.change(searchInput, { target: { value: 'Bhavna' } });

    // Should return 0 results since Bhavna is Gujarati and we are in English workspace
    expect(screen.getByText('No students match your filters')).toBeInTheDocument();
    expect(screen.queryByText('Bhavna Shah')).not.toBeInTheDocument();
  });

  it('preselects Gujarati Medium in AddStudentModal when opened from Gujarati workspace', () => {
    render(
      <BrowserRouter>
        <StudentsPage />
      </BrowserRouter>
    );

    // Select Gujarati workspace
    const gujTab = screen.getByRole('tab', { name: /Gujarati Medium/i });
    fireEvent.click(gujTab);

    // Click Add Student
    const addBtn = screen.getByRole('button', { name: /Add Student/i });
    fireEvent.click(addBtn);

    // Modal should open with Gujarati radio option checked
    const gujRadio = screen.getByRole('radio', { name: /Gujarati Medium/i });
    expect(gujRadio).toHaveAttribute('aria-checked', 'true');

    const engRadio = screen.getByRole('radio', { name: /English Medium/i });
    expect(engRadio).toHaveAttribute('aria-checked', 'false');
  });

  it('preselects English Medium in AddStudentModal when opened from English workspace', () => {
    render(
      <BrowserRouter>
        <StudentsPage />
      </BrowserRouter>
    );

    // Select English workspace
    const engTab = screen.getByRole('tab', { name: /English Medium/i });
    fireEvent.click(engTab);

    // Click Add Student
    const addBtn = screen.getByRole('button', { name: /Add Student/i });
    fireEvent.click(addBtn);

    // Modal should open with English radio option checked
    const engRadio = screen.getByRole('radio', { name: /English Medium/i });
    expect(engRadio).toHaveAttribute('aria-checked', 'true');

    const gujRadio = screen.getByRole('radio', { name: /Gujarati Medium/i });
    expect(gujRadio).toHaveAttribute('aria-checked', 'false');
  });

  it('preserves student stored medium when editing an existing student', async () => {
    render(
      <BrowserRouter>
        <StudentsPage />
      </BrowserRouter>
    );

    // Switch to Gujarati workspace
    const gujTab = screen.getByRole('tab', { name: /Gujarati Medium/i });
    fireEvent.click(gujTab);

    // Switch to All Students
    const allTab = screen.getByRole('tab', { name: /All Students/i });
    fireEvent.click(allTab);

    // Open row actions menu for Aarav (English student)
    const actionBtns = screen.getAllByRole('button', { name: /Actions for Aarav Patel/i });
    expect(actionBtns.length).toBeGreaterThan(0);
    fireEvent.pointerDown(actionBtns[0], { button: 0 });
    fireEvent.keyDown(actionBtns[0], { key: 'Enter' });

    // Click "Edit Student"
    const editItem = await screen.findByText('Edit Student');
    fireEvent.click(editItem);

    // In Edit modal, Aarav's stored English medium must be preserved
    const engRadio = screen.getByRole('radio', { name: /English Medium/i });
    expect(engRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('displays prominent student medium badge on StudentDetailPage and preserves historical medium', () => {
    render(
      <MemoryRouter initialEntries={['/students/stu-1']}>
        <Routes>
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Student profile header contains the prominent medium badge
    expect(screen.getByLabelText('English Medium')).toBeInTheDocument();

    // Historical enrollment on Previous Years tab preserves and displays historical medium
    const prevYearsTab = screen.getByRole('tab', { name: /Previous Years/ });
    fireEvent.click(prevYearsTab);
    expect(screen.getByText('Class: Class 4')).toBeInTheDocument();
  });

  it('preserves spreadsheet row medium values and falls back to defaultMedium when empty in validateImportRows', async () => {
    const { validateImportRows } = await import('@/lib/student-import');

    const sampleRows = [
      ['Aarav Shah', 'Class 5', 'gujarati', '20000'],
      ['Zara Khan', 'Class 6', 'english', '25000'],
      ['Pooja Dave', 'Class 4', '', '18000'], // empty medium, should use fallback
    ];

    const mapping = {
      0: 'student_name' as const,
      1: 'class_name' as const,
      2: 'medium' as const,
      3: 'total_fee' as const,
    };

    const academicYears = useFinanceStore.getState().academicYears;

    // Test with defaultMedium = 'english'
    const validatedEnglishDefault = validateImportRows(
      sampleRows,
      mapping,
      [],
      [],
      'ay-2026',
      academicYears,
      '2026-06-01',
      { defaultMedium: 'english' }
    );

    expect(validatedEnglishDefault[0].medium).toBe('gujarati'); // row medium preserved!
    expect(validatedEnglishDefault[1].medium).toBe('english');  // row medium preserved!
    expect(validatedEnglishDefault[2].medium).toBe('english');  // fallback applied

    // Test with defaultMedium = 'gujarati'
    const validatedGujaratiDefault = validateImportRows(
      sampleRows,
      mapping,
      [],
      [],
      'ay-2026',
      academicYears,
      '2026-06-01',
      { defaultMedium: 'gujarati' }
    );

    expect(validatedGujaratiDefault[0].medium).toBe('gujarati'); // row medium preserved!
    expect(validatedGujaratiDefault[1].medium).toBe('english');  // row medium preserved!
    expect(validatedGujaratiDefault[2].medium).toBe('gujarati'); // fallback applied
  });

  it('renders student listings as professional clickable cards by default in responsive grid', () => {
    render(
      <BrowserRouter>
        <StudentsPage />
      </BrowserRouter>
    );

    // Cards view mode is active
    const cardsBtn = screen.getByRole('button', { name: /Cards view/i });
    expect(cardsBtn).toBeInTheDocument();

    // Verify card contents for Aarav Patel
    expect(screen.getByRole('heading', { name: 'Aarav Patel' })).toBeInTheDocument();
    expect(screen.getByText('ADM-101')).toBeInTheDocument();
    expect(screen.getAllByText('Class 5').length).toBeGreaterThan(0);
    expect(screen.getByText(/ENG · English/i)).toBeInTheDocument();
    expect(screen.getByText('60% paid')).toBeInTheDocument();
  });

  it('clicking a student card navigates to full student detail page', async () => {
    render(
      <MemoryRouter initialEntries={['/students']}>
        <Routes>
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Find Aarav Patel's card (button role or clickable card container)
    const aaravHeading = screen.getByRole('heading', { name: 'Aarav Patel' });
    const card = aaravHeading.closest('[role="button"]')!;
    expect(card).toBeInTheDocument();

    // Click the card
    fireEvent.click(card);

    // Canonical StudentDetailPage opens
    expect(await screen.findByText('Current Fee Account')).toBeInTheDocument();
    expect(screen.getByText('Payment Collection Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Profile & Enrollment Info')).toBeInTheDocument();

    // Header actions in student detail page
    expect(screen.getAllByRole('button', { name: /Record Payment/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();

    // Switch to Payments tab inside student detail page
    const paymentsTab = screen.getByRole('tab', { name: /Payments/i });
    fireEvent.click(paymentsTab);
    expect(await screen.findByText('Official fee transactions recorded through the finance ledger')).toBeInTheDocument();
    expect(screen.getAllByText('₹15,000').length).toBeGreaterThan(0);

    // Switch to Previous Years tab inside student detail page
    const prevYearsTab = screen.getByRole('tab', { name: /Previous Years/i });
    fireEvent.click(prevYearsTab);
    expect(await screen.findByText('Academic Year 2025-26')).toBeInTheDocument();
  });

  it('allows toggling between Cards view and Table view in toolbar', () => {
    render(
      <BrowserRouter>
        <StudentsPage />
      </BrowserRouter>
    );

    // Click Table view
    const tableBtn = screen.getByRole('button', { name: /Table view/i });
    fireEvent.click(tableBtn);

    // Table view should now be rendered with Table element
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Adm No.')).toBeInTheDocument();

    // Switch back to Cards view
    const cardsBtn = screen.getByRole('button', { name: /Cards view/i });
    fireEvent.click(cardsBtn);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('quick Pay Fee button on student card opens Record Payment modal without bubbling', async () => {
    render(
      <BrowserRouter>
        <StudentsPage />
      </BrowserRouter>
    );

    // Find quick "Pay Fee" buttons on cards that have pending fees
    const payButtons = screen.getAllByRole('button', { name: /Pay Fee/i });
    expect(payButtons.length).toBeGreaterThan(0);

    // Click quick pay button for Aarav
    fireEvent.click(payButtons[0]);

    // Record Payment modal should open directly
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Add Income')).toBeInTheDocument();
  });
});

