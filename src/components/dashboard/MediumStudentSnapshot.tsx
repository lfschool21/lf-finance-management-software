import React from 'react';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { useTranslation } from '@/lib/i18n';

interface MediumStats {
  totalStudents: number;
  pendingStudents: number;
  pendingAmount: number;
  avgAnnualFeeCharged?: number;
  avgCollected?: number;
}

interface MediumStudentSnapshotProps {
  gujarati: MediumStats;
  english: MediumStats;
  unassignedCurrentTuition: number;
  onNavigateMedium: (medium: 'gujarati' | 'english') => void;
  onViewAllStudents: () => void;
}

export function MediumStudentSnapshot({
  gujarati,
  english,
  unassignedCurrentTuition,
  onNavigateMedium,
  onViewAllStudents,
}: MediumStudentSnapshotProps) {
  const { t } = useTranslation();
  const totalActive = gujarati.totalStudents + english.totalStudents;

  return (
    <section aria-labelledby="medium-snapshot-title" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="medium-snapshot-title" className="text-lg font-bold text-foreground">
            {t('studentsByMedium')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('studentsByMediumSubtitle')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs font-semibold text-primary hover:bg-primary/5"
          onClick={onViewAllStudents}
        >
          <span>{t('allStudentsCount', { count: totalActive })}</span>
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Gujarati Medium Card */}
        <div className="rounded-xl border border-amber-500/30 bg-card p-4 shadow-sm transition-all hover:border-amber-500/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-amber-600 dark:bg-amber-400 shrink-0"
                  aria-hidden="true"
                />
                <h3 className="text-base font-bold text-foreground">{t('gujaratiMedium')}</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-500/15 text-amber-800 dark:text-amber-300 font-mono-nums">
                {t('studentsCountBadge', { count: gujarati.totalStudents })}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/40 p-2.5">
                <p className="text-xs text-muted-foreground">{t('withFeesPending')}</p>
                <p className="mt-1 font-mono text-base font-bold text-foreground font-mono-nums">
                  {gujarati.pendingStudents}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <p className="text-xs text-muted-foreground">{t('studentLedgerPending')}</p>
                <p
                  className="mt-1 font-mono text-base font-bold text-warning font-mono-nums"
                  title={formatINR(gujarati.pendingAmount)}
                >
                  {formatINRAbbr(gujarati.pendingAmount)}
                </p>
              </div>
            </div>

            {typeof gujarati.avgAnnualFeeCharged === 'number' && gujarati.avgAnnualFeeCharged > 0 && (
              <div className="mt-2.5 flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 font-mono-nums">
                <span className="text-muted-foreground text-[11px]">Avg Fee Charged:</span>
                <span className="font-bold text-foreground">{formatINR(gujarati.avgAnnualFeeCharged)} / stu</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border/70 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {gujarati.totalStudents > 0
                ? t('feesClearedPercent', {
                    percent: Math.round(
                      ((gujarati.totalStudents - gujarati.pendingStudents) / gujarati.totalStudents) * 100
                    ),
                  })
                : t('noActiveEnrollments')}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-semibold border-amber-500/30 text-amber-900 dark:text-amber-200 hover:bg-amber-500/10"
              onClick={() => onNavigateMedium('gujarati')}
            >
              <span>{t('viewGujaratiStudents')}</span>
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* English Medium Card */}
        <div className="rounded-xl border border-sky-500/30 bg-card p-4 shadow-sm transition-all hover:border-sky-500/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-sky-600 dark:bg-sky-400 shrink-0"
                  aria-hidden="true"
                />
                <h3 className="text-base font-bold text-foreground">{t('englishMedium')}</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-sky-500/15 text-sky-800 dark:text-sky-300 font-mono-nums">
                {t('studentsCountBadge', { count: english.totalStudents })}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/40 p-2.5">
                <p className="text-xs text-muted-foreground">{t('withFeesPending')}</p>
                <p className="mt-1 font-mono text-base font-bold text-foreground font-mono-nums">
                  {english.pendingStudents}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <p className="text-xs text-muted-foreground">{t('studentLedgerPending')}</p>
                <p
                  className="mt-1 font-mono text-base font-bold text-warning font-mono-nums"
                  title={formatINR(english.pendingAmount)}
                >
                  {formatINRAbbr(english.pendingAmount)}
                </p>
              </div>
            </div>

            {typeof english.avgAnnualFeeCharged === 'number' && english.avgAnnualFeeCharged > 0 && (
              <div className="mt-2.5 flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 font-mono-nums">
                <span className="text-muted-foreground text-[11px]">Avg Fee Charged:</span>
                <span className="font-bold text-foreground">{formatINR(english.avgAnnualFeeCharged)} / stu</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border/70 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {english.totalStudents > 0
                ? t('feesClearedPercent', {
                    percent: Math.round(
                      ((english.totalStudents - english.pendingStudents) / english.totalStudents) * 100
                    ),
                  })
                : t('noActiveEnrollments')}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-semibold border-sky-500/30 text-sky-900 dark:text-sky-200 hover:bg-sky-500/10"
              onClick={() => onNavigateMedium('english')}
            >
              <span>{t('viewEnglishStudents')}</span>
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Unassigned Tuition Reconciliation Notice (shown only when unassignedCurrentTuition > 0) */}
      {unassignedCurrentTuition > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/[0.06] p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-foreground">
              {t('unassignedTuitionNotice', { amount: formatINR(unassignedCurrentTuition) })}
            </span>
          </div>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs font-semibold text-warning hover:underline shrink-0"
            onClick={onViewAllStudents}
          >
            {t('reviewAndLinkFees')}
          </Button>
        </div>
      )}
    </section>
  );
}
