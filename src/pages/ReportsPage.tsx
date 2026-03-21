import { useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  PieChart as PieChartIcon,
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
import { FIXED_EXPENSE_CATEGORIES } from '@/types/finance';

const COLORS = [
  'hsl(210, 52%, 25%)',
  'hsl(160, 84%, 39%)',
  'hsl(0, 84%, 60%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(190, 70%, 45%)',
  'hsl(330, 70%, 50%)',
  'hsl(60, 80%, 45%)',
];

export default function ReportsPage() {
  const { incomeEntries, expenseEntries, academicYears, currentYearId } = useFinanceStore();
  const currentYear = academicYears.find((y) => y.id === currentYearId);

  const yearlyPL = useMemo(() => {
    const yearIncome = incomeEntries.filter((i) => i.academicYearId === currentYearId);
    const yearExpenses = expenseEntries.filter(
      (e) => e.academicYearId === currentYearId && e.expenseType === 'school'
    );

    const totalIncome = yearIncome.reduce((s, i) => s + i.amount, 0);
    const fixedExpenses = yearExpenses
      .filter((e) => (FIXED_EXPENSE_CATEGORIES as readonly string[]).includes(e.category))
      .reduce((s, e) => s + e.amount, 0);
    const extraExpenses = yearExpenses
      .filter((e) => !(FIXED_EXPENSE_CATEGORIES as readonly string[]).includes(e.category))
      .reduce((s, e) => s + e.amount, 0);
    const gross = totalIncome - fixedExpenses;
    const net = gross - extraExpenses;

    return { totalIncome, fixedExpenses, extraExpenses, gross, net };
  }, [incomeEntries, expenseEntries, currentYearId]);

  const allYearsData = useMemo(() => {
    return academicYears.map((y) => {
      const income = incomeEntries
        .filter((i) => i.academicYearId === y.id)
        .reduce((s, i) => s + i.amount, 0);
      const expenses = expenseEntries
        .filter((e) => e.academicYearId === y.id && e.expenseType === 'school')
        .reduce((s, e) => s + e.amount, 0);
      return {
        year: y.label,
        income,
        expenses,
        profit: income - expenses,
      };
    });
  }, [academicYears, incomeEntries, expenseEntries]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    expenseEntries
      .filter((e) => e.academicYearId === currentYearId && e.expenseType === 'school')
      .forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenseEntries, currentYearId]);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Reports & Analytics</h1>

      <Tabs defaultValue="yearly">
        <TabsList className="flex-wrap">
          <TabsTrigger value="yearly">Yearly P&L</TabsTrigger>
          <TabsTrigger value="alltime">All-Time</TabsTrigger>
          <TabsTrigger value="expenses">Expense Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="yearly" className="mt-4 space-y-4">
          {/* P&L Statement */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold">
              Profit & Loss — AY {currentYear?.label}
            </h3>
            <div className="space-y-3">
              <PLRow label="Total Income" value={yearlyPL.totalIncome} type="income" />
              <PLRow label="Fixed Expenses" value={yearlyPL.fixedExpenses} type="expense" indent />
              <div className="border-t pt-2">
                <PLRow label="Gross Profit" value={yearlyPL.gross} type={yearlyPL.gross >= 0 ? 'income' : 'expense'} bold />
              </div>
              <PLRow label="Extra Expenses" value={yearlyPL.extraExpenses} type="expense" indent />
              <div className="border-t pt-2">
                <PLRow label="Net Profit" value={yearlyPL.net} type={yearlyPL.net >= 0 ? 'income' : 'expense'} bold />
              </div>
            </div>
          </div>

          {/* Category Pie */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold">Expense Breakdown</h3>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-52 w-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                    >
                      {categoryBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatINR(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {categoryBreakdown.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground">{c.name}</span>
                    </div>
                    <span className="font-mono font-medium">{formatINR(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alltime" className="mt-4 space-y-4">
          {/* All-time table */}
          <div className="overflow-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3">Year</th>
                  <th className="p-3 text-right">Income</th>
                  <th className="p-3 text-right">Expenses</th>
                  <th className="p-3 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody>
                {allYearsData.map((y) => (
                  <tr key={y.year} className="border-b last:border-0">
                    <td className="p-3 font-medium">AY {y.year}</td>
                    <td className="p-3 text-right font-mono text-income">{formatINR(y.income)}</td>
                    <td className="p-3 text-right font-mono text-expense">{formatINR(y.expenses)}</td>
                    <td className={`p-3 text-right font-mono font-bold ${y.profit >= 0 ? 'text-income' : 'text-expense'}`}>
                      {formatINR(y.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Trend chart */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold">Profit Trend</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={allYearsData}>
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatINRAbbr(v)} />
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                  <Line type="monotone" dataKey="profit" stroke="hsl(210, 52%, 25%)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4 space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold">Top Expense Categories</h3>
            <div className="space-y-3">
              {categoryBreakdown.map((c, i) => {
                const max = categoryBreakdown[0]?.value || 1;
                const pct = Math.round((c.value / max) * 100);
                return (
                  <div key={c.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{i + 1}. {c.name}</span>
                      <span className="font-mono font-medium">{formatINR(c.value)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PLRow({
  label,
  value,
  type,
  bold,
  indent,
}: {
  label: string;
  value: number;
  type: 'income' | 'expense';
  bold?: boolean;
  indent?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${indent ? 'pl-4' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
      <span
        className={`font-mono text-sm ${bold ? 'text-base font-bold' : 'font-medium'} ${
          type === 'income' ? 'text-income' : 'text-expense'
        }`}
      >
        {type === 'expense' && value > 0 ? '-' : ''}{formatINR(value)}
      </span>
    </div>
  );
}
