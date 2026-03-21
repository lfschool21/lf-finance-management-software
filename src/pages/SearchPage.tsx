import { useState } from 'react';
import { Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react';
import { useFinanceStore } from '@/store/finance-store';
import { formatINR } from '@/utils/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function SearchPage() {
  const { incomeEntries, expenseEntries, transfers, accounts } = useFinanceStore();
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const results = query.length < 2 ? [] : [
    ...incomeEntries
      .filter((i) =>
        (i.notes || '').toLowerCase().includes(query.toLowerCase()) ||
        i.type.toLowerCase().includes(query.toLowerCase())
      )
      .map((i) => ({
        id: i.id,
        date: i.date,
        label: i.type === 'tuition' ? 'Tuition Fees' : 'Lunch Fees',
        desc: i.notes,
        amount: i.amount,
        isIncome: true,
      })),
    ...expenseEntries
      .filter((e) =>
        e.category.toLowerCase().includes(query.toLowerCase()) ||
        (e.description || '').toLowerCase().includes(query.toLowerCase())
      )
      .map((e) => ({
        id: e.id,
        date: e.date,
        label: e.category,
        desc: e.description,
        amount: e.amount,
        isIncome: false,
      })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">Search</h1>

      <div className="flex gap-2">
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

      {showFilters && (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Advanced filters coming soon — filter by date range, amount, category, type, and account.
        </div>
      )}

      {query.length >= 2 && (
        <p className="text-sm text-muted-foreground">
          Found {results.length} transaction{results.length !== 1 ? 's' : ''}
        </p>
      )}

      {results.length > 0 && (
        <div className="divide-y rounded-lg border bg-card">
          {results.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.label}</p>
                <p className="text-xs text-muted-foreground">
                  {r.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {r.desc && ` • ${r.desc}`}
                </p>
              </div>
              <span
                className={cn(
                  'font-mono text-sm font-semibold',
                  r.isIncome ? 'text-income' : 'text-expense'
                )}
              >
                {r.isIncome ? '+' : '-'}{formatINR(r.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {query.length >= 2 && results.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-12">
          <SearchIcon className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No results found for "{query}"</p>
        </div>
      )}
    </div>
  );
}
