import { useState, useMemo } from 'react';
import { Plus, TrendingUp, UtensilsCrossed, Clock, IndianRupee } from 'lucide-react';
import { useFinanceStore } from '@/store/finance-store';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { AddIncomeModal } from '@/components/AddIncomeModal';
import type { IncomeEntry } from '@/types/finance';

export default function IncomePage() {
  const { incomeEntries, academicYears, currentYearId } = useFinanceStore();
  const [tab, setTab] = useState('tuition');
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<IncomeEntry | undefined>();
  const [lateYearId, setLateYearId] = useState<string | undefined>();

  const currentYear = academicYears.find((y) => y.id === currentYearId);

  const stats = useMemo(() => {
    const yearIncome = incomeEntries.filter((i) => i.academicYearId === currentYearId);
    const tuition = yearIncome.filter((i) => i.type === 'tuition');
    const lunch = yearIncome.filter((i) => i.type === 'lunch');
    const tuitionTotal = tuition.reduce((s, i) => s + i.amount, 0);
    const lunchTotal = lunch.reduce((s, i) => s + i.amount, 0);
    const target = currentYear?.targetTuitionFees || 0;
    return { tuitionTotal, lunchTotal, target, tuition, lunch };
  }, [incomeEntries, currentYearId, currentYear]);

  const pendingYears = useMemo(() => {
    return academicYears
      .filter((y) => y.status === 'pending_collections' || true) // check all years
      .map((y) => {
        const collected = incomeEntries
          .filter((i) => i.academicYearId === y.id && i.type === 'tuition')
          .reduce((s, i) => s + i.amount, 0);
        const remaining = Math.max(0, y.targetTuitionFees - collected);
        const startYear = y.startDate.getFullYear();
        const yearsOverdue = new Date().getFullYear() - startYear - 1;
        return { ...y, collected, remaining, yearsOverdue };
      })
      .filter((y) => y.remaining > 0);
  }, [academicYears, incomeEntries]);

  const filteredEntries = useMemo(() => {
    const yearIncome = incomeEntries.filter((i) => i.academicYearId === currentYearId);
    if (tab === 'tuition') return yearIncome.filter((i) => i.type === 'tuition');
    if (tab === 'lunch') return yearIncome.filter((i) => i.type === 'lunch');
    return [];
  }, [incomeEntries, currentYearId, tab]);

  function openAdd() {
    setEditEntry(undefined);
    setLateYearId(undefined);
    setShowModal(true);
  }

  function openEdit(entry: IncomeEntry) {
    setEditEntry(entry);
    setShowModal(true);
  }

  function openLatePayment(yearId: string) {
    setEditEntry(undefined);
    setLateYearId(yearId);
    setShowModal(true);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Income</h1>
          <p className="text-sm text-muted-foreground">AY {currentYear?.label}</p>
        </div>
        <Button className="gap-1.5 bg-income text-income-foreground hover:bg-income/90" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Income
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Tuition Collected" value={formatINRAbbr(stats.tuitionTotal)} icon={IndianRupee} variant="income" />
        <StatCard title="Lunch Collected" value={formatINRAbbr(stats.lunchTotal)} icon={UtensilsCrossed} variant="income" />
        <StatCard title="Target" value={formatINRAbbr(stats.target)} icon={TrendingUp} variant="balance" />
        <StatCard title="Remaining" value={formatINRAbbr(Math.max(0, stats.target - stats.tuitionTotal))} icon={Clock} variant="pending" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tuition">Tuition Fees</TabsTrigger>
          <TabsTrigger value="lunch">Lunch Fees</TabsTrigger>
          <TabsTrigger value="pending">
            Pending Collections
            {pendingYears.length > 0 && (
              <span className="ml-1.5 rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-bold text-warning-foreground">
                {pendingYears.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tuition" className="mt-4">
          <TransactionList entries={filteredEntries} onEdit={openEdit} />
        </TabsContent>

        <TabsContent value="lunch" className="mt-4">
          <TransactionList entries={filteredEntries} onEdit={openEdit} />
        </TabsContent>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {pendingYears.length === 0 ? (
            <EmptyState message="No pending collections! All fees are up to date." />
          ) : (
            pendingYears.map((y) => (
              <div
                key={y.id}
                className={cn(
                  'rounded-lg border bg-card p-4',
                  y.yearsOverdue >= 2 && 'border-expense/50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">AY {y.label}</h4>
                      {y.yearsOverdue >= 2 && (
                        <span className="rounded bg-expense/10 px-2 py-0.5 text-[10px] font-bold text-expense">
                          ⚠ Pending {y.yearsOverdue}+ years
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Target: {formatINR(y.targetTuitionFees)} • Collected: {formatINR(y.collected)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-bold text-warning">{formatINR(y.remaining)}</p>
                    <p className="text-xs text-muted-foreground">remaining</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => openLatePayment(y.id)}>
                  Record Late Payment
                </Button>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      <AddIncomeModal isOpen={showModal} onClose={() => setShowModal(false)} editEntry={editEntry} />
    </div>
  );
}

function TransactionList({
  entries,
  onEdit,
}: {
  entries: IncomeEntry[];
  onEdit: (entry: IncomeEntry) => void;
}) {
  if (entries.length === 0) return <EmptyState message="No entries yet. Add your first one!" />;

  const sorted = [...entries].sort((a, b) => b.date.getTime() - a.date.getTime());
  return (
    <div className="divide-y rounded-lg border bg-card">
      {sorted.map((entry) => (
        <div
          key={entry.id}
          className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
          onClick={() => onEdit(entry)}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{entry.notes || 'No description'}</p>
            <p className="text-xs text-muted-foreground">
              {entry.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <span className="font-mono text-sm font-semibold text-income">
            +{formatINR(entry.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-12">
      <IndianRupee className="mb-3 h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
