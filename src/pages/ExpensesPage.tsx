import { useState, useMemo } from 'react';
import { Plus, School, Home, TrendingDown, Repeat } from 'lucide-react';
import { useFinanceStore } from '@/store/finance-store';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import type { ExpenseEntry } from '@/types/finance';

export default function ExpensesPage() {
  const { expenseEntries, currentYearId, academicYears } = useFinanceStore();
  const [tab, setTab] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<ExpenseEntry | undefined>();
  const currentYear = academicYears.find((y) => y.id === currentYearId);

  const stats = useMemo(() => {
    const year = expenseEntries.filter((e) => e.academicYearId === currentYearId);
    const school = year.filter((e) => e.expenseType === 'school').reduce((s, e) => s + e.amount, 0);
    const home = year.filter((e) => e.expenseType === 'home').reduce((s, e) => s + e.amount, 0);
    return { school, home, total: school + home, entries: year };
  }, [expenseEntries, currentYearId]);

  const filtered = useMemo(() => {
    if (tab === 'school') return stats.entries.filter((e) => e.expenseType === 'school');
    if (tab === 'home') return stats.entries.filter((e) => e.expenseType === 'home');
    if (tab === 'recurring') return stats.entries.filter((e) => e.isRecurringInstance);
    return stats.entries;
  }, [stats.entries, tab]);

  const sorted = [...filtered].sort((a, b) => b.date.getTime() - a.date.getTime());

  function openAdd() {
    setEditEntry(undefined);
    setShowModal(true);
  }

  function openEdit(entry: ExpenseEntry) {
    setEditEntry(entry);
    setShowModal(true);
  }

  function handleEditExisting(entry: ExpenseEntry) {
    setEditEntry(entry);
    setShowModal(true);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground">AY {currentYear?.label}</p>
        </div>
        <Button variant="destructive" className="gap-1.5" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard title="School" value={formatINRAbbr(stats.school)} icon={School} variant="expense" />
        <StatCard title="Home" value={formatINRAbbr(stats.home)} icon={Home} variant="pending" />
        <StatCard title="Total" value={formatINRAbbr(stats.total)} icon={TrendingDown} variant="expense" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({stats.entries.length})</TabsTrigger>
          <TabsTrigger value="school">🏫 School</TabsTrigger>
          <TabsTrigger value="home">🏠 Home</TabsTrigger>
          <TabsTrigger value="recurring">
            <Repeat className="mr-1 h-3.5 w-3.5" /> Recurring
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-12">
              <TrendingDown className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y rounded-lg border bg-card">
              {sorted.map((entry) => (
                <div
                  key={entry.id}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  onClick={() => openEdit(entry)}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
                      entry.expenseType === 'school' ? 'bg-primary/10' : 'bg-warning/10'
                    )}
                  >
                    {entry.expenseType === 'school' ? (
                      <School className="h-4 w-4 text-primary" />
                    ) : (
                      <Home className="h-4 w-4 text-warning" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{entry.category}</p>
                      {entry.isRecurringInstance && (
                        <Repeat className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {entry.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {entry.description && ` • ${entry.description}`}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-expense">
                    -{formatINR(entry.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddExpenseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        editEntry={editEntry}
        onEditExisting={handleEditExisting}
      />
    </div>
  );
}
