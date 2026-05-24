import { useState, useMemo } from 'react';
import { Plus, TrendingUp, UtensilsCrossed, Clock, IndianRupee, Pencil, Loader2, History } from 'lucide-react';
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
  const { incomeEntries, academicYears, currentYearId, refreshAcademicYears, getPendingForYear } = useFinanceStore();
  const [tab, setTab] = useState('tuition');
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<IncomeEntry | undefined>();
  const [lateYearId, setLateYearId] = useState<string | undefined>();

  // Edit target state
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetValue, setTargetValue] = useState('');
  const [targetSaving, setTargetSaving] = useState(false);

  // Edit carry-forward fees state
  const [showCarryModal, setShowCarryModal] = useState(false);
  const [carryYearId, setCarryYearId] = useState<string | null>(null);
  const [carryValue, setCarryValue] = useState('');
  const [carrySaving, setCarrySaving] = useState(false);

  const currentYear = academicYears.find((y) => y.id === currentYearId);

  const stats = useMemo(() => {
    // Exclude late collections (they belong to a previous year) from this year's progress
    const yearIncome = incomeEntries.filter(
      (i) => i.academicYearId === currentYearId && !i.isLateCollection
    );
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
        const info = getPendingForYear(y.id);
        const startYear = y.startDate.getFullYear();
        const yearsOverdue = new Date().getFullYear() - startYear - 1;
        return {
          ...y,
          collected: info.collected,
          remainingFromTarget: info.targetGap,
          carryForward: info.carryForward,
          totalTarget: info.totalOwed,
          totalRemaining: info.remaining,
          yearsOverdue,
        };
      })
      .filter((y) => y.totalRemaining > 0);
  }, [academicYears, incomeEntries, getPendingForYear]);

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

  function openEditCarry(yearId: string, currentCarry: number) {
    setCarryYearId(yearId);
    setCarryValue(currentCarry > 0 ? currentCarry.toString() : '');
    setShowCarryModal(true);
  }

  async function saveCarry() {
    if (!carryYearId) return;
    setCarrySaving(true);
    try {
      await academicYearsService.update(carryYearId, {
        carry_forward_fees: parseFloat(carryValue) || 0,
      });
      await refreshAcademicYears();
      toast({ title: '✅ Carry-forward fees updated' });
      setShowCarryModal(false);
    } catch {
      toast({ title: 'Failed to update carry-forward fees', variant: 'destructive' });
    }
    setCarrySaving(false);
  }

  const feeProgress = stats.target > 0 ? Math.round((stats.tuitionTotal / stats.target) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Income</h1>
          <p className="text-fit text-sm text-muted-foreground">AY {currentYear?.label}</p>
        </div>
        <Button className="w-full gap-1.5 bg-income text-income-foreground hover:bg-income/90 sm:w-auto" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Income
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Tuition Collected" value={formatINRAbbr(stats.tuitionTotal)} fullValue={formatINR(stats.tuitionTotal)} icon={IndianRupee} variant="income" />
        <StatCard title="Lunch Collected" value={formatINRAbbr(stats.lunchTotal)} fullValue={formatINR(stats.lunchTotal)} icon={UtensilsCrossed} variant="income" />
        <StatCard title="Target" value={formatINRAbbr(stats.target)} fullValue={formatINR(stats.target)} icon={TrendingUp} variant="balance" />
        <StatCard title="Remaining" value={formatINRAbbr(Math.max(0, stats.target - stats.tuitionTotal))} fullValue={formatINR(Math.max(0, stats.target - stats.tuitionTotal))} icon={Clock} variant="pending" />
      </div>

      {/* Fee progress bar with edit target button */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium">Tuition Fee Collection Progress</span>
          <div className="flex min-w-0 items-center gap-2">
            <span className="money-fit font-mono text-sm font-bold text-primary">
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
        <TabsList className="w-full sm:w-auto">
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
            pendingYears.map((y) => {
              const collectProgress = y.totalTarget > 0
                ? Math.min(100, Math.round((y.collected / y.totalTarget) * 100))
                : 0;
              return (
                <div
                  key={y.id}
                  className={cn(
                    'rounded-lg border bg-card p-4',
                    y.yearsOverdue >= 2 && 'border-expense/50'
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h4 className="font-semibold">AY {y.label}</h4>
                        {y.yearsOverdue >= 2 && (
                          <span className="rounded bg-expense/10 px-2 py-0.5 text-[10px] font-bold text-expense">
                            ⚠ Pending {y.yearsOverdue}+ years
                          </span>
                        )}
                      </div>
                      <p className="text-fit text-sm text-muted-foreground">
                        Collected: {formatINR(y.collected)} / {formatINR(y.totalTarget)}
                      </p>
                    </div>
                    <div className="min-w-0 text-left sm:text-right">
                      <p className="money-fit font-mono text-lg font-bold text-warning">{formatINR(y.totalRemaining)}</p>
                      <p className="text-xs text-muted-foreground">still pending</p>
                    </div>
                  </div>

                  {/* Collection progress bar */}
                  <div className="mt-3">
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-income transition-all"
                        style={{ width: `${collectProgress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {collectProgress}% collected
                    </p>
                  </div>

                  {/* Breakdown: target gap vs carry-forward */}
                  {y.carryForward > 0 && (
                    <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs space-y-1">
                      <div className="flex flex-col gap-1 text-muted-foreground min-[420px]:flex-row min-[420px]:justify-between">
                        <span>Remaining from this year's target</span>
                        <span className="money-fit font-mono">{formatINR(y.remainingFromTarget)}</span>
                      </div>
                      <div className="flex flex-col gap-1 text-warning min-[420px]:flex-row min-[420px]:justify-between">
                        <span className="flex items-center gap-1">
                          <History className="h-3 w-3" /> Carry-forward from previous year
                        </span>
                        <span className="money-fit font-mono">{formatINR(y.carryForward)}</span>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openLatePayment(y.id)}>
                      Record Late Payment
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-muted-foreground"
                      onClick={() => openEditCarry(y.id, y.carryForward)}
                      title="Set last year's remaining fees carried forward"
                    >
                      <History className="h-3.5 w-3.5" />
                      {y.carryForward > 0 ? 'Edit Carry-Forward' : 'Add Carry-Forward'}
                    </Button>
                  </div>
                </div>
              );
            })
          )}

          {/* Allow setting carry-forward for years with no current gap (fully collected from target) */}
          {academicYears.filter((y) => !pendingYears.find((p) => p.id === y.id)).length > 0 && (
            <div className="rounded-lg border border-dashed bg-card/50 p-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Add carry-forward fees for years that appear fully collected but have last-year balances still outstanding:
              </p>
              <div className="flex flex-wrap gap-2">
                {academicYears
                  .filter((y) => !pendingYears.find((p) => p.id === y.id))
                  .map((y) => (
                    <Button
                      key={y.id}
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() => openEditCarry(y.id, y.carryForwardFees || 0)}
                    >
                      <History className="h-3 w-3" /> AY {y.label}
                    </Button>
                  ))}
              </div>
            </div>
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

      {/* Edit Carry-Forward Fees Modal */}
      <Dialog open={showCarryModal} onOpenChange={setShowCarryModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Last Year's Remaining Fees</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter the amount still owed from last year that was not collected — this will appear as an
            additional pending amount for AY {academicYears.find((y) => y.id === carryYearId)?.label}.
            Set to 0 to clear it.
          </p>
          <Input
            type="number"
            placeholder="Carry-forward amount (₹)"
            value={carryValue}
            onChange={(e) => setCarryValue(e.target.value)}
          />
          {carryValue && (
            <p className="text-xs text-muted-foreground">
              {formatINR(parseFloat(carryValue) || 0)}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCarryModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={saveCarry} disabled={carrySaving} className="flex-1">
              {carrySaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
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
          className="flex min-w-0 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
          onClick={() => onEdit(entry)}
        >
          <div className="min-w-0 flex-1">
            <p className="text-fit text-sm font-medium">{entry.notes || 'No description'}</p>
            <p className="text-xs text-muted-foreground">
              {entry.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <span className="money-fit max-w-[45%] text-right font-mono text-sm font-semibold text-income">
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
