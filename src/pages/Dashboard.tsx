import { useState, useMemo } from 'react';
import {
  IndianRupee,
  TrendingDown,
  BarChart3,
  Landmark,
  TrendingUp,
  Plus,
  ArrowLeftRight,
  ClipboardList,
  School,
  Home,
  AlertTriangle,
  Info,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useFinanceStore } from '@/store/finance-store';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { TUITION_CATEGORY } from '@/types/finance';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { AddIncomeModal } from '@/components/AddIncomeModal';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import { TransferModal } from '@/components/TransferModal';
import { RecurringReviewModal } from '@/components/RecurringReviewModal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const CHART_COLORS = [
  'hsl(210, 52%, 25%)', 'hsl(160, 84%, 39%)', 'hsl(0, 84%, 60%)',
  'hsl(38, 92%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(190, 70%, 45%)',
  'hsl(330, 70%, 50%)', 'hsl(60, 80%, 45%)',
];

const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];

export default function Dashboard() {
  const {
    incomeEntries, expenseEntries, accounts, academicYears, currentYearId,
    transfers, getTotalBalance, getYearProfitBreakdown, getProjectedProfit,
    pendingRecurringItems, getPendingForYear,
  } = useFinanceStore();
  const navigate = useNavigate();

  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);

  const currentYear = academicYears.find((y) => y.id === currentYearId);

  const stats = useMemo(() => {
    // breakdown now excludes late-collection entries from the current year's income
    const breakdown = getYearProfitBreakdown(currentYearId);
    const projected = getProjectedProfit(currentYearId);

    // Current year: direct (non-late) tuition only — for the progress bar denominator
    const tuitionCollected = incomeEntries
      .filter((i) => i.academicYearId === currentYearId && i.category === TUITION_CATEGORY && !i.isLateCollection)
      .reduce((s, i) => s + i.amount, 0);
    const target = currentYear?.targetTuitionFees || 0;
    const feeProgress = target > 0 ? Math.round((tuitionCollected / target) * 100) : 0;

    // Previous years pending — uses shared helper that accounts for late payments + carry-forward
    const prevYears = academicYears.filter((y) => y.id !== currentYearId);
    const prevPending = prevYears.reduce((s, y) => s + getPendingForYear(y.id).remaining, 0);

    // Per-year breakdown for the previous-year pending progress bars
    const prevYearPending = prevYears
      .map((y) => ({ year: y, info: getPendingForYear(y.id) }))
      .filter((p) => p.info.remaining > 0);

    const totalBalance = getTotalBalance();

    const homeExpenses = expenseEntries
      .filter((e) => e.academicYearId === currentYearId && e.expenseType === 'home')
      .reduce((s, e) => s + e.amount, 0);

    // Projected breakdown
    const year = currentYear;
    let projectedIncome = breakdown.totalIncome;
    let projectedExpenses = breakdown.fixedExpenses + breakdown.extraExpenses;
    if (year) {
      const today = new Date();
      const monthsElapsed = Math.max(1,
        (today.getFullYear() - year.startDate.getFullYear()) * 12 +
        (today.getMonth() - year.startDate.getMonth()) + 1
      );
      const totalMonths = Math.max(1,
        (year.endDate.getFullYear() - year.startDate.getFullYear()) * 12 +
        (year.endDate.getMonth() - year.startDate.getMonth()) + 1
      );
      const remainingMonths = Math.max(0, totalMonths - monthsElapsed);
      const currentSchoolExpenses = breakdown.fixedExpenses + breakdown.extraExpenses;
      const avgMonthlyExpense = currentSchoolExpenses / monthsElapsed;
      projectedExpenses = currentSchoolExpenses + (avgMonthlyExpense * remainingMonths);
      // Only project the target gap (not carry-forward) as future income
      const currentPending = getPendingForYear(currentYearId);
      projectedIncome = breakdown.totalIncome + currentPending.targetGap;
    }

    return {
      ...breakdown,
      projected,
      tuitionCollected,
      target,
      feeProgress,
      prevPending,
      prevYearPending,
      totalBalance,
      homeExpenses,
      projectedIncome,
      projectedExpenses,
    };
  }, [incomeEntries, expenseEntries, accounts, academicYears, currentYearId, currentYear, transfers, getTotalBalance, getYearProfitBreakdown, getProjectedProfit, getPendingForYear]);

  const monthlyData = useMemo(() => {
    // Only direct income entries for this year (exclude late collections — they belong to original years)
    const yearIncome = incomeEntries.filter(
      (i) => i.academicYearId === currentYearId && !i.isLateCollection
    );
    const yearExpenses = expenseEntries.filter((e) => e.academicYearId === currentYearId && e.expenseType === 'school');
    return MONTHS.map((month, idx) => {
      const monthNum = (idx + 5) % 12;
      const inc = yearIncome.filter((i) => i.date.getMonth() === monthNum).reduce((s, i) => s + i.amount, 0);
      const exp = yearExpenses.filter((e) => e.date.getMonth() === monthNum).reduce((s, e) => s + e.amount, 0);
      return { month, income: inc, expenses: exp };
    }).filter((d) => d.income > 0 || d.expenses > 0);
  }, [incomeEntries, expenseEntries, currentYearId]);

  const categoryData = useMemo(() => {
    const yearExpenses = expenseEntries.filter((e) => e.academicYearId === currentYearId && e.expenseType === 'school');
    const map = new Map<string, number>();
    yearExpenses.forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenseEntries, currentYearId]);

  const recentTransactions = useMemo(() => {
    const all = [
      ...incomeEntries.map((i) => ({
        id: i.id, date: i.date,
        category: i.isLateCollection
          ? `Late Collection (prev year)`
          : i.category,
        amount: i.amount, isIncome: true, type: null as string | null,
        isLate: i.isLateCollection,
      })),
      ...expenseEntries.map((e) => ({
        id: e.id, date: e.date, category: e.category, amount: e.amount,
        isIncome: false, type: e.expenseType, isLate: false,
      })),
    ];
    return all.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
  }, [incomeEntries, expenseEntries]);

  const schoolExpensesTotal = stats.fixedExpenses + stats.extraExpenses;
  const overallPosition = stats.netProfit - stats.homeExpenses;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-fit text-sm text-muted-foreground">
            Academic Year {currentYear?.label || '—'} • Little Flowers School
          </p>
        </div>
      </div>

      {/* Alert banners */}
      {stats.prevPending > 0 && (
        <div
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3"
          onClick={() => navigate('/income')}
        >
          <AlertTriangle className="h-5 w-5 text-warning" />
          <p className="text-sm font-medium">⚠️ Pending: {formatINR(stats.prevPending)} from previous years → View Details</p>
        </div>
      )}

      {pendingRecurringItems.length > 0 && (
        <div
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3"
          onClick={() => setShowRecurring(true)}
        >
          <ClipboardList className="h-5 w-5 text-primary" />
          <p className="text-sm font-medium">📋 {pendingRecurringItems.length} recurring item{pendingRecurringItems.length !== 1 ? 's' : ''} need review → Review Now</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard title="Total Income" value={formatINRAbbr(stats.totalIncome)} fullValue={formatINR(stats.totalIncome)} icon={IndianRupee} variant="income" subtitle="Tuition + Lunch" />
        <StatCard title="School Expenses" value={formatINRAbbr(schoolExpensesTotal)} fullValue={formatINR(schoolExpensesTotal)} icon={TrendingDown} variant="expense" />
        <StatCard title="Net Profit" value={formatINRAbbr(stats.netProfit)} fullValue={formatINR(stats.netProfit)} icon={BarChart3} variant={stats.netProfit >= 0 ? 'profit' : 'expense'} subtitle="School income − expenses" />
        <StatCard title="All Balances" value={formatINRAbbr(stats.totalBalance)} fullValue={formatINR(stats.totalBalance)} icon={Landmark} variant="balance" />
        <StatCard title="Gross Profit" value={formatINRAbbr(stats.grossProfit)} fullValue={formatINR(stats.grossProfit)} icon={TrendingUp} variant="cumulative" subtitle="Income − Fixed" />
        <div className="relative">
          <StatCard title="Projected Profit" value={formatINRAbbr(stats.projected)} fullValue={formatINR(stats.projected)} icon={TrendingUp} variant="profit" subtitle="By year end" />
          <Popover>
            <PopoverTrigger asChild>
              <button className="absolute right-2 top-2 rounded-full p-1 opacity-60 hover:opacity-100 transition-opacity">
                <Info className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 text-xs" side="bottom" align="end">
              <p className="mb-2 font-semibold">Projected Profit Calculation</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected Income:</span>
                  <span className="font-mono">{formatINR(stats.projectedIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Projected Expenses:</span>
                  <span className="font-mono">{formatINR(Math.round(stats.projectedExpenses))}</span>
                </div>
                <div className="border-t pt-1 flex justify-between font-semibold">
                  <span>Projected Profit:</span>
                  <span className="font-mono">{formatINR(stats.projected)}</span>
                </div>
              </div>
              <p className="mt-2 text-muted-foreground">Assumes spending continues at the current monthly rate.</p>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">💰 Financial Overview</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">School Profit</p>
            <p className={cn('font-mono text-xl font-bold', stats.netProfit >= 0 ? 'text-income' : 'text-expense')}>
              {formatINR(stats.netProfit)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Income {formatINR(stats.totalIncome)} − School Expenses {formatINR(schoolExpensesTotal)}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">After Personal Expenses</p>
            <p className={cn('font-mono text-xl font-bold', overallPosition >= 0 ? 'text-income' : 'text-expense')}>
              {formatINR(overallPosition)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              School Profit {formatINR(stats.netProfit)} − Home {formatINR(stats.homeExpenses)}
            </p>
          </div>
        </div>
      </div>

      {/* Current year: Tuition Fee Collection Progress */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium">Tuition Fee Collection — AY {currentYear?.label}</span>
          <span className="money-fit font-mono text-sm font-bold text-primary">
            {formatINR(stats.tuitionCollected)} / {formatINR(stats.target)}
          </span>
        </div>
        <Progress value={stats.feeProgress} className="h-3" />
        <p className="mt-1 text-xs text-muted-foreground">
          {stats.feeProgress}% collected • {formatINR(Math.max(0, stats.target - stats.tuitionCollected))} remaining
        </p>
      </div>

      {/* Previous years: Pending Collections — separate progress bar per year */}
      {stats.prevYearPending.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-warning">⏳ Previous Year Pending Collections</span>
            <span className="font-mono text-sm font-bold text-warning">{formatINR(stats.prevPending)} total</span>
          </div>
          <div className="space-y-4">
            {stats.prevYearPending.map(({ year, info }) => {
              const collectPct = info.totalOwed > 0
                ? Math.min(100, Math.round((info.collected / info.totalOwed) * 100))
                : 0;
              return (
                <div key={year.id}>
                  <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-medium">AY {year.label}</span>
                    <span className="money-fit font-mono text-sm font-bold text-warning">{formatINR(info.remaining)} pending</span>
                  </div>
                  <Progress value={collectPct} className="h-2.5 [&>div]:bg-warning" />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>{collectPct}% collected</span>
                    <span>{formatINR(info.collected)} / {formatINR(info.totalOwed)}</span>
                  </div>
                  {info.carryForward > 0 && (
                    <p className="mt-0.5 text-xs text-warning/80">
                      Includes {formatINR(info.carryForward)} carry-forward from prior year
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <button
            className="mt-3 text-xs text-warning underline-offset-2 hover:underline"
            onClick={() => navigate('/income')}
          >
            Record a payment →
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5 bg-income text-income-foreground hover:bg-income/90" onClick={() => setShowIncome(true)}>
          <Plus className="h-4 w-4" /> Add Income
        </Button>
        <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setShowExpense(true)}>
          <Plus className="h-4 w-4" /> Add Expense
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowTransfer(true)}>
          <ArrowLeftRight className="h-4 w-4" /> Transfer Money
        </Button>
        {pendingRecurringItems.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowRecurring(true)}>
            <ClipboardList className="h-4 w-4" /> Recurring Review ({pendingRecurringItems.length})
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Monthly Income vs Expenses</h3>
          {monthlyData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">No data yet</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barGap={4}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatINRAbbr(v)} />
                  <RechartsTooltip formatter={(value: number) => formatINR(value)} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }} />
                  <Bar dataKey="income" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} name="Income" />
                  <Bar dataKey="expenses" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">School Expense Breakdown</h3>
          {categoryData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">No expenses yet</div>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-40 w-40 flex-shrink-0 sm:h-48 sm:w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} strokeWidth={2}>
                      {categoryData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => formatINR(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {categoryData.slice(0, 6).map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-2 text-xs">
                    <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="truncate text-muted-foreground">{cat.name}</span>
                    <span className="money-fit ml-auto text-right font-mono font-medium">{formatINRAbbr(cat.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Recent Transactions</h3>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <IndianRupee className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No transactions yet. Start by adding income or expenses.</p>
          </div>
        ) : (
          <div className="divide-y">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex min-w-0 items-center gap-3 px-4 py-3">
                <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', tx.isIncome ? 'bg-income/10' : 'bg-expense/10')}>
                  {tx.isIncome ? <TrendingUp className="h-4 w-4 text-income" /> : tx.type === 'school' ? <School className="h-4 w-4 text-expense" /> : <Home className="h-4 w-4 text-expense" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-fit text-sm font-medium">{tx.category}</p>
                  <p className="text-fit text-xs text-muted-foreground">{tx.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <span className={cn('money-fit max-w-[42%] text-right font-mono text-sm font-semibold', tx.isIncome ? 'text-income' : 'text-expense')}>
                  {tx.isIncome ? '+' : '-'}{formatINR(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddIncomeModal isOpen={showIncome} onClose={() => setShowIncome(false)} />
      <AddExpenseModal isOpen={showExpense} onClose={() => setShowExpense(false)} />
      <TransferModal isOpen={showTransfer} onClose={() => setShowTransfer(false)} />
      <RecurringReviewModal isOpen={showRecurring} onClose={() => setShowRecurring(false)} />
    </div>
  );
}
