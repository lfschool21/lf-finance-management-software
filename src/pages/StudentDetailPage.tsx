import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  IndianRupee,
  MoreVertical,
  Archive,
  Calendar,
  History,
  CreditCard,
  Plus,
  CheckCircle2,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useStudentStore } from '@/store/student-store';
import { useFinanceStore } from '@/store/finance-store';
import { getStudentFeeSummary, getStudentPreviousPending } from '@/lib/student-fees';
import type { IncomeEntry } from '@/types/finance';
import { MEDIUM_LABELS, type StudentEnrollment } from '@/types/students';
import { formatINR } from '@/utils/currency';
import { getPreviousClassName } from '@/utils/class-progression';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { StudentFeeBadge } from '@/components/students/StudentFeeBadge';
import { StudentMediumBadge } from '@/components/students/StudentMediumBadge';
import { AddIncomeModal } from '@/components/AddIncomeModal';
import { AddStudentModal } from '@/components/AddStudentModal';
import { AddHistoricalFeeModal } from '@/components/students/AddHistoricalFeeModal';
import { RecordPreviousPaymentModal } from '@/components/students/RecordPreviousPaymentModal';
import { RecordCurrentPaymentModal } from '@/components/students/RecordCurrentPaymentModal';
import { toast } from '@/hooks/use-toast';

export default function StudentDetailPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { students, enrollments, archiveStudent, deleteEnrollment } = useStudentStore();
  const { currentYearId, academicYears, incomeEntries, accounts, deleteIncome } = useFinanceStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'payments'>('overview');
  const [paymentEnrollmentId, setPaymentEnrollmentId] = useState<string | undefined>(undefined);
  const [editingIncomeEntry, setEditingIncomeEntry] = useState<IncomeEntry | null>(null);
  const [deletingIncomeEntry, setDeletingIncomeEntry] = useState<IncomeEntry | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [editingHistoricalEnrollment, setEditingHistoricalEnrollment] = useState<StudentEnrollment | null>(null);
  const [deletingHistoricalEnrollment, setDeletingHistoricalEnrollment] = useState<StudentEnrollment | null>(null);
  const [isDeletingEnrollment, setIsDeletingEnrollment] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoricalModal, setShowHistoricalModal] = useState(false);
  const [showPreviousPaymentModal, setShowPreviousPaymentModal] = useState(false);
  const [selectedPreviousEnrollment, setSelectedPreviousEnrollment] = useState<StudentEnrollment | null>(null);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function handleDeletePayment() {
    if (!deletingIncomeEntry) return;
    setIsDeletingPayment(true);
    try {
      await deleteIncome(deletingIncomeEntry.id);
      toast({
        title: 'Payment deleted',
        description: 'Payment has been removed and pending fee balance updated.',
      });
      setDeletingIncomeEntry(null);
    } catch (err) {
      toast({
        title: 'Could not delete payment',
        description: err instanceof Error ? err.message : 'Database error',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingPayment(false);
    }
  }

  async function handleDeleteEnrollment() {
    if (!deletingHistoricalEnrollment) return;
    setIsDeletingEnrollment(true);
    try {
      await deleteEnrollment(deletingHistoricalEnrollment.id);
      toast({
        title: 'Fee record removed',
        description: 'Previous-year fee record has been deleted.',
      });
      setDeletingHistoricalEnrollment(null);
    } catch (err) {
      toast({
        title: 'Could not delete fee record',
        description: err instanceof Error ? err.message : 'Database error',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingEnrollment(false);
    }
  }

  // Student and enrollments
  const student = useMemo(() => students.find((item) => item.id === studentId), [students, studentId]);

  const studentEnrollments = useMemo(() => {
    return enrollments
      .filter((item) => item.studentId === studentId)
      .sort((a, b) => {
        const yearA = academicYears.find((y) => y.id === a.academicYearId);
        const yearB = academicYears.find((y) => y.id === b.academicYearId);
        return (yearB?.startDate.getTime() || 0) - (yearA?.startDate.getTime() || 0);
      });
  }, [enrollments, studentId, academicYears]);

  // Current active enrollment (prefers selected currentYearId, falls back to latest)
  const current = useMemo(() => {
    return (
      studentEnrollments.find((item) => item.academicYearId === currentYearId && item.status === 'active') ||
      studentEnrollments.find((item) => item.academicYearId === currentYearId) ||
      studentEnrollments[0]
    );
  }, [studentEnrollments, currentYearId]);

  // Current year fee summary
  const currentSummary = useMemo(() => {
    if (!current) return null;
    return getStudentFeeSummary(current, incomeEntries);
  }, [current, incomeEntries]);

  // Historical enrollments (all except current)
  const historicalEnrollments = useMemo(() => {
    if (!current) return [];
    const separate = studentEnrollments
      .filter((item) => item.id !== current.id)
      .map((enrollment) => ({
        enrollment,
        year: academicYears.find((y) => y.id === enrollment.academicYearId),
        summary: getStudentFeeSummary(enrollment, incomeEntries),
      }));

    if (separate.length === 0 && current.additionalOutstandingAmount > 0) {
      const prevYear = academicYears
        .filter((y) => y.id !== current.academicYearId)
        .sort((a, b) => {
          const timeA = a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime();
          const timeB = b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime();
          return timeB - timeA;
        })[0];
      if (prevYear) {
        const latePaid = incomeEntries
          .filter(
            (entry) =>
              entry.category === 'Tuition Fees' &&
              entry.isLateCollection &&
              (entry.studentEnrollmentId === current.id ||
                studentEnrollments.some((e) => e.id === entry.studentEnrollmentId))
          )
          .reduce((sum, entry) => sum + entry.amount, 0);
        const prevPending = Math.max(0, current.additionalOutstandingAmount - latePaid);
        const pct = current.additionalOutstandingAmount > 0
          ? Math.min(100, Math.round((latePaid / current.additionalOutstandingAmount) * 100))
          : 0;
        separate.push({
          enrollment: {
            ...current,
            id: current.id,
            academicYearId: prevYear.id,
            className: getPreviousClassName(current.className),
            annualFeeAmount: current.additionalOutstandingAmount,
            additionalOutstandingAmount: 0,
          },
          year: prevYear,
          summary: {
            obligation: current.additionalOutstandingAmount,
            collected: latePaid,
            openingCollected: 0,
            recordedCollected: latePaid,
            pending: prevPending,
            status: prevPending <= 0 ? 'paid' : latePaid > 0 ? 'partially_paid' : 'not_paid',
            collectionPercent: pct,
            cash: 0,
            upi: 0,
            other: 0,
            unknown: 0,
          },
        });
      }
    }
    return separate;
  }, [studentEnrollments, current, academicYears, incomeEntries, currentSummary]);

  const currentYear = useMemo(() => {
    if (!current) return null;
    return academicYears.find((y) => y.id === current.academicYearId);
  }, [current, academicYears]);

  // Total previous-year pending dues
  const totalPreviousPending = useMemo(() => {
    if (!student || !current) return 0;
    return getStudentPreviousPending(student.id, current.academicYearId, enrollments, incomeEntries);
  }, [student, current, enrollments, incomeEntries]);

  // Previous-year accounting separation metrics
  const primaryHistorical = historicalEnrollments[0] || null;
  const previousClass = primaryHistorical?.enrollment.className || getPreviousClassName(current?.className);
  const previousObligation = primaryHistorical
    ? primaryHistorical.summary.obligation
    : (current?.additionalOutstandingAmount || 0);
  const previousRecovered = primaryHistorical
    ? primaryHistorical.summary.collected
    : 0;
  const previousPending = primaryHistorical
    ? primaryHistorical.summary.pending
    : (current?.additionalOutstandingAmount || 0);
  const previousCollectionPercent = previousObligation > 0
    ? Math.min(100, Math.round((previousRecovered / previousObligation) * 100))
    : 0;
  const hasPreviousDues = Boolean(previousObligation > 0 || totalPreviousPending > 0);

  const previousEnrollmentObj = useMemo(() => {
    if (primaryHistorical?.enrollment) return primaryHistorical.enrollment;
    const currentStart = currentYear?.startDate instanceof Date
      ? currentYear.startDate.getTime()
      : currentYear ? new Date(currentYear.startDate).getTime() : 0;
    const prevYear = academicYears
      .filter((y) => {
        if (y.id === current?.academicYearId) return false;
        if (currentStart) {
          const yStart = y.startDate instanceof Date ? y.startDate.getTime() : new Date(y.startDate).getTime();
          return yStart < currentStart;
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime();
        const timeB = b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime();
        return timeB - timeA;
      })[0];
    return {
      ...current!,
      id: current?.id || '',
      academicYearId: prevYear?.id || '',
      className: previousClass,
      annualFeeAmount: current?.additionalOutstandingAmount || 0,
      additionalOutstandingAmount: 0,
    };
  }, [primaryHistorical, academicYears, current, currentYear, previousClass]);

  // Current year fee calculations strictly separated from previous-year dues
  const currentYearFee = current?.annualFeeAmount || 0;
  const currentYearPaid = currentSummary?.collected || 0;
  const currentYearPending = Math.max(0, currentYearFee - currentYearPaid);
  const currentYearProgress = currentYearFee > 0
    ? Math.min(100, Math.round((currentYearPaid / currentYearFee) * 100))
    : 0;

  // Payments applied to this student
  const payments = useMemo(() => {
    return incomeEntries
      .filter((entry) => studentEnrollments.some((enrollment) => enrollment.id === entry.studentEnrollmentId))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [incomeEntries, studentEnrollments]);

  // Handle student archive
  async function handleArchiveConfirm() {
    if (!student) return;
    setArchiving(true);
    try {
      await archiveStudent(student.id);
      toast({ title: 'Student archived', description: `${student.fullName} has been marked as inactive.` });
      setShowArchiveDialog(false);
      navigate('/students');
    } catch (error) {
      toast({
        title: 'Archive failed',
        description: error instanceof Error ? error.message : 'Database error',
        variant: 'destructive',
      });
    } finally {
      setArchiving(false);
    }
  }

  // Handle missing student record
  if (!student || !current || !currentSummary) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center space-y-3">
        <p className="text-base font-semibold text-foreground">Student record not found</p>
        <p className="text-xs text-muted-foreground">
          The requested student ID does not exist or has been removed.
        </p>
        <Button size="sm" variant="outline" onClick={() => navigate('/students')} className="text-xs">
          Return to Students
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Back Navigation Link */}
      <div>
        <Link
          to="/students"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Students</span>
        </Link>
      </div>

      {/* Student Details Header */}
      <header className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {student.fullName}
              </h1>
              <StudentMediumBadge medium={current.medium} size="sm" />
              <Badge
                variant="outline"
                className={
                  student.status === 'active'
                    ? 'border-income/30 bg-income/10 text-income text-[11px]'
                    : 'border-muted text-muted-foreground text-[11px]'
                }
              >
                {student.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {student.admissionNumber ? `Admission ${student.admissionNumber} · ` : ''}
              {current.className} · AY {currentYear?.label || '—'}
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEditModal(true)}
              className="h-9 text-xs gap-1.5"
            >
              <Edit className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Edit Student</span>
            </Button>

            {previousPending > 0 && (
              <Button
                size="sm"
                onClick={() => setShowPreviousPaymentModal(true)}
                className="h-9 text-xs gap-1.5 shadow-sm bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600"
              >
                <IndianRupee className="h-3.5 w-3.5" />
                <span className="sr-only">Pay Last Year's Dues </span>
                <span>Record Previous-Year Payment</span>
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => setPaymentEnrollmentId(current.id)}
              className="h-9 text-xs gap-1.5 shadow-sm"
            >
              <IndianRupee className="h-3.5 w-3.5" />
              <span>Record Payment</span>
            </Button>

            {/* Overflow Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 text-muted-foreground" aria-label="More options">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 text-xs">
                <DropdownMenuItem
                  onClick={() => setShowHistoricalModal(true)}
                  className="gap-2 cursor-pointer"
                >
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Add Previous-Year Fee Record</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowArchiveDialog(true)}
                  className="gap-2 text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10"
                >
                  <Archive className="h-3.5 w-3.5" />
                  <span>Archive Student</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* 2-Tab Information Architecture: Overview | Payments */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md h-9">
          <TabsTrigger value="overview" onPointerDown={() => setActiveTab('overview')} onClick={() => setActiveTab('overview')} className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="payments" onPointerDown={() => setActiveTab('payments')} onClick={() => setActiveTab('payments')} className="text-xs">
            Payments {payments.length > 0 && `(${payments.length})`}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview" className="space-y-4 outline-none">

          {/* Side-by-Side Fee Management Cards: This Year vs Last Year */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Card 1: This Year's Fee Account */}
            <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">This Year</span>
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        Class {current.className}
                      </Badge>
                    </div>
                    <h2 className="text-sm font-semibold text-foreground mt-0.5">
                      Academic Year {currentYear?.label || '—'}
                    </h2>
                    <span className="text-[11px] font-medium text-muted-foreground block">
                      Current Fee Account
                    </span>
                  </div>
                  <StudentFeeBadge status={currentYearPending <= 0 ? 'paid' : currentYearPaid > 0 ? 'partially_paid' : 'not_paid'} />
                </div>

                {/* Numbers: Total Fee | Paid | Pending */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 font-mono-nums">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Current-Year Fee</p>
                    <p className="money-fit mt-1 font-mono text-base sm:text-xl font-bold text-foreground">
                      {formatINR(currentYearFee)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">
                      Class: {current.className}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Amount Paid</p>
                    <p className="money-fit mt-1 font-mono text-base sm:text-xl font-bold text-income">
                      {formatINR(currentYearPaid)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">
                      {currentYearProgress}% paid
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Amount Pending</p>
                    <p className={`money-fit mt-1 font-mono text-base sm:text-xl font-bold ${currentYearPending > 0 ? 'text-warning' : 'text-income'}`}>
                      {currentYearPending > 0 ? formatINR(currentYearPending) : '₹0 (Clear)'}
                    </p>
                    {currentYearPending <= 0 && (
                      <p className="text-[10px] text-income mt-0.5 font-sans flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 inline" /> Fully settled
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                    <span>This Year Progress</span>
                    <span>{currentYearProgress}%</span>
                  </div>
                  <Progress value={currentYearProgress} className="h-2" />
                </div>

                {/* Payment Breakdown */}
                <div className="border-t pt-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    Payment Collection Breakdown
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 text-xs font-mono-nums">
                    <div className="rounded-lg border bg-muted/20 p-2">
                      <span className="text-[11px] text-muted-foreground block">Cash</span>
                      <span className="font-mono font-medium">{formatINR(currentSummary.cash)}</span>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-2">
                      <span className="text-[11px] text-muted-foreground block">UPI</span>
                      <span className="font-mono font-medium">{formatINR(currentSummary.upi)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="pt-2 border-t">
                <Button
                  size="sm"
                  onClick={() => setPaymentEnrollmentId(current.id)}
                  className="w-full h-8 text-xs gap-1.5 font-medium"
                >
                  <IndianRupee className="h-3.5 w-3.5" />
                  <span>Record Current-Year Payment</span>
                </Button>
              </div>
            </div>

            {/* Card 2: Previous-Year Pending Fee */}
            <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm flex flex-col justify-between space-y-4">
              {hasPreviousDues ? (
                <>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-warning">Previous-Year Outstanding</span>
                          <Badge variant="outline" className="text-[10px] py-0 h-4 border-warning/40 bg-warning/10 text-warning">
                            {previousClass}
                          </Badge>
                        </div>
                        <h2 className="text-sm font-semibold text-foreground mt-0.5">
                          Previous Class: {previousClass}
                        </h2>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">
                          {`Last Year's Pending: ${formatINR(previousPending)}`}
                        </p>
                      </div>
                      {previousPending <= 0 ? (
                        <Badge variant="outline" className="border-income/30 bg-income/10 text-income text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Dues Cleared
                        </Badge>
                      ) : (
                        <StudentFeeBadge status={previousRecovered > 0 ? 'partially_paid' : 'not_paid'} />
                      )}
                    </div>

                    {/* Numbers: Original Due | Recovered | Pending */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 font-mono-nums">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Original Outstanding</p>
                        <p className="money-fit mt-1 font-mono text-base sm:text-xl font-bold text-foreground">
                          {formatINR(previousObligation)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">
                          Class: {previousClass}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Paid So Far</p>
                        <p className="money-fit mt-1 font-mono text-base sm:text-xl font-bold text-income">
                          {formatINR(previousRecovered)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">
                          {previousCollectionPercent}% recovered
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Remaining Pending</p>
                        <p className={`money-fit mt-1 font-mono text-base sm:text-xl font-bold ${previousPending > 0 ? 'text-warning' : 'text-income'}`}>
                          {previousPending > 0 ? formatINR(previousPending) : '₹0 (Clear)'}
                        </p>
                        {previousPending <= 0 && (
                          <p className="text-[10px] text-income mt-0.5 font-sans flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 inline" /> Dues cleared
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                        <span>Recovery Progress</span>
                        <span>{previousCollectionPercent}%</span>
                      </div>
                      <Progress value={previousCollectionPercent} className="h-2" />
                    </div>

                    {previousPending <= 0 ? (
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>Previous-year dues cleared</span>
                      </div>
                    ) : (
                      <div className="border-t pt-2 text-xs text-muted-foreground">
                        <span>Balance carried forward from previous academic session.</span>
                      </div>
                    )}
                  </div>

                  {/* Actions for Last Year */}
                  <div className="pt-2 border-t flex flex-wrap items-center gap-2">
                    {previousPending > 0 ? (
                      <Button
                        size="sm"
                        onClick={() => setShowPreviousPaymentModal(true)}
                        className="flex-1 h-8 text-xs gap-1.5 font-medium bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600"
                      >
                        <IndianRupee className="h-3.5 w-3.5" />
                        <span className="sr-only">Pay Last Year's Dues </span>
                        <span>Record Previous-Year Payment</span>
                      </Button>
                    ) : (
                      <div className="flex-1 text-xs text-income font-medium flex items-center gap-1.5 py-1">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Previous-year dues cleared</span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingHistoricalEnrollment(primaryHistorical?.enrollment || null);
                        setShowHistoricalModal(true);
                      }}
                      className="h-8 text-xs gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit Fee Record</span>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 border-2 border-dashed rounded-lg bg-muted/10">
                  <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
                    <Calendar className="h-5 w-5 opacity-60" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Previous-Year Dues
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      No previous-year dues. This student has no unpaid balance carried forward from previous years.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingHistoricalEnrollment(null);
                      setShowHistoricalModal(true);
                    }}
                    className="text-xs gap-1.5 border-dashed border-primary/50 text-primary hover:bg-primary/10"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ Add Previous-Year Fee</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Recent Payments Section */}
          <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Recent Payments
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Latest payments recorded for this student
                </p>
              </div>
              {payments.length > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setActiveTab('payments')}
                  className="text-xs h-auto p-0 font-medium text-primary hover:underline"
                >
                  View All Payments ({payments.length}) →
                </Button>
              )}
            </div>

            {payments.length > 0 ? (
              <div className="divide-y rounded-lg border bg-muted/20">
                {payments.slice(0, 4).map((entry) => {
                  const entryEnrollment = studentEnrollments.find((e) => e.id === entry.studentEnrollmentId);
                  const entryYear = academicYears.find((y) => y.id === entryEnrollment?.academicYearId);
                  const account = accounts.find((a) => a.id === entry.accountId);

                  return (
                    <div key={entry.id} className="flex items-center justify-between p-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="font-mono text-sm font-bold text-income shrink-0 font-mono-nums">
                          {formatINR(entry.amount)}
                        </div>
                        <span className="text-muted-foreground">•</span>
                        <Badge
                          variant="outline"
                          className={
                            entry.isLateCollection
                              ? 'border-warning/30 bg-warning/10 text-warning text-[10px] font-medium'
                              : 'border-primary/20 bg-primary/5 text-primary text-[10px] font-medium'
                          }
                        >
                          {entry.isLateCollection
                            ? `Previous Year — ${entryEnrollment?.className || 'Class'} (AY ${entryYear?.label || '—'})`
                            : `Current Year (AY ${entryYear?.label || '—'})`}
                        </Badge>
                        <span className="text-muted-foreground hidden sm:inline">•</span>
                        <span className="text-muted-foreground truncate hidden sm:inline">
                          {entry.paymentMethod === 'upi' ? `UPI • ${account?.name || 'School Bank'}` : (account?.name || 'Cash')}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0 font-mono-nums">
                        {entry.date.toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-2">
                No fee payments recorded yet for this student.
              </p>
            )}
          </div>

          {/* Student Profile & Enrollment Details Card */}
          <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Profile & Enrollment Info
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs">
              <div>
                <span className="text-muted-foreground block">Admission Number</span>
                <span className="font-mono font-medium text-foreground">{student.admissionNumber || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Enrolled Class</span>
                <span className="font-medium text-foreground">{current.className}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Instruction Medium</span>
                <span className="font-medium text-foreground">{MEDIUM_LABELS[current.medium]}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Student Status</span>
                <span className="font-medium text-foreground capitalize">{student.status}</span>
              </div>
            </div>

            {student.notes && (
              <div className="border-t pt-3 mt-2 text-xs">
                <span className="text-muted-foreground block font-medium mb-1">Notes:</span>
                <p className="text-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg whitespace-pre-wrap">
                  {student.notes}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: PAYMENTS */}
        <TabsContent value="payments" className="space-y-4 outline-none">
          {/* Recorded Payments Table */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b p-3.5">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Recorded Fee Payments
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Official fee transactions recorded through the finance ledger
                </p>
              </div>
              <div className="flex items-center gap-2">
                {previousPending > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedPreviousEnrollment(null);
                      setShowPreviousPaymentModal(true);
                    }}
                    className="h-8 text-xs gap-1.5 border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
                  >
                    <IndianRupee className="h-3.5 w-3.5" />
                    <span>Record Previous-Year Payment</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => setPaymentEnrollmentId(current.id)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Record Current-Year Payment</span>
                </Button>
              </div>
            </div>

            {payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b bg-muted/30 text-muted-foreground font-medium">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Applied To</th>
                      <th className="py-2.5 px-4">Method</th>
                      <th className="py-2.5 px-4">Account</th>
                      <th className="py-2.5 px-4">Reference</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono-nums">
                    {payments.map((entry) => {
                      const enrollment = studentEnrollments.find((item) => item.id === entry.studentEnrollmentId);
                      const year = academicYears.find((item) => item.id === enrollment?.academicYearId);
                      const account = accounts.find((a) => a.id === entry.accountId);

                      return (
                        <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-medium text-foreground">
                            {entry.date.toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={
                                entry.isLateCollection
                                  ? 'border-warning/30 bg-warning/10 text-warning text-[10px] font-medium'
                                  : 'border-primary/20 bg-primary/5 text-primary text-[10px] font-medium'
                              }
                            >
                              {entry.isLateCollection
                                ? `Previous-Year Due — ${enrollment?.className || 'Class'}`
                                : `Current-Year Fee`}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 capitalize font-medium text-foreground">
                            {entry.paymentMethod === 'upi' ? 'UPI' : 'Cash'}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {entry.paymentMethod === 'upi'
                              ? `UPI • ${account?.name || 'School Bank'}`
                              : (account?.name ? `Cash • ${account.name}` : 'Cash')}
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground text-[11px]">
                            {entry.paymentReference || '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-income">
                            {formatINR(entry.amount)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                                onClick={() => setEditingIncomeEntry(entry)}
                                title="Edit payment details"
                                aria-label="Edit payment"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeletingIncomeEntry(entry)}
                                title="Delete payment"
                                aria-label="Delete payment"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                <CreditCard className="mx-auto h-8 w-8 opacity-30" />
                <p className="font-medium text-foreground">No payments recorded yet</p>
                <p>No fee income entries have been recorded for this student in the application.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dedicated Record Current-Year Payment Modal */}
      {student && current && (
        <RecordCurrentPaymentModal
          open={!!paymentEnrollmentId}
          onClose={() => setPaymentEnrollmentId(undefined)}
          student={student}
          enrollment={current}
          currentPending={currentYearPending}
          currentFee={currentYearFee}
          currentPaid={currentYearPaid}
        />
      )}

      {/* Edit Fee Payment Modal (for editing existing payments in table) */}
      <AddIncomeModal
        isOpen={!!editingIncomeEntry}
        onClose={() => {
          setEditingIncomeEntry(null);
        }}
        presetStudentEnrollmentId={editingIncomeEntry?.studentEnrollmentId || undefined}
        editEntry={editingIncomeEntry || undefined}
        tuitionOnly={true}
      />

      {/* Edit Student Modal */}
      <AddStudentModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        student={student}
        enrollment={current}
        defaultYearId={current.academicYearId}
        defaultMedium={current.medium}
      />

      {/* Dedicated Add / Edit Historical Fee Modal */}
      <AddHistoricalFeeModal
        open={showHistoricalModal}
        onClose={() => {
          setShowHistoricalModal(false);
          setEditingHistoricalEnrollment(null);
        }}
        student={student}
        existingEnrollments={studentEnrollments}
        editingEnrollment={editingHistoricalEnrollment}
      />

      {/* Record Previous-Year Payment Modal */}
      {student && (selectedPreviousEnrollment || previousEnrollmentObj) && (
        <RecordPreviousPaymentModal
          open={showPreviousPaymentModal}
          onClose={() => {
            setShowPreviousPaymentModal(false);
            setSelectedPreviousEnrollment(null);
          }}
          student={student}
          previousEnrollment={selectedPreviousEnrollment || previousEnrollmentObj}
          previousPending={
            selectedPreviousEnrollment
              ? getStudentFeeSummary(selectedPreviousEnrollment, incomeEntries).pending
              : previousPending
          }
          previousClass={selectedPreviousEnrollment?.className || previousClass}
          previousObligation={
            selectedPreviousEnrollment
              ? getStudentFeeSummary(selectedPreviousEnrollment, incomeEntries).obligation
              : previousObligation
          }
          previousRecovered={
            selectedPreviousEnrollment
              ? getStudentFeeSummary(selectedPreviousEnrollment, incomeEntries).collected
              : previousRecovered
          }
        />
      )}

      {/* Archive Student Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              Archive Student: {student.fullName}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Archiving marks this student as inactive on active school rosters. All historical fee obligations,
              payments, and accounting ledger records will remain safely preserved and available in reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveConfirm}
              disabled={archiving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
            >
              {archiving ? 'Archiving...' : 'Archive Student'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Payment Confirmation Dialog */}
      <AlertDialog
        open={!!deletingIncomeEntry}
        onOpenChange={(open) => {
          if (!open && !isDeletingPayment) setDeletingIncomeEntry(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              Delete Mistaken Payment?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
                <p>
                  Are you sure you want to delete the payment of{' '}
                  <strong className="text-foreground font-mono">
                    {deletingIncomeEntry ? formatINR(deletingIncomeEntry.amount) : '₹0'}
                  </strong>{' '}
                  recorded on{' '}
                  <strong className="text-foreground">
                    {deletingIncomeEntry?.date.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </strong>
                  ?
                </p>
                <p className="rounded-lg bg-warning/10 border border-warning/20 p-2.5 text-warning font-medium">
                  This will permanently remove this entry from the financial ledger and immediately restore{' '}
                  <span className="font-mono font-bold">
                    {deletingIncomeEntry ? formatINR(deletingIncomeEntry.amount) : '₹0'}
                  </span>{' '}
                  to {student.fullName}'s pending fee balance.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPayment} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePayment}
              disabled={isDeletingPayment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs gap-1.5"
            >
              {isDeletingPayment && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isDeletingPayment ? 'Deleting...' : 'Delete Payment'}</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Historical Fee Confirmation Dialog */}
      <AlertDialog
        open={!!deletingHistoricalEnrollment}
        onOpenChange={(open) => {
          if (!open && !isDeletingEnrollment) setDeletingHistoricalEnrollment(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              Delete Previous-Year Fee Record?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
                <p>
                  Are you sure you want to remove this previous-year fee record for{' '}
                  <strong className="text-foreground">{student.fullName}</strong>?
                </p>
                <p className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-destructive font-medium">
                  This will remove this academic year's pending dues from the student's account and adjust total pending fee collections.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingEnrollment} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEnrollment}
              disabled={isDeletingEnrollment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs gap-1.5"
            >
              {isDeletingEnrollment && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isDeletingEnrollment ? 'Deleting...' : 'Delete Fee Record'}</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
