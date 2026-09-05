import { useState, useMemo } from 'react';
import { Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react';
import { useFinanceStore } from '@/store/finance-store';
import { formatINR } from '@/utils/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AddIncomeModal } from '@/components/AddIncomeModal';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import { TransferModal } from '@/components/TransferModal';
import type { IncomeEntry, ExpenseEntry, Transfer } from '@/types/finance';
import type { Recoverable, RecoverableRepayment } from '@/types/finance';
import { dateKey, incomeSource, INCOME_SOURCE_LABELS } from '@/lib/finance-domain';
import { useNavigate } from 'react-router-dom';
import { useStudentStore } from '@/store/student-store';

type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest';
const ALL_TYPES = ['income', 'school_expense', 'home_expense', 'transfer', 'recoverable_advance', 'recoverable_repayment'] as const;

interface SearchResult {
  id: string;
  date: Date;
  label: string;
  desc: string;
  amount: number;
  type: 'income' | 'school_expense' | 'home_expense' | 'transfer' | 'recoverable_advance' | 'recoverable_repayment';
  raw: IncomeEntry | ExpenseEntry | Transfer | Recoverable | RecoverableRepayment;
}

export default function SearchPage() {
  const { incomeEntries, expenseEntries, transfers, recoverables, recoverableRepayments, accounts, academicYears } = useFinanceStore();
  const { students, enrollments } = useStudentStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set(ALL_TYPES));
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [selectedYearId, setSelectedYearId] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('newest');

  // Edit modals
  const [editIncome, setEditIncome] = useState<IncomeEntry | undefined>();
  const [editExpense, setEditExpense] = useState<ExpenseEntry | undefined>();
  const [editTransfer, setEditTransfer] = useState<Transfer | undefined>();

  function toggleType(t: string) {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    expenseEntries.forEach((e) => cats.add(e.category));
    incomeEntries.forEach((entry) => cats.add(INCOME_SOURCE_LABELS[incomeSource(entry)]));
    cats.add('Transfer'); cats.add('Recoverable Advance'); cats.add('Recoverable Repayment');
    return Array.from(cats).sort();
  }, [expenseEntries, incomeEntries]);

  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  function toggleCategory(c: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const hasQuery = q.length >= 2;
    const hasFilters = showFilters && (dateFrom || dateTo || amountMin || amountMax || selectedAccountId !== 'all' || selectedYearId !== 'all' || selectedCategories.size > 0 || typeFilters.size < ALL_TYPES.length);

    if (!hasQuery && !hasFilters) return [];

    let items: SearchResult[] = [];

    // Income entries
    if (typeFilters.has('income')) {
      incomeEntries.forEach((i) => {
        const sourceLabel = INCOME_SOURCE_LABELS[incomeSource(i)];
        const enrollment = enrollments.find((item) => item.id === i.studentEnrollmentId);
        const student = students.find((item) => item.id === enrollment?.studentId);
        const account = accounts.find((item) => item.id === i.accountId);
        const matchText = !hasQuery || [i.category, sourceLabel, i.notes, student?.fullName, student?.admissionNumber, enrollment?.className, i.paymentMethod, account?.name, ...(i.tags || [])].some((s) => (s || '').toLowerCase().includes(q));
        if (!matchText) return;
        if (selectedCategories.size > 0 && !selectedCategories.has(sourceLabel)) return;
        items.push({
          id: `income-${i.id}`, date: i.date,
          label: student?.fullName || sourceLabel,
          desc: student ? `${sourceLabel} · ${i.paymentMethod?.replace('_', ' ') || 'Unknown / Not Recorded'} · ${account?.name || 'Unknown account'}` : i.notes, amount: i.amount,
          type: 'income', raw: i,
        });
      });
    }

    // Expense entries
    expenseEntries.forEach((e) => {
      const expType = e.expenseType === 'school' ? 'school_expense' : 'home_expense';
      if (!typeFilters.has(expType)) return;
      const matchText = !hasQuery || [e.category, e.subCategory, e.description, ...(e.tags || [])].some((s) => (s || '').toLowerCase().includes(q));
      if (!matchText) return;
      if (selectedCategories.size > 0 && !selectedCategories.has(e.category)) return;
      items.push({
        id: `expense-${e.id}`, date: e.date, label: e.subCategory ? `${e.category}: ${e.subCategory}` : e.category,
        desc: e.description, amount: e.amount,
        type: expType, raw: e,
      });
    });

    // Transfers
    if (typeFilters.has('transfer')) {
      transfers.forEach((t) => {
        const fromName = accounts.find((a) => a.id === t.fromAccountId)?.name || '';
        const toName = accounts.find((a) => a.id === t.toAccountId)?.name || '';
        const matchText = !hasQuery || [fromName, toName, t.notes, t.category].some((s) => (s || '').toLowerCase().includes(q));
        if (!matchText) return;
        if (selectedCategories.size > 0 && !selectedCategories.has('Transfer')) return;
        items.push({
          id: `transfer-${t.id}`, date: t.date, label: `${fromName} → ${toName}`,
          desc: t.notes, amount: t.amount,
          type: 'transfer', raw: t,
        });
      });
    }

    if (typeFilters.has('recoverable_advance')) {
      recoverables.forEach((r) => {
        const accountName = accounts.find((a) => a.id === r.sourceAccountId)?.name || '';
        if (hasQuery && ![r.partyName, r.notes, accountName, 'recoverable advance'].some((s) => s.toLowerCase().includes(q))) return;
        if (selectedCategories.size > 0 && !selectedCategories.has('Recoverable Advance')) return;
        items.push({ id: `advance-${r.id}`, date: r.dateGiven, label: `Advance — ${r.partyName}`, desc: r.notes, amount: r.originalAmount, type: 'recoverable_advance', raw: r });
      });
    }
    if (typeFilters.has('recoverable_repayment')) {
      recoverableRepayments.forEach((r) => {
        const parent = recoverables.find((advance) => advance.id === r.recoverableId);
        const accountName = accounts.find((a) => a.id === r.accountId)?.name || '';
        if (hasQuery && ![parent?.partyName || '', r.notes, accountName, 'recoverable repayment'].some((s) => s.toLowerCase().includes(q))) return;
        if (selectedCategories.size > 0 && !selectedCategories.has('Recoverable Repayment')) return;
        items.push({ id: `repayment-${r.id}`, date: r.date, label: `Repayment — ${parent?.partyName || 'Recoverable'}`, desc: r.notes, amount: r.amount, type: 'recoverable_repayment', raw: r });
      });
    }

    // Apply filters
    if (dateFrom) items = items.filter((r) => dateKey(r.date) >= dateFrom);
    if (dateTo) items = items.filter((r) => dateKey(r.date) <= dateTo);
    if (amountMin) items = items.filter((r) => r.amount >= parseFloat(amountMin));
    if (amountMax) items = items.filter((r) => r.amount <= parseFloat(amountMax));

    if (selectedAccountId !== 'all') {
      items = items.filter((r) => {
        if ('accountId' in r.raw) return (r.raw as IncomeEntry | ExpenseEntry | RecoverableRepayment).accountId === selectedAccountId;
        if ('sourceAccountId' in r.raw) return (r.raw as Recoverable).sourceAccountId === selectedAccountId;
        if ('fromAccountId' in r.raw) {
          const tr = r.raw as Transfer;
          return tr.fromAccountId === selectedAccountId || tr.toAccountId === selectedAccountId;
        }
        return true;
      });
    }

    if (selectedYearId !== 'all') {
      items = items.filter((r) => {
        if ('academicYearId' in r.raw) return (r.raw as IncomeEntry | ExpenseEntry).academicYearId === selectedYearId;
        const year = academicYears.find((candidate) => candidate.id === selectedYearId);
        return !!year && dateKey(r.date) >= dateKey(year.startDate) && dateKey(r.date) <= dateKey(year.endDate);
      });
    }

    // Sort
    switch (sortBy) {
      case 'newest': items.sort((a, b) => b.date.getTime() - a.date.getTime()); break;
      case 'oldest': items.sort((a, b) => a.date.getTime() - b.date.getTime()); break;
      case 'highest': items.sort((a, b) => b.amount - a.amount); break;
      case 'lowest': items.sort((a, b) => a.amount - b.amount); break;
    }

    return items;
  }, [query, showFilters, dateFrom, dateTo, amountMin, amountMax, typeFilters, selectedAccountId, selectedYearId, selectedCategories, sortBy, incomeEntries, expenseEntries, transfers, recoverables, recoverableRepayments, accounts, academicYears, enrollments, students]);

  function clearFilters() {
    setDateFrom(''); setDateTo('');
    setAmountMin(''); setAmountMax('');
    setTypeFilters(new Set(ALL_TYPES));
    setSelectedAccountId('all');
    setSelectedYearId('all');
    setSelectedCategories(new Set());
    setSortBy('newest');
  }

  function handleClick(r: SearchResult) {
    if (r.type === 'income') setEditIncome(r.raw as IncomeEntry);
    else if (r.type === 'transfer') setEditTransfer(r.raw as Transfer);
    else if (r.type.startsWith('recoverable_')) navigate('/recoverables');
    else setEditExpense(r.raw as ExpenseEntry);
  }

  const typeColors: Record<string, string> = {
    income: 'text-income',
    school_expense: 'text-expense',
    home_expense: 'text-warning',
    transfer: 'text-primary',
    recoverable_advance: 'text-warning',
    recoverable_repayment: 'text-primary',
  };

  const typeLabels: Record<string, string> = {
    income: 'Income',
    school_expense: 'School',
    home_expense: 'Home',
    transfer: 'Transfer',
    recoverable_advance: 'Advance',
    recoverable_repayment: 'Recoverable Repayment',
  };
  const activeFilterCount = Number(!!dateFrom) + Number(!!dateTo) + Number(!!amountMin) + Number(!!amountMax)
    + Number(selectedAccountId !== 'all') + Number(selectedYearId !== 'all') + selectedCategories.size
    + Number(typeFilters.size < ALL_TYPES.length);

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">Search</h1>

      <div className="flex min-w-0 gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions, student, admission number..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={cn('gap-1.5 px-3', showFilters && 'bg-accent')}
          aria-expanded={showFilters}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden min-[380px]:inline">Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
          <span className="sr-only min-[380px]:hidden">Show filters{activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}</span>
        </Button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Advanced Filters</h3>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">Clear All</Button>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-4">
            <div>
              <Label className="text-xs">From Date</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To Date</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Min Amount</Label>
              <Input type="number" placeholder="₹0" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Max Amount</Label>
              <Input type="number" placeholder="₹∞" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-xs">Type</Label>
            <div className="flex flex-wrap gap-3">
              {(['income', 'school_expense', 'home_expense', 'transfer', 'recoverable_advance', 'recoverable_repayment'] as const).map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={typeFilters.has(t)} onCheckedChange={() => toggleType(t)} />
                  {typeLabels[t]}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Transaction Academic Year</Label>
              <Select value={selectedYearId} onValueChange={setSelectedYearId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {academicYears.map((y) => (<SelectItem key={y.id} value={y.id}>AY {y.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sort</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="highest">Highest Amount</SelectItem>
                  <SelectItem value="lowest">Lowest Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {allCategories.length > 0 && (
            <div>
              <Label className="mb-2 block text-xs">Categories</Label>
              <div className="flex flex-wrap gap-1.5">
                {allCategories.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleCategory(c)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-all',
                      selectedCategories.has(c)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(query.length >= 2 || (showFilters && results.length > 0)) && (
        <p className="text-sm text-muted-foreground">
          Found {results.length} result{results.length !== 1 ? 's' : ''}
        </p>
      )}

      {results.length > 0 && (
        <div className="divide-y rounded-lg border bg-card">
          {results.map((r) => (
            <button
              type="button"
              key={r.id}
              className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => handleClick(r)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="text-fit text-sm font-medium">{r.label}</p>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${typeColors[r.type]}`}>
                    {typeLabels[r.type]}
                  </span>
                </div>
                <p className="text-fit text-xs text-muted-foreground">
                  {r.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {r.desc && ` • ${r.desc}`}
                  {r.type === 'income' && (r.raw as IncomeEntry).isLateCollection && ` • For AY ${academicYears.find((year) => year.id === (r.raw as IncomeEntry).originalYearId)?.label || '—'}`}
                </p>
              </div>
              <span className={cn('money-fit max-w-[42%] text-right font-mono text-sm font-semibold', typeColors[r.type])}>
                {r.type === 'income' || r.type === 'recoverable_repayment' ? '+' : r.type === 'transfer' ? '' : '-'}{formatINR(r.amount)}
              </span>
            </button>
          ))}
        </div>
      )}

      {query.length >= 2 && results.length === 0 && !showFilters && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-12">
          <SearchIcon className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No results found for "{query}"</p>
        </div>
      )}

      <AddIncomeModal isOpen={!!editIncome} onClose={() => setEditIncome(undefined)} editEntry={editIncome} />
      <AddExpenseModal isOpen={!!editExpense} onClose={() => setEditExpense(undefined)} editEntry={editExpense} />
      <TransferModal isOpen={!!editTransfer} onClose={() => setEditTransfer(undefined)} editEntry={editTransfer} />
    </div>
  );
}
