import React from 'react';
import { ArrowRight, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatINRAbbr, formatINR } from '@/utils/currency';
import { useTranslation } from '@/lib/i18n';

interface ExpenseCategory {
  name: string;
  value: number;
}

interface ExpenseCategorySummaryProps {
  categories: ExpenseCategory[];
  onViewAllReports: () => void;
}

export function ExpenseCategorySummary({
  categories,
  onViewAllReports,
}: ExpenseCategorySummaryProps) {
  const { t } = useTranslation();

  return (
    <section
      className="rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:p-5 flex flex-col justify-between"
      aria-labelledby="expense-categories-heading"
    >
      <div>
        <div className="mb-3">
          <h2 id="expense-categories-heading" className="text-sm font-bold text-foreground">
            {t('topSchoolExpenseCategories')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('topCategoriesSubtitle')}
          </p>
        </div>

        {categories.length === 0 ? (
          <div className="flex h-44 flex-col items-center justify-center text-center p-4">
            <Receipt className="mb-2 h-7 w-7 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('noSchoolExpensesYet')}</p>
          </div>
        ) : (
          <div className="space-y-2.5 pt-1">
            {categories.map((cat, idx) => (
              <div
                key={cat.name}
                className="flex items-center justify-between gap-3 text-sm py-1 border-b border-border/40 last:border-0"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-expense/10 text-[11px] font-bold text-expense font-mono-nums">
                    {idx + 1}
                  </span>
                  <span className="truncate font-medium text-foreground text-xs sm:text-sm">
                    {cat.name}
                  </span>
                </div>
                <span
                  className="font-mono text-xs font-semibold text-foreground shrink-0 font-mono-nums"
                  title={formatINR(cat.value)}
                >
                  {formatINRAbbr(cat.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-2 border-t border-border/70">
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-xs font-semibold text-primary hover:text-primary/80"
          onClick={onViewAllReports}
        >
          <span>{t('viewAllExpenseAnalytics')}</span>
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </section>
  );
}
