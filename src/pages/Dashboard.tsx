import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, BarChart3, ClipboardList, HandCoins, IndianRupee, Landmark, Plus, School, TrendingUp } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useFinanceStore } from '@/store/finance-store';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { TUITION_CATEGORY } from '@/types/finance';
import { getIncomeBreakdown, getRecoverableSummary, isPreviousAcademicYear } from '@/lib/finance-domain';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { AddIncomeModal } from '@/components/AddIncomeModal';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import { TransferModal } from '@/components/TransferModal';
import { RecurringReviewModal } from '@/components/RecurringReviewModal';
import { useStudentStore } from '@/store/student-store';
import { summarizeRoster } from '@/lib/student-fees';

export default function Dashboard() {
  const {
    incomeEntries, expenseEntries, academicYears, currentYearId, transfers,
    getTotalBalance, getYearProfitBreakdown, getProjectedProfit, pendingRecurringItems,
    getPendingForYear, recoverables, recoverableRepayments, accounts,
  } = useFinanceStore();
  const { enrollments } = useStudentStore();
  const navigate = useNavigate();
  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const currentYear = academicYears.find((year) => year.id === currentYearId);

  const stats = useMemo(() => {
    const breakdown = getYearProfitBreakdown(currentYearId);
    const currentYearIncome = incomeEntries.filter((entry) => entry.academicYearId === currentYearId);
    const incomeBreakdown = getIncomeBreakdown(currentYearIncome);
    const currentTuitionCollected = currentYearIncome
      .filter((entry) => entry.category === TUITION_CATEGORY && !entry.isLateCollection)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const currentTarget = currentYear?.targetTuitionFees || 0;
    const currentRemaining = Math.max(0, currentTarget - currentTuitionCollected);
    const feeProgress = currentTarget > 0 ? Math.min(100, Math.round((currentTuitionCollected / currentTarget) * 100)) : 0;
    const previousYears = currentYear ? academicYears.filter((year) => isPreviousAcademicYear(year, currentYear)) : [];
    const previousYearRows = previousYears.map((year) => ({
      year,
      info: getPendingForYear(year.id),
      receivedThisAcademicYear: currentYearIncome
        .filter((entry) => entry.isLateCollection && entry.originalYearId === year.id)
        .reduce((sum, entry) => sum + entry.amount, 0),
    }));
    const previousPending = previousYearRows.reduce((sum, row) => sum + row.info.remaining, 0);
    const schoolExpenses = breakdown.fixedExpenses + breakdown.extraExpenses;
    const recoverablesOutstanding = recoverables.reduce(
      (sum, recoverable) => sum + getRecoverableSummary(recoverable, recoverableRepayments).outstanding,
      0,
    );
    return {
      ...breakdown,
      projected: getProjectedProfit(currentYearId),
      totalBalance: getTotalBalance(),
      currentTarget, currentTuitionCollected, currentRemaining, feeProgress,
      previousYearRows, previousPending, previousReceived: incomeBreakdown.oldFees,
      feeCashCollected: currentTuitionCollected + incomeBreakdown.oldFees,
      totalFeesStillToCollect: currentRemaining + previousPending,
      schoolExpenses, recoverablesOutstanding,
    };
  }, [academicYears, currentYear, currentYearId, expenseEntries, getPendingForYear, getProjectedProfit, getTotalBalance, getYearProfitBreakdown, incomeEntries, recoverableRepayments, recoverables]);

  const monthlyData = useMemo(() => {
    if (!currentYear) return [];
    const yearIncome = incomeEntries.filter((entry) => entry.academicYearId === currentYearId);
    const yearExpenses = expenseEntries.filter((entry) => entry.academicYearId === currentYearId && entry.expenseType === 'school');
    const buckets: { month: string; year: number; monthIndex: number }[] = [];
    const cursor = new Date(currentYear.startDate.getFullYear(), currentYear.startDate.getMonth(), 1);
    const end = new Date(currentYear.endDate.getFullYear(), currentYear.endDate.getMonth(), 1);
    while (cursor <= end && buckets.length < 24) {
      buckets.push({ month: cursor.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), year: cursor.getFullYear(), monthIndex: cursor.getMonth() });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return buckets.map((bucket) => ({
      month: bucket.month,
      income: yearIncome.filter((entry) => entry.date.getFullYear() === bucket.year && entry.date.getMonth() === bucket.monthIndex).reduce((sum, entry) => sum + entry.amount, 0),
      expenses: yearExpenses.filter((entry) => entry.date.getFullYear() === bucket.year && entry.date.getMonth() === bucket.monthIndex).reduce((sum, entry) => sum + entry.amount, 0),
    })).filter((item) => item.income > 0 || item.expenses > 0);
  }, [currentYear, currentYearId, expenseEntries, incomeEntries]);

  const topExpenseCategories = useMemo(() => {
    const totals = new Map<string, number>();
    expenseEntries.filter((entry) => entry.academicYearId === currentYearId && entry.expenseType === 'school')
      .forEach((entry) => totals.set(entry.category, (totals.get(entry.category) || 0) + entry.amount));
    return Array.from(totals.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [currentYearId, expenseEntries]);

  const recentTransactions = useMemo(() => {
    const accountName = (id: string) => accounts.find((account) => account.id === id)?.name || 'Unknown account';
    return [
      ...incomeEntries.map((entry) => ({
        id: `income-${entry.id}`, date: entry.date,
        label: entry.isLateCollection ? 'Previous-Year Fee Payment' : entry.category,
        detail: entry.isLateCollection ? `For AY ${academicYears.find((year) => year.id === entry.originalYearId)?.label || '—'}` : entry.notes,
        amount: entry.amount, kind: 'income' as const,
      })),
      ...expenseEntries.map((entry) => ({ id: `expense-${entry.id}`, date: entry.date, label: entry.category, detail: entry.expenseType === 'school' ? 'School expense' : 'Home/personal expense', amount: entry.amount, kind: 'expense' as const })),
      ...transfers.map((entry) => ({ id: `transfer-${entry.id}`, date: entry.date, label: 'Transfer', detail: `${accountName(entry.fromAccountId)} → ${accountName(entry.toAccountId)} · No change to total liquidity`, amount: entry.amount, kind: 'transfer' as const })),
      ...recoverables.map((entry) => ({ id: `advance-${entry.id}`, date: entry.dateGiven, label: `Recoverable Advance — ${entry.partyName}`, detail: 'Cash advanced · not an expense', amount: entry.originalAmount, kind: 'recoverable' as const })),
      ...recoverableRepayments.map((entry) => ({ id: `repayment-${entry.id}`, date: entry.date, label: 'Recoverable Repayment', detail: 'Liquidity restored · not income', amount: entry.amount, kind: 'recoverable' as const })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
  }, [academicYears, accounts, expenseEntries, incomeEntries, recoverableRepayments, recoverables, transfers]);

  const attentionCount = Number(stats.previousPending > 0) + Number(stats.recoverablesOutstanding > 0) + Number(pendingRecurringItems.length > 0);
  const studentSnapshot = useMemo(() => summarizeRoster(enrollments.filter((item) => item.academicYearId === currentYearId), incomeEntries), [currentYearId, enrollments, incomeEntries]);
  const unassignedCurrentTuition = stats.currentTuitionCollected - incomeEntries.filter((entry) => entry.academicYearId === currentYearId && !entry.isLateCollection && entry.studentEnrollmentId).reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Little Flowers School</p><h1 className="text-2xl font-bold">Dashboard</h1><p className="text-sm text-muted-foreground">Academic Year {currentYear?.label || '—'}</p></div>
        <div className="grid grid-cols-2 gap-2 min-[480px]:flex">
          <Button size="sm" className="gap-1.5 bg-income text-income-foreground hover:bg-income/90" onClick={() => setShowIncome(true)}><Plus className="h-4 w-4" />Income</Button>
          <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setShowExpense(true)}><Plus className="h-4 w-4" />Expense</Button>
          <Button size="sm" variant="outline" className="col-span-2 gap-1.5" onClick={() => setShowTransfer(true)}><ArrowLeftRight className="h-4 w-4" />Transfer</Button>
        </div>
      </div>

      <section className="rounded-xl border border-primary/20 bg-card p-4 shadow-sm sm:p-5" aria-labelledby="fee-overview-title">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Primary financial story</p><h2 id="fee-overview-title" className="text-lg font-bold">Fee Collection Overview</h2></div><span className="text-xs text-muted-foreground">AY {currentYear?.label || '—'}</span></div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg bg-primary/[0.04] p-4">
            <h3 className="mb-3 text-sm font-semibold">Current-Year Tuition</h3>
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-3"><FeeMetric label="Current-Year Tuition Target" value={stats.currentTarget} /><FeeMetric label="Current-Year Tuition Collected" value={stats.currentTuitionCollected} tone="income" /><FeeMetric label="Current-Year Tuition Remaining" value={stats.currentRemaining} tone="warning" /></div>
            <Progress value={stats.feeProgress} className="mt-4 h-2.5" /><div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>Collection progress</span><span>{stats.feeProgress}%</span></div>
          </div>
          <div className="rounded-lg border border-warning/20 bg-warning/[0.04] p-4">
            <h3 className="mb-3 text-sm font-semibold">Previous-Year Fees</h3>
            <div className="grid gap-3 min-[380px]:grid-cols-2"><FeeMetric label="Received This AY" value={stats.previousReceived} tone="income" /><FeeMetric label="Still Pending" value={stats.previousPending} tone="warning" /></div>
            {stats.previousYearRows.filter((row) => row.info.remaining > 0 || row.receivedThisAcademicYear > 0).length > 0 ? <div className="mt-3 space-y-2 border-t border-warning/15 pt-3">{stats.previousYearRows.filter((row) => row.info.remaining > 0 || row.receivedThisAcademicYear > 0).map((row) => <div key={row.year.id} className="flex flex-col gap-0.5 text-xs min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"><span className="font-medium">AY {row.year.label}</span><span className="text-muted-foreground">{formatINR(row.info.remaining)} pending{row.receivedThisAcademicYear > 0 ? ` · ${formatINR(row.receivedThisAcademicYear)} received this AY` : ''}</span></div>)}</div> : <p className="mt-3 text-xs text-muted-foreground">No previous-year fee balance is currently pending.</p>}
            <Button variant="link" size="sm" className="mt-1 h-auto px-0 text-warning" onClick={() => navigate('/income')}>View previous-year fees →</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 border-t pt-4 min-[420px]:grid-cols-2"><FeeMetric label="Fee Cash Collected This AY" value={stats.feeCashCollected} tone="income" prominent /><FeeMetric label="Total Fees Still To Collect" value={stats.totalFeesStillToCollect} tone="warning" prominent /></div>
      </section>

      <section className="rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="school-snapshot-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">School Snapshot</p><h2 id="school-snapshot-title" className="text-lg font-semibold">{studentSnapshot.totalStudents} active students</h2></div><Button variant="outline" size="sm" onClick={() => navigate('/students')}>View Students →</Button></div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><SnapshotMetric label="English Medium" value={String(studentSnapshot.english)} /><SnapshotMetric label="Gujarati Medium" value={String(studentSnapshot.gujarati)} /><SnapshotMetric label="Students With Fees Pending" value={String(studentSnapshot.pendingStudents)} tone="warning" /><SnapshotMetric label="Student-Identified Pending" value={formatINR(studentSnapshot.pending)} tone="warning" /></div>
        {(studentSnapshot.totalStudents > 0 || unassignedCurrentTuition > 0) && <p className="mt-3 text-xs text-muted-foreground">Student roster fee total {formatINR(studentSnapshot.obligation)} · Unassigned current tuition received {formatINR(Math.max(0, unassignedCurrentTuition))}. Overall finance targets remain authoritative until reconciliation is complete.</p>}
      </section>

      <section aria-labelledby="financial-position-title">
        <div className="mb-3"><h2 id="financial-position-title" className="text-base font-semibold">Financial Position</h2><p className="text-xs text-muted-foreground">Money available and school operating performance</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><StatCard title="Available Balance" value={formatINRAbbr(stats.totalBalance)} fullValue={formatINR(stats.totalBalance)} icon={Landmark} variant="balance" subtitle="Total liquid money across accounts" className="sm:p-5" /><StatCard title="School Profit" value={formatINRAbbr(stats.netProfit)} fullValue={formatINR(stats.netProfit)} icon={BarChart3} variant={stats.netProfit >= 0 ? 'profit' : 'expense'} subtitle="Cash income received − school expenses" className="sm:p-5" /></div>
        <div className="mt-3 grid gap-2 min-[360px]:grid-cols-2 lg:grid-cols-3"><CompactMetric label="Cash Income Received" value={stats.totalIncome} tone="income" /><CompactMetric label="School Expenses" value={stats.schoolExpenses} tone="expense" /><CompactMetric label="Projected School Profit" value={stats.projected} tone={stats.projected >= 0 ? 'income' : 'expense'} /></div>
      </section>

      <section className="rounded-lg border bg-card" aria-labelledby="attention-title">
        <div className="flex items-center justify-between border-b px-4 py-3"><div><h2 id="attention-title" className="text-sm font-semibold">Needs Attention</h2><p className="text-xs text-muted-foreground">Only items that may need action</p></div>{attentionCount > 0 && <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">{attentionCount}</span>}</div>
        {attentionCount === 0 ? <p className="px-4 py-5 text-sm text-muted-foreground">Everything is up to date.</p> : <div className="divide-y">{stats.previousPending > 0 && <AttentionRow icon={AlertTriangle} label="Previous-year fees pending" value={formatINR(stats.previousPending)} action="View fees" onClick={() => navigate('/income')} />}{stats.recoverablesOutstanding > 0 && <AttentionRow icon={HandCoins} label="Recoverables outstanding" value={formatINR(stats.recoverablesOutstanding)} action="View recoverables" onClick={() => navigate('/recoverables')} />}{pendingRecurringItems.length > 0 && <AttentionRow icon={ClipboardList} label={`${pendingRecurringItems.length} recurring expense item${pendingRecurringItems.length === 1 ? '' : 's'} need review`} action="Review" onClick={() => setShowRecurring(true)} />}</div>}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <section className="rounded-lg border bg-card p-4" aria-labelledby="cash-flow-title"><h2 id="cash-flow-title" className="mb-3 text-sm font-semibold">Monthly Income vs School Expenses</h2>{monthlyData.length === 0 ? <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">No cash-flow data yet</div> : <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyData} barGap={4}><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatINRAbbr(value)} /><RechartsTooltip formatter={(value: number) => formatINR(value)} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }} /><Bar dataKey="income" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} name="Income" /><Bar dataKey="expenses" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} name="School expenses" /></BarChart></ResponsiveContainer></div>}</section>
        <section className="rounded-lg border bg-card p-4" aria-labelledby="expense-categories-title"><h2 id="expense-categories-title" className="mb-3 text-sm font-semibold">Top School Expense Categories</h2>{topExpenseCategories.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No school expenses yet</p> : <div className="space-y-3">{topExpenseCategories.map((category, index) => <div key={category.name} className="flex items-center gap-3 text-sm"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-expense/10 text-xs font-semibold text-expense">{index + 1}</span><span className="min-w-0 flex-1 truncate">{category.name}</span><span className="money-fit font-mono text-xs font-semibold">{formatINRAbbr(category.value)}</span></div>)}</div>}<Button variant="link" size="sm" className="mt-2 h-auto px-0" onClick={() => navigate('/reports')}>View expense analytics →</Button></section>
      </div>

      <section className="rounded-lg border bg-card" aria-labelledby="activity-title">
        <div className="border-b px-4 py-3"><h2 id="activity-title" className="text-sm font-semibold">Recent Activity</h2></div>
        {recentTransactions.length === 0 ? <div className="flex flex-col items-center justify-center py-12"><IndianRupee className="mb-3 h-10 w-10 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">No transactions yet.</p></div> : <div className="divide-y">{recentTransactions.map((transaction) => {
          const Icon = transaction.kind === 'income' ? TrendingUp : transaction.kind === 'expense' ? School : transaction.kind === 'transfer' ? ArrowLeftRight : HandCoins;
          const tone = transaction.kind === 'income' ? 'income' : transaction.kind === 'expense' ? 'expense' : 'primary';
          return <div key={transaction.id} className="flex min-w-0 items-center gap-3 px-4 py-3"><div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', tone === 'income' ? 'bg-income/10' : tone === 'expense' ? 'bg-expense/10' : 'bg-primary/10')}><Icon className={cn('h-4 w-4', tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : 'text-primary')} /></div><div className="min-w-0 flex-1"><p className="text-fit text-sm font-medium">{transaction.label}</p><p className="text-fit text-xs text-muted-foreground">{transaction.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{transaction.detail ? ` · ${transaction.detail}` : ''}</p></div><span className={cn('money-fit max-w-[42%] text-right font-mono text-sm font-semibold', tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : 'text-primary')}>{transaction.kind === 'income' ? '+' : transaction.kind === 'expense' ? '-' : ''}{formatINR(transaction.amount)}</span></div>;
        })}</div>}
      </section>

      <AddIncomeModal isOpen={showIncome} onClose={() => setShowIncome(false)} />
      <AddExpenseModal isOpen={showExpense} onClose={() => setShowExpense(false)} />
      <TransferModal isOpen={showTransfer} onClose={() => setShowTransfer(false)} />
      <RecurringReviewModal isOpen={showRecurring} onClose={() => setShowRecurring(false)} />
    </div>
  );
}

function FeeMetric({ label, value, tone = 'default', prominent = false }: { label: string; value: number; tone?: 'default' | 'income' | 'warning'; prominent?: boolean }) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className={cn('money-fit mt-1 font-mono font-bold', prominent ? 'text-xl' : 'text-base', tone === 'income' && 'text-income', tone === 'warning' && 'text-warning')}>{formatINR(value)}</p></div>;
}

function CompactMetric({ label, value, tone }: { label: string; value: number; tone: 'income' | 'expense' }) {
  return <div className="rounded-lg border bg-card px-3 py-2.5"><p className="text-xs text-muted-foreground">{label}</p><p className={cn('money-fit mt-0.5 font-mono text-sm font-semibold', tone === 'income' ? 'text-income' : 'text-expense')}>{formatINR(value)}</p></div>;
}

function SnapshotMetric({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  return <div className="rounded-lg bg-muted/40 px-3 py-2.5"><p className="text-xs text-muted-foreground">{label}</p><p className={cn('money-fit mt-0.5 font-mono text-base font-semibold', tone && 'text-warning')}>{value}</p></div>;
}

function AttentionRow({ icon: Icon, label, value, action, onClick }: { icon: typeof AlertTriangle; label: string; value?: string; action: string; onClick: () => void }) {
  return <div className="flex flex-col gap-2 px-4 py-3 min-[420px]:flex-row min-[420px]:items-center"><Icon className="hidden h-4 w-4 text-warning min-[420px]:block" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{label}</p>{value && <p className="money-fit text-xs text-muted-foreground">{value}</p>}</div><Button variant="ghost" size="sm" className="h-8 justify-start px-0 text-primary min-[420px]:justify-center min-[420px]:px-3" onClick={onClick}>{action} →</Button></div>;
}
