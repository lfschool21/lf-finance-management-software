import { useState, useMemo } from 'react';
import { Plus, TrendingUp, UtensilsCrossed, Clock, IndianRupee, Pencil, Loader2 } from 'lucide-react';
import { useFinanceStore } from '@/store/finance-store';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { AddIncomeModal } from '@/components/AddIncomeModal';
import { toast } from '@/hooks/use-toast';
import * as academicYearsService from '@/services/academicYears';
import type { IncomeEntry } from '@/types/finance';

export default function IncomePage() {
  const { incomeEntries, academicYears, currentYearId, refreshAcademicYears } = useFinanceStore();
  const [tab, setTab] = useState('tuition');
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<IncomeEntry | undefined>();
  const [lateYearId, setLateYearId] = useState<string | undefined>();

  // Edit target state
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetValue, setTargetValue] = useState('');
  const [targetSaving, setTargetSaving] = useState(false);

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

  function openEditTarget() {
    setTargetValue((currentYear?.targetTuitionFees || 0).toString());
    setShowTargetModal(true);
  }

  async function saveTarget() {
    if (!currentYearId) return;
    setTargetSaving(true);
    try {
      await academicYearsService.update(currentYearId, {
        target_tuition_fees: parseFloat(targetValue) || 0,
      });
      await refreshAcademicYears();
      toast({ title: '✅ Target updated' });
      setShowTargetModal(false);
    } catch {
      toast({ title: 'Failed to update target', variant: 'destructive' });
    }
    setTargetSaving(false);
  }

  const feeProgress = stats.target > 0 ? Math.round((stats.tuitionCollected || stats.tuitionTotal) / stats.target * 100) : 0;

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
        <StatCard title="Tuition Collected" value={formatINRAbbr(stats.tuitionTotal)} fullValue={formatINR(stats.tuitionTotal)} icon={IndianRupee} variant="income" />
        <StatCard title="Lunch Collected" value={formatINRAbbr(stats.lunchTotal)} fullValue={formatINR(stats.lunchTotal)} icon={UtensilsCrossed} variant="income" />
        <StatCard title="Target" value={formatINRAbbr(stats.target)} fullValue={formatINR(stats.target)} icon={TrendingUp} variant="balance" />
        <StatCard title="Remaining" value={formatINRAbbr(Math.max(0, stats.target - stats.tuitionTotal))} fullValue={formatINR(Math.max(0, stats.target - stats.tuitionTotal))} icon={Clock} variant="pending" />
      </div>

      {/* Fee progress bar with edit target button */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Tuition Fee Collection Progress</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-primary">
              {formatINR(stats.tuitionTotal)} / {formatINR(stats.target)}
            </span>
            <button
              onClick={openEditTarget}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Edit target"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div className="h-2 rounded-full bg-income transition-all" style={{ width: `${Math.min(100, feeProgress)}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {feeProgress}% collected • {formatINR(Math.max(0, stats.target - stats.tuitionTotal))} remaining
        </p>
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

      {/* Edit Target Modal */}
      <Dialog open={showTargetModal} onOpenChange={setShowTargetModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Tuition Fee Target</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">AY {currentYear?.label}</p>
          <Input
            type="number"
            placeholder="Target tuition fees (₹)"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
          />
          {targetValue && (
            <p className="text-xs text-muted-foreground">
              {formatINR(parseFloat(targetValue) || 0)}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTargetModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={saveTarget} disabled={targetSaving} className="flex-1">
              {targetSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
