import React from 'react';
import { HelpCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { formatINR } from '@/utils/currency';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FinancialPositionProps {
  totalIncome: number;
  schoolExpenses: number;
  netProfit: number;
  projectedProfit: number;
}

export function FinancialPosition({
  totalIncome,
  schoolExpenses,
  netProfit,
  projectedProfit,
}: FinancialPositionProps) {
  const { t } = useTranslation();
  const isNetProfitable = netProfit >= 0;
  const isProjectedProfitable = projectedProfit >= 0;

  return (
    <section aria-labelledby="financial-position-heading" className="space-y-3">
      <div>
        <h2 id="financial-position-heading" className="text-lg font-bold text-foreground">
          {t('financialPosition')}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t('financialPositionSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Cash Income Received */}
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t('cashIncomeReceived')}
          </p>
          <p
            className="mt-1 font-mono text-lg font-bold text-income font-mono-nums"
            title={formatINR(totalIncome)}
          >
            {formatINR(totalIncome)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t('allFeesAndIncome')}
          </p>
        </div>

        {/* School Expenses */}
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t('schoolExpenses')}
          </p>
          <p
            className="mt-1 font-mono text-lg font-bold text-expense font-mono-nums"
            title={formatINR(schoolExpenses)}
          >
            {formatINR(schoolExpenses)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t('fixedAndExtraCosts')}
          </p>
        </div>

        {/* Realized School Profit */}
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t('currentSchoolProfit')}
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <p
              className={cn(
                'font-mono text-lg font-bold font-mono-nums',
                isNetProfitable ? 'text-income' : 'text-expense'
              )}
              title={formatINR(netProfit)}
            >
              {formatINR(netProfit)}
            </p>
            {isNetProfitable ? (
              <TrendingUp className="h-4 w-4 text-income shrink-0" />
            ) : (
              <TrendingDown className="h-4 w-4 text-expense shrink-0" />
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t('schoolProfitSub')}
          </p>
        </div>

        {/* Projected Year-End School Profit */}
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <div className="flex items-center gap-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              {t('projectedYearEnd')}
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Projection explanation">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/70" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {t('projectedTooltip')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <p
            className={cn(
              'mt-1 font-mono text-lg font-bold font-mono-nums',
              isProjectedProfitable ? 'text-income' : 'text-expense'
            )}
            title={formatINR(projectedProfit)}
          >
            {formatINR(projectedProfit)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t('projectedYearEndSchoolProfit')}
          </p>
        </div>
      </div>
    </section>
  );
}
