import React from 'react';
import { BarChart3 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { useTranslation } from '@/lib/i18n';

interface CashFlowItem {
  month: string;
  income: number;
  expenses: number;
}

interface CashFlowChartProps {
  data: CashFlowItem[];
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  const { t } = useTranslation();

  return (
    <section
      className="rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:p-5 flex flex-col justify-between"
      aria-labelledby="cash-flow-heading"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 id="cash-flow-heading" className="text-sm font-bold text-foreground">
            {t('monthlyIncomeVsExpenses')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('monthlyCashFlowSubtitle')}
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 p-4 text-center">
          <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">{t('noCashFlowData')}</p>
          <p className="text-xs text-muted-foreground/70">
            {t('noCashFlowSubtitle')}
          </p>
        </div>
      ) : (
        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={3} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(val: number) => formatINRAbbr(val)}
                tickLine={false}
                axisLine={false}
              />
              <RechartsTooltip
                formatter={(val: number, name: string) => [formatINR(val), name]}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  color: 'hsl(var(--foreground))',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Bar
                dataKey="income"
                fill="hsl(var(--income))"
                radius={[4, 4, 0, 0]}
                name={t('incomeLegend')}
                maxBarSize={32}
              />
              <Bar
                dataKey="expenses"
                fill="hsl(var(--expense))"
                radius={[4, 4, 0, 0]}
                name={t('schoolExpensesLegend')}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
