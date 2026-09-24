import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Search,
  Users,
  IndianRupee,
  Clock,
  AlertCircle,
  Eye,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StudentFeeBadge } from './StudentFeeBadge';
import { formatINR } from '@/utils/currency';
import type { Student, StudentEnrollment, StudentMedium } from '@/types/students';
import type { StudentRowData } from './StudentTable';
import { compareAdmissionNumbers } from '@/utils/student-order';

interface ClassStudentListProps {
  className: string;
  medium: StudentMedium;
  rows: StudentRowData[];
  onBack: () => void;
  onSelectStudent: (studentId: string) => void;
  onRecordPayment?: (enrollmentId: string) => void;
  onRecordPreviousPayment?: (row: StudentRowData) => void;
  onEditStudent?: (student: Student, enrollment: StudentEnrollment) => void;
}

type SortField = 'admission' | 'name' | 'current' | 'previous' | 'total';
type SortDirection = 'asc' | 'desc';

export function ClassStudentList({
  className,
  medium,
  rows,
  onBack,
  onSelectStudent,
  onRecordPayment,
  onRecordPreviousPayment,
  onEditStudent,
}: ClassStudentListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('admission');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const isGujarati = medium === 'gujarati';

  // Compute class-level aggregates
  const stats = useMemo(() => {
    let currentPending = 0;
    let previousPending = 0;

    for (const r of rows) {
      const studentCurrentPending = Math.max(0, r.enrollment.annualFeeAmount - r.fees.collected);
      currentPending += studentCurrentPending;
      previousPending += r.previous;
    }

    currentPending = Math.round(currentPending * 100) / 100;
    previousPending = Math.round(previousPending * 100) / 100;
    const totalPending = Math.round((currentPending + previousPending) * 100) / 100;

    return {
      count: rows.length,
      currentPending,
      previousPending,
      totalPending,
    };
  }, [rows]);

  // Filter students within the class
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const matchName = r.student.fullName.toLowerCase().includes(q);
      const matchAdm = (r.student.admissionNumber || '').toLowerCase().includes(q);
      return matchName || matchAdm;
    });
  }, [rows, searchQuery]);

  // Sort students within the class
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let cmp = 0;
      const aCurrent = Math.max(0, a.enrollment.annualFeeAmount - a.fees.collected);
      const bCurrent = Math.max(0, b.enrollment.annualFeeAmount - b.fees.collected);
      switch (sortField) {
        case 'admission':
          cmp = compareAdmissionNumbers(a.student.admissionNumber, b.student.admissionNumber);
          if (cmp === 0) {
            cmp = a.student.fullName.localeCompare(b.student.fullName);
          }
          break;
        case 'name':
          cmp = a.student.fullName.localeCompare(b.student.fullName);
          break;
        case 'current':
          cmp = aCurrent - bCurrent;
          break;
        case 'previous':
          cmp = a.previous - b.previous;
          break;
        case 'total':
          cmp = (aCurrent + a.previous) - (bCurrent + b.previous);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-100" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-1 h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-primary" />
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 1. Breadcrumb and Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border/70 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="h-9 gap-1.5 text-xs font-semibold hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Classes</span>
          </Button>

          {/* Breadcrumb Trail */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-medium">
            <button
              type="button"
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Students
            </button>
            <span className="text-muted-foreground/60">/</span>
            <span
              className={`font-semibold ${
                isGujarati ? 'text-amber-700 dark:text-amber-300' : 'text-sky-700 dark:text-sky-300'
              }`}
            >
              {isGujarati ? 'Gujarati Medium' : 'English Medium'}
            </span>
            <span className="text-muted-foreground/60">/</span>
            <span className="font-bold text-foreground bg-muted px-2 py-0.5 rounded">
              {className}
            </span>
          </nav>
        </div>

        {/* Count Pill */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono-nums">
            Showing <strong className="text-foreground">{filteredRows.length}</strong> of {rows.length} students
          </span>
        </div>
      </div>

      {/* 2. Class Summary Cards (4 Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono-nums">
        <div className="rounded-xl border bg-card p-3.5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Class Strength
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
              {stats.count}
            </p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
            <Users className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-amber-800 dark:text-amber-300">
              This Year Pending
            </p>
            <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-0.5">
              {formatINR(stats.currentPending)}
            </p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-700 dark:text-amber-300">
            <IndianRupee className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3.5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-orange-800 dark:text-orange-300">
              Previous Year Pending
            </p>
            <p className="text-2xl font-bold tracking-tight text-orange-600 dark:text-orange-400 mt-0.5">
              {formatINR(stats.previousPending)}
            </p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-700 dark:text-orange-300">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3.5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-rose-800 dark:text-rose-300">
              Total Class Pending
            </p>
            <p className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-0.5">
              {formatINR(stats.totalPending)}
            </p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* 3. Class Toolbar (Search within class) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border/70 rounded-xl p-3 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${className} students by name or admission number...`}
            className="pl-9 pr-9 h-9 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Student List Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 text-xs">
                {/* Adm No */}
                <TableHead className="w-[120px]">
                  <button
                    type="button"
                    onClick={() => handleSort('admission')}
                    className="group inline-flex items-center text-xs font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none"
                  >
                    <span>Adm No.</span>
                    {getSortIcon('admission')}
                  </button>
                </TableHead>

                {/* Student Name */}
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="group inline-flex items-center text-xs font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none"
                  >
                    <span>Student Name</span>
                    {getSortIcon('name')}
                  </button>
                </TableHead>

                {/* This Year Pending */}
                <TableHead className="w-[140px] text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('current')}
                    className="group inline-flex items-center justify-end w-full text-xs font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none"
                  >
                    <span>This Year Pending</span>
                    {getSortIcon('current')}
                  </button>
                </TableHead>

                {/* Previous Year Pending */}
                <TableHead className="w-[150px] text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('previous')}
                    className="group inline-flex items-center justify-end w-full text-xs font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none"
                  >
                    <span>Previous Year Pending</span>
                    {getSortIcon('previous')}
                  </button>
                </TableHead>

                {/* Total Due */}
                <TableHead className="w-[130px] text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('total')}
                    className="group inline-flex items-center justify-end w-full text-xs font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none"
                  >
                    <span>Total Due</span>
                    {getSortIcon('total')}
                  </button>
                </TableHead>

                {/* Status */}
                <TableHead className="w-[110px] text-center">Status</TableHead>

                {/* Actions */}
                <TableHead className="w-[100px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y font-mono-nums">
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground text-xs font-sans">
                    {searchQuery ? `No students found matching "${searchQuery}"` : 'No students found in this class.'}
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row) => {
                  const { student, enrollment, fees, previous } = row;
                  const studentCurrentPending = Math.max(0, enrollment.annualFeeAmount - fees.collected);
                  const totalStudentDue = studentCurrentPending + previous;

                  return (
                    <TableRow
                      key={enrollment.id}
                      onClick={() => onSelectStudent(student.id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectStudent(student.id);
                        }
                      }}
                      className="group cursor-pointer hover:bg-muted/40 transition-colors focus-within:bg-muted/40"
                    >
                      {/* Adm No */}
                      <TableCell className="py-3 font-mono text-xs text-muted-foreground">
                        {student.admissionNumber || '—'}
                      </TableCell>

                      {/* Student Name */}
                      <TableCell className="py-3">
                        <span className="font-sans font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                          {student.fullName}
                        </span>
                      </TableCell>

                      {/* This Year Pending */}
                      <TableCell className="py-3 text-right">
                        {studentCurrentPending > 0 ? (
                          <span className="font-bold text-xs text-amber-600 dark:text-amber-400">
                            {formatINR(studentCurrentPending)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>

                      {/* Previous Year Pending */}
                      <TableCell className="py-3 text-right">
                        {previous > 0 ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-bold text-xs text-orange-600 dark:text-orange-400">
                              {formatINR(previous)}
                            </span>
                            <span className="rounded bg-orange-500/15 px-1 py-0.2 text-[9px] font-bold text-orange-700 dark:text-orange-300 uppercase">
                              Old Dues
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>

                      {/* Total Due */}
                      <TableCell className="py-3 text-right font-bold text-xs">
                        {totalStudentDue > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            {formatINR(totalStudentDue)}
                          </span>
                        ) : (
                          <span className="text-income font-medium">Paid</span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3 text-center">
                        <StudentFeeBadge
                          status={
                            totalStudentDue <= 0.005
                              ? 'paid'
                              : fees.collected > 0.005
                              ? 'partially_paid'
                              : 'not_paid'
                          }
                          size="sm"
                        />
                      </TableCell>

                      {/* Actions */}
                      <TableCell
                        className="py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {previous > 0 && onRecordPreviousPayment && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onRecordPreviousPayment(row)}
                              className="h-7 px-2 text-xs gap-1 border-warning/40 text-warning hover:bg-warning/10 font-medium"
                            >
                              <Clock className="h-3.5 w-3.5" />
                              <span>Record Previous-Year Payment</span>
                            </Button>
                          )}

                          {onRecordPayment && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onRecordPayment(enrollment.id)}
                              className="h-7 px-2 text-xs gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-medium"
                              aria-label={`Record Payment for ${student.fullName}`}
                            >
                              <IndianRupee className="h-3.5 w-3.5" />
                              <span>Record Payment</span>
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSelectStudent(student.id)}
                            className="h-7 px-2 text-xs gap-1 hover:bg-muted text-primary"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>View</span>
                          </Button>

                          {(onRecordPayment || onRecordPreviousPayment || onEditStudent) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  aria-label={`Actions for ${student.fullName}`}
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44 text-xs">
                                <DropdownMenuItem
                                  onClick={() => onSelectStudent(student.id)}
                                  className="gap-2 cursor-pointer"
                                >
                                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>View Profile</span>
                                </DropdownMenuItem>
                                {onRecordPayment && (
                                  <DropdownMenuItem
                                    onClick={() => onRecordPayment(enrollment.id)}
                                    className="gap-2 cursor-pointer text-income focus:text-income"
                                  >
                                    <IndianRupee className="h-3.5 w-3.5" />
                                    <span>Record Payment</span>
                                  </DropdownMenuItem>
                                )}
                                {previous > 0 && onRecordPreviousPayment && (
                                  <DropdownMenuItem
                                    onClick={() => onRecordPreviousPayment(row)}
                                    className="gap-2 cursor-pointer text-warning focus:text-warning"
                                  >
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>Record Previous Payment</span>
                                  </DropdownMenuItem>
                                )}
                                {onEditStudent && (
                                  <DropdownMenuItem
                                    onClick={() => onEditStudent(student, enrollment)}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <span>Edit Student</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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
    </div>
  );
}
