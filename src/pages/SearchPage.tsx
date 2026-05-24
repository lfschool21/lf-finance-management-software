import { useState, useMemo } from 'react';
import { Search as SearchIcon, SlidersHorizontal, X, ArrowUpDown } from 'lucide-react';
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

type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest';

interface SearchResult {
  id: string;
  date: Date;
  label: string;
  desc: string;
  amount: number;
  type: 'income' | 'school_expense' | 'home_expense' | 'transfer';
  raw: IncomeEntry | ExpenseEntry | Transfer;
}

export default function SearchPage() {
  const { incomeEntries, expenseEntries, transfers, accounts, academicYears } = useFinanceStore();
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set(['income', 'school_expense', 'home_expense', 'transfer']));
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
    return Array.from(cats).sort();
  }, [expenseEntries]);

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
    const hasFilters = showFilters && (dateFrom || dateTo || amountMin || amountMax || selectedAccountId !== 'all' || selectedYearId !== 'all' || selectedCategories.size > 0 || typeFilters.size < 4);

    if (!hasQuery && !hasFilters) return [];

    let items: SearchResult[] = [];

    // Income entries
    if (typeFilters.has('income')) {
      incomeEntries.forEach((i) => {
        const matchText = !hasQuery || [i.type, i.notes, ...(i.tags || [])].some((s) => (s || '').toLowerCase().includes(q));
        if (!matchText) return;
        items.push({
          id: i.id, date: i.date,
          label: i.type === 'tuition' ? 'Tuition Fees' : 'Lunch Fees',
          desc: i.notes, amount: i.amount,
          type: 'income', raw: i,
        });
      });
    }

    // Expense entries
    expenseEntries.forEach((e) => {
      const expType = e.expenseType === 'school' ? 'school_expense' : 'home_expense';
      if (!typeFilters.has(expType)) return;
      const matchText = !hasQuery || [e.category, e.description, ...(e.tags || [])].some((s) => (s || '').toLowerCase().includes(q));
      if (!matchText) return;
      if (selectedCategories.size > 0 && !selectedCategories.has(e.category)) return;
      items.push({
        id: e.id, date: e.date, label: e.category,
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
        items.push({
          id: t.id, date: t.date, label: `${fromName} → ${toName}`,
          desc: t.notes, amount: t.amount,
          type: 'transfer', raw: t,
        });
      });
    }

    // Apply filters
    if (dateFrom) items = items.filter((r) => r.date >= new Date(dateFrom));
    if (dateTo) items = items.filter((r) => r.date <= new Date(dateTo));
    if (amountMin) items = items.filter((r) => r.amount >= parseFloat(amountMin));
    if (amountMax) items = items.filter((r) => r.amount <= parseFloat(amountMax));

    if (selectedAccountId !== 'all') {
      items = items.filter((r) => {
        if ('accountId' in r.raw) return (r.raw as IncomeEntry | ExpenseEntry).accountId === selectedAccountId;
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
        return true;
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
  }, [query, showFilters, dateFrom, dateTo, amountMin, amountMax, typeFilters, selectedAccountId, selectedYearId, selectedCategories, sortBy, incomeEntries, expenseEntries, transfers, accounts]);

  function clearFilters() {
    setDateFrom(''); setDateTo('');
    setAmountMin(''); setAmountMax('');
    setTypeFilters(new Set(['income', 'school_expense', 'home_expense', 'transfer']));
    setSelectedAccountId('all');
    setSelectedYearId('all');
    setSelectedCategories(new Set());
    setSortBy('newest');
  }

  function handleClick(r: SearchResult) {
    if (r.type === 'income') setEditIncome(r.raw as IncomeEntry);
    else if (r.type === 'transfer') setEditTransfer(r.raw as Transfer);
    else setEditExpense(r.raw as ExpenseEntry);
  }

  const typeColors: Record<string, string> = {
    income: 'text-income',
    school_expense: 'text-expense',
    home_expense: 'text-warning',
    transfer: 'text-primary',
  };

  const typeLabels: Record<string, string> = {
    income: 'Income',
    school_expense: 'School',
    home_expense: 'Home',
    transfer: 'Transfer',
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">Search</h1>

      <div className="flex min-w-0 gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions, categories, notes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(showFilters && 'bg-accent')}
        >
          <SlidersHorizontal className="h-4 w-4" />
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
              {(['income', 'school_expense', 'home_expense', 'transfer'] as const).map((t) => (
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
              <Label className="text-xs">Academic Year</Label>
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
            <div
              key={r.id}
              className="flex min-w-0 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
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
                </p>
              </div>
              <span className={cn('money-fit max-w-[42%] text-right font-mono text-sm font-semibold', typeColors[r.type])}>
                {r.type === 'income' ? '+' : r.type === 'transfer' ? '' : '-'}{formatINR(r.amount)}
              </span>
            </div>
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
