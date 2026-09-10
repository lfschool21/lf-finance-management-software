import { useState, useMemo } from 'react';
import { Plus, TrendingUp, Clock, IndianRupee, Pencil, Loader2, History } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useFinanceStore } from '@/store/finance-store';
import { useTranslation } from '@/lib/i18n';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AddIncomeModal } from '@/components/AddIncomeModal';
import { toast } from '@/hooks/use-toast';
import * as academicYearsService from '@/services/academicYears';
import type { IncomeEntry } from '@/types/finance';
import { TUITION_CATEGORY, LUNCH_CATEGORY, OTHER_CATEGORY } from '@/types/finance';
import { getIncomeBreakdown, isPreviousAcademicYear, parseNonNegativeAmount } from '@/lib/finance-domain';
import { useStudentStore } from '@/store/student-store';
import { getStudentFeeSummary } from '@/lib/student-fees';
import { MEDIUM_LABELS } from '@/types/students';

export default function IncomePage() {
  const { t } = useTranslation();
  const { incomeEntries, academicYears, currentYearId, refreshAcademicYears, getPendingForYear } = useFinanceStore();
  const { enrollments } = useStudentStore();
  const [tab, setTab] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<IncomeEntry | undefined>();
  const [lateYearId, setLateYearId] = useState<string | undefined>();

  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetValue, setTargetValue] = useState('');
  const [targetSaving, setTargetSaving] = useState(false);

  const [showCarryModal, setShowCarryModal] = useState(false);
  const [carryYearId, setCarryYearId] = useState<string | null>(null);
  const [carryValue, setCarryValue] = useState('');
  const [carrySaving, setCarrySaving] = useState(false);

  const currentYear = academicYears.find((y) => y.id === currentYearId);

  const stats = useMemo(() => {
    const yearIncome = incomeEntries.filter((i) => i.academicYearId === currentYearId);
    const tuitionTotal = yearIncome
      .filter((i) => i.category === TUITION_CATEGORY && !i.isLateCollection)
      .reduce((s, i) => s + i.amount, 0);
    const incomeBreakdown = getIncomeBreakdown(yearIncome);
    const totalIncome = incomeBreakdown.total;
    const target = currentYear?.targetTuitionFees || 0;

    // Build per-category breakdown for the summary tab
    const categoryBreakdown = [
      { cat: 'Current-Year Tuition Fees', amount: incomeBreakdown.currentTuition },
      { cat: 'Previous-Year Fees Received', amount: incomeBreakdown.oldFees },
      { cat: 'Lunch Fees', amount: incomeBreakdown.lunch },
      { cat: 'Investment / Extra Income', amount: incomeBreakdown.other },
    ].filter((item) => item.amount > 0);

    return { tuitionTotal, totalIncome, target, categoryBreakdown, incomeBreakdown };
  }, [incomeEntries, currentYearId, currentYear]);

  const pendingYears = useMemo(() => {
    return academicYears
      .map((y) => {
        const info = getPendingForYear(y.id);
        const yearRosterPending = enrollments
          .filter((e) => e.academicYearId === y.id && e.status === 'active')
          .reduce((sum, e) => sum + getStudentFeeSummary(e, incomeEntries).pending, 0);
        const totalRemaining = Math.max(info.remaining, yearRosterPending);
        const startYear = y.startDate.getFullYear();
        const yearsOverdue = new Date().getFullYear() - startYear - 1;
        return {
          ...y,
          collected: info.collected,
          remainingFromTarget: info.targetGap,
          carryForward: info.carryForward,
          totalTarget: Math.max(info.totalOwed, yearRosterPending + info.collected),
          totalRemaining,
          yearsOverdue,
          receivedThisAcademicYear: incomeEntries
            .filter((entry) => entry.academicYearId === currentYearId && entry.isLateCollection && entry.originalYearId === y.id)
            .reduce((sum, entry) => sum + entry.amount, 0),
        };
      })
      .filter((y) => y.totalRemaining > 0 && (!currentYear || isPreviousAcademicYear(y, currentYear)));
  }, [academicYears, currentYear, currentYearId, getPendingForYear, incomeEntries, enrollments]);

  // Fixed tabs — no dynamic category discovery needed
  const filteredEntries = useMemo(() => {
    const yearIncome = incomeEntries.filter((i) => i.academicYearId === currentYearId);
    if (tab === 'all') return yearIncome;
    if (tab === 'tuition') return yearIncome.filter((i) => i.category === TUITION_CATEGORY && !i.isLateCollection);
    if (tab === 'old') return yearIncome.filter((i) => i.category === TUITION_CATEGORY && i.isLateCollection);
    if (tab === 'lunch')   return yearIncome.filter((i) => i.category === LUNCH_CATEGORY);
    if (tab === 'other')   return yearIncome.filter((i) => i.category === OTHER_CATEGORY);
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
    const target = parseNonNegativeAmount(targetValue || '0');
    if (target === null) { toast({ title: 'Enter a non-negative target', variant: 'destructive' }); return; }
    setTargetSaving(true);
    try {
      const { error } = await academicYearsService.update(currentYearId, {
        target_tuition_fees: target,
      });
      if (error) throw error;
      await refreshAcademicYears();
      toast({ title: 'Target updated' });
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
    const carry = parseNonNegativeAmount(carryValue || '0');
    if (carry === null) { toast({ title: 'Enter a non-negative outstanding balance', variant: 'destructive' }); return; }
    setCarrySaving(true);
    try {
      const { error } = await academicYearsService.update(carryYearId, {
        carry_forward_fees: carry,
      });
      if (error) throw error;
      await refreshAcademicYears();
      toast({ title: "Last year's pending fee balance updated" });
      setShowCarryModal(false);
    } catch {
      toast({ title: "Failed to update last year's pending fee balance", variant: 'destructive' });
    }
    setCarrySaving(false);
  }

  const currentEnrollmentCarryPending = useMemo(() => {
    return enrollments
      .filter((e) => e.academicYearId === currentYearId && e.status === 'active')
      .reduce((sum, e) => {
        const summary = getStudentFeeSummary(e, incomeEntries);
        return sum + Math.min(e.additionalOutstandingAmount || 0, summary.pending);
      }, 0);
  }, [enrollments, currentYearId, incomeEntries]);

  const feeProgress = stats.target > 0 ? Math.round((stats.tuitionTotal / stats.target) * 100) : 0;
  const previousYearsPendingSum = pendingYears.reduce((sum, year) => sum + year.totalRemaining, 0);
  const previousPendingTotal = previousYearsPendingSum + currentEnrollmentCarryPending;
  const feeCashCollected = stats.tuitionTotal + stats.incomeBreakdown.oldFees;
  const totalFeesStillToCollect = Math.max(0, stats.target - stats.tuitionTotal) + previousPendingTotal;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('incomeTitle')}
        subtitle={`AY ${currentYear?.label || ''}`}
        action={
          <Button className="w-full gap-1.5 bg-income text-income-foreground hover:bg-income/90 sm:w-auto" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {t('addIncome')}
          </Button>
        }
      />

      <section className="space-y-3 rounded-xl border bg-card p-4" aria-labelledby="income-fees-title">
        <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{t('feeCollectionsBadge')}</p><h2 id="income-fees-title" className="text-lg font-bold">{t('currentAndPreviousYearFees')}</h2></div>
        <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 lg:grid-cols-3">
          <StatCard title={t('currentYearTuitionTarget')} value={formatINRAbbr(stats.target)} fullValue={formatINR(stats.target)} icon={TrendingUp} variant="balance" />
          <StatCard title={t('currentYearTuitionCollected')} value={formatINRAbbr(stats.tuitionTotal)} fullValue={formatINR(stats.tuitionTotal)} icon={IndianRupee} variant="income" />
          <StatCard title={t('currentYearTuitionRemaining')} value={formatINRAbbr(Math.max(0, stats.target - stats.tuitionTotal))} fullValue={formatINR(Math.max(0, stats.target - stats.tuitionTotal))} icon={Clock} variant="pending" />
          <StatCard title={t('prevYearFeesReceivedThisAY')} value={formatINRAbbr(stats.incomeBreakdown.oldFees)} fullValue={formatINR(stats.incomeBreakdown.oldFees)} icon={IndianRupee} variant="income" />
          <StatCard title={t('prevYearFeesStillPending')} value={formatINRAbbr(previousPendingTotal)} fullValue={formatINR(previousPendingTotal)} icon={Clock} variant="pending" />
          <StatCard title={t('totalCashIncome')} value={formatINRAbbr(stats.totalIncome)} fullValue={formatINR(stats.totalIncome)} icon={TrendingUp} variant="income" />
        </div>
        <div className="grid gap-3 border-t pt-3 min-[420px]:grid-cols-2">
          <SummaryMetric label={t('feeCashCollectedThisAY')} value={feeCashCollected} tone="income" />
          <SummaryMetric label={t('totalFeesStillToCollect')} value={totalFeesStillToCollect} tone="warning" />
        </div>
      </section>

      {/* Tuition fee progress bar */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium">{t('tuitionProgress')}</span>
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
          {feeProgress}% {t('collectedSoFar').toLowerCase()} • {formatINR(Math.max(0, stats.target - stats.tuitionTotal))} {t('remainingWord')}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto">
          <TabsList className="w-max min-w-full sm:w-auto">
            <TabsTrigger value="all">{t('allIncomeTab')}</TabsTrigger>
            <TabsTrigger value="tuition">{t('currentTuitionTab')}</TabsTrigger>
            <TabsTrigger value="old">{t('prevFeesReceivedTab')}</TabsTrigger>
            <TabsTrigger value="lunch">{t('lunchFeesTab')}</TabsTrigger>
            <TabsTrigger value="other">{t('investmentExtraTab')}</TabsTrigger>
            <TabsTrigger value="pending">
              {t('prevFeesPendingTab')}
              {pendingYears.length > 0 && (
                <span className="ml-1.5 rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-bold text-warning-foreground">
                  {pendingYears.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* All income tab */}
        <TabsContent value="all" className="mt-4 space-y-4">
          {stats.categoryBreakdown.length > 0 && (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('breakdownByCategory')}</p>
              {stats.categoryBreakdown.map(({ cat, amount }) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className="text-fit">{cat}</span>
                  <span className="money-fit font-mono font-semibold text-income">{formatINR(amount)}</span>
                </div>
              ))}
            </div>
          )}
          <TransactionList entries={filteredEntries} onEdit={openEdit} showCategory />
        </TabsContent>

        <TabsContent value="tuition" className="mt-4">
          <TransactionList
            entries={incomeEntries.filter((i) => i.academicYearId === currentYearId && i.category === TUITION_CATEGORY && !i.isLateCollection)}
            onEdit={openEdit}
          />
        </TabsContent>

        <TabsContent value="old" className="mt-4">
          <TransactionList
            entries={incomeEntries.filter((i) => i.academicYearId === currentYearId && i.category === TUITION_CATEGORY && i.isLateCollection)}
            onEdit={openEdit}
          />
        </TabsContent>

        <TabsContent value="lunch" className="mt-4">
          <TransactionList
            entries={incomeEntries.filter((i) => i.academicYearId === currentYearId && i.category === LUNCH_CATEGORY)}
            onEdit={openEdit}
          />
        </TabsContent>

        <TabsContent value="other" className="mt-4">
          <TransactionList
            entries={incomeEntries.filter((i) => i.academicYearId === currentYearId && i.category === OTHER_CATEGORY)}
            onEdit={openEdit}
          />
        </TabsContent>

        {/* Pending collections tab */}
        <TabsContent value="pending" className="mt-4 space-y-3">
          {pendingYears.length === 0 ? (
            <EmptyState message={t('noPrevYearFeeBalance')} />
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
                        {t('collectedAgainstAY', { year: y.label })} {formatINR(y.collected)} / {formatINR(y.totalTarget)}
                      </p>
                    </div>
                    <div className="min-w-0 text-left sm:text-right">
                      <p className="money-fit font-mono text-lg font-bold text-warning">{formatINR(y.totalRemaining)}</p>
                      <p className="text-xs text-muted-foreground">{t('stillPending')}</p>
                    </div>
                  </div>

                  {y.receivedThisAcademicYear > 0 && (
                    <p className="mt-2 text-xs font-medium text-income">
                      Received in AY {currentYear?.label}: {formatINR(y.receivedThisAcademicYear)}
                    </p>
                  )}

                  <div className="mt-3">
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-income transition-all" style={{ width: `${collectProgress}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{collectProgress}% {t('collectedSoFar').toLowerCase()}</p>
                  </div>

                  {y.carryForward > 0 && (
                    <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs space-y-1">
                      <div className="flex flex-col gap-1 text-muted-foreground min-[420px]:flex-row min-[420px]:justify-between">
                        <span>{t('remainingFromThisYearTarget')}</span>
                        <span className="money-fit font-mono">{formatINR(y.remainingFromTarget)}</span>
                      </div>
                      <div className="flex flex-col gap-1 text-warning min-[420px]:flex-row min-[420px]:justify-between">
                        <span className="flex items-center gap-1">
                          <History className="h-3 w-3" /> {t('lastYearPendingBalance')}
                        </span>
                        <span className="money-fit font-mono">{formatINR(y.carryForward)}</span>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openLatePayment(y.id)}>
                      {t('recordPrevYearPayment')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-muted-foreground"
                      onClick={() => openEditCarry(y.id, y.carryForward)}
                    >
                      <History className="h-3.5 w-3.5" />
                      {y.carryForward > 0 ? t('editLastYearPendingFees') : t('addLastYearPendingFees')}
                    </Button>
                  </div>
                </div>
              );
            })
          )}

          {academicYears.filter((y) => !pendingYears.find((p) => p.id === y.id)).length > 0 && (
            <div className="rounded-lg border border-dashed bg-card/50 p-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Add an outstanding balance only when unpaid fees for an academic year are not already included in its tuition target:
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

      <AddIncomeModal isOpen={showModal} onClose={() => setShowModal(false)} editEntry={editEntry} presetLateYearId={lateYearId} />

      {/* Edit Target Modal */}
      <Dialog open={showTargetModal} onOpenChange={setShowTargetModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('editTuitionTarget')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">AY {currentYear?.label}</p>
          <Label htmlFor="current-year-target">{t('currentYearTuitionTarget')} (₹)</Label>
          <Input
            id="current-year-target"
            type="number"
            placeholder="Target tuition fees (₹)"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
          />
          {targetValue && (
            <p className="text-xs text-muted-foreground">{formatINR(parseFloat(targetValue) || 0)}</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTargetModal(false)} className="flex-1">{t('actionCancel')}</Button>
            <Button onClick={saveTarget} disabled={targetSaving} className="flex-1">
              {targetSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t('actionSave')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit last year's pending fee balance modal */}
      <Dialog open={showCarryModal} onOpenChange={setShowCarryModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('lastYearPendingFeeBalance')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter unpaid fees belonging to AY {academicYears.find((y) => y.id === carryYearId)?.label} that are not already included in its tuition target.
            Do not enter the same balance under another academic year. Set to 0 to clear it.
          </p>
          <Label htmlFor="additional-outstanding-balance">{t('lastYearPendingFeeBalance')} (₹)</Label>
          <Input
            id="additional-outstanding-balance"
            type="number"
            placeholder="Enter additional balance"
            value={carryValue}
            onChange={(e) => setCarryValue(e.target.value)}
          />
          {carryValue && (
            <p className="text-xs text-muted-foreground">{formatINR(parseFloat(carryValue) || 0)}</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCarryModal(false)} className="flex-1">{t('actionCancel')}</Button>
            <Button onClick={saveCarry} disabled={carrySaving} className="flex-1">
              {carrySaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t('actionSave')}
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
  showCategory = false,
}: {
  entries: IncomeEntry[];
  onEdit: (entry: IncomeEntry) => void;
  showCategory?: boolean;
}) {
  const { t } = useTranslation();
  const { students, enrollments } = useStudentStore();
  const { accounts, academicYears } = useFinanceStore();
  if (entries.length === 0) return <EmptyState message={t('noEntriesYet')} />;

  const sorted = [...entries].sort((a, b) => b.date.getTime() - a.date.getTime());
  return (
    <div className="divide-y rounded-lg border bg-card">
      {sorted.map((entry) => {
        const enrollment = enrollments.find((item) => item.id === entry.studentEnrollmentId);
        const student = students.find((item) => item.id === enrollment?.studentId);
        const account = accounts.find((item) => item.id === entry.accountId);
        const originalYear = academicYears.find((item) => item.id === entry.originalYearId);
        return (
        <button
          type="button"
          key={entry.id}
          className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={() => onEdit(entry)}
        >
          <div className="min-w-0 flex-1">
            {showCategory && (
              <p className="text-[11px] font-medium text-muted-foreground">{entry.category}</p>
            )}
            <p className="text-fit text-sm font-medium">{student?.fullName || entry.notes || (entry.category === TUITION_CATEGORY ? 'Unassigned tuition payment' : 'No description')}</p>
            <p className="text-xs text-muted-foreground">
              {entry.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {enrollment ? ` · ${enrollment.className} · ${MEDIUM_LABELS[enrollment.medium]}` : ''}
              {entry.isLateCollection ? ` · For AY ${originalYear?.label || '—'}` : ''}
            </p>
            {entry.category === TUITION_CATEGORY && <p className="text-xs text-muted-foreground">
              {entry.paymentMethod?.replace('_', ' ') || 'Unknown / Not Recorded'} · {account?.name || 'Unknown account'}
            </p>
            }
          </div>
          <span className="money-fit max-w-[45%] text-right font-mono text-sm font-semibold text-income">
            +{formatINR(entry.amount)}
          </span>
        </button>
      );})}
    </div>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: number; tone: 'income' | 'warning' }) {
  return <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={cn('money-fit mt-1 font-mono text-lg font-bold', tone === 'income' ? 'text-income' : 'text-warning')}>{formatINR(value)}</p></div>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-12">
      <IndianRupee className="mb-3 h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
