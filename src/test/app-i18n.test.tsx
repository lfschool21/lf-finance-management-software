import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useLanguageStore } from '@/store/language-store';
import { translations, useTranslation } from '@/lib/i18n';
import AppLayout from '@/components/AppLayout';
import IncomePage from '@/pages/IncomePage';
import ExpensesPage from '@/pages/ExpensesPage';
import TransfersPage from '@/pages/TransfersPage';
import RecoverablesPage from '@/pages/RecoverablesPage';
import BankBalancesPage from '@/pages/BankBalancesPage';
import { useFinanceStore } from '@/store/finance-store';

describe('Global Gujarati I18n & Language Switcher System', () => {
  beforeEach(() => {
    localStorage.clear();
    useLanguageStore.setState({ language: 'en' });
    document.documentElement.lang = 'en';
  });

  it('1. Language store manages language toggle and syncs document.documentElement.lang', () => {
    expect(useLanguageStore.getState().language).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    useLanguageStore.getState().setLanguage('gu');
    expect(useLanguageStore.getState().language).toBe('gu');
    expect(document.documentElement.lang).toBe('gu');

    useLanguageStore.getState().toggleLanguage();
    expect(useLanguageStore.getState().language).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('2. Complete key parity between English and Gujarati dictionaries', () => {
    const enKeys = Object.keys(translations.en) as (keyof typeof translations.en)[];
    const guKeys = Object.keys(translations.gu) as (keyof typeof translations.gu)[];

    expect(guKeys.length).toBe(enKeys.length);

    enKeys.forEach((key) => {
      expect(translations.gu[key]).toBeDefined();
      expect(typeof translations.gu[key]).toBe('string');
      expect((translations.gu[key] as string).trim().length).toBeGreaterThan(0);
    });
  });

  it('3. Guarantees 0 traditional Gujarati digits [૦-૯] across all translations (pure English numerals 0-9)', () => {
    const guValues = Object.values(translations.gu);
    const traditionalGujaratiDigitsRegex = /[૦-૯]/;

    guValues.forEach((val) => {
      const match = traditionalGujaratiDigitsRegex.test(val);
      expect(match).toBe(false);
    });
  });

  it('4. Global AppLayout renders EN | ગુજરાતી switcher and updates nav and descriptions appropriately', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout>
          <div>Dashboard Page Content</div>
        </AppLayout>
      </MemoryRouter>
    );

    // Initial English nav labels
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Students').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Income').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Expenses').length).toBeGreaterThan(0);

    // Find and click language switcher button
    const guButtons = screen.getAllByRole('button', { name: /Switch to Gujarati|ગુજરાતી/i });
    expect(guButtons.length).toBeGreaterThan(0);
    fireEvent.click(guButtons[0]);

    // Active state updated to Gujarati
    expect(useLanguageStore.getState().language).toBe('gu');
    expect(document.documentElement.lang).toBe('gu');

    // Standard navigation headers remain in clear English
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Students').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Income').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Expenses').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Balances').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Transfers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Recoverables').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reports').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
  });

  it('5. IncomePage renders accurately with English headers/actions and Gujarati explanatory subtext', () => {
    // English mode
    useLanguageStore.setState({ language: 'en' });
    const { unmount } = render(
      <MemoryRouter>
        <IncomePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Income' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Income/ })).toBeInTheDocument();
    expect(screen.getByText('Current-Year Tuition Target')).toBeInTheDocument();
    expect(screen.getByText('Total Fees Still To Collect')).toBeInTheDocument();
    unmount();

    // Switch to Gujarati
    useLanguageStore.setState({ language: 'gu' });
    render(
      <MemoryRouter>
        <IncomePage />
      </MemoryRouter>
    );

    // Headers and action buttons remain in English
    expect(screen.getByRole('heading', { level: 1, name: 'Income' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Income/ })).toBeInTheDocument();
    expect(screen.getByText('Current-Year Tuition Target')).toBeInTheDocument();
    expect(screen.getByText('Total Fees Still To Collect')).toBeInTheDocument();
    expect(screen.getByText('Current and Previous-Year Fees')).toBeInTheDocument();
    expect(screen.getByText('All Income')).toBeInTheDocument();

    // Explanatory guidance message appears in Gujarati
    expect(screen.getByText('હજી કોઈ એન્ટ્રી નથી. નવી એન્ટ્રી એડ કરો!')).toBeInTheDocument();
  });

  it('6. ExpensesPage renders accurately with English headers and Gujarati subtext', () => {
    // English mode
    useLanguageStore.setState({ language: 'en' });
    const { unmount } = render(
      <MemoryRouter>
        <ExpensesPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Expenses' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Add Expense/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('School').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
    unmount();

    // Switch to Gujarati
    useLanguageStore.setState({ language: 'gu' });
    render(
      <MemoryRouter>
        <ExpensesPage />
      </MemoryRouter>
    );

    // Headers and main tabs remain in English
    expect(screen.getByRole('heading', { level: 1, name: 'Expenses' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Add Expense/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('School').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);

    // Explanatory status text appears in Gujarati
    expect(screen.getByText('હજી કોઈ ખર્ચ નોંધાયેલ નથી.')).toBeInTheDocument();
  });

  it('7. Transfers and Recoverables pages render with English headers and Gujarati explanatory subtexts', () => {
    useLanguageStore.setState({ language: 'gu' });

    const { unmount: unmountTransfers } = render(
      <MemoryRouter>
        <TransfersPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Transfers & Accounts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Transfer Money/ })).toBeInTheDocument();
    expect(screen.getByText('Active Account Balances')).toBeInTheDocument();
    expect(screen.getByText('Transfer History')).toBeInTheDocument();
    // Subtext explaining transfer mechanism in Gujarati
    expect(screen.getByText('નફાને અસર કર્યા વગર કેશ અને બેન્ક એકાઉન્ટ્સ વચ્ચે રકમ ટ્રાન્સફર કરો')).toBeInTheDocument();
    unmountTransfers();

    const { unmount: unmountRecoverables } = render(
      <MemoryRouter>
        <RecoverablesPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Recoverables / Advances' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Give Advance/ })).toBeInTheDocument();
    expect(screen.getByText('Money Given')).toBeInTheDocument();
    // Subtext explaining recoverable mechanism in Gujarati
    expect(screen.getByText('આપેલ રકમ જે પરત મેળવવાની છે; આ કોઈ ખર્ચ નથી.')).toBeInTheDocument();
    expect(screen.getByText('કોઈ રિકવરેબલ એડવાન્સ નોંધાયેલ નથી.')).toBeInTheDocument();
    unmountRecoverables();
  });

  it('8. BankBalancesPage renders with English headers and Gujarati subtext', () => {
    useLanguageStore.setState({ language: 'gu' });

    render(
      <MemoryRouter>
        <BankBalancesPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Bank & Cash Balances' })).toBeInTheDocument();
    expect(screen.getByText('Total Liquid Balance')).toBeInTheDocument();
    expect(screen.getByText('Bank Total')).toBeInTheDocument();
    expect(screen.getByText('School Bank')).toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('Account Reconciliation')).toBeInTheDocument();
    // Explanatory subtext in Gujarati
    expect(screen.getByText('બધા સ્કૂલ અને પર્સનલ એકાઉન્ટ્સમાં ઉપલબ્ધ લિક્વિડ રકમ')).toBeInTheDocument();
  });
});
