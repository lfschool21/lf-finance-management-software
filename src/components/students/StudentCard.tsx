import React from 'react';
import {
  IndianRupee,
  MoreHorizontal,
  Edit,
  Eye,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StudentFeeBadge } from './StudentFeeBadge';
import { StudentMediumBadge } from './StudentMediumBadge';
import { formatINR } from '@/utils/currency';
import { useTranslation } from '@/lib/i18n';
import type { Student, StudentEnrollment, StudentMedium } from '@/types/students';
import type { StudentRowData } from './StudentTable';

interface StudentCardProps {
  row: StudentRowData;
  onSelectStudent: (studentId: string) => void;
  onRecordPayment: (enrollmentId: string) => void;
  onRecordPreviousPayment?: (row: StudentRowData) => void;
  onEditStudent: (student: Student, enrollment: StudentEnrollment) => void;
  activeMedium?: 'all' | StudentMedium;
}

export function StudentCard({
  row,
  onSelectStudent,
  onRecordPayment,
  onRecordPreviousPayment,
  onEditStudent,
  activeMedium = 'all',
}: StudentCardProps) {
  const { t } = useTranslation();
  const { student, enrollment, fees, previous } = row;

  // Extract initials for the avatar badge
  const initials = student.fullName
    .split(' ')
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'ST';

  // Fee status accent border class
  const statusBorderClass =
    fees.status === 'paid'
      ? 'hover:border-emerald-500/50'
      : fees.status === 'partially_paid'
      ? 'hover:border-amber-500/50'
      : 'hover:border-rose-500/50';

  const statusTopAccent =
    fees.status === 'paid'
      ? 'bg-emerald-500'
      : fees.status === 'partially_paid'
      ? 'bg-amber-500'
      : 'bg-rose-500';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Student card: ${student.fullName}`}
      onClick={(e) => {
        // Do not trigger card selection if clicking an internal button, link, or menu
        if ((e.target as HTMLElement).closest('button, a, [role="menuitem"]')) {
          return;
        }
        onSelectStudent(student.id);
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectStudent(student.id);
        }
      }}
      className={`group relative flex flex-col justify-between rounded-2xl border bg-card p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${statusBorderClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer text-left overflow-hidden`}
    >
      {/* Subtle top indicator bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${statusTopAccent} opacity-80 group-hover:opacity-100 transition-opacity`} />

      {/* Top Header Section */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2.5">
          {/* Avatar and Student Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs tracking-wider ring-1 ring-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
              {initials}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate">
                {student.fullName}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap font-sans mt-0.5">
                <span className="font-mono text-[11px] font-medium bg-muted/60 px-1.5 py-0.5 rounded text-foreground/80 font-mono-nums">
                  {student.admissionNumber || 'No Adm.'}
                </span>
                <span>•</span>
                <span className="font-medium text-foreground/90 font-mono-nums">{enrollment.className}</span>
              </p>
            </div>
          </div>

          {/* Action Menu (stops click bubbling to card) */}
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 -mr-1 -mt-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                  aria-label={`Actions for ${student.fullName}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 text-xs">
                <DropdownMenuItem
                  onClick={() => onSelectStudent(student.id)}
                  className="gap-2 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{t('viewDetails')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onRecordPayment(enrollment.id)}
                  className="gap-2 cursor-pointer"
                >
                  <IndianRupee className="h-3.5 w-3.5 text-income" />
                  <span>{t('recordFeePayment')}</span>
                </DropdownMenuItem>
                {previous > 0 && (
                  <DropdownMenuItem
                    onClick={() => onRecordPayment(enrollment.id)}
                    className="gap-2 cursor-pointer text-amber-600 dark:text-amber-400 font-medium"
                  >
                    <IndianRupee className="h-3.5 w-3.5" />
                    <span>Pay Last Year Dues ({formatINR(previous)})</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => onEditStudent(student, enrollment)}
                  className="gap-2 cursor-pointer"
                >
                  <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{t('editStudent')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Medium & Fee Status Badges */}
        <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
          <StudentMediumBadge
            medium={enrollment.medium}
            size="xs"
            variant="compact"
          />
          <StudentFeeBadge status={fees.status} size="sm" />
        </div>

        {/* Financial Metrics Panel */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2.5">
          <div className="grid grid-cols-3 gap-2 text-xs font-mono-nums">
            <div>
              <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {t('totalFee')}
              </span>
              <span className="font-mono text-xs sm:text-sm font-semibold text-foreground font-mono-nums">
                {formatINR(fees.obligation)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {t('statusPaid')}
              </span>
              <span className="font-mono text-xs sm:text-sm font-semibold text-income font-mono-nums">
                {fees.collected > 0 ? formatINR(fees.collected) : '₹0'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {t('statusPending')}
              </span>
              <span
                className={`font-mono text-xs sm:text-sm font-bold font-mono-nums ${
                  fees.pending > 0 ? 'text-warning' : 'text-income'
                }`}
              >
                {fees.pending > 0 ? formatINR(fees.pending) : '₹0'}
              </span>
            </div>
          </div>

          {/* Progress Bar & Percentage */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                {fees.pending <= 0 && <CheckCircle2 className="h-3 w-3 text-income" />}
                <span className="font-mono-nums">
                  {t('percentPaid', { percent: Math.round(fees.collectionPercent) })}
                </span>
              </span>
              <span className="font-mono text-[10px] font-mono-nums">
                {fees.collected > 0 ? `${formatINR(fees.collected)} / ${formatINR(fees.obligation)}` : 'No payments yet'}
              </span>
            </div>
            <Progress value={fees.collectionPercent} className="h-1.5" />
          </div>
        </div>

        {/* Last Year's Pending Warning if applicable */}
        {previous > 0 && (
          <div className="flex items-center justify-between gap-1.5 rounded-lg bg-warning/10 border border-warning/25 px-2.5 py-1.5 text-xs font-medium text-warning">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                Last year pending: <strong className="font-mono font-mono-nums">{formatINR(previous)}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onRecordPreviousPayment) {
                  onRecordPreviousPayment(row);
                } else {
                  onRecordPayment(enrollment.id);
                }
              }}
              className="text-[11px] font-semibold underline hover:text-warning/80 shrink-0"
            >
              Record Previous-Year Payment
            </button>
          </div>
        )}
      </div>

      {/* Card Action Footer */}
      <div className="flex items-center justify-between pt-3.5 mt-3.5 border-t border-border/50 text-xs">
        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">
          <span>{t('viewDetails')}</span>
          <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>

        {fees.pending > 0 && (
          <div onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 px-2.5 border-income/30 text-income hover:bg-income hover:text-income-foreground hover:border-income transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onRecordPayment(enrollment.id);
              }}
            >
              <IndianRupee className="h-3 w-3" />
              <span>{t('payFee')}</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
