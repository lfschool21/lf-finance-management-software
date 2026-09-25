import React from 'react';
import { Calculator, ArrowRight, CheckCircle2, AlertCircle, Building2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { useTranslation } from '@/lib/i18n';
import type { AverageFeeMetrics } from '@/lib/student-fees';

interface AverageFeeDashboardCardProps {
  overall: AverageFeeMetrics;
  gujarati: AverageFeeMetrics;
  english: AverageFeeMetrics;
  academicYearLabel?: string;
  onOpenCalculator: () => void;
  onNavigateStudents: () => void;
}

export function AverageFeeDashboardCard({
  overall,
  gujarati,
  english,
  academicYearLabel,
  onOpenCalculator,
  onNavigateStudents,
}: AverageFeeDashboardCardProps) {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="avg-fees-title"
      className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calculator className="h-4 w-4" />
            </div>
            <h2 id="avg-fees-title" className="text-lg font-bold text-foreground">
              {t('averageFeePerStudent')}
            </h2>
            <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground font-mono-nums">
              AY: {academicYearLabel || '—'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('averageFeesSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onOpenCalculator}
            className="gap-1.5 text-xs font-semibold shadow-xs"
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>{t('openFeeCalculator')}</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Overall Hero vs Medium Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Overall School Average Fee Charged Spotlight (7 cols) */}
        <div className="lg:col-span-7 rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-card to-card p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {t('avgFeeChargedBySchool')}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary font-mono-nums">
                {overall.totalStudents} {overall.totalStudents === 1 ? 'Student' : 'Students'}
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span
                className="font-mono text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground font-mono-nums"
                title={formatINR(overall.avgAnnualFeeCharged)}
              >
                {formatINR(overall.avgAnnualFeeCharged)}
              </span>
              <span className="text-sm font-sans text-muted-foreground font-medium">
                / student / year
              </span>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Total school annual fee target:{' '}
              <strong className="text-foreground font-semibold font-mono-nums">
                {formatINR(overall.totalAnnualFee)}
              </strong>
            </p>

            {/* Collection Realization Progress */}
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono-nums">
                <span className="text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-income" />
                  Avg Realized: <strong className="text-income font-semibold">{formatINR(overall.avgCollected)}</strong> / student
                </span>
                <span className="font-bold text-foreground">
                  {overall.collectionRate}% collected
                </span>
              </div>
              <Progress value={overall.collectionRate} className="h-2" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/70 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground font-mono-nums">
              Avg Outstanding:{' '}
              <strong className="text-warning font-semibold">{formatINR(overall.avgPending)}</strong> / student
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateStudents}
              className="h-7 text-xs font-semibold text-primary p-0 hover:bg-transparent hover:underline"
            >
              <span>View Roster</span>
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Right: Medium Average Fee Cards (5 cols) */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 font-mono-nums">
          {/* Gujarati Medium Avg Fee */}
          <div className="rounded-xl border border-amber-500/30 bg-card p-3.5 shadow-xs flex flex-col justify-between hover:border-amber-500/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="font-sans text-xs font-bold text-foreground">
                  Gujarati Medium Avg
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {gujarati.totalStudents} students
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-xl font-bold text-foreground">
                  {formatINR(gujarati.avgAnnualFeeCharged)}
                </span>
                <span className="text-[10px] font-sans text-muted-foreground ml-1">
                  charged / stu
                </span>
              </div>
              <div className="text-right text-xs">
                <span className="text-income font-semibold block">
                  {formatINR(gujarati.avgCollected)} recvd
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {gujarati.collectionRate}% realized
                </span>
              </div>
            </div>
          </div>

          {/* English Medium Avg Fee */}
          <div className="rounded-xl border border-sky-500/30 bg-card p-3.5 shadow-xs flex flex-col justify-between hover:border-sky-500/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                <span className="font-sans text-xs font-bold text-foreground">
                  English Medium Avg
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {english.totalStudents} students
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-xl font-bold text-foreground">
                  {formatINR(english.avgAnnualFeeCharged)}
                </span>
                <span className="text-[10px] font-sans text-muted-foreground ml-1">
                  charged / stu
                </span>
              </div>
              <div className="text-right text-xs">
                <span className="text-income font-semibold block">
                  {formatINR(english.avgCollected)} recvd
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {english.collectionRate}% realized
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
