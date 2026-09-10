import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  IndianRupee,
  MoreVertical,
  Archive,
  Calendar,
  AlertTriangle,
  History,
  FileText,
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
import { toast } from '@/hooks/use-toast';

export default function StudentDetailPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { students, enrollments, archiveStudent, deleteEnrollment } = useStudentStore();
  const { currentYearId, academicYears, incomeEntries, accounts, deleteIncome } = useFinanceStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'previous-years'>('overview');
  const [paymentEnrollmentId, setPaymentEnrollmentId] = useState<string | undefined>(undefined);
  const [editingIncomeEntry, setEditingIncomeEntry] = useState<IncomeEntry | null>(null);
  const [deletingIncomeEntry, setDeletingIncomeEntry] = useState<IncomeEntry | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [editingHistoricalEnrollment, setEditingHistoricalEnrollment] = useState<StudentEnrollment | null>(null);
  const [deletingHistoricalEnrollment, setDeletingHistoricalEnrollment] = useState<StudentEnrollment | null>(null);
  const [isDeletingEnrollment, setIsDeletingEnrollment] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoricalModal, setShowHistoricalModal] = useState(false);
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

  // Historical enrollments (all except current)
  const historicalEnrollments = useMemo(() => {
    if (!current) return [];
    return studentEnrollments
      .filter((item) => item.id !== current.id)
      .map((enrollment) => ({
        enrollment,
        year: academicYears.find((y) => y.id === enrollment.academicYearId),
        summary: getStudentFeeSummary(enrollment, incomeEntries),
      }));
  }, [studentEnrollments, current, academicYears, incomeEntries]);

  // Current year fee summary
  const currentSummary = useMemo(() => {
    if (!current) return null;
    return getStudentFeeSummary(current, incomeEntries);
  }, [current, incomeEntries]);

  const currentYear = useMemo(() => {
    if (!current) return null;
    return academicYears.find((y) => y.id === current.academicYearId);
  }, [current, academicYears]);

  // Total previous-year pending dues
  const totalPreviousPending = useMemo(() => {
    if (!student || !current) return 0;
    return getStudentPreviousPending(student.id, current.academicYearId, enrollments, incomeEntries);
  }, [student, current, enrollments, incomeEntries]);

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

      {/* 3-Tab Information Architecture: Overview | Payments | Previous Years */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md h-9">
          <TabsTrigger value="overview" onPointerDown={() => setActiveTab('overview')} onClick={() => setActiveTab('overview')} className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="payments" onPointerDown={() => setActiveTab('payments')} onClick={() => setActiveTab('payments')} className="text-xs">
            Payments {payments.length > 0 && `(${payments.length})`}
          </TabsTrigger>
          <TabsTrigger value="previous-years" onPointerDown={() => setActiveTab('previous-years')} onClick={() => setActiveTab('previous-years')} className="text-xs">
            Previous Years {historicalEnrollments.length > 0 && `(${historicalEnrollments.length})`}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview" className="space-y-4 outline-none">
          {/* Previous-Year Warning Callout if dues exist */}
          {totalPreviousPending > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/20 text-warning shrink-0">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Last Year's Pending Fees:{' '}
                    <span className="font-mono text-warning">{formatINR(totalPreviousPending)}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    This student has unpaid balances carried forward from previous academic years.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveTab('previous-years')}
                className="h-8 text-xs border-warning/30 hover:bg-warning/20 shrink-0 self-start sm:self-auto"
              >
                View Previous Years
              </Button>
            </div>
          )}

          {/* Current Fee Account Card */}
          <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Current Fee Account</p>
                <h2 className="text-sm font-semibold text-foreground mt-0.5">
                  Academic Year {currentYear?.label || '—'}
                </h2>
              </div>
              <StudentFeeBadge status={currentSummary.status} />
            </div>

            {/* Main Financial Numbers: Obligation | Collected | Pending */}
            <div className="grid grid-cols-3 gap-3 sm:gap-6 font-mono-nums">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Obligation</p>
                <p className="money-fit mt-1 font-mono text-lg sm:text-2xl font-bold text-foreground">
                  {formatINR(currentSummary.obligation)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">
                  Annual: {formatINR(current.annualFeeAmount)}
                  {current.additionalOutstandingAmount > 0 && ` + Last Year's Pending: ${formatINR(current.additionalOutstandingAmount)}`}
                </p>
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Collected</p>
                <p className="money-fit mt-1 font-mono text-lg sm:text-2xl font-bold text-income">
                  {formatINR(currentSummary.collected)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">
                  {Math.round(currentSummary.collectionPercent)}% of fee paid
                </p>
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Current Pending</p>
                <p className={`money-fit mt-1 font-mono text-lg sm:text-2xl font-bold ${currentSummary.pending > 0 ? 'text-warning' : 'text-income'}`}>
                  {currentSummary.pending > 0 ? formatINR(currentSummary.pending) : '₹0 (Clear)'}
                </p>
                {currentSummary.pending <= 0 && (
                  <p className="text-[11px] text-income mt-0.5 font-sans flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 inline" /> Fully settled
                  </p>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                <span>Payment Progress</span>
                <span>{Math.round(currentSummary.collectionPercent)}%</span>
              </div>
              <Progress value={currentSummary.collectionPercent} className="h-2" />
            </div>

            {/* Supporting Payment Method Breakdown */}
            <div className="border-t pt-3.5">
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
              <Button
                size="sm"
                onClick={() => setPaymentEnrollmentId(current.id)}
                className="h-8 text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Record Payment</span>
              </Button>
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
                                  ? 'border-warning/30 bg-warning/10 text-warning text-[10px]'
                                  : 'border-primary/20 bg-primary/5 text-primary text-[10px]'
                              }
                            >
                              {entry.isLateCollection
                                ? `Previous Year (AY ${year?.label || '—'})`
                                : `Current Year (AY ${year?.label || '—'})`}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 capitalize text-muted-foreground">
                            {entry.paymentMethod ? entry.paymentMethod.replace('_', ' ') : 'Cash'}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {account?.name || 'School Bank'}
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

        {/* TAB 3: PREVIOUS YEARS */}
        <TabsContent value="previous-years" className="space-y-4 outline-none">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Historical Academic Years
              </h2>
              <p className="text-xs text-muted-foreground">
                Fee obligations, collections, and dues from previous enrollment years
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingHistoricalEnrollment(null);
                setShowHistoricalModal(true);
              }}
              className="text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Previous-Year Fee</span>
            </Button>
          </div>

          {historicalEnrollments.length > 0 ? (
            <div className="space-y-3">
              {historicalEnrollments.map(({ enrollment, year, summary }) => (
                <div
                  key={enrollment.id}
                  className="rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        Academic Year {year?.label || '—'}
                      </span>
                      <StudentFeeBadge status={summary.status} size="sm" />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Class: {enrollment.className}</span>
                      <span>·</span>
                      <StudentMediumBadge medium={enrollment.medium} size="xs" variant="compact" />
                    </div>
                    <div className="flex flex-wrap gap-3 font-mono text-xs pt-1">
                      <span className="text-muted-foreground">
                        Obligation: <strong className="text-foreground">{formatINR(summary.obligation)}</strong>
                      </span>
                      <span className="text-muted-foreground">
                        Collected: <strong className="text-income">{formatINR(summary.collected)}</strong>
                      </span>
                      <span className="text-muted-foreground">
                        Pending:{' '}
                        <strong className={summary.pending > 0 ? 'text-warning' : 'text-income'}>
                          {summary.pending > 0 ? formatINR(summary.pending) : '₹0'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                    {summary.pending > 0 && (
                      <Button
                        size="sm"
                        onClick={() => setPaymentEnrollmentId(enrollment.id)}
                        className="text-xs gap-1.5"
                      >
                        <IndianRupee className="h-3.5 w-3.5" />
                        <span>Record Past Payment</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setEditingHistoricalEnrollment(enrollment);
                        setShowHistoricalModal(true);
                      }}
                      title="Edit fee record"
                      aria-label="Edit fee record"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {summary.collected <= 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingHistoricalEnrollment(enrollment)}
                        title="Delete fee record"
                        aria-label="Delete fee record"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-card p-8 text-center space-y-2 text-xs text-muted-foreground">
              <Calendar className="mx-auto h-8 w-8 opacity-30" />
              <p className="font-medium text-foreground">No historical fee records</p>
              <p>This student currently has only their active enrollment year on record.</p>
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingHistoricalEnrollment(null);
                    setShowHistoricalModal(true);
                  }}
                  className="text-xs gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Previous-Year Fee Record</span>
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Record or Edit Fee Payment Modal */}
      <AddIncomeModal
        isOpen={!!paymentEnrollmentId || !!editingIncomeEntry}
        onClose={() => {
          setPaymentEnrollmentId(undefined);
          setEditingIncomeEntry(null);
        }}
        presetStudentEnrollmentId={paymentEnrollmentId || editingIncomeEntry?.studentEnrollmentId || undefined}
        editEntry={editingIncomeEntry || undefined}
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
