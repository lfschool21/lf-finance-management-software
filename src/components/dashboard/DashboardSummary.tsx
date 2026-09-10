import React from 'react';
import { Landmark, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface DashboardSummaryProps {
  totalFeesStillToCollect: number;
  availableBalance: number;
  schoolProfit: number;
  activeStudents: number;
  gujaratiStudents: number;
  englishStudents: number;
}

export function DashboardSummary({
  totalFeesStillToCollect,
  availableBalance,
  schoolProfit,
  activeStudents,
  gujaratiStudents,
  englishStudents,
}: DashboardSummaryProps) {
  const { t } = useTranslation();
  const isProfitable = schoolProfit >= 0;

  return (
    <section aria-label="Executive Financial Summary">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Total Fees Still To Collect */}
        <div className="min-w-0 rounded-xl border border-warning/30 bg-card p-4 shadow-sm transition-all hover:border-warning/50">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('feesStillToCollect')}
              </p>
              <p
                className="mt-1.5 whitespace-nowrap font-mono text-2xl font-bold tracking-tight text-warning font-mono-nums"
                title={formatINR(totalFeesStillToCollect)}
                aria-label={`${t('feesStillToCollect')}: ${formatINR(totalFeesStillToCollect)}`}
              >
                {formatINRAbbr(totalFeesStillToCollect)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {t('feesStillToCollectSub')}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Metric 2: Available Balance */}
        <div className="min-w-0 rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-primary/40">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('availableBalance')}
              </p>
              <p
                className="mt-1.5 whitespace-nowrap font-mono text-2xl font-bold tracking-tight text-foreground font-mono-nums"
                title={formatINR(availableBalance)}
                aria-label={`${t('availableBalance')}: ${formatINR(availableBalance)}`}
              >
                {formatINRAbbr(availableBalance)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {t('availableBalanceSub')}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Landmark className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Metric 3: School Profit */}
        <div className="min-w-0 rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-border">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('schoolProfit')}
              </p>
              <p
                className={cn(
                  'mt-1.5 whitespace-nowrap font-mono text-2xl font-bold tracking-tight font-mono-nums',
                  isProfitable ? 'text-income' : 'text-expense'
                )}
                title={formatINR(schoolProfit)}
                aria-label={`${t('schoolProfit')}: ${formatINR(schoolProfit)}`}
              >
                {formatINRAbbr(schoolProfit)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {t('schoolProfitSub')}
              </p>
            </div>
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                isProfitable ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
              )}
            >
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Metric 4: Active Students */}
        <div className="min-w-0 rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-border">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('activeStudents')}
              </p>
              <p className="mt-1.5 whitespace-nowrap font-mono text-2xl font-bold tracking-tight text-foreground font-mono-nums">
                {activeStudents}
              </p>
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {t('activeStudentsSub', { gujarati: gujaratiStudents, english: englishStudents })}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
