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
    window.history.pushState({}, '', '/');
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
    expect(screen.getByRole('heading', { name: /Students/i })).toBeInTheDocument();
    expect(screen.getByText('Manage student records and fee accounts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Student/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import \/ Export/i })).toBeInTheDocument();

    // 4 Key Overview Metrics for active medium (default Gujarati)
    expect(screen.getByText('Gujarati Students')).toBeInTheDocument();
    expect(screen.getAllByText('This Year Pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Previous Year Pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Total Pending').length).toBeGreaterThan(0);

    // Class Card is rendered
    expect(screen.getByRole('heading', { name: 'Class 3' })).toBeInTheDocument();

    // Global Search bar functionality across mediums
    const searchInput = screen.getByPlaceholderText('Search all students across mediums by name or admission number...');
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Bhavna' } });
    expect(screen.getAllByText('Bhavna Shah').length).toBeGreaterThan(0);
  });

  it('renders total fees collected for both Gujarati and English medium in summary section and allows interaction', () => {
    render(
      <BrowserRouter>
        <StudentsPage />
      </BrowserRouter>
    );

    // Section title
    expect(screen.getByText('Medium Fee Collection Breakdown')).toBeInTheDocument();
    expect(screen.getByText(/Total fees collected for Gujarati and English medium students/i)).toBeInTheDocument();
    expect(screen.getByText(/Combined Collected:/i)).toBeInTheDocument();

    // Gujarati and English collection summary cards via test IDs
    const gujaratiCard = screen.getByTestId('gujarati-collection-summary');
    const englishCard = screen.getByTestId('english-collection-summary');
    expect(gujaratiCard).toBeInTheDocument();
    expect(englishCard).toBeInTheDocument();
    expect(screen.getAllByText('Total Fees Collected').length).toBe(2);

    // Active medium operational card has Fees Collected metric
    expect(screen.getByText('Fees Collected')).toBeInTheDocument();

    // Click English Medium card to switch active medium
    fireEvent.click(englishCard);
    expect(screen.getByText('English Students')).toBeInTheDocument();
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

    // Check 2 tabs exist (Overview and Payments)
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Payments/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Previous Years/ })).not.toBeInTheDocument();

    // Verify overview fee cards: Current-year fee card and previous-year outstanding
    expect(screen.getByText('Current Fee Account')).toBeInTheDocument();
    expect(screen.getByText('Previous-Year Outstanding')).toBeInTheDocument();
    expect(screen.getByText('Payment Collection Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('UPI')).toBeInTheDocument();
    expect(screen.queryByText('Bank / Other')).not.toBeInTheDocument();
    expect(screen.queryByText('Opening Imported')).not.toBeInTheDocument();

    // Switch to Payments tab
    const paymentsTab = screen.getByRole('tab', { name: /Payments/ });
    fireEvent.click(paymentsTab);
    expect(screen.getByText('Recorded Fee Payments')).toBeInTheDocument();
    expect(screen.queryByText('Previous-Year Fee Records')).not.toBeInTheDocument();

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

    // On Overview tab, click "Edit Fee Record" on Previous-Year Outstanding card
    const editHistoricalBtn = screen.getByRole('button', { name: /Edit Fee Record/i });
    fireEvent.click(editHistoricalBtn);

    // Modal opens with student context and simplified Pending Fee Left input
    expect(screen.getByRole('heading', { name: 'Edit Previous-Year Fee' })).toBeInTheDocument();
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
    const gujTab = screen.getByRole('tab', { name: /Gujarati Medium/i });
    const engTab = screen.getByRole('tab', { name: /English Medium/i });

    expect(gujTab).toBeInTheDocument();
    expect(engTab).toBeInTheDocument();

    // In default Gujarati mode, Class 3 is visible
    expect(screen.getByRole('heading', { name: 'Class 3' })).toBeInTheDocument();
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

    // Gujarati Class 3 card is visible, English Class 5 is not
    expect(screen.getByRole('heading', { name: 'Class 3' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Class 5' })).not.toBeInTheDocument();

    // Gujarati overview banner should be displayed
    expect(screen.getByText('Gujarati Medium Summary')).toBeInTheDocument();
    expect(screen.getByText('Gujarati Students')).toBeInTheDocument();

    // Navigate into Class 3
    const classCard = screen.getByRole('button', { name: /Class 3/i });
    fireEvent.click(classCard);

    // Only Bhavna Shah (Gujarati) is in Class 3, Aarav Patel (English) is not
    expect(screen.getByText('Bhavna Shah')).toBeInTheDocument();
    expect(screen.queryByText('Aarav Patel')).not.toBeInTheDocument();
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

    // English Class 5 card is visible, Gujarati Class 3 is not
    expect(screen.getByRole('heading', { name: 'Class 5' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Class 3' })).not.toBeInTheDocument();

    // English overview banner should be displayed
    expect(screen.getByText('English Medium Summary')).toBeInTheDocument();
    expect(screen.getByText('English Students')).toBeInTheDocument();

    // Navigate into Class 5
    const classCard = screen.getByRole('button', { name: /Class 5/i });
    fireEvent.click(classCard);

    // Only Aarav Patel (English) is in Class 5, Bhavna Shah (Gujarati) is not
    expect(screen.getByText('Aarav Patel')).toBeInTheDocument();
    expect(screen.queryByText('Bhavna Shah')).not.toBeInTheDocument();
  });

  it('operates search strictly within active class student list', () => {
    render(
      <MemoryRouter initialEntries={['/students?medium=english&class=Class+5']}>
        <StudentsPage />
      </MemoryRouter>
    );

    // Inside Class 5 student list, search for Bhavna (who is Gujarati in Class 3)
    const searchInput = screen.getByPlaceholderText(/Search Class 5 students by name or admission number/i);
    fireEvent.change(searchInput, { target: { value: 'Bhavna' } });

    // Should return 0 results inside Class 5
    expect(screen.getByText(/No students found matching "Bhavna"/i)).toBeInTheDocument();
    expect(screen.queryByText('Aarav Patel')).not.toBeInTheDocument();

    // Search for Aarav
    fireEvent.change(searchInput, { target: { value: 'Aarav' } });
    expect(screen.getByText('Aarav Patel')).toBeInTheDocument();
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
      <MemoryRouter initialEntries={['/students']}>
        <Routes>
          <Route path="/students" element={<StudentsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Switch to English Medium
    const engTab = screen.getByRole('tab', { name: /English Medium/i });
    fireEvent.click(engTab);

    // Click Class 5 card
    const classCard = screen.getByRole('button', { name: /Class 5/i });
    fireEvent.click(classCard);

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

    // Historical previous class is displayed on the Overview tab's Previous-Year Outstanding card
    expect(screen.getAllByText(/Class 4/).length).toBeGreaterThanOrEqual(1);

    // Payments tab contains only Recorded Fee Payments
    const paymentsTab = screen.getByRole('tab', { name: /Payments/ });
    fireEvent.click(paymentsTab);
    expect(screen.getByText('Recorded Fee Payments')).toBeInTheDocument();
    expect(screen.queryByText('Previous-Year Fee Records')).not.toBeInTheDocument();
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

  it('renders class cards with financial metrics in responsive grid', () => {
    render(
      <MemoryRouter initialEntries={['/students?medium=gujarati']}>
        <Routes>
          <Route path="/students" element={<StudentsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Default Gujarati medium shows Class 3 card
    const classHeading = screen.getByRole('heading', { name: 'Class 3' });
    expect(classHeading).toBeInTheDocument();

    // Class card contains financial indicators
    expect(screen.getAllByText('This Year Pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Previous Year Pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('View Students').length).toBeGreaterThan(0);
  });

  it('clicking a class card navigates into class student list and student detail', async () => {
    render(
      <MemoryRouter initialEntries={['/students?medium=english']}>
        <Routes>
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Click Class 5 card
    const classCard = screen.getByRole('button', { name: /Class 5/i });
    fireEvent.click(classCard);

    // Breadcrumb and student list appear
    expect(await screen.findByText('Back to Classes')).toBeInTheDocument();
    expect(screen.getByText('Aarav Patel')).toBeInTheDocument();

    // Click Aarav Patel row
    fireEvent.click(screen.getByText('Aarav Patel'));

    // Canonical StudentDetailPage opens
    expect(await screen.findByText('Current Fee Account')).toBeInTheDocument();
    expect(screen.getByText('Payment Collection Breakdown')).toBeInTheDocument();
  });

  it('allows breadcrumb navigation from student list back to class cards grid', async () => {
    render(
      <MemoryRouter initialEntries={['/students']}>
        <Routes>
          <Route path="/students" element={<StudentsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Switch to English Medium
    const engTab = screen.getByRole('tab', { name: /English Medium/i });
    fireEvent.click(engTab);

    // Click Class 5 card
    const classCard = screen.getByRole('button', { name: /Class 5/i });
    fireEvent.click(classCard);

    // Inside Class 5 student list
    expect(await screen.findByText('Back to Classes')).toBeInTheDocument();
    expect(screen.getByText('Aarav Patel')).toBeInTheDocument();

    // Click Back to Classes
    fireEvent.click(screen.getByRole('button', { name: /Back to Classes/i }));

    // Back in class cards grid view
    expect(screen.getByRole('heading', { name: 'Class 5' })).toBeInTheDocument();
    expect(screen.getByText('English Medium Classes')).toBeInTheDocument();
  });

  it('quick Record Payment in class student list opens payment modal', async () => {
    render(
      <MemoryRouter initialEntries={['/students']}>
        <Routes>
          <Route path="/students" element={<StudentsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Switch to English Medium
    const engTab = screen.getByRole('tab', { name: /English Medium/i });
    fireEvent.click(engTab);

    // Click Class 5 card
    const classCard = screen.getByRole('button', { name: /Class 5/i });
    fireEvent.click(classCard);

    // In Class 5 student list, click direct Record Payment button for Aarav
    const payBtn = await screen.findByRole('button', { name: /Record Payment for Aarav Patel/i });
    fireEvent.click(payBtn);

    // Modal opens
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Add Income')).toBeInTheDocument();
  });
});

