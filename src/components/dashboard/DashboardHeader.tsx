import React from 'react';
import { ArrowLeftRight, Languages, Plus, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface DashboardHeaderProps {
  academicYearLabel?: string;
  onRecordFee: () => void;
  onAddExpense: () => void;
  onTransfer: () => void;
}

export function DashboardHeader({
  academicYearLabel,
  onRecordFee,
  onAddExpense,
  onTransfer,
}: DashboardHeaderProps) {
  const { t, language, setLanguage } = useTranslation();

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t('dashboardTitle')}
        </h1>
        <p className="text-sm font-medium text-muted-foreground">
          {t('academicYearPrefix')} {academicYearLabel || '—'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Language Switcher Button */}
        <div
          role="group"
          aria-label="Language selector"
          className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5 text-xs"
        >
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              language === 'en'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-pressed={language === 'en'}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('gu')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              language === 'gu'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-pressed={language === 'gu'}
          >
            ગુજરાતી
          </button>
        </div>

        {/* Primary Operational Action */}
        <Button
          size="sm"
          className="gap-1.5 bg-income text-income-foreground hover:bg-income/90 shadow-sm font-semibold"
          onClick={onRecordFee}
        >
          <Receipt className="h-4 w-4 shrink-0" />
          <span>{t('recordFeePayment')}</span>
        </Button>

        {/* Secondary Action */}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-expense/30 text-expense hover:bg-expense/10 hover:text-expense font-medium"
          onClick={onAddExpense}
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>{t('addExpense')}</span>
        </Button>

        {/* Additional action: Transfer - shown directly on sm+ screens, in More menu on xs */}
        <div className="hidden sm:block">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 font-medium"
            onClick={onTransfer}
          >
            <ArrowLeftRight className="h-4 w-4 shrink-0" />
            <span>{t('transfer')}</span>
          </Button>
        </div>

        {/* Mobile dropdown for Transfer */}
        <div className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="px-2" aria-label={t('moreActions')}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onTransfer} className="gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                <span>{t('transferFunds')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
