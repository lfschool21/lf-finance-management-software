import React, { useMemo, useState, useEffect } from 'react';
import {
  Calculator,
  Search,
  TrendingUp,
  Users,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  Building,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import {
  calculateAverageFees,
  calculateClassAverageFees,
  type ClassAverageFeeDetail,
} from '@/lib/student-fees';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import type { StudentMedium } from '@/types/students';
import { useTranslation } from '@/lib/i18n';

interface AverageFeeCalculatorModalProps {
  open: boolean;
  onClose: () => void;
  academicYearId?: string;
  academicYearLabel?: string;
  initialMedium?: 'all' | StudentMedium;
}

export function AverageFeeCalculatorModal({
  open,
  onClose,
  academicYearId,
  academicYearLabel,
  initialMedium = 'all',
}: AverageFeeCalculatorModalProps) {
  const { t } = useTranslation();
  const { currentYearId, academicYears, incomeEntries } = useFinanceStore();
  const { enrollments } = useStudentStore();

  const targetYearId = academicYearId || currentYearId;
  const year = useMemo(
    () => academicYears.find((y) => y.id === targetYearId),
    [academicYears, targetYearId]
  );
  const displayYearLabel = academicYearLabel || year?.label || '—';

  // Medium Filter
  const [selectedMedium, setSelectedMedium] = useState<'all' | StudentMedium>(initialMedium);
  const [searchQuery, setSearchQuery] = useState('');

  // Synchronize initialMedium when modal opens
  useEffect(() => {
    if (open) {
      setSelectedMedium(initialMedium);
    }
  }, [open, initialMedium]);

  // Active enrollments for this academic year
  const activeEnrollments = useMemo(() => {
    return enrollments.filter(
      (e) => e.academicYearId === targetYearId && e.status === 'active'
    );
  }, [enrollments, targetYearId]);

  // Medium-scoped enrollments
  const scopedEnrollments = useMemo(() => {
    if (selectedMedium === 'all') return activeEnrollments;
    return activeEnrollments.filter((e) => e.medium === selectedMedium);
  }, [activeEnrollments, selectedMedium]);

  // Actual average fee metrics
  const actualMetrics = useMemo(() => {
    return calculateAverageFees(scopedEnrollments, incomeEntries);
  }, [scopedEnrollments, incomeEntries]);

  // All medium metrics for comparison
  const overallMetrics = useMemo(() => {
    return calculateAverageFees(activeEnrollments, incomeEntries);
  }, [activeEnrollments, incomeEntries]);

  const gujaratiMetrics = useMemo(() => {
    return calculateAverageFees(
      activeEnrollments.filter((e) => e.medium === 'gujarati'),
      incomeEntries
    );
  }, [activeEnrollments, incomeEntries]);

  const englishMetrics = useMemo(() => {
    return calculateAverageFees(
      activeEnrollments.filter((e) => e.medium === 'english'),
      incomeEntries
    );
  }, [activeEnrollments, incomeEntries]);

  // Class-level breakdown
  const classBreakdown = useMemo(() => {
    return calculateClassAverageFees(scopedEnrollments, incomeEntries);
  }, [scopedEnrollments, incomeEntries]);

  // Min / Max class fee charged
  const classFeeRange = useMemo(() => {
    if (classBreakdown.length === 0) return { min: 0, max: 0 };
    const fees = classBreakdown.map((c) => c.avgAnnualFeeCharged);
    return {
      min: Math.min(...fees),
      max: Math.max(...fees),
    };
  }, [classBreakdown]);

  // Interactive What-If Simulator State
  const [simTargetFee, setSimTargetFee] = useState<number>(0);
  const [simStudents, setSimStudents] = useState<number>(0);
  const [simCollectionRate, setSimCollectionRate] = useState<number>(90);

  // Initialize simulator values to actuals whenever modal opens or medium changes
  useEffect(() => {
    setSimTargetFee(actualMetrics.avgAnnualFeeCharged);
    setSimStudents(actualMetrics.totalStudents);
    setSimCollectionRate(actualMetrics.collectionRate > 0 ? actualMetrics.collectionRate : 90);
  }, [actualMetrics, open, selectedMedium]);

  // Simulator Calculations
  const simResults = useMemo(() => {
    const students = Math.max(0, simStudents);
    const fee = Math.max(0, simTargetFee);
    const rate = Math.min(100, Math.max(0, simCollectionRate));

    const projectedRevenue = students * fee;
    const actualRevenue = actualMetrics.totalAnnualFee;
    const revenueDifference = projectedRevenue - actualRevenue;
    const projectedInflow = Math.round(projectedRevenue * (rate / 100));
    const monthlyBudget = Math.round(projectedRevenue / 12);

    return {
      projectedRevenue,
      revenueDifference,
      projectedInflow,
      monthlyBudget,
    };
  }, [simStudents, simTargetFee, simCollectionRate, actualMetrics.totalAnnualFee]);

  // Filtered classes in table
  const filteredClasses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return classBreakdown;
    return classBreakdown.filter(
      (c) =>
        c.className.toLowerCase().includes(q) ||
        c.medium.toLowerCase().includes(q)
    );
  }, [classBreakdown, searchQuery]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                  {t('feeCalculatorTitle')}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {t('feeCalculatorSubtitle')}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold font-mono font-mono-nums text-foreground">
                AY {displayYearLabel}
              </span>
              <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary font-mono-nums">
                {actualMetrics.totalStudents} Active Students
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* 1. Medium Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setSelectedMedium('all')}
              className={`rounded-md px-3 py-1.5 transition-all ${
                selectedMedium === 'all'
                  ? 'bg-card font-bold text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Mediums ({overallMetrics.totalStudents})
            </button>
            <button
              type="button"
              onClick={() => setSelectedMedium('gujarati')}
              className={`rounded-md px-3 py-1.5 transition-all ${
                selectedMedium === 'gujarati'
                  ? 'bg-amber-500/15 font-bold text-amber-900 dark:text-amber-200 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Gujarati ({gujaratiMetrics.totalStudents})
            </button>
            <button
              type="button"
              onClick={() => setSelectedMedium('english')}
              className={`rounded-md px-3 py-1.5 transition-all ${
                selectedMedium === 'english'
                  ? 'bg-sky-500/15 font-bold text-sky-900 dark:text-sky-200 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              English ({englishMetrics.totalStudents})
            </button>
          </div>

          {/* Quick Context Summary */}
          <div className="text-xs text-muted-foreground font-mono-nums">
            Total Annual Obligation:{' '}
            <strong className="text-foreground font-semibold">
              {formatINR(actualMetrics.totalAnnualFee)}
            </strong>
          </div>
        </div>

        {/* 2. Key Calculated Averages Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono-nums">
          {/* Spotlight Card: Avg Fee Charged by School */}
          <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                {t('avgFeeChargedBySchool')}
              </span>
              <Building className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2">
              <span
                className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground"
                title={formatINR(actualMetrics.avgAnnualFeeCharged)}
              >
                {formatINR(actualMetrics.avgAnnualFeeCharged)}
              </span>
              <span className="text-xs font-sans text-muted-foreground ml-1.5 font-normal">
                / student
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Across {actualMetrics.totalStudents} enrolled students
            </p>
          </div>

          {/* Avg Fee Collected */}
          <div className="rounded-xl border border-income/30 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-income">
                {t('avgFeeCollectedPerStudent')}
              </span>
              <CheckCircle2 className="h-4 w-4 text-income" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span
                className="text-2xl sm:text-3xl font-bold tracking-tight text-income"
                title={formatINR(actualMetrics.avgCollected)}
              >
                {formatINR(actualMetrics.avgCollected)}
              </span>
              <span className="text-xs font-sans text-muted-foreground font-normal">
                / student
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Realization: {actualMetrics.collectionRate}%</span>
              <span>{formatINRAbbr(actualMetrics.totalCollected)} total</span>
            </div>
          </div>

          {/* Avg Fee Pending */}
          <div className="rounded-xl border border-warning/30 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-warning">
                {t('avgFeePendingPerStudent')}
              </span>
              <AlertCircle className="h-4 w-4 text-warning" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span
                className="text-2xl sm:text-3xl font-bold tracking-tight text-warning"
                title={formatINR(actualMetrics.avgPending)}
              >
                {formatINR(actualMetrics.avgPending)}
              </span>
              <span className="text-xs font-sans text-muted-foreground font-normal">
                / student
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Total pending: {formatINRAbbr(actualMetrics.totalPending)}
            </p>
          </div>

          {/* Class Fee Pricing Range */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Class Rate Range
              </span>
              <ArrowUpDown className="h-4 w-4 opacity-70" />
            </div>
            <div className="mt-2">
              <div className="text-xs text-muted-foreground">
                Min Class Fee:{' '}
                <strong className="text-foreground font-semibold">
                  {formatINR(classFeeRange.min)}
                </strong>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Max Class Fee:{' '}
                <strong className="text-foreground font-semibold">
                  {formatINR(classFeeRange.max)}
                </strong>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {classBreakdown.length} classes analyzed
            </p>
          </div>
        </div>

        {/* 3. Interactive "What-If" Fee Scenario Calculator & Revenue Simulator */}
        <div className="rounded-xl border border-primary/25 bg-gradient-to-r from-primary/[0.04] via-card to-primary/[0.02] p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {t('whatIfSimulator')}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Simulate fee adjustments, student growth, and collection targets
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSimTargetFee(actualMetrics.avgAnnualFeeCharged);
                setSimStudents(actualMetrics.totalStudents);
                setSimCollectionRate(actualMetrics.collectionRate || 90);
              }}
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground self-start sm:self-auto"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset to Actual</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            {/* Input 1: Target Avg Fee */}
            <div className="space-y-1.5">
              <Label htmlFor="sim-target-fee" className="text-xs font-semibold text-foreground">
                Target Avg Fee / Student (₹)
              </Label>
              <div className="relative">
                <IndianRupee className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="sim-target-fee"
                  type="number"
                  min="0"
                  step="500"
                  value={simTargetFee || ''}
                  onChange={(e) => setSimTargetFee(Number(e.target.value) || 0)}
                  className="pl-8 font-mono font-mono-nums text-sm font-semibold h-9"
                  placeholder="e.g. 25000"
                />
              </div>
              <div className="flex gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setSimTargetFee((v) => Math.max(0, v - 1000))}
                  className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                >
                  -₹1K
                </button>
                <button
                  type="button"
                  onClick={() => setSimTargetFee((v) => v + 1000)}
                  className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                >
                  +₹1K
                </button>
                <button
                  type="button"
                  onClick={() => setSimTargetFee((v) => v + 2000)}
                  className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                >
                  +₹2K
                </button>
                <button
                  type="button"
                  onClick={() => setSimTargetFee((v) => v + 5000)}
                  className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                >
                  +₹5K
                </button>
              </div>
            </div>

            {/* Input 2: Number of Enrolled Students */}
            <div className="space-y-1.5">
              <Label htmlFor="sim-students" className="text-xs font-semibold text-foreground">
                Enrolled Students Count
              </Label>
              <div className="relative">
                <Users className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="sim-students"
                  type="number"
                  min="0"
                  step="1"
                  value={simStudents || ''}
                  onChange={(e) => setSimStudents(Number(e.target.value) || 0)}
                  className="pl-8 font-mono font-mono-nums text-sm font-semibold h-9"
                  placeholder="e.g. 150"
                />
              </div>
              <div className="flex gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setSimStudents((v) => Math.max(0, v - 10))}
                  className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() => setSimStudents((v) => v + 10)}
                  className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => setSimStudents((v) => v + 25)}
                  className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                >
                  +25
                </button>
                <button
                  type="button"
                  onClick={() => setSimStudents(actualMetrics.totalStudents)}
                  className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                >
                  Actual ({actualMetrics.totalStudents})
                </button>
              </div>
            </div>

            {/* Input 3: Expected Collection Rate */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="sim-collection-rate" className="text-xs font-semibold text-foreground">
                  Expected Realization Rate
                </Label>
                <span className="text-xs font-mono font-bold text-income font-mono-nums">
                  {simCollectionRate}%
                </span>
              </div>
              <input
                id="sim-collection-rate"
                type="range"
                min="50"
                max="100"
                step="1"
                value={simCollectionRate}
                onChange={(e) => setSimCollectionRate(Number(e.target.value))}
                className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer mt-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono-nums pt-1">
                <span>50%</span>
                <span>75%</span>
                <span>90%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Simulator Results Output Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border/60 font-mono-nums">
            <div className="rounded-lg bg-card p-3 border shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground uppercase">
                {t('projectedTotalRevenue')}
              </span>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {formatINR(simResults.projectedRevenue)}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {simStudents} students × {formatINR(simTargetFee)}
              </span>
            </div>

            <div className="rounded-lg bg-card p-3 border shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground uppercase">
                {t('varianceVsTarget')}
              </span>
              <p
                className={`text-lg font-bold mt-0.5 ${
                  simResults.revenueDifference >= 0
                    ? 'text-income'
                    : 'text-warning'
                }`}
              >
                {simResults.revenueDifference >= 0 ? '+' : ''}
                {formatINR(simResults.revenueDifference)}
              </p>
              <span className="text-[10px] text-muted-foreground">
                vs current {formatINR(actualMetrics.totalAnnualFee)}
              </span>
            </div>

            <div className="rounded-lg bg-card p-3 border shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground uppercase">
                {t('projectedCashInflow')}
              </span>
              <p className="text-lg font-bold text-income mt-0.5">
                {formatINR(simResults.projectedInflow)}
              </p>
              <span className="text-[10px] text-muted-foreground">
                At {simCollectionRate}% realization
              </span>
            </div>

            <div className="rounded-lg bg-card p-3 border shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground uppercase">
                {t('monthlyOperatingRunRate')}
              </span>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {formatINR(simResults.monthlyBudget)}
              </p>
              <span className="text-[10px] text-muted-foreground">
                Annual budget ÷ 12 mo
              </span>
            </div>
          </div>
        </div>

        {/* 4. Class-by-Class Average Fees Table */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {t('classAvgFeesTitle')}
              </h3>
              <p className="text-xs text-muted-foreground">
                Detailed average annual fee charges, collections, and pending dues by class
              </p>
            </div>
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search class..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-muted/40"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/80 overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs font-semibold">Class</TableHead>
                  <TableHead className="text-xs font-semibold">Medium</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Students</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Total Annual Fee</TableHead>
                  <TableHead className="text-xs font-semibold text-right text-primary">
                    Avg Fee / Student
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-right text-income">
                    Avg Collected
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-right text-warning">
                    Avg Pending
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-right">Realization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono-nums text-xs">
                {filteredClasses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                      No classes found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClasses.map((cls: ClassAverageFeeDetail) => {
                    const isGuj = cls.medium === 'gujarati';
                    return (
                      <TableRow key={`${cls.className}-${cls.medium}`} className="hover:bg-muted/30">
                        <TableCell className="font-semibold font-sans text-foreground">
                          {cls.className}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isGuj
                                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                                : 'bg-sky-500/15 text-sky-800 dark:text-sky-300'
                            }`}
                          >
                            {isGuj ? 'Gujarati' : 'English'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{cls.totalStudents}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatINR(cls.totalAnnualFee)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-foreground bg-primary/[0.04]">
                          {formatINR(cls.avgAnnualFeeCharged)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-income">
                          {formatINR(cls.avgCollected)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-warning">
                          {formatINR(cls.avgPending)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[11px] font-semibold">
                              {cls.collectionRate}%
                            </span>
                            <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                              <div
                                className="h-full bg-income rounded-full"
                                style={{ width: `${Math.min(100, cls.collectionRate)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border/70">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
