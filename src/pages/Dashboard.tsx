import { useState, useMemo } from 'react';
import {
  IndianRupee,
  TrendingDown,
  BarChart3,
  Landmark,
  Clock,
  TrendingUp,
  Plus,
  ArrowLeftRight,
  ClipboardList,
  School,
  Home,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useFinanceStore } from '@/store/finance-store';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { AddIncomeModal } from '@/components/AddIncomeModal';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import { TransferModal } from '@/components/TransferModal';

const CHART_COLORS = [
  'hsl(210, 52%, 25%)',
  'hsl(160, 84%, 39%)',
  'hsl(0, 84%, 60%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(190, 70%, 45%)',
  'hsl(330, 70%, 50%)',
  'hsl(60, 80%, 45%)',
];

const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];

export default function Dashboard() {
  const { incomeEntries, expenseEntries, accounts, academicYears, currentYearId, transfers, getTotalBalance } =
    useFinanceStore();

  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const currentYear = academicYears.find((y) => y.id === currentYearId);

  const stats = useMemo(() => {
    const yearIncome = incomeEntries.filter((i) => i.academicYearId === currentYearId);
    const yearExpenses = expenseEntries.filter((e) => e.academicYearId === currentYearId);

    const totalIncome = yearIncome.reduce((s, i) => s + i.amount, 0);
    const totalSchoolExpenses = yearExpenses
      .filter((e) => e.expenseType === 'school')
      .reduce((s, e) => s + e.amount, 0);
    const netProfit = totalIncome - totalSchoolExpenses;

    const tuitionCollected = yearIncome
      .filter((i) => i.type === 'tuition')
      .reduce((s, i) => s + i.amount, 0);
    const target = currentYear?.targetTuitionFees || 0;
    const feeProgress = target > 0 ? Math.round((tuitionCollected / target) * 100) : 0;

    const totalPending = academicYears
      .filter((y) => y.status === 'pending_collections')
      .reduce((s, y) => {
        const collected = incomeEntries
          .filter((i) => i.academicYearId === y.id && i.type === 'tuition')
          .reduce((sum, i) => sum + i.amount, 0);
        return s + Math.max(0, y.targetTuitionFees - collected);
      }, 0);

    const totalBalance = getTotalBalance();

    // All-time cumulative profit
    const cumulativeProfit = academicYears.reduce((s, y) => {
      const yInc = incomeEntries.filter((i) => i.academicYearId === y.id).reduce((sum, i) => sum + i.amount, 0);
      const yExp = expenseEntries.filter((e) => e.academicYearId === y.id && e.expenseType === 'school').reduce((sum, e) => sum + e.amount, 0);
      return s + (yInc - yExp);
    }, 0);

    return { totalIncome, totalSchoolExpenses, netProfit, tuitionCollected, target, feeProgress, totalPending, totalBalance, cumulativeProfit };
  }, [incomeEntries, expenseEntries, accounts, academicYears, currentYearId, currentYear, transfers, getTotalBalance]);

  const monthlyData = useMemo(() => {
    const yearIncome = incomeEntries.filter((i) => i.academicYearId === currentYearId);
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
        id: i.id, date: i.date, category: i.type === 'tuition' ? 'Tuition Fees' : 'Lunch Fees',
        amount: i.amount, isIncome: true, type: null as string | null, accountId: i.accountId,
      })),
      ...expenseEntries.map((e) => ({
        id: e.id, date: e.date, category: e.category, amount: e.amount,
        isIncome: false, type: e.expenseType, accountId: e.accountId,
      })),
    ];
    return all.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
  }, [incomeEntries, expenseEntries]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Academic Year {currentYear?.label || '—'} • Little Flowers School
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total Income" value={formatINRAbbr(stats.totalIncome)} icon={IndianRupee} variant="income" subtitle="Tuition + Lunch" />
        <StatCard title="School Expenses" value={formatINRAbbr(stats.totalSchoolExpenses)} icon={TrendingDown} variant="expense" />
        <StatCard title="Net Profit" value={formatINRAbbr(stats.netProfit)} icon={BarChart3} variant={stats.netProfit >= 0 ? 'profit' : 'expense'} subtitle="School only" />
        <StatCard title="All Balances" value={formatINRAbbr(stats.totalBalance)} icon={Landmark} variant="balance" />
        <StatCard title="Pending Fees" value={formatINRAbbr(stats.totalPending)} icon={Clock} variant="pending" subtitle="All years" />
        <StatCard title="Cumulative Profit" value={formatINRAbbr(stats.cumulativeProfit)} icon={TrendingUp} variant="cumulative" subtitle="All-time" />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Tuition Fee Collection Progress</span>
          <span className="font-mono text-sm font-bold text-primary">
            {formatINR(stats.tuitionCollected)} / {formatINR(stats.target)}
          </span>
        </div>
        <Progress value={stats.feeProgress} className="h-3" />
        <p className="mt-1 text-xs text-muted-foreground">
          {stats.feeProgress}% collected • {formatINR(Math.max(0, stats.target - stats.tuitionCollected))} remaining
        </p>
      </div>

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
        <Button size="sm" variant="outline" className="gap-1.5">
          <ClipboardList className="h-4 w-4" /> Recurring Review
        </Button>
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
                  <Tooltip formatter={(value: number) => formatINR(value)} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }} />
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
            <div className="flex items-center gap-4">
              <div className="h-48 w-48 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} strokeWidth={2}>
                      {categoryData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatINR(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {categoryData.slice(0, 6).map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-2 text-xs">
                    <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="truncate text-muted-foreground">{cat.name}</span>
                    <span className="ml-auto font-mono font-medium">{formatINRAbbr(cat.value)}</span>
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
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', tx.isIncome ? 'bg-income/10' : 'bg-expense/10')}>
                  {tx.isIncome ? <TrendingUp className="h-4 w-4 text-income" /> : tx.type === 'school' ? <School className="h-4 w-4 text-expense" /> : <Home className="h-4 w-4 text-expense" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{tx.category}</p>
                  <p className="text-xs text-muted-foreground">{tx.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <span className={cn('font-mono text-sm font-semibold', tx.isIncome ? 'text-income' : 'text-expense')}>
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
    </div>
  );
}
