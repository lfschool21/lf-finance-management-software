import { useMemo, useState, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  FileText,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useFinanceStore } from '@/store/finance-store';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FIXED_EXPENSE_CATEGORIES } from '@/types/finance';
import { toast } from '@/hooks/use-toast';

const COLORS = [
  'hsl(210, 52%, 25%)', 'hsl(160, 84%, 39%)', 'hsl(0, 84%, 60%)',
  'hsl(38, 92%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(190, 70%, 45%)',
  'hsl(330, 70%, 50%)', 'hsl(60, 80%, 45%)',
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ReportsPage() {
  const {
    incomeEntries, expenseEntries, academicYears, currentYearId,
    getYearProfitBreakdown, getAllTimeCumulativeProfit, getPendingForYear,
  } = useFinanceStore();

  const [selectedYearId, setSelectedYearId] = useState(currentYearId);
  const [compareYear1, setCompareYear1] = useState(currentYearId);
  const [compareYear2, setCompareYear2] = useState(academicYears.length > 1 ? academicYears[1]?.id || '' : '');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const selectedYear = academicYears.find((y) => y.id === selectedYearId);
  const breakdown = useMemo(() => getYearProfitBreakdown(selectedYearId), [selectedYearId, getYearProfitBreakdown, incomeEntries, expenseEntries]);

  const schoolCategoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    expenseEntries
      .filter((e) => e.academicYearId === selectedYearId && e.expenseType === 'school')
      .forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenseEntries, selectedYearId]);

  const homeCategoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    expenseEntries
      .filter((e) => e.academicYearId === selectedYearId && e.expenseType === 'home')
      .forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenseEntries, selectedYearId]);

  // All categories combined for analytics
  const allCategoryBreakdown = useMemo(() => {
    const map = new Map<string, { value: number; type: string }>();
    expenseEntries
      .filter((e) => e.academicYearId === selectedYearId)
      .forEach((e) => {
        const existing = map.get(e.category);
        map.set(e.category, {
          value: (existing?.value || 0) + e.amount,
          type: e.expenseType,
        });
      });
    return Array.from(map.entries())
      .map(([name, { value, type }]) => ({ name, value, type }))
      .sort((a, b) => b.value - a.value);
  }, [expenseEntries, selectedYearId]);

  // Monthly Summary
  const monthlySummary = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;

    const monthIncome = incomeEntries.filter(
      (i) => i.date.getFullYear() === year && i.date.getMonth() === month
    );
    const monthExpenses = expenseEntries.filter(
      (e) => e.date.getFullYear() === year && e.date.getMonth() === month
    );

    const income = monthIncome.reduce((s, i) => s + i.amount, 0);
    const school = monthExpenses.filter((e) => e.expenseType === 'school').reduce((s, e) => s + e.amount, 0);
    const home = monthExpenses.filter((e) => e.expenseType === 'home').reduce((s, e) => s + e.amount, 0);

    const catMap = new Map<string, number>();
    monthExpenses.forEach((e) => catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount));
    const categories = Array.from(catMap.entries()).map(([c, a]) => ({ category: c, amount: a })).sort((a, b) => b.amount - a.amount);

    const transactions = [
      ...monthIncome.map((i) => ({ id: i.id, date: i.date, label: i.type === 'tuition' ? 'Tuition' : 'Lunch', amount: i.amount, isIncome: true })),
      ...monthExpenses.map((e) => ({ id: e.id, date: e.date, label: e.category, amount: e.amount, isIncome: false })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return { income, school, home, schoolProfit: income - school, net: income - school - home, categories, transactions };
  }, [selectedMonth, incomeEntries, expenseEntries]);

  // All-time data
  const allYearsData = useMemo(() => {
    let cumulative = 0;
    return academicYears.map((y) => {
      const b = getYearProfitBreakdown(y.id);
      const homeExp = expenseEntries
        .filter((e) => e.academicYearId === y.id && e.expenseType === 'home')
        .reduce((s, e) => s + e.amount, 0);
      cumulative += b.netProfit;
      const pending = getPendingForYear(y.id);
      return {
        year: y.label,
        income: b.totalIncome,
        schoolExpenses: b.fixedExpenses + b.extraExpenses,
        homeExpenses: homeExp,
        profit: b.netProfit,
        overallPosition: b.netProfit - homeExp,
        cumulative,
        status: y.status,
        pendingRemaining: pending.remaining,
        carryForward: pending.carryForward,
      };
    });
  }, [academicYears, getYearProfitBreakdown, getPendingForYear, incomeEntries, expenseEntries]);

  // Compare years
  const comparison = useMemo(() => {
    if (!compareYear1 || !compareYear2) return null;
    const b1 = getYearProfitBreakdown(compareYear1);
    const b2 = getYearProfitBreakdown(compareYear2);
    const y1 = academicYears.find((y) => y.id === compareYear1);
    const y2 = academicYears.find((y) => y.id === compareYear2);

    const pctChange = (a: number, b: number) => b === 0 ? 0 : Math.round(((a - b) / Math.abs(b)) * 100);

    const items = [
      { label: 'Total Income', v1: b1.totalIncome, v2: b2.totalIncome, pct: pctChange(b1.totalIncome, b2.totalIncome) },
      { label: 'Fixed Expenses', v1: b1.fixedExpenses, v2: b2.fixedExpenses, pct: pctChange(b1.fixedExpenses, b2.fixedExpenses) },
      { label: 'Extra Expenses', v1: b1.extraExpenses, v2: b2.extraExpenses, pct: pctChange(b1.extraExpenses, b2.extraExpenses) },
      { label: 'Gross Profit', v1: b1.grossProfit, v2: b2.grossProfit, pct: pctChange(b1.grossProfit, b2.grossProfit) },
      { label: 'Net Profit', v1: b1.netProfit, v2: b2.netProfit, pct: pctChange(b1.netProfit, b2.netProfit) },
    ];

    const allCats = new Set<string>();
    [...b1.fixedBreakdown, ...b1.extraBreakdown, ...b2.fixedBreakdown, ...b2.extraBreakdown].forEach((c) => allCats.add(c.category));
    const catComparison = Array.from(allCats).map((cat) => {
      const a1 = [...b1.fixedBreakdown, ...b1.extraBreakdown].find((c) => c.category === cat)?.amount || 0;
      const a2 = [...b2.fixedBreakdown, ...b2.extraBreakdown].find((c) => c.category === cat)?.amount || 0;
      return { category: cat, v1: a1, v2: a2, pct: pctChange(a1, a2) };
    }).sort((a, b) => (b.v1 + b.v2) - (a.v1 + a.v2));

    return { items, catComparison, y1Label: y1?.label || '', y2Label: y2?.label || '' };
  }, [compareYear1, compareYear2, academicYears, getYearProfitBreakdown, incomeEntries, expenseEntries]);

  // Expense Analytics
  const expenseAnalytics = useMemo(() => {
    const yearExpenses = expenseEntries.filter((e) => e.academicYearId === selectedYearId);
    const school = yearExpenses.filter((e) => e.expenseType === 'school').reduce((s, e) => s + e.amount, 0);
    const home = yearExpenses.filter((e) => e.expenseType === 'home').reduce((s, e) => s + e.amount, 0);

    const monthlyMap = new Map<number, number>();
    yearExpenses.filter((e) => e.expenseType === 'school').forEach((e) => {
      const m = e.date.getMonth();
      monthlyMap.set(m, (monthlyMap.get(m) || 0) + e.amount);
    });
    const monthlyTrend = Array.from(monthlyMap.entries())
      .map(([m, amount]) => ({ month: MONTH_NAMES[m], amount }))
      .sort((a, b) => MONTH_NAMES.indexOf(a.month) - MONTH_NAMES.indexOf(b.month));

    const monthlyAmounts = Array.from(monthlyMap.values());
    const highest = monthlyAmounts.length > 0 ? Math.max(...monthlyAmounts) : 0;
    const lowest = monthlyAmounts.length > 0 ? Math.min(...monthlyAmounts) : 0;
    const average = monthlyAmounts.length > 0 ? monthlyAmounts.reduce((s, v) => s + v, 0) / monthlyAmounts.length : 0;

    return { school, home, total: school + home, monthlyTrend, highest, lowest, average };
  }, [expenseEntries, selectedYearId]);

  // Home expenses for P&L
  const homeExpensesTotal = useMemo(() => {
    return expenseEntries
      .filter((e) => e.academicYearId === selectedYearId && e.expenseType === 'home')
      .reduce((s, e) => s + e.amount, 0);
  }, [expenseEntries, selectedYearId]);

  const handleExportCSV = useCallback(() => {
    const rows = [
      ['Date', 'Type', 'Category', 'Amount', 'Description', 'Account'],
      ...incomeEntries.map((i) => [
        i.date.toISOString().split('T')[0], 'Income', i.type, i.amount.toString(), i.notes, '',
      ]),
      ...expenseEntries.map((e) => [
        e.date.toISOString().split('T')[0], e.expenseType, e.category, e.amount.toString(), e.description, '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `little-flowers-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: '📊 CSV exported' });
  }, [incomeEntries, expenseEntries]);

  const handleExportPDF = useCallback(async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Little Flowers School Financial Report', 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 28);
      doc.text(`Academic Year: ${selectedYear?.label || ''}`, 14, 34);

      doc.setFontSize(12);
      doc.text('Profit & Loss Summary', 14, 46);

      (doc as unknown as { autoTable: (opts: Record<string, unknown>) => void }).autoTable({
        startY: 50,
        head: [['Item', 'Amount (₹)']],
        body: [
          ['Total Income', formatINR(breakdown.totalIncome)],
          ['Fixed Expenses', formatINR(breakdown.fixedExpenses)],
          ['Gross Profit', formatINR(breakdown.grossProfit)],
          ['Extra Expenses', formatINR(breakdown.extraExpenses)],
          ['Net Profit (School)', formatINR(breakdown.netProfit)],
          ['Home Expenses', formatINR(homeExpensesTotal)],
          ['Overall Position', formatINR(breakdown.netProfit - homeExpensesTotal)],
        ],
      });

      doc.save(`little-flowers-report-${selectedYear?.label || 'report'}.pdf`);
      toast({ title: '📄 PDF exported' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  }, [breakdown, selectedYear, homeExpensesTotal]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportPDF} className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      <Tabs defaultValue="monthly">
        <TabsList className="flex-wrap">
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly P&L</TabsTrigger>
          <TabsTrigger value="alltime">All-Time</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
          <TabsTrigger value="expenses">Expense Analytics</TabsTrigger>
        </TabsList>

        {/* Monthly Summary — FIX 7 */}
        <TabsContent value="monthly" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-md border bg-card px-3 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MiniCard label="Income" value={formatINR(monthlySummary.income)} color="text-income" />
            <MiniCard label="School Expenses" value={formatINR(monthlySummary.school)} color="text-expense" />
            <MiniCard label="Home Expenses" value={formatINR(monthlySummary.home)} color="text-warning" />
            <MiniCard label="School Profit" value={formatINR(monthlySummary.schoolProfit)} color={monthlySummary.schoolProfit >= 0 ? 'text-primary' : 'text-expense'} subtitle="Income − School" />
            <MiniCard label="Overall Position" value={formatINR(monthlySummary.net)} color={monthlySummary.net >= 0 ? 'text-warning' : 'text-expense'} subtitle="After all expenses" />
          </div>

          {monthlySummary.categories.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Category Breakdown</h3>
              <div className="space-y-2">
                {monthlySummary.categories.map((c) => (
                  <div key={c.category} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{c.category}</span>
                    <span className="font-mono font-medium">{formatINR(c.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {monthlySummary.transactions.length > 0 && (
            <div className="rounded-lg border bg-card">
              <h3 className="border-b px-4 py-3 text-sm font-semibold">Transactions</h3>
              <div className="divide-y">
                {monthlySummary.transactions.slice(0, 20).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <span className="font-medium">{tx.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {tx.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <span className={`font-mono font-medium ${tx.isIncome ? 'text-income' : 'text-expense'}`}>
                      {tx.isIncome ? '+' : '-'}{formatINR(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {monthlySummary.transactions.length === 0 && (
            <div className="rounded-lg border border-dashed bg-card py-12 text-center text-sm text-muted-foreground">
              No transactions in this month.
            </div>
          )}
        </TabsContent>

        {/* Yearly P&L — FIX 3 + FIX 5 */}
        <TabsContent value="yearly" className="mt-4 space-y-4">
          <Select value={selectedYearId} onValueChange={setSelectedYearId}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {academicYears.map((y) => (
                <SelectItem key={y.id} value={y.id}>AY {y.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="rounded-lg border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold">Profit & Loss — AY {selectedYear?.label}</h3>
            <div className="space-y-3">
              <PLRow label="Total Income" value={breakdown.totalIncome} type="income" />
              {breakdown.fixedBreakdown.map((f) => (
                <PLRow key={f.category} label={f.category} value={f.amount} type="expense" indent />
              ))}
              <div className="border-t pt-2">
                <PLRow label="Gross Profit" value={breakdown.grossProfit} type={breakdown.grossProfit >= 0 ? 'income' : 'expense'} bold />
              </div>
              {breakdown.extraBreakdown.map((e) => (
                <PLRow key={e.category} label={e.category} value={e.amount} type="expense" indent />
              ))}
              <div className="border-t border-dashed pt-2">
                <PLRow label="SCHOOL NET PROFIT" value={breakdown.netProfit} type={breakdown.netProfit >= 0 ? 'income' : 'expense'} bold />
              </div>
              {homeExpensesTotal > 0 && (
                <>
                  <PLRow label="Personal/Home Expenses" value={homeExpensesTotal} type="expense" indent />
                  <div className="border-t pt-2">
                    <PLRow label="OVERALL POSITION" value={breakdown.netProfit - homeExpensesTotal} type={breakdown.netProfit - homeExpensesTotal >= 0 ? 'income' : 'expense'} bold />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Fee status */}
          {selectedYear && (() => {
            const pending = getPendingForYear(selectedYearId);
            const pct = pending.totalOwed > 0
              ? Math.min(100, Math.round((pending.collected / pending.totalOwed) * 100))
              : 0;
            return (
              <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-2 text-sm font-semibold">Fee Collection Status</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Collected</span>
                    <span className="font-mono font-medium text-income">{formatINR(pending.collected)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Target (this year)</span>
                    <span className="font-mono font-medium">{formatINR(selectedYear.targetTuitionFees)}</span>
                  </div>
                  {pending.carryForward > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Carry-forward (prev year)</span>
                      <span className="font-mono font-medium text-warning">{formatINR(pending.carryForward)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">Total Pending</span>
                    <span className="font-mono text-warning">{formatINR(pending.remaining)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-income transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{pct}% collected</p>
                </div>
              </div>
            );
          })()}

          {/* FIX 5: Two pie charts — School + Home */}
          <div className="grid gap-4 lg:grid-cols-2">
            {schoolCategoryBreakdown.length > 0 && (
              <div className="rounded-lg border bg-card p-5">
                <h3 className="mb-3 text-sm font-semibold">🏫 School Expenses</h3>
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="h-48 w-48 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={schoolCategoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                          {schoolCategoryBreakdown.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatINR(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {schoolCategoryBreakdown.map((c, i) => (
                      <div key={c.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-muted-foreground">{c.name}</span>
                        </div>
                        <span className="font-mono font-medium">{formatINR(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {homeCategoryBreakdown.length > 0 ? (
              <div className="rounded-lg border bg-card p-5">
                <h3 className="mb-3 text-sm font-semibold">🏠 Home Expenses</h3>
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="h-48 w-48 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={homeCategoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                          {homeCategoryBreakdown.map((_, i) => (<Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatINR(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {homeCategoryBreakdown.map((c, i) => (
                      <div key={c.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[(i + 3) % COLORS.length] }} />
                          <span className="text-muted-foreground">{c.name}</span>
                        </div>
                        <span className="font-mono font-medium">{formatINR(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed bg-card p-5 text-sm text-muted-foreground">
                No home expenses recorded.
              </div>
            )}
          </div>
        </TabsContent>

        {/* All-Time — FIX 3 */}
        <TabsContent value="alltime" className="mt-4 space-y-4">
          <div className="overflow-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3">Year</th>
                  <th className="p-3 text-right">Income</th>
                  <th className="p-3 text-right">School Exp.</th>
                  <th className="p-3 text-right">Home Exp.</th>
                  <th className="p-3 text-right">School Profit</th>
                  <th className="p-3 text-right">Overall</th>
                  <th className="p-3 text-right">Cumulative</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {allYearsData.map((y) => (
                  <tr key={y.year} className="border-b last:border-0">
                    <td className="p-3 font-medium">AY {y.year}</td>
                    <td className="p-3 text-right font-mono text-income">{formatINRAbbr(y.income)}</td>
                    <td className="p-3 text-right font-mono text-expense">{formatINRAbbr(y.schoolExpenses)}</td>
                    <td className="p-3 text-right font-mono text-warning">{formatINRAbbr(y.homeExpenses)}</td>
                    <td className={`p-3 text-right font-mono font-bold ${y.profit >= 0 ? 'text-income' : 'text-expense'}`}>{formatINRAbbr(y.profit)}</td>
                    <td className={`p-3 text-right font-mono ${y.overallPosition >= 0 ? 'text-income' : 'text-expense'}`}>{formatINRAbbr(y.overallPosition)}</td>
                    <td className={`p-3 text-right font-mono ${y.cumulative >= 0 ? 'text-income' : 'text-expense'}`}>{formatINRAbbr(y.cumulative)}</td>
                    <td className="p-3 text-right">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold capitalize ${
                        y.status === 'active' ? 'bg-income/10 text-income' :
                        y.status === 'closed' ? 'bg-muted text-muted-foreground' :
                        'bg-warning/10 text-warning'
                      }`}>{y.status.replace('_', ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-sm text-muted-foreground">All-Time Cumulative School Profit</p>
            <p className={`font-mono text-2xl font-bold ${getAllTimeCumulativeProfit() >= 0 ? 'text-income' : 'text-expense'}`}>
              {formatINR(getAllTimeCumulativeProfit())}
            </p>
          </div>

          {allYearsData.length > 1 && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold">Profit Trend</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={allYearsData}>
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatINRAbbr(v)} />
                    <Tooltip formatter={(v: number) => formatINR(v)} />
                    <Line type="monotone" dataKey="profit" stroke="hsl(210, 52%, 25%)" strokeWidth={2} dot={{ r: 4 }} name="School Profit" />
                    <Line type="monotone" dataKey="cumulative" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={{ r: 4 }} name="Cumulative" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Compare Years */}
        <TabsContent value="compare" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Year 1</label>
              <Select value={compareYear1} onValueChange={setCompareYear1}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {academicYears.map((y) => (<SelectItem key={y.id} value={y.id}>AY {y.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Year 2</label>
              <Select value={compareYear2} onValueChange={setCompareYear2}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {academicYears.map((y) => (<SelectItem key={y.id} value={y.id}>AY {y.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {comparison && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {comparison.items.map((item) => (
                  <div key={item.label} className="rounded-lg border bg-card p-4">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <div className="mt-1 flex items-end gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground">AY {comparison.y1Label}</p>
                        <p className="font-mono text-sm font-bold">{formatINRAbbr(item.v1)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">AY {comparison.y2Label}</p>
                        <p className="font-mono text-sm font-medium">{formatINRAbbr(item.v2)}</p>
                      </div>
                      <span className={`ml-auto text-sm font-bold ${item.pct > 0 ? 'text-expense' : item.pct < 0 ? 'text-income' : 'text-muted-foreground'}`}>
                        {item.pct > 0 ? '↑' : item.pct < 0 ? '↓' : '—'}{Math.abs(item.pct)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {comparison.catComparison.length > 0 && (
                <div className="overflow-auto rounded-lg border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">AY {comparison.y1Label}</th>
                        <th className="p-3 text-right">AY {comparison.y2Label}</th>
                        <th className="p-3 text-right">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.catComparison.map((c) => (
                        <tr key={c.category} className="border-b last:border-0">
                          <td className="p-3">{c.category}</td>
                          <td className="p-3 text-right font-mono">{formatINR(c.v1)}</td>
                          <td className="p-3 text-right font-mono">{formatINR(c.v2)}</td>
                          <td className={`p-3 text-right font-mono font-bold ${c.pct > 0 ? 'text-expense' : c.pct < 0 ? 'text-income' : ''}`}>
                            {c.pct > 0 ? '+' : ''}{c.pct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {!comparison && (
            <div className="rounded-lg border border-dashed bg-card py-12 text-center text-sm text-muted-foreground">
              Select two different years to compare.
            </div>
          )}
        </TabsContent>

        {/* Expense Analytics — FIX 5 */}
        <TabsContent value="expenses" className="mt-4 space-y-4">
          <Select value={selectedYearId} onValueChange={setSelectedYearId}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {academicYears.map((y) => (<SelectItem key={y.id} value={y.id}>AY {y.label}</SelectItem>))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniCard label="School" value={formatINR(expenseAnalytics.school)} color="text-expense" />
            <MiniCard label="Home" value={formatINR(expenseAnalytics.home)} color="text-warning" />
            <MiniCard label="Highest Month" value={formatINR(expenseAnalytics.highest)} color="text-expense" />
            <MiniCard label="Avg Monthly" value={formatINR(Math.round(expenseAnalytics.average))} color="text-muted-foreground" />
          </div>

          {/* School vs Home donut */}
          {expenseAnalytics.total > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold">School vs Home Ratio</h3>
              <div className="flex items-center gap-6">
                <div className="h-40 w-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'School', value: expenseAnalytics.school },
                          { name: 'Home', value: expenseAnalytics.home },
                        ]}
                        dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={30}
                      >
                        <Cell fill="hsl(210, 52%, 25%)" />
                        <Cell fill="hsl(38, 92%, 50%)" />
                      </Pie>
                      <Tooltip formatter={(v: number) => formatINR(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-full" style={{ background: 'hsl(210, 52%, 25%)' }} />
                    <span>School: {formatINR(expenseAnalytics.school)} ({Math.round((expenseAnalytics.school / expenseAnalytics.total) * 100)}%)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-full" style={{ background: 'hsl(38, 92%, 50%)' }} />
                    <span>Home: {formatINR(expenseAnalytics.home)} ({Math.round((expenseAnalytics.home / expenseAnalytics.total) * 100)}%)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top categories — ALL categories with type label */}
          {allCategoryBreakdown.length > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold">Top Expense Categories (All)</h3>
              <div className="space-y-3">
                {allCategoryBreakdown.map((c, i) => {
                  const max = allCategoryBreakdown[0]?.value || 1;
                  const pct = Math.round((c.value / max) * 100);
                  return (
                    <div key={c.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span>{i + 1}. {c.type === 'school' ? '🏫' : '🏠'} {c.name}</span>
                        <span className="font-mono font-medium">{formatINR(c.value)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: c.type === 'school' ? 'hsl(210, 52%, 25%)' : 'hsl(38, 92%, 50%)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly trend */}
          {expenseAnalytics.monthlyTrend.length > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold">Monthly Expense Trend</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expenseAnalytics.monthlyTrend}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatINRAbbr(v)} />
                    <Tooltip formatter={(v: number) => formatINR(v)} />
                    <Bar dataKey="amount" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MiniCard({ label, value, color, subtitle }: { label: string; value: string; color: string; subtitle?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 break-all font-mono text-lg font-bold ${color}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function PLRow({ label, value, type, bold, indent }: {
  label: string; value: number; type: 'income' | 'expense'; bold?: boolean; indent?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${indent ? 'pl-4' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`font-mono text-sm ${bold ? 'text-base font-bold' : 'font-medium'} ${type === 'income' ? 'text-income' : 'text-expense'}`}>
        {type === 'expense' && value > 0 ? '-' : ''}{formatINR(value)}
      </span>
    </div>
  );
}
