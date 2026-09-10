import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Layers, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatINR } from '@/utils/currency';
import { useTranslation } from '@/lib/i18n';
import type { ClassRosterSummary, RosterSummary } from '@/lib/student-fees';
import type { AcademicYear } from '@/types/finance';

import type { StudentMedium } from '@/types/students';

interface StudentOverviewProps {
  summary: RosterSummary;
  classes: ClassRosterSummary[];
  year?: AcademicYear;
  unassignedTuition: number;
  activeMedium?: 'all' | StudentMedium;
}

export function StudentOverview({
  summary,
  classes,
  year,
  unassignedTuition,
  activeMedium = 'all',
}: StudentOverviewProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const targetTuition = year?.targetTuitionFees || 0;
  const targetDifference = targetTuition - summary.obligation;

  const isGujarati = activeMedium === 'gujarati';
  const isEnglish = activeMedium === 'english';
  const isAll = activeMedium === 'all';

  return (
    <div className="space-y-3">
      {/* Compact Overview Bar */}
      <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-sm">
        {/* Scope Context Label when medium is filtered */}
        {!isAll && (
          <div className="mb-2 pb-2 border-b flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  isGujarati ? 'bg-amber-500' : 'bg-sky-500'
                }`}
              />
              <span className="font-semibold text-foreground">
                {isGujarati ? t('gujaratiMediumSummary') : t('englishMediumSummary')}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Showing figures for {isGujarati ? 'Gujarati' : 'English'} enrollments only
            </span>
          </div>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-6 flex-1">
            {/* Total Students */}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {isAll ? t('totalStudents') : isGujarati ? t('gujaratiStudentsLabel') : t('englishStudentsLabel')}
              </p>
              <div className="mt-0.5 flex items-baseline gap-1.5 font-mono-nums">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {summary.totalStudents}
                </span>
                {isAll ? (
                  <span className="text-[11px] text-muted-foreground">
                    ({summary.english} Eng · {summary.gujarati} Guj)
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">enrolled</span>
                )}
              </div>
            </div>

            {/* Pending Students */}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {t('feesPending')}
              </p>
              <div className="mt-0.5 flex items-baseline gap-1.5 font-mono-nums">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-warning">
                  {summary.pendingStudents}
                </span>
                <span className="text-[11px] text-muted-foreground">students</span>
              </div>
            </div>

            {/* Fully Paid */}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {t('fullyPaid')}
              </p>
              <div className="mt-0.5 flex items-baseline gap-1.5 font-mono-nums">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-income">
                  {summary.fullyPaidStudents}
                </span>
                <span className="text-[11px] text-muted-foreground">students</span>
              </div>
            </div>

            {/* Total Pending Amount */}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {t('totalDuesPending')}
              </p>
              <p className="money-fit mt-0.5 font-mono text-xl sm:text-2xl font-bold tracking-tight text-warning font-mono-nums">
                {formatINR(summary.pending)}
              </p>
            </div>
          </div>

          {/* Progressive Disclosure Toggle */}
          <div className="border-t pt-2.5 md:border-t-0 md:border-l md:pl-4 md:pt-0 shrink-0">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full md:w-auto text-xs text-muted-foreground hover:text-foreground gap-1.5"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>{isOpen ? 'Hide Class Summary' : 'Class Summary & Reconciliation'}</span>
                  {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>

        {/* Collapsible Section for Secondary Financial Analytics */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent className="space-y-4 pt-4 mt-3 border-t">
            {/* Class-wise Breakdown Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {isAll
                    ? 'Class Strength & Fees Breakdown (All Mediums)'
                    : isGujarati
                    ? 'Gujarati Medium Class Strength & Fees'
                    : 'English Medium Class Strength & Fees'}
                </h3>
                <span className="text-xs text-muted-foreground">{classes.length} Classes Active</span>
              </div>

              {classes.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border bg-background/50">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b bg-muted/30 text-muted-foreground font-medium">
                        <th className="py-2 px-3">Class</th>
                        {isAll && <th className="py-2 px-3 text-center">English</th>}
                        {isAll && <th className="py-2 px-3 text-center">Gujarati</th>}
                        <th className="py-2 px-3 text-center">
                          {isAll ? 'Total' : isGujarati ? 'Gujarati Students' : 'English Students'}
                        </th>
                        <th className="py-2 px-3 text-right">Target Fee</th>
                        <th className="py-2 px-3 text-right">Collected</th>
                        <th className="py-2 px-3 text-right">Pending</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 font-mono-nums">
                      {classes.map((cls) => (
                        <tr key={cls.className} className="hover:bg-muted/20">
                          <td className="py-2 px-3 font-sans font-medium text-foreground">{cls.className}</td>
                          {isAll && <td className="py-2 px-3 text-center text-muted-foreground">{cls.english}</td>}
                          {isAll && <td className="py-2 px-3 text-center text-muted-foreground">{cls.gujarati}</td>}
                          <td className="py-2 px-3 text-center font-medium">
                            {isAll ? cls.totalStudents : isGujarati ? cls.gujarati : cls.english}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{formatINR(cls.obligation)}</td>
                          <td className="py-2 px-3 text-right font-mono text-income font-medium">{formatINR(cls.collected)}</td>
                          <td className="py-2 px-3 text-right font-mono text-warning font-medium">
                            {cls.pending > 0 ? formatINR(cls.pending) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-3 text-center">No active class enrollments found.</p>
              )}
            </div>

            {/* Roster Reconciliation Cards */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <PieChart className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Roster vs Financial Ledger Reconciliation</h3>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 text-xs">
                <div className="rounded-lg border bg-background/50 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Tuition Target</p>
                  <p className="money-fit mt-1 font-mono font-semibold">{formatINR(targetTuition)}</p>
                </div>
                <div className="rounded-lg border bg-background/50 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Roster Fee Total</p>
                  <p className="money-fit mt-1 font-mono font-semibold">{formatINR(summary.obligation)}</p>
                </div>
                <div className="rounded-lg border bg-background/50 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Target Difference</p>
                  <p className={`money-fit mt-1 font-mono font-semibold ${targetDifference !== 0 ? 'text-warning' : ''}`}>
                    {formatINR(targetDifference)}
                  </p>
                </div>
                <div className="rounded-lg border bg-background/50 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Unassigned Tuition</p>
                  <p className={`money-fit mt-1 font-mono font-semibold ${unassignedTuition !== 0 ? 'text-warning' : ''}`}>
                    {formatINR(unassignedTuition)}
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
